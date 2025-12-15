use wasm_bindgen::prelude::*;

// Initialize WASM panic hook for better error messages
#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

// Particle data layout: [x, y, vx, vy, life, hue] (6 floats per particle)
const PARTICLE_STRIDE: usize = 6;
const DAMPING: f64 = 0.95;

/// Update particles and return only alive ones
/// Input: flat array [x, y, vx, vy, life, hue, x, y, vx, vy, life, hue, ...]
/// Output: flat array of alive particles in the same format
#[wasm_bindgen]
pub fn update_particles(particle_data: &[f64]) -> Vec<f64> {
    let count = particle_data.len() / PARTICLE_STRIDE;
    let mut alive_particles = Vec::with_capacity(count * PARTICLE_STRIDE);
    
    for i in 0..count {
        let offset = i * PARTICLE_STRIDE;
        
        // Read particle data
        let mut x = particle_data[offset];
        let mut y = particle_data[offset + 1];
        let mut vx = particle_data[offset + 2];
        let mut vy = particle_data[offset + 3];
        let mut life = particle_data[offset + 4];
        let hue = particle_data[offset + 5];
        
        // Skip dead particles
        if life <= 0.0 {
            continue;
        }
        
        // Update position
        x += vx;
        y += vy;
        
        // Apply damping to velocity
        vx *= DAMPING;
        vy *= DAMPING;
        
        // Decrease life
        life -= 1.0;
        
        // Only keep if still alive after update
        if life > 0.0 {
            alive_particles.push(x);
            alive_particles.push(y);
            alive_particles.push(vx);
            alive_particles.push(vy);
            alive_particles.push(life);
            alive_particles.push(hue);
        }
    }
    
    alive_particles
}

/// Create explosion particles
/// Returns flat array of particle data
#[wasm_bindgen]
pub fn create_explosion_particles(
    x: f64,
    y: f64,
    count: usize,
    is_zombie: bool,
) -> Vec<f64> {
    let mut particles = Vec::with_capacity(count * PARTICLE_STRIDE);
    
    for _ in 0..count {
        // Random velocity
        let vx = (js_sys::Math::random() - 0.5) * 10.0;
        let vy = (js_sys::Math::random() - 0.5) * 10.0;
        
        // Color: zombie = green (100-140 hue), normal = red-yellow (0-60 hue)
        let hue = if is_zombie {
            100.0 + js_sys::Math::random() * 40.0
        } else {
            js_sys::Math::random() * 60.0
        };
        
        particles.push(x);
        particles.push(y);
        particles.push(vx);
        particles.push(vy);
        particles.push(30.0); // life
        particles.push(hue);
    }
    
    particles
}
