// grid-wasm/src/lib.rs
use wasm_bindgen::prelude::*;
use std::collections::HashMap;
use std::sync::Mutex;

#[macro_use]
extern crate lazy_static;

const ENEMY_CELL_SIZE: f64 = 128.0;

lazy_static! {
    static ref ENEMY_GRID: Mutex<HashMap<(i32, i32), Vec<usize>>> = Mutex::new(HashMap::new());
}

fn get_grid_key(x: f64, y: f64) -> (i32, i32) {
    ((x / ENEMY_CELL_SIZE) as i32, (y / ENEMY_CELL_SIZE) as i32)
}

#[wasm_bindgen]
pub fn rebuild_grid(enemy_positions: &[f64]) {
    let mut grid = ENEMY_GRID.lock().unwrap();
    grid.clear();
    let num_enemies = enemy_positions.len() / 2;
    for i in 0..num_enemies {
        let x = enemy_positions[i * 2];
        let y = enemy_positions[i * 2 + 1];
        let key = get_grid_key(x, y);
        grid.entry(key).or_insert_with(Vec::new).push(i);
    }
}

#[wasm_bindgen]
pub fn query_neighbors(x: f64, y: f64) -> Vec<usize> {
    let grid = ENEMY_GRID.lock().unwrap();
    let mut neighbors = Vec::new();
    let (cx, cy) = get_grid_key(x, y);

    for dy in -1..=1 {
        for dx in -1..=1 {
            let key = (cx + dx, cy + dy);
            if let Some(indices) = grid.get(&key) {
                neighbors.extend(indices);
            }
        }
    }
    neighbors
}
