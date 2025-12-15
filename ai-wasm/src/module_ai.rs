// Module AI - targeting and shooting logic
use crate::types::*;

pub fn find_nearest_enemy_target(mx: f64, my: f64, enemy_data: &[f64]) -> ModuleTarget {
    let num_enemies = enemy_data.len() / ENEMY_STRIDE;
    let mut best_dist_sq = f64::INFINITY;
    let mut best_index = None;
    let mut best_pos = (0.0, 0.0);

    // First try grid-based neighbor query if available
    // For now, we do linear scan (grid query would be called from JS)

    for i in 0..num_enemies {
        let offset = i * ENEMY_STRIDE;
        let ex = enemy_data[offset];
        let ey = enemy_data[offset + 1];
        let is_zombie = enemy_data[offset + 5] > 0.5;

        // Skip zombies
        if is_zombie {
            continue;
        }

        let dx = ex - mx;
        let dy = ey - my;
        let dist_sq = dx * dx + dy * dy;

        if dist_sq < best_dist_sq {
            best_dist_sq = dist_sq;
            best_index = Some(i);
            best_pos = (ex, ey);
        }
    }

    match best_index {
        Some(idx) => ModuleTarget::some(best_pos.0, best_pos.1, idx),
        None => ModuleTarget::none(),
    }
}

// Calculate shooting angle towards target
#[inline]
pub fn calculate_shoot_angle(mx: f64, my: f64, tx: f64, ty: f64) -> f64 {
    (ty - my).atan2(tx - mx)
}

// Check if module should shoot (cooldown managed in JS)
pub fn should_module_shoot(
    module_x: f64,
    module_y: f64,
    target_x: f64,
    target_y: f64,
    min_dist: f64,
) -> bool {
    let dx = target_x - module_x;
    let dy = target_y - module_y;
    let dist = hypot(dx, dy);
    dist > min_dist // Only shoot if target is not too close
}
