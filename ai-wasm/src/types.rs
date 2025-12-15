// Type definitions for AI WASM module
use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

// Enemy data stride: [x, y, vx, vy, type_id, is_zombie, is_stealth, radius, hp, max_hp,
//                     shoot_cooldown, angle, bounce_boost_frames, hit_cooldown,
//                     charge_cooldown, charge_frames, aggression, pulse_phase,
//                     zombie_lifetime, stealth_wave_phase, split_level]
pub const ENEMY_STRIDE: usize = 21;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum EnemyType {
    Basic = 0,
    Elite = 1,
    Rammer = 2,
    Exploder = 3,
}

impl From<f64> for EnemyType {
    fn from(v: f64) -> Self {
        match v as i32 {
            0 => EnemyType::Basic,
            1 => EnemyType::Elite,
            2 => EnemyType::Rammer,
            3 => EnemyType::Exploder,
            _ => EnemyType::Basic,
        }
    }
}

#[derive(Debug, Clone)]
pub struct EnemyState {
    pub x: f64,
    pub y: f64,
    pub vx: f64,
    pub vy: f64,
    pub enemy_type: EnemyType,
    pub is_zombie: bool,
    pub is_stealth: bool,
    pub radius: f64,
    pub hp: f64,
    pub max_hp: f64,
    pub shoot_cooldown: f64,
    pub angle: f64,
    pub bounce_boost_frames: f64,
    pub hit_cooldown: f64,
    pub charge_cooldown: f64,
    pub charge_frames: f64,
    pub aggression: f64,
    pub pulse_phase: f64,
    pub zombie_lifetime: f64,
    pub stealth_wave_phase: f64,
    pub split_level: f64,
}

impl EnemyState {
    pub fn from_slice(data: &[f64]) -> Self {
        Self {
            x: data[0],
            y: data[1],
            vx: data[2],
            vy: data[3],
            enemy_type: EnemyType::from(data[4]),
            is_zombie: data[5] > 0.5,
            is_stealth: data[6] > 0.5,
            radius: data[7],
            hp: data[8],
            max_hp: data[9],
            shoot_cooldown: data[10],
            angle: data[11],
            bounce_boost_frames: data[12],
            hit_cooldown: data[13],
            charge_cooldown: data[14],
            charge_frames: data[15],
            aggression: data[16],
            pulse_phase: data[17],
            zombie_lifetime: data[18],
            stealth_wave_phase: data[19],
            split_level: data[20],
        }
    }

    pub fn to_js_value(&self) -> JsValue {
        let arr = js_sys::Array::new();
        arr.push(&JsValue::from_f64(self.x));
        arr.push(&JsValue::from_f64(self.y));
        arr.push(&JsValue::from_f64(self.vx));
        arr.push(&JsValue::from_f64(self.vy));
        arr.push(&JsValue::from_f64(self.enemy_type as i32 as f64));
        arr.push(&JsValue::from_bool(self.is_zombie));
        arr.push(&JsValue::from_bool(self.is_stealth));
        arr.push(&JsValue::from_f64(self.radius));
        arr.push(&JsValue::from_f64(self.hp));
        arr.push(&JsValue::from_f64(self.max_hp));
        arr.push(&JsValue::from_f64(self.shoot_cooldown));
        arr.push(&JsValue::from_f64(self.angle));
        arr.push(&JsValue::from_f64(self.bounce_boost_frames));
        arr.push(&JsValue::from_f64(self.hit_cooldown));
        arr.push(&JsValue::from_f64(self.charge_cooldown));
        arr.push(&JsValue::from_f64(self.charge_frames));
        arr.push(&JsValue::from_f64(self.aggression));
        arr.push(&JsValue::from_f64(self.pulse_phase));
        arr.push(&JsValue::from_f64(self.zombie_lifetime));
        arr.push(&JsValue::from_f64(self.stealth_wave_phase));
        arr.push(&JsValue::from_f64(self.split_level));
        arr.into()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleTarget {
    pub has_target: bool,
    pub target_x: f64,
    pub target_y: f64,
    pub target_index: i32,
}

impl ModuleTarget {
    pub fn none() -> Self {
        Self {
            has_target: false,
            target_x: 0.0,
            target_y: 0.0,
            target_index: -1,
        }
    }

    pub fn some(x: f64, y: f64, index: usize) -> Self {
        Self {
            has_target: true,
            target_x: x,
            target_y: y,
            target_index: index as i32,
        }
    }

    pub fn to_js_value(&self) -> JsValue {
        serde_wasm_bindgen::to_value(self).unwrap()
    }
}

pub const TWO_PI: f64 = std::f64::consts::PI * 2.0;
pub const HALF_PI: f64 = std::f64::consts::PI / 2.0;

// Rammer configuration
pub struct RammerConfig;

impl RammerConfig {
    pub const BASE_MAX: f64 = 9.0;
    pub const BOOST_MAX: f64 = 28.0;
    pub const REST: f64 = 1.6;
    pub const DAMP: f64 = 0.985;
    pub const BOOST_FRAMES: f64 = 14.0;
    pub const HIT_CD: f64 = 4.0;
    pub const STEER: f64 = 0.5;
    pub const THRUST: f64 = 1.2;
    pub const CHARGE_DIST: f64 = 300.0;
    pub const CHARGE_PROB: f64 = 0.02;
    pub const CHARGE_FRAMES: f64 = 26.0;
    pub const CHARGE_SPEED_BONUS: f64 = 6.0;
    pub const DODGE_DIST: f64 = 120.0;
    pub const DODGE_FORCE: f64 = 2.2;
    pub const ORBIT_BREAK_RADIUS: f64 = 140.0;
    pub const ORBIT_TANGENT_DAMP: f64 = 0.9;
    pub const CLOSE_STEER: f64 = 0.75;
    pub const MIN_FWD: f64 = 0.8;
}

#[inline]
pub fn hypot(x: f64, y: f64) -> f64 {
    (x * x + y * y).sqrt()
}

#[inline]
pub fn clamp(value: f64, min: f64, max: f64) -> f64 {
    if value < min {
        min
    } else if value > max {
        max
    } else {
        value
    }
}
