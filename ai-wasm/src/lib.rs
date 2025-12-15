// AI WASM Module - Complete AI migration to Rust
mod types;
mod grid;
mod enemy_ai;
mod module_ai;

use wasm_bindgen::prelude::*;
use types::*;
use grid::*;
use enemy_ai::*;
use module_ai::*;

// Initialize WASM panic hook for better error messages
#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

// ========== ENEMY GRID SYSTEM ==========
static mut ENEMY_GRID: Option<EnemyGrid> = None;

#[wasm_bindgen]
pub fn rebuild_enemy_grid(positions: &[f64]) {
    unsafe {
        let grid = ENEMY_GRID.get_or_insert_with(|| EnemyGrid::new(128.0));
        grid.rebuild(positions);
    }
}

#[wasm_bindgen]
pub fn query_enemy_neighbors(x: f64, y: f64) -> Vec<usize> {
    unsafe {
        ENEMY_GRID
            .as_ref()
            .map(|grid| grid.query_neighbors(x, y))
            .unwrap_or_default()
    }
}

// ========== ENEMY AI UPDATE ==========
#[wasm_bindgen]
pub fn update_enemies(
    enemy_data: &[f64],
    ship_x: f64,
    ship_y: f64,
    ship_radius: f64,
    module_data: &[f64],
    projectile_data: &[f64],
    canvas_width: f64,
    canvas_height: f64,
    shield_active: bool,
) -> js_sys::Array {
    let num_enemies = enemy_data.len() / ENEMY_STRIDE;
    let mut results = js_sys::Array::new();

    for i in 0..num_enemies {
        let offset = i * ENEMY_STRIDE;
        let enemy = EnemyState::from_slice(&enemy_data[offset..offset + ENEMY_STRIDE]);

        let updated = update_single_enemy(
            enemy,
            ship_x,
            ship_y,
            ship_radius,
            module_data,
            projectile_data,
            enemy_data,
            canvas_width,
            canvas_height,
            shield_active,
        );

        results.push(&updated.to_js_value());
    }

    results
}

// ========== MODULE AI ==========
#[wasm_bindgen]
pub fn find_module_targets(
    module_data: &[f64],
    enemy_data: &[f64],
) -> js_sys::Array {
    let num_modules = module_data.len() / 3;
    let mut results = js_sys::Array::new();

    for i in 0..num_modules {
        let offset = i * 3;
        let mx = module_data[offset];
        let my = module_data[offset + 1];

        let target = find_nearest_enemy_target(mx, my, enemy_data);
        results.push(&target.to_js_value());
    }

    results
}

// ========== RAMMER CONFIGURATION EXPORT ==========
#[wasm_bindgen]
pub fn get_rammer_config() -> js_sys::Object {
    let config = js_sys::Object::new();

    js_sys::Reflect::set(&config, &"BASE_MAX".into(), &JsValue::from_f64(9.0)).unwrap();
    js_sys::Reflect::set(&config, &"BOOST_MAX".into(), &JsValue::from_f64(28.0)).unwrap();
    js_sys::Reflect::set(&config, &"REST".into(), &JsValue::from_f64(1.6)).unwrap();
    js_sys::Reflect::set(&config, &"DAMP".into(), &JsValue::from_f64(0.985)).unwrap();
    js_sys::Reflect::set(&config, &"BOOST_FRAMES".into(), &JsValue::from_f64(14.0)).unwrap();
    js_sys::Reflect::set(&config, &"HIT_CD".into(), &JsValue::from_f64(4.0)).unwrap();
    js_sys::Reflect::set(&config, &"STEER".into(), &JsValue::from_f64(0.5)).unwrap();
    js_sys::Reflect::set(&config, &"THRUST".into(), &JsValue::from_f64(1.2)).unwrap();
    js_sys::Reflect::set(&config, &"CHARGE_DIST".into(), &JsValue::from_f64(300.0)).unwrap();
    js_sys::Reflect::set(&config, &"CHARGE_PROB".into(), &JsValue::from_f64(0.02)).unwrap();
    js_sys::Reflect::set(&config, &"CHARGE_FRAMES".into(), &JsValue::from_f64(26.0)).unwrap();
    js_sys::Reflect::set(&config, &"CHARGE_SPEED_BONUS".into(), &JsValue::from_f64(6.0)).unwrap();
    js_sys::Reflect::set(&config, &"DODGE_DIST".into(), &JsValue::from_f64(120.0)).unwrap();
    js_sys::Reflect::set(&config, &"DODGE_FORCE".into(), &JsValue::from_f64(2.2)).unwrap();
    js_sys::Reflect::set(&config, &"ORBIT_BREAK_RADIUS".into(), &JsValue::from_f64(140.0)).unwrap();
    js_sys::Reflect::set(&config, &"ORBIT_TANGENT_DAMP".into(), &JsValue::from_f64(0.9)).unwrap();
    js_sys::Reflect::set(&config, &"CLOSE_STEER".into(), &JsValue::from_f64(0.75)).unwrap();
    js_sys::Reflect::set(&config, &"MIN_FWD".into(), &JsValue::from_f64(0.8)).unwrap();

    config
}
