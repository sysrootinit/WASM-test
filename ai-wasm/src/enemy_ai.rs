// Enemy AI behaviors - complete port from JavaScript to Rust
use crate::types::*;
use crate::grid::*;

// Random number generation using js_sys
fn random() -> f64 {
    js_sys::Math::random()
}

pub fn update_single_enemy(
    mut enemy: EnemyState,
    ship_x: f64,
    ship_y: f64,
    ship_radius: f64,
    module_data: &[f64],
    projectile_data: &[f64],
    enemy_data: &[f64],
    canvas_width: f64,
    canvas_height: f64,
    shield_active: bool,
) -> EnemyState {
    // Zombie lifetime countdown
    if enemy.is_zombie {
        enemy.zombie_lifetime -= 1.0;
        if enemy.zombie_lifetime <= 0.0 {
            enemy.hp = 0.0;
            return enemy;
        }
    }

    match enemy.enemy_type {
        EnemyType::Basic => update_basic(&mut enemy),
        EnemyType::Elite => update_elite(&mut enemy, ship_x, ship_y, enemy_data),
        EnemyType::Rammer => update_rammer(&mut enemy, ship_x, ship_y, ship_radius, projectile_data, enemy_data, canvas_width, canvas_height, shield_active),
        EnemyType::Exploder => update_exploder(&mut enemy, ship_x, ship_y, ship_radius, module_data, enemy_data, canvas_width, canvas_height, shield_active),
    }

    // Boundary adjustments for non-rammer and non-exploder
    if enemy.enemy_type != EnemyType::Rammer && enemy.enemy_type != EnemyType::Exploder {
        if enemy.x < enemy.radius || enemy.x > canvas_width - enemy.radius {
            enemy.angle = std::f64::consts::PI - enemy.angle;
        }
        if enemy.y < enemy.radius || enemy.y > canvas_height - enemy.radius {
            enemy.angle = -enemy.angle;
        }
    }

    // Boundary adjust for exploder
    if enemy.enemy_type == EnemyType::Exploder {
        enemy.x = clamp(enemy.x, enemy.radius, canvas_width - enemy.radius);
        enemy.y = clamp(enemy.y, enemy.radius, canvas_height - enemy.radius);
    }

    // Update shoot cooldown
    if enemy.shoot_cooldown > 0.0 {
        enemy.shoot_cooldown -= 1.0;
    }

    enemy
}

fn update_basic(enemy: &mut EnemyState) {
    enemy.angle += 0.02;
    enemy.x += enemy.angle.cos() * enemy.radius * 0.133; // speed=2 for radius=15
    enemy.y += enemy.angle.sin() * enemy.radius * 0.133;
}

fn update_elite(enemy: &mut EnemyState, ship_x: f64, ship_y: f64, enemy_data: &[f64]) {
    let (target_x, target_y) = if enemy.is_zombie {
        find_nearest_hostile(enemy.x, enemy.y, enemy_data)
            .unwrap_or((ship_x, ship_y))
    } else {
        (ship_x, ship_y)
    };

    let dx = target_x - enemy.x;
    let dy = target_y - enemy.y;
    let dist = hypot(dx, dy);

    if dist > 200.0 {
        let speed = enemy.radius * 0.04; // speed=1 for radius=25
        enemy.x += (dx / dist) * speed;
        enemy.y += (dy / dist) * speed;
    }
}

fn update_rammer(
    enemy: &mut EnemyState,
    ship_x: f64,
    ship_y: f64,
    ship_radius: f64,
    projectile_data: &[f64],
    enemy_data: &[f64],
    canvas_width: f64,
    canvas_height: f64,
    shield_active: bool,
) {
    // Decrease cooldowns
    if enemy.hit_cooldown > 0.0 {
        enemy.hit_cooldown -= 1.0;
    }
    if enemy.charge_cooldown > 0.0 {
        enemy.charge_cooldown -= 1.0;
    }
    if enemy.charge_frames > 0.0 {
        enemy.charge_frames -= 1.0;
    }
    if enemy.bounce_boost_frames > 0.0 {
        enemy.bounce_boost_frames -= 1.0;
    }

    // Forward vector
    let mut fvx = enemy.vx;
    let mut fvy = enemy.vy;
    if fvx.abs() + fvy.abs() < 0.001 {
        fvx = 1.0;
        fvy = 0.0;
    }
    let fl = hypot(fvx, fvy).max(1.0);
    let mut fx = fvx / fl;
    let mut fy = fvy / fl;

    // Target selection
    let (target_x, target_y) = if enemy.is_zombie {
        find_nearest_hostile(enemy.x, enemy.y, enemy_data)
            .unwrap_or((enemy.x, enemy.y))
    } else {
        // Predictive targeting
        let predict_factor = 1.4;
        (ship_x * predict_factor, ship_y * predict_factor)
    };

    let mut dx = target_x - enemy.x;
    let mut dy = target_y - enemy.y;
    let dl = hypot(dx, dy).max(1.0);
    dx /= dl;
    dy /= dl;

    let dist_to_ship = hypot(ship_x - enemy.x, ship_y - enemy.y);

    // Dodge incoming projectiles
    let num_proj = projectile_data.len() / 5;
    for i in 0..num_proj {
        let offset = i * 5;
        let proj_type = projectile_data[offset + 4] as i32;
        // Type 0=player, 1=module
        if proj_type == 0 || proj_type == 1 {
            let px = projectile_data[offset];
            let py = projectile_data[offset + 1];
            let pvx = projectile_data[offset + 2];
            let pvy = projectile_data[offset + 3];

            let pdx = px - enemy.x;
            let pdy = py - enemy.y;
            let pdist = hypot(pdx, pdy);

            if pdist < RammerConfig::DODGE_DIST && dist_to_ship >= RammerConfig::ORBIT_BREAK_RADIUS {
                let pvlen = hypot(pvx, pvy).max(1.0);
                let pvx_norm = pvx / pvlen;
                let pvy_norm = pvy / pvlen;
                let approach = pdx * pvx_norm + pdy * pvy_norm;

                if approach < 80.0 {
                    let perp_x = -pvx_norm;
                    let perp_y = -pvy_norm;
                    enemy.vx += perp_x * RammerConfig::DODGE_FORCE;
                    enemy.vy += perp_y * RammerConfig::DODGE_FORCE;
                }
            }
        }
    }

    // Steering
    let steer = RammerConfig::STEER;
    let mut dirx = fx * (1.0 - steer) + dx * steer;
    let mut diry = fy * (1.0 - steer) + dy * steer;
    let dl2 = hypot(dirx, diry).max(1.0);
    dirx /= dl2;
    diry /= dl2;

    // Charge behavior
    if enemy.charge_frames > 0.0 {
        enemy.vx += dirx * (RammerConfig::THRUST * 1.8);
        enemy.vy += diry * (RammerConfig::THRUST * 1.8);
        enemy.bounce_boost_frames = enemy.bounce_boost_frames.max(RammerConfig::CHARGE_FRAMES);
    } else {
        enemy.vx += dirx * RammerConfig::THRUST;
        enemy.vy += diry * RammerConfig::THRUST;

        if enemy.charge_cooldown <= 0.0 && dist_to_ship < RammerConfig::CHARGE_DIST && random() < RammerConfig::CHARGE_PROB {
            enemy.charge_frames = RammerConfig::CHARGE_FRAMES;
            enemy.charge_cooldown = 220.0 + random() * 120.0;
            enemy.vx += dirx * RammerConfig::CHARGE_SPEED_BONUS;
            enemy.vy += diry * RammerConfig::CHARGE_SPEED_BONUS;
        }
    }

    // Anti-orbit logic
    if dist_to_ship < RammerConfig::ORBIT_BREAK_RADIUS {
        let nx = (ship_x - enemy.x) / dist_to_ship.max(1.0);
        let ny = (ship_y - enemy.y) / dist_to_ship.max(1.0);
        let vdotn = enemy.vx * nx + enemy.vy * ny;
        let vrx = nx * vdotn;
        let vry = ny * vdotn;
        let vtx = enemy.vx - vrx;
        let vty = enemy.vy - vry;
        enemy.vx = vrx + vtx * RammerConfig::ORBIT_TANGENT_DAMP;
        enemy.vy = vry + vty * RammerConfig::ORBIT_TANGENT_DAMP;
        enemy.vx += nx * 0.8;
        enemy.vy += ny * 0.8;

        dirx = dirx * (1.0 - RammerConfig::CLOSE_STEER) + nx * RammerConfig::CLOSE_STEER;
        diry = diry * (1.0 - RammerConfig::CLOSE_STEER) + ny * RammerConfig::CLOSE_STEER;
        let ndl = hypot(dirx, diry).max(1.0);
        dirx /= ndl;
        diry /= ndl;
    }

    // Velocity damping and clamping
    enemy.vx *= RammerConfig::DAMP;
    enemy.vy *= RammerConfig::DAMP;
    let v = hypot(enemy.vx, enemy.vy);
    let max_v = if enemy.bounce_boost_frames > 0.0 || enemy.charge_frames > 0.0 {
        RammerConfig::BOOST_MAX
    } else {
        RammerConfig::BASE_MAX
    };

    if v > max_v {
        enemy.vx = enemy.vx / v * max_v;
        enemy.vy = enemy.vy / v * max_v;
    }

    // Ensure minimal forward speed when engaging
    if dist_to_ship < 220.0 {
        let v2 = hypot(enemy.vx, enemy.vy);
        if v2 < RammerConfig::MIN_FWD {
            enemy.vx += dirx * (RammerConfig::MIN_FWD - v2);
            enemy.vy += diry * (RammerConfig::MIN_FWD - v2);
        }
    }

    // Apply velocity
    enemy.x += enemy.vx;
    enemy.y += enemy.vy;

    // Boundary bounce with HP damage
    handle_boundary_bounce(enemy, canvas_width, canvas_height);

    // Shield repel (not fully implemented in WASM - would require game state modification)
    // Note: Complex interactions like shield repel are better handled in JS for now

    // Note: Ship and enemy collisions are better handled in the main collision detection system
}

fn update_exploder(
    enemy: &mut EnemyState,
    ship_x: f64,
    ship_y: f64,
    ship_radius: f64,
    module_data: &[f64],
    enemy_data: &[f64],
    canvas_width: f64,
    canvas_height: f64,
    shield_active: bool,
) {
    enemy.pulse_phase += 0.1;

    let (target_x, target_y) = if enemy.is_zombie {
        match find_nearest_hostile(enemy.x, enemy.y, enemy_data) {
            Some((x, y)) => (x, y),
            None => return, // No enemies to chase
        }
    } else {
        (ship_x, ship_y)
    };

    let dx = target_x - enemy.x;
    let dy = target_y - enemy.y;
    let dist = hypot(dx, dy);

    if dist > 0.0 {
        let speed = enemy.radius * 0.0145; // speed=0.8 for radius=55
        enemy.x += (dx / dist) * speed;
        enemy.y += (dy / dist) * speed;
    }

    // Note: Explosion logic on contact is better handled in main game loop
    // as it requires particle creation and game state modification
}

fn handle_boundary_bounce(enemy: &mut EnemyState, canvas_width: f64, canvas_height: f64) {
    let mut bounced = false;

    if enemy.x < enemy.radius {
        enemy.x = enemy.radius;
        enemy.vx = -enemy.vx * RammerConfig::REST;
        bounced = true;
    }
    if enemy.x > canvas_width - enemy.radius {
        enemy.x = canvas_width - enemy.radius;
        enemy.vx = -enemy.vx * RammerConfig::REST;
        bounced = true;
    }
    if enemy.y < enemy.radius {
        enemy.y = enemy.radius;
        enemy.vy = -enemy.vy * RammerConfig::REST;
        bounced = true;
    }
    if enemy.y > canvas_height - enemy.radius {
        enemy.y = canvas_height - enemy.radius;
        enemy.vy = -enemy.vy * RammerConfig::REST;
        bounced = true;
    }

    if bounced {
        enemy.bounce_boost_frames = RammerConfig::BOOST_FRAMES;
        enemy.hit_cooldown = RammerConfig::HIT_CD;
        clamp_velocity(enemy);
        // HP damage would be applied in JS
    }
}

fn clamp_velocity(enemy: &mut EnemyState) {
    let v = hypot(enemy.vx, enemy.vy);
    let cap = RammerConfig::BOOST_MAX;
    if v > cap {
        enemy.vx = enemy.vx / v * cap;
        enemy.vy = enemy.vy / v * cap;
    }
}

// Find nearest non-zombie enemy for zombie targeting
fn find_nearest_hostile(x: f64, y: f64, enemy_data: &[f64]) -> Option<(f64, f64)> {
    let num_enemies = enemy_data.len() / ENEMY_STRIDE;
    let mut best_dist_sq = f64::INFINITY;
    let mut result = None;

    for i in 0..num_enemies {
        let offset = i * ENEMY_STRIDE;
        let ex = enemy_data[offset];
        let ey = enemy_data[offset + 1];
        let is_zombie = enemy_data[offset + 5] > 0.5;

        if !is_zombie {
            let dx = ex - x;
            let dy = ey - y;
            let dist_sq = dx * dx + dy * dy;

            if dist_sq < best_dist_sq {
                best_dist_sq = dist_sq;
                result = Some((ex, ey));
            }
        }
    }

    result
}
