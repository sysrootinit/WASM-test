// ============ SHIP SYSTEM ============
// MotherShip and Module classes with related configurations

// Module movement tunables
const MODULE = {
    LERP: 0.28,        // faster default follow responsiveness
    SPLIT_LERP: 0.24,  // faster autonomous tracking
    RECALL_LERP: 0.40, // quicker recall tightening
    RECALL_FRAMES: 45,
    MAX_SPEED: 10      // slight cap increase to support quicker turns
};

// Ship configuration constants
const BASE_MODULES = 3;           // initial module count
const MAX_MODULES = 6;            // base(3) + up to +3 from purple stars

// Energy costs
const PLAYER_SHOT_COST = 3;
const SHIELD_COST = 20;
const SUPERNOVA_COST = 50;
const PLAYER_BULLET_SPEED = 14;

// Combo system
const COMBO_WINDOW = 120; // frames to maintain combo

// Energy drain for split mode
const ENERGY_DRAIN_SPLIT_PER_SEC = 1;

class MotherShip {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 25;
        this.modules = [];
        this.rotation = 0;
        this.targetX = x;
        this.targetY = y;
        this.isSplit = false;
        this.splitCooldown = 0;
    }

    update() {
        this.x += (this.targetX - this.x) * 0.15;
        this.y += (this.targetY - this.y) * 0.15;
        this.rotation += 0.02;
        if (this.splitCooldown > 0) this.splitCooldown--;

        this.modules.forEach((module, index) => {
            if (!this.isSplit) {
                const TWO_PI = Math.PI * 2;
                const angle = (TWO_PI / this.modules.length) * index + this.rotation;
                module.targetX = this.x + Math.cos(angle) * 40;
                module.targetY = this.y + Math.sin(angle) * 40;
            }
            module.update();
        });
    }

    draw(ctx, gameState, Sprites) {
        const TWO_PI = Math.PI * 2;
        const HALF_PI = Math.PI / 2;

        if (gameState.shieldActive) {
            ctx.save();
            const time = Date.now() * 0.005;
            const pulseIntensity = Math.sin(time * 2) * 0.3 + 0.7;

            // Multi-layer dynamic shield - enhanced version
            for (let i = 0; i < 3; i++) {
                const gradient = ctx.createRadialGradient(this.x, this.y, this.radius + 35 + i * 5, this.x, this.y, this.radius + 50 + i * 8);
                gradient.addColorStop(0, `rgba(0, 255, 255, ${(pulseIntensity - i * 0.15) * 0.4})`);
                gradient.addColorStop(1, `rgba(0, 100, 255, ${(pulseIntensity - i * 0.15) * 0.2})`);

                ctx.strokeStyle = gradient;
                ctx.lineWidth = 4 - i * 0.8;
                ctx.shadowBlur = 40 + i * 15;
                ctx.shadowColor = '#0ff';

                const radius = this.radius + 40 + i * 6 + Math.sin(time * (1 + i * 0.3) + i) * 4;
                ctx.beginPath();
                ctx.arc(this.x, this.y, radius, 0, TWO_PI);
                ctx.stroke();

                // Hexagonal shield pattern
                if (i === 0) {
                    ctx.strokeStyle = `rgba(0, 255, 255, ${pulseIntensity * 0.3})`;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    for (let j = 0; j < 6; j++) {
                        const angle = (Math.PI / 3) * j + time;
                        const x = this.x + Math.cos(angle) * (this.radius + 45);
                        const y = this.y + Math.sin(angle) * (this.radius + 45);
                        if (j === 0) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    }
                    ctx.closePath();
                    ctx.stroke();
                }
            }
            ctx.restore();
        }

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Enhanced core glow
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
        gradient.addColorStop(0, '#fff');
        gradient.addColorStop(0.2, '#0ff');
        gradient.addColorStop(0.5, '#00aaff');
        gradient.addColorStop(1, 'rgba(0, 255, 255, 0.2)');
        ctx.fillStyle = gradient;
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#0ff';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, TWO_PI);
        ctx.fill();

        // Animated rings
        for (let i = 0; i < 4; i++) {
            ctx.strokeStyle = `rgba(0, 255, 255, ${0.8 - i * 0.2})`;
            ctx.lineWidth = 3 - i * 0.5;
            ctx.shadowBlur = 20 - i * 4;
            ctx.beginPath();
            const pulseOffset = Math.sin(Date.now() * 0.003 + i) * 2;
            ctx.arc(0, 0, this.radius + i * 6 + pulseOffset, 0, TWO_PI);
            ctx.stroke();
        }

        // Energy lines
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            const angle = (TWO_PI / 8) * i + this.rotation * 2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * this.radius * 0.5, Math.sin(angle) * this.radius * 0.5);
            ctx.lineTo(Math.cos(angle) * this.radius * 1.2, Math.sin(angle) * this.radius * 1.2);
            ctx.stroke();
        }

        ctx.restore();
        this.modules.forEach(module => module.draw(ctx, Sprites));
    }

    split(gameState) {
        if (this.modules.length === 0 || this.splitCooldown > 0) return;
        this.isSplit = !this.isSplit;
        this.splitCooldown = 15; // Reduced from 30 to allow immediate retraction

        const TWO_PI = Math.PI * 2;

        if (this.isSplit) {
            this.modules.forEach((module, index) => {
                const angle = (TWO_PI / this.modules.length) * index;
                module.targetX = this.x + Math.cos(angle) * 150;
                module.targetY = this.y + Math.sin(angle) * 150;
                module.autonomous = true;
            });
            gameState.splits--;
        } else {
            this.modules.forEach(module => {
                module.autonomous = false;
                module.recalling = MODULE.RECALL_FRAMES;
            });
            gameState.splits++;
        }
    }

    createModules(count) {
        for (let i = 0; i < count; i++) {
            this.modules.push(new Module(this.x, this.y));
        }
    }
}

class Module {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.radius = 12;
        this.autonomous = false;
        this.shootCooldown = 0;
        this.recalling = 0;
    }

    update() {
        // Tunable, capped module movement
        const lerp = (this.recalling > 0) ? MODULE.RECALL_LERP : (this.autonomous ? MODULE.SPLIT_LERP : MODULE.LERP);
        let vx = (this.targetX - this.x) * lerp;
        let vy = (this.targetY - this.y) * lerp;
        const sp = Math.hypot(vx, vy);
        if (sp > MODULE.MAX_SPEED) {
            vx = vx / sp * MODULE.MAX_SPEED;
            vy = vy / sp * MODULE.MAX_SPEED;
        }
        this.x += vx;
        this.y += vy;
        if (this.recalling > 0) this.recalling--;

        if (this.autonomous && this.shootCooldown <= 0) {
            const nearestEnemy = this.findNearestEnemy();
            if (nearestEnemy) {
                this.shoot(nearestEnemy);
                this.shootCooldown = 20;
            }
        }
        if (this.shootCooldown > 0) this.shootCooldown--;
    }

    findNearestEnemy() {
        const enemies = window.enemies || [];

        // Try WASM module targeting first
        if (typeof window.findModuleTargetsWasm === 'function' && window.aiWasmReady && window.aiWasmReady()) {
            const modules = [this]; // Single module for this query
            const results = window.findModuleTargetsWasm(modules, enemies);
            if (results && results.length > 0) {
                const target = results[0];
                if (target.has_target && target.target_index >= 0 && target.target_index < enemies.length) {
                    return enemies[target.target_index];
                }
            }
        }

        // JavaScript fallback
        let nearest = null;
        let bestD2 = Infinity;

        // Prefer fast neighbor candidates from 3x3 grid cells (exported by gameAI.js)
        const candIdx = (typeof window.queryEnemyNeighbors === 'function') ? window.queryEnemyNeighbors(this.x, this.y) : [];
        if (candIdx.length > 0) {
            for (let k = 0; k < candIdx.length; k++) {
                const e = enemies[candIdx[k]];
                if (!e || e.isZombie) continue;
                const dx = e.x - this.x, dy = e.y - this.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < bestD2) {
                    bestD2 = d2;
                    nearest = e;
                }
            }
        }

        // Fallback: global scan keeps behavior identical when grid is empty/sparse
        if (!nearest) {
            for (let i = 0; i < enemies.length; i++) {
                const e = enemies[i];
                if (!e || e.isZombie) continue;
                const dx = e.x - this.x, dy = e.y - this.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < bestD2) {
                    bestD2 = d2;
                    nearest = e;
                }
            }
        }
        return nearest;
    }

    shoot(target) {
        const Projectile = window.Projectile;
        const projectiles = window.projectiles || [];

        // Predictive targeting - lead the target based on its velocity
        const bulletSpeed = 10;

        // Get target velocity (vx, vy for rammer/elite/exploder, or derive from angle for basic)
        const targetVx = target.vx || 0;
        const targetVy = target.vy || 0;

        // Calculate distance and time to target
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.hypot(dx, dy);
        const timeToHit = dist / bulletSpeed;

        // Predict target's future position
        const predictedX = target.x + targetVx * timeToHit;
        const predictedY = target.y + targetVy * timeToHit;

        // Aim at predicted position
        const angle = Math.atan2(predictedY - this.y, predictedX - this.x);
        projectiles.push(new Projectile(this.x, this.y, Math.cos(angle) * bulletSpeed, Math.sin(angle) * bulletSpeed, 'module'));
    }

    draw(ctx, Sprites) {
        const TWO_PI = Math.PI * 2;

        // draw cached core glow at correct scale
        const sprite = Sprites.moduleCore;
        const sw = sprite.width || sprite.bitmapWidth;
        const sh = sprite.height || sprite.bitmapHeight;
        const base = sprite._baseRadius || 12;
        const scale = this.radius / base;
        const w = sw * scale, h = sh * scale;

        ctx.drawImage(sprite, this.x - w / 2, this.y - h / 2, w, h);

        // crisp procedural ring to preserve constant pixel thickness/offset
        ctx.save();
        ctx.strokeStyle = '#ff0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 3, 0, TWO_PI);
        ctx.stroke();
        ctx.restore();
    }
}

// Export for use in main game
window.MotherShip = MotherShip;
window.Module = Module;
window.MODULE = MODULE;
window.BASE_MODULES = BASE_MODULES;
window.MAX_MODULES = MAX_MODULES;
window.PLAYER_SHOT_COST = PLAYER_SHOT_COST;
window.SHIELD_COST = SHIELD_COST;
window.SUPERNOVA_COST = SUPERNOVA_COST;
window.PLAYER_BULLET_SPEED = PLAYER_BULLET_SPEED;
window.COMBO_WINDOW = COMBO_WINDOW;
window.ENERGY_DRAIN_SPLIT_PER_SEC = ENERGY_DRAIN_SPLIT_PER_SEC;
