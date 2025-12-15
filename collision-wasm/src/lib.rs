use wasm_bindgen::prelude::*;
use std::collections::HashSet;

// Initialize WASM panic hook
#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub struct CollisionState {
    proj_buffer: Vec<f64>,
    enemy_buffer: Vec<f64>,
    ship_buffer: Vec<f64>,
    mod_buffer: Vec<f64>,
    powerup_buffer: Vec<f64>,
    star_buffer: Vec<f64>,
    
    // Results
    projectile_hits: Vec<u32>,     // Indices of projectiles to remove
    enemy_hits: Vec<f64>,          // Pairs of [enemy_index, damage] flattened
    ship_hit: bool,
    ship_damage: f64,
    powerup_collected: Vec<u32>,   // Indices of powerups collected
    modulestar_collected: Vec<u32>, // Indices of stars collected
}

#[wasm_bindgen]
impl CollisionState {
    #[wasm_bindgen(constructor)]
    pub fn new() -> CollisionState {
        CollisionState {
            proj_buffer: Vec::with_capacity(2000),
            enemy_buffer: Vec::with_capacity(1000),
            ship_buffer: vec![0.0; 3],
            mod_buffer: Vec::with_capacity(300),
            powerup_buffer: Vec::with_capacity(300),
            star_buffer: Vec::with_capacity(300),
            projectile_hits: Vec::with_capacity(100),
            enemy_hits: Vec::with_capacity(100),
            ship_hit: false,
            ship_damage: 0.0,
            powerup_collected: Vec::with_capacity(20),
            modulestar_collected: Vec::with_capacity(20),
        }
    }

    // Buffer management methods
    pub fn get_proj_buffer_ptr(&self) -> *const f64 { self.proj_buffer.as_ptr() }
    pub fn ensure_proj_buffer_size(&mut self, size: usize) { 
        if self.proj_buffer.len() < size { self.proj_buffer.resize(size, 0.0); } 
    }

    pub fn get_enemy_buffer_ptr(&self) -> *const f64 { self.enemy_buffer.as_ptr() }
    pub fn ensure_enemy_buffer_size(&mut self, size: usize) { 
        if self.enemy_buffer.len() < size { self.enemy_buffer.resize(size, 0.0); } 
    }

    pub fn get_ship_buffer_ptr(&self) -> *const f64 { self.ship_buffer.as_ptr() }
    // Ship buffer is fixed size 3

    pub fn get_mod_buffer_ptr(&self) -> *const f64 { self.mod_buffer.as_ptr() }
    pub fn ensure_mod_buffer_size(&mut self, size: usize) { 
        if self.mod_buffer.len() < size { self.mod_buffer.resize(size, 0.0); } 
    }

    pub fn get_powerup_buffer_ptr(&self) -> *const f64 { self.powerup_buffer.as_ptr() }
    pub fn ensure_powerup_buffer_size(&mut self, size: usize) { 
        if self.powerup_buffer.len() < size { self.powerup_buffer.resize(size, 0.0); } 
    }

    pub fn get_star_buffer_ptr(&self) -> *const f64 { self.star_buffer.as_ptr() }
    pub fn ensure_star_buffer_size(&mut self, size: usize) { 
        if self.star_buffer.len() < size { self.star_buffer.resize(size, 0.0); } 
    }

    // Result accessors
    pub fn get_projectile_hits_ptr(&self) -> *const u32 { self.projectile_hits.as_ptr() }
    pub fn get_projectile_hits_len(&self) -> usize { self.projectile_hits.len() }

    pub fn get_enemy_hits_ptr(&self) -> *const f64 { self.enemy_hits.as_ptr() }
    pub fn get_enemy_hits_len(&self) -> usize { self.enemy_hits.len() }

    pub fn get_ship_hit(&self) -> bool { self.ship_hit }
    pub fn get_ship_damage(&self) -> f64 { self.ship_damage }

    pub fn get_powerup_collected_ptr(&self) -> *const u32 { self.powerup_collected.as_ptr() }
    pub fn get_powerup_collected_len(&self) -> usize { self.powerup_collected.len() }

    pub fn get_modulestar_collected_ptr(&self) -> *const u32 { self.modulestar_collected.as_ptr() }
    pub fn get_modulestar_collected_len(&self) -> usize { self.modulestar_collected.len() }

    // Main collision detection function - called from JavaScript
    pub fn check_collisions_shared(
        &mut self,
        num_projs: usize,
        num_enemies: usize,
        num_modules: usize,
        num_powerups: usize,
        num_stars: usize,
        shield_active: bool,
    ) {
        // Clear previous results
        self.projectile_hits.clear();
        self.enemy_hits.clear();
        self.ship_hit = false;
        self.ship_damage = 0.0;
        self.powerup_collected.clear();
        self.modulestar_collected.clear();

        // Parse Ship data
        let ship_x = self.ship_buffer[0];
        let ship_y = self.ship_buffer[1];
        let ship_radius = self.ship_buffer[2];

        // Track removed projectiles to avoid double-processing
        let mut removed_projs = HashSet::new();

        // 1. Player/Module/Zombie Projectiles vs Enemies
        for i in 0..num_projs {
            if removed_projs.contains(&i) { continue; }
            
            let p_offset = i * 5;
            let p_type = self.proj_buffer[p_offset + 4] as i32;

            // Type 0=player, 1=module, 2=zombie projectiles hit enemies
            if p_type == 0 || p_type == 1 || p_type == 2 {
                let px = self.proj_buffer[p_offset];
                let py = self.proj_buffer[p_offset + 1];
                let pr = self.proj_buffer[p_offset + 2];
                let p_damage = self.proj_buffer[p_offset + 3];

                for j in 0..num_enemies {
                    let e_offset = j * 4;
                    let is_zombie = self.enemy_buffer[e_offset + 3] > 0.5;

                    // Zombie projectiles don't hit zombies
                    if p_type == 2 && is_zombie { continue; }

                    let ex = self.enemy_buffer[e_offset];
                    let ey = self.enemy_buffer[e_offset + 1];
                    let er = self.enemy_buffer[e_offset + 2];

                    let dist_sq = distance_squared(px, py, ex, ey);
                    let radius_sum = pr + er;

                    if dist_sq < radius_sum * radius_sum {
                        self.projectile_hits.push(i as u32);
                        removed_projs.insert(i);
                        
                        self.enemy_hits.push(j as f64);
                        self.enemy_hits.push(p_damage);
                        
                        break;
                    }
                }
            }
        }

        // 2. Enemy Projectiles vs Ship/Modules/Zombies
        for i in 0..num_projs {
            if removed_projs.contains(&i) { continue; }
            
            let p_offset = i * 5;
            let p_type = self.proj_buffer[p_offset + 4] as i32;

            if p_type == 3 { // Enemy projectile
                let px = self.proj_buffer[p_offset];
                let py = self.proj_buffer[p_offset + 1];
                let pr = self.proj_buffer[p_offset + 2];
                let p_damage = self.proj_buffer[p_offset + 3];
                
                let mut hit = false;

                // Check Ship collision
                let dist_sq_ship = distance_squared(px, py, ship_x, ship_y);
                let r_sum_ship = pr + ship_radius;
                
                if dist_sq_ship < r_sum_ship * r_sum_ship {
                    if !shield_active {
                        self.ship_hit = true;
                        self.ship_damage += p_damage;
                    }
                    self.projectile_hits.push(i as u32);
                    removed_projs.insert(i);
                    hit = true;
                }

                // Check Module collisions (if not already hit)
                if !hit {
                    for m in 0..num_modules {
                        let m_offset = m * 3;
                        let mx = self.mod_buffer[m_offset];
                        let my = self.mod_buffer[m_offset + 1];
                        let mr = self.mod_buffer[m_offset + 2];

                        let dist_sq_mod = distance_squared(px, py, mx, my);
                        let r_sum_mod = pr + mr;
                        
                        if dist_sq_mod < r_sum_mod * r_sum_mod {
                            self.projectile_hits.push(i as u32);
                            removed_projs.insert(i);
                            hit = true;
                            break;
                        }
                    }
                }

                // Check Zombie collisions (if not already hit)
                if !hit {
                    for j in 0..num_enemies {
                        let e_offset = j * 4;
                        let is_zombie = self.enemy_buffer[e_offset + 3] > 0.5;
                        
                        if !is_zombie { continue; }
                        
                        let ex = self.enemy_buffer[e_offset];
                        let ey = self.enemy_buffer[e_offset + 1];
                        let er = self.enemy_buffer[e_offset + 2];
                        
                        let dist_sq_z = distance_squared(px, py, ex, ey);
                        let r_sum_z = pr + er;
                        
                        if dist_sq_z < r_sum_z * r_sum_z {
                            self.projectile_hits.push(i as u32);
                            removed_projs.insert(i);
                            
                            self.enemy_hits.push(j as f64);
                            self.enemy_hits.push(p_damage);
                            
                            hit = true;
                            break;
                        }
                    }
                }
            }
        }

        // 3. PowerUp Collection by Ship
        for i in 0..num_powerups {
            let offset = i * 3;
            let px = self.powerup_buffer[offset];
            let py = self.powerup_buffer[offset + 1];
            let pr = self.powerup_buffer[offset + 2];

            let dist_sq = distance_squared(ship_x, ship_y, px, py);
            let r_sum = ship_radius + pr;
            
            if dist_sq < r_sum * r_sum {
                self.powerup_collected.push(i as u32);
            }
        }

        // 4. ModuleStar Collection by Ship
        for i in 0..num_stars {
            let offset = i * 3;
            let sx = self.star_buffer[offset];
            let sy = self.star_buffer[offset + 1];
            let sr = self.star_buffer[offset + 2];

            let dist_sq = distance_squared(ship_x, ship_y, sx, sy);
            let r_sum = ship_radius + sr;
            
            if dist_sq < r_sum * r_sum {
                self.modulestar_collected.push(i as u32);
            }
        }
    }
}

// Helper function for distance squared calculation
#[inline]
fn distance_squared(x1: f64, y1: f64, x2: f64, y2: f64) -> f64 {
    let dx = x1 - x2;
    let dy = y1 - y2;
    dx * dx + dy * dy
}



