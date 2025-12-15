// Enemy grid system for spatial partitioning
use std::collections::HashMap;

pub struct EnemyGrid {
    cell_size: f64,
    grid: HashMap<(i32, i32), Vec<usize>>,
}

impl EnemyGrid {
    pub fn new(cell_size: f64) -> Self {
        Self {
            cell_size,
            grid: HashMap::new(),
        }
    }

    #[inline]
    fn get_cell(&self, x: f64, y: f64) -> (i32, i32) {
        (
            (x / self.cell_size).floor() as i32,
            (y / self.cell_size).floor() as i32,
        )
    }

    pub fn rebuild(&mut self, positions: &[f64]) {
        self.grid.clear();
        let num_enemies = positions.len() / 2;

        for i in 0..num_enemies {
            let x = positions[i * 2];
            let y = positions[i * 2 + 1];
            let cell = self.get_cell(x, y);

            self.grid.entry(cell).or_insert_with(Vec::new).push(i);
        }
    }

    pub fn query_neighbors(&self, x: f64, y: f64) -> Vec<usize> {
        let (cx, cy) = self.get_cell(x, y);
        let mut neighbors = Vec::new();

        // Query 3x3 grid
        for dy in -1..=1 {
            for dx in -1..=1 {
                let cell = (cx + dx, cy + dy);
                if let Some(indices) = self.grid.get(&cell) {
                    neighbors.extend(indices);
                }
            }
        }

        neighbors
    }
}
