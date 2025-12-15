// ============ GAME AI SYSTEM ============
// Enemy AI behaviors and configurations

// Rammer physics tunables (enhanced aggressor tuning)
const RAMMER = {
    BASE_MAX: 9,        // higher base top speed so rammer is faster overall
    BOOST_MAX: 28,      // larger boost after bounces/charges
    REST: 1.6,          // restitution multiplier on reflection (unchanged)
    DAMP: 0.985,        // slightly less damping so it keeps momentum
    BOOST_FRAMES: 14,   // longer boosted window after rebounds
    HIT_CD: 4,          // shorter cooldown so it can collide more frequently (but still guarded)
    STEER: 0.5,         // stronger steering to aggressively track the player
    THRUST: 1.2,        // much stronger forward thrust
    CHARGE_DIST: 300,   // distance under which rammer may start a charge
    CHARGE_PROB: 0.02,  // per-frame chance to initiate a charge when in range
    CHARGE_FRAMES: 26,  // how long a charge lasts
    CHARGE_SPEED_BONUS: 6, // instant speed impulse when charge starts
    DODGE_DIST: 120,    // detect incoming player projectiles within this radius to dodge
    DODGE_FORCE: 2.2,   // lateral force applied to dodge
    ORBIT_BREAK_RADIUS: 140, // within this range, suppress orbiting
    ORBIT_TANGENT_DAMP: 0.9,   // extra damping on tangential velocity when close
    CLOSE_STEER: 0.75,         // when close, bias steering strongly straight-in
    MIN_FWD: 0.8               // ensure a minimal forward speed when engaging
};

// Export configurations

window.RAMMER = RAMMER;

// ==== Uniform grid for enemy neighbor queries (exported) ====
const ENEMY_CELL = 128;               // tune 96~160 depending on density
const __enemyGrid = new Map();        // key: "cx,cy" -> array of indices

function __enemyGridKey(x, y) {
    return ((x / ENEMY_CELL) | 0) + ',' + ((y / ENEMY_CELL) | 0);
}
// Rebuild with the current enemies array (call once per frame in main loop)
function rebuildEnemyGridJS(enemies) {
    __enemyGrid.clear();
    for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i]; if (!e) continue;
        const k = __enemyGridKey(e.x, e.y);
        const arr = __enemyGrid.get(k);
        if (arr) arr.push(i); else __enemyGrid.set(k, [i]);
    }
}
// Query indices around (x,y) from a 3x3 cell neighborhood
function queryEnemyNeighborsJS(x, y) {
    const cx = (x / ENEMY_CELL) | 0, cy = (y / ENEMY_CELL) | 0;
    const out = [];
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const arr = __enemyGrid.get((cx + dx) + ',' + (cy + dy));
            if (arr) out.push(...arr);
        }
    }
    return out;
}
// Export helpers so space.html / modules can call them
window.ENEMY_CELL = ENEMY_CELL;
window.rebuildEnemyGridJS = rebuildEnemyGridJS;
window.queryEnemyNeighborsJS = queryEnemyNeighborsJS;

// WASM-enabled grid system (will use WASM if available, fallback to JS)
window.rebuildEnemyGrid = function (enemies) {
    if (typeof window.rebuildEnemyGridAI === 'function' && window.aiWasmReady && window.aiWasmReady()) {
        window.rebuildEnemyGridAI(enemies);
    } else {
        rebuildEnemyGridJS(enemies);
    }
};

window.queryEnemyNeighbors = function (x, y) {
    if (typeof window.queryEnemyNeighborsAI === 'function' && window.aiWasmReady && window.aiWasmReady()) {
        return window.queryEnemyNeighborsAI(x, y);
    } else {
        return queryEnemyNeighborsJS(x, y);
    }
};
// ============================================================

// Enemy class with advanced AI behaviors
class Enemy {
    constructor(x, y, type = 'basic', isZombie = false, isStealth = false, splitLevel = 0) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.isZombie = isZombie;
        this.isStealth = isStealth;
        this.splitLevel = splitLevel;

        if (type === 'basic') {
            this.radius = 15; this.hp = 50; this.speed = 2;
        } else if (type === 'elite') {
            this.radius = 25; this.hp = 100; this.speed = 1;
        } else if (type === 'rammer') {
            this.radius = 18; this.hp = 80; this.speed = 1.8;
        } else if (type === 'exploder') {
            this.radius = 55; this.hp = 150; this.speed = 0.8;
        }

        this.maxHp = this.hp;
        this.shootCooldown = 0;
        this.angle = Math.random() * Math.PI * 2;
        this.vx = 0;
        this.vy = 0;
        this.bounceBoostFrames = 0;
        this.hitCooldown = 0;
        this.chargeCooldown = 0;
        this.chargeFrames = 0;
        this.aggression = 1.0;
        this.pulsePhase = 0;
        this.zombieLifetime = isZombie ? 480 : 0;
        this.stealthWavePhase = Math.random() * Math.PI * 2;
    }

    update(ship, enemies, projectiles, particles, getParticle, supernovaEffects, ExploderExplosion, gameState, clampEnergy, canvas) {
        const TWO_PI = Math.PI * 2;
        const HALF_PI = Math.PI / 2;

        // Zombie lifetime countdown
        if (this.isZombie) {
            this.zombieLifetime--;
            if (this.zombieLifetime <= 0) {
                this.hp = 0;
                return;
            }
        }

        if (this.type === 'basic') {
            this.angle += 0.02;
            this.x += Math.cos(this.angle) * this.speed;
            this.y += Math.sin(this.angle) * this.speed;
        } else if (this.type === 'elite') {
            // Target nearest non-zombie enemy if zombie, otherwise target ship
            let targetX, targetY;
            if (this.isZombie) {
                const nearestEnemy = this.findNearestHostileEnemy(enemies);
                if (nearestEnemy) {
                    targetX = nearestEnemy.x;
                    targetY = nearestEnemy.y;
                } else {
                    targetX = ship.x;
                    targetY = ship.y;
                }
            } else {
                targetX = ship.x;
                targetY = ship.y;
            }
            const dx = targetX - this.x, dy = targetY - this.y, dist = Math.hypot(dx, dy);
            if (dist > 200) { this.x += (dx / dist) * this.speed; this.y += (dy / dist) * this.speed; }
        } else if (this.type === 'exploder') {
            this.pulsePhase += 0.1;

            // Target nearest non-zombie enemy if zombie, otherwise target ship
            let targetX, targetY;
            if (this.isZombie) {
                const nearestEnemy = this.findNearestHostileEnemy(enemies);
                if (nearestEnemy) {
                    targetX = nearestEnemy.x;
                    targetY = nearestEnemy.y;
                } else {
                    return; // No enemies to chase
                }
            } else {
                targetX = ship.x;
                targetY = ship.y;
            }

            const dx = targetX - this.x, dy = targetY - this.y, dist = Math.hypot(dx, dy);
            if (dist > 0) {
                this.x += (dx / dist) * this.speed;
                this.y += (dy / dist) * this.speed;
            }

            if (this.isZombie) {
                // Zombie exploder damages enemies
                for (let i = enemies.length - 1; i >= 0; i--) {
                    const enemy = enemies[i];
                    if (enemy === this || enemy.isZombie) continue;
                    const distToEnemy = Math.hypot(this.x - enemy.x, this.y - enemy.y);
                    if (distToEnemy < this.radius + enemy.radius) {
                        for (let j = 0; j < 30; j++) particles.push(getParticle(this.x, this.y, this.isZombie));
                        supernovaEffects.push(new ExploderExplosion(this.x, this.y));
                        enemy.takeDamage(50, ship, enemies, particles, getParticle, gameState, projectiles);
                        this.hp = 0;
                        break;
                    }
                }
            } else {
                // Normal exploder damages ship
                const distToShip = Math.hypot(this.x - ship.x, this.y - ship.y);
                if (distToShip < this.radius + ship.radius) {
                    for (let i = 0; i < 30; i++) particles.push(getParticle(this.x, this.y, this.isZombie));
                    supernovaEffects.push(new ExploderExplosion(this.x, this.y));
                    if (!gameState.shieldActive) {
                        gameState.energy -= 20;
                        if (window.devMode) window.devMode.logDamage('exploderExplosion', 20);
                        clampEnergy();
                    }
                    this.hp = 0;
                }

                for (let m = 0; m < ship.modules.length; m++) {
                    const module = ship.modules[m];
                    const distToModule = Math.hypot(this.x - module.x, this.y - module.y);
                    if (distToModule < this.radius + module.radius) {
                        for (let i = 0; i < 30; i++) particles.push(getParticle(this.x, this.y, this.isZombie));
                        supernovaEffects.push(new ExploderExplosion(this.x, this.y));
                        if (!gameState.shieldActive) {
                            gameState.energy -= 20;
                            if (window.devMode) window.devMode.logDamage('exploderExplosion', 20);
                            clampEnergy();
                        }
                        this.hp = 0;
                        break;
                    }
                }
            }
        } else if (this.type === 'rammer') {
            if (this.hitCooldown > 0) this.hitCooldown--;

            let fvx = this.vx, fvy = this.vy;
            if (Math.abs(fvx) + Math.abs(fvy) < 0.001) { fvx = 1; fvy = 0; }
            const fl = Math.hypot(fvx, fvy) || 1;
            let fx = fvx / fl, fy = fvy / fl;

            // Target selection based on zombie status
            let targetX, targetY;
            if (this.isZombie) {
                const nearestEnemy = this.findNearestHostileEnemy(enemies);
                if (nearestEnemy) {
                    targetX = nearestEnemy.x;
                    targetY = nearestEnemy.y;
                } else {
                    targetX = this.x;
                    targetY = this.y;
                }
            } else {
                const predictFactor = 1.4;
                targetX = ship.x + (ship.targetX - ship.x) * predictFactor;
                targetY = ship.y + (ship.targetY - ship.y) * predictFactor;
            }
            let dx = targetX - this.x, dy = targetY - this.y;
            const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;

            // Dodge incoming player projectiles
            const distToShip = Math.hypot(ship.x - this.x, ship.y - this.y);
            for (let pi = 0; pi < projectiles.length; pi++) {
                const proj = projectiles[pi];
                if (proj.type === 'player' || proj.type === 'module') {
                    const pdx = proj.x - this.x, pdy = proj.y - this.y;
                    const pdist = Math.hypot(pdx, pdy);
                    if (pdist < RAMMER.DODGE_DIST && distToShip >= RAMMER.ORBIT_BREAK_RADIUS) {
                        const pvlen = Math.hypot(proj.vx, proj.vy) || 1;
                        const pvx = proj.vx / pvlen, pvy = proj.vy / pvlen;
                        const approach = (pdx * pvx + pdy * pvy);
                        if (approach < 80) {
                            const perpX = -pvx, perpY = -pvy;
                            this.vx += perpX * RAMMER.DODGE_FORCE;
                            this.vy += perpY * RAMMER.DODGE_FORCE;
                        }
                    }
                }
            }

            // Steering
            const steer = RAMMER.STEER;
            let dirx = fx * (1 - steer) + dx * steer;
            let diry = fy * (1 - steer) + dy * steer;
            const dl2 = Math.hypot(dirx, diry) || 1; dirx /= dl2; diry /= dl2;

            // Charge behavior
            if (this.chargeCooldown > 0) this.chargeCooldown--;
            if (this.chargeFrames > 0) {
                this.chargeFrames--;
                this.vx += dirx * (RAMMER.THRUST * 1.8);
                this.vy += diry * (RAMMER.THRUST * 1.8);
                this.bounceBoostFrames = Math.max(this.bounceBoostFrames, RAMMER.CHARGE_FRAMES);
            } else {
                this.vx += dirx * RAMMER.THRUST;
                this.vy += diry * RAMMER.THRUST;
                if (this.chargeCooldown <= 0 && distToShip < RAMMER.CHARGE_DIST && Math.random() < RAMMER.CHARGE_PROB) {
                    this.chargeFrames = RAMMER.CHARGE_FRAMES;
                    this.chargeCooldown = 220 + Math.floor(Math.random() * 120);
                    this.vx += dirx * RAMMER.CHARGE_SPEED_BONUS;
                    this.vy += diry * RAMMER.CHARGE_SPEED_BONUS;
                }
            }

            // Anti-orbit logic
            if (distToShip < RAMMER.ORBIT_BREAK_RADIUS) {
                const nx = (ship.x - this.x) / (distToShip || 1);
                const ny = (ship.y - this.y) / (distToShip || 1);
                const vdotn = this.vx * nx + this.vy * ny;
                const vrx = nx * vdotn, vry = ny * vdotn;
                const vtx = this.vx - vrx, vty = this.vy - vry;
                this.vx = vrx + vtx * RAMMER.ORBIT_TANGENT_DAMP;
                this.vy = vry + vty * RAMMER.ORBIT_TANGENT_DAMP;
                this.vx += nx * 0.8;
                this.vy += ny * 0.8;
                dirx = dirx * (1 - RAMMER.CLOSE_STEER) + nx * RAMMER.CLOSE_STEER;
                diry = diry * (1 - RAMMER.CLOSE_STEER) + ny * RAMMER.CLOSE_STEER;
                const ndl = Math.hypot(dirx, diry) || 1; dirx /= ndl; diry /= ndl;
            }

            // Velocity damping and clamping
            this.vx *= RAMMER.DAMP; this.vy *= RAMMER.DAMP;
            let v = Math.hypot(this.vx, this.vy);
            const maxV = (this.bounceBoostFrames > 0 || this.chargeFrames > 0) ? RAMMER.BOOST_MAX : RAMMER.BASE_MAX;
            if (v > maxV) { this.vx = this.vx / v * maxV; this.vy = this.vy / v * maxV; v = maxV; }

            // Ensure minimal forward speed
            if (distToShip < 220) {
                let v2 = Math.hypot(this.vx, this.vy);
                if (v2 < RAMMER.MIN_FWD) {
                    this.vx += dirx * (RAMMER.MIN_FWD - v2);
                    this.vy += diry * (RAMMER.MIN_FWD - v2);
                }
            }

            this.x += this.vx; this.y += this.vy;
            if (this.bounceBoostFrames > 0) this.bounceBoostFrames--;

            // Boundary bounce logic with HP damage
            this.handleBoundaryBounce(canvas);

            // Shield repel logic
            this.handleShieldRepel(ship, gameState);

            // Collision with ship
            this.handleShipCollision(ship, gameState);

            // Collision with other enemies
            this.handleEnemyCollisions(enemies);
        }

        // Boundary adjust for non-rammer and non-exploder
        if (this.type !== 'rammer' && this.type !== 'exploder') {
            if (this.x < this.radius || this.x > canvas.width - this.radius) this.angle = Math.PI - this.angle;
            if (this.y < this.radius || this.y > canvas.height - this.radius) this.angle = -this.angle;
        }

        // Boundary adjust for exploder
        if (this.type === 'exploder') {
            if (this.x < this.radius) this.x = this.radius;
            if (this.x > canvas.width - this.radius) this.x = canvas.width - this.radius;
            if (this.y < this.radius) this.y = this.radius;
            if (this.y > canvas.height - this.radius) this.y = canvas.height - this.radius;
        }

        // Shooting logic
        if (this.type !== 'rammer' && this.type !== 'exploder') {
            if (this.shootCooldown <= 0) {
                this.shoot(ship, enemies, projectiles);
                this.shootCooldown = this.type === 'basic' ? 60 : 40;
            }
            this.shootCooldown--;
        }
    }

    handleBoundaryBounce(canvas) {
        let bounced = false;

        if (this.x < this.radius) {
            this.x = this.radius;
            this.vx = -this.vx * RAMMER.REST;
            bounced = true;
            this.bounceBoostFrames = RAMMER.BOOST_FRAMES;
            this.hitCooldown = RAMMER.HIT_CD;
            this.clampVelocity();
        }
        if (this.x > canvas.width - this.radius) {
            this.x = canvas.width - this.radius;
            this.vx = -this.vx * RAMMER.REST;
            bounced = true;
            this.bounceBoostFrames = RAMMER.BOOST_FRAMES;
            this.hitCooldown = RAMMER.HIT_CD;
            this.clampVelocity();
        }
        if (this.y < this.radius) {
            this.y = this.radius;
            this.vy = -this.vy * RAMMER.REST;
            bounced = true;
            this.bounceBoostFrames = RAMMER.BOOST_FRAMES;
            this.hitCooldown = RAMMER.HIT_CD;
            this.clampVelocity();
        }
        if (this.y > canvas.height - this.radius) {
            this.y = canvas.height - this.radius;
            this.vy = -this.vy * RAMMER.REST;
            bounced = true;
            this.bounceBoostFrames = RAMMER.BOOST_FRAMES;
            this.hitCooldown = RAMMER.HIT_CD;
            this.clampVelocity();
        }

        if (bounced) this.takeDamage(5);
    }

    clampVelocity() {
        const v2 = Math.hypot(this.vx, this.vy);
        const cap = RAMMER.BOOST_MAX;
        if (v2 > cap) {
            this.vx = this.vx / v2 * cap;
            this.vy = this.vy / v2 * cap;
        }
    }

    handleShieldRepel(ship, gameState) {
        const dShip = Math.hypot(this.x - ship.x, this.y - ship.y);
        if (gameState.shieldActive) {
            const shieldRadius = ship.radius + 40;
            const repelDist = shieldRadius + this.radius;
            if (dShip < repelDist) {
                const nx = (this.x - ship.x) / (dShip || 1), ny = (this.y - ship.y) / (dShip || 1);
                this.x = ship.x + nx * repelDist;
                this.y = ship.y + ny * repelDist;
                const dotS = this.vx * nx + this.vy * ny;
                this.vx = (this.vx - 2 * dotS * nx) * RAMMER.REST;
                this.vy = (this.vy - 2 * dotS * ny) * RAMMER.REST;
                this.bounceBoostFrames = RAMMER.BOOST_FRAMES;
                this.hitCooldown = RAMMER.HIT_CD;
                this.clampVelocity();
                this.takeDamage(5);
            }
        }
    }

    handleShipCollision(ship, gameState) {
        const dShip = Math.hypot(this.x - ship.x, this.y - ship.y);
        if (!gameState.shieldActive && this.hitCooldown === 0 && dShip < this.radius + ship.radius) {
            let fvx = this.vx, fvy = this.vy;
            if (Math.abs(fvx) + Math.abs(fvy) < 0.001) { fvx = 1; fvy = 0; }
            const fl = Math.hypot(fvx, fvy) || 1;
            const fx = fvx / fl, fy = fvy / fl;
            const toShipX = (ship.x - this.x) / (dShip || 1);
            const toShipY = (ship.y - this.y) / (dShip || 1);
            const align = fx * toShipX + fy * toShipY;
            const tipHit = align > 0.7;

            if (tipHit) {
                gameState.energy = Math.max(0, gameState.energy - 10);
                if (window.devMode) window.devMode.logDamage('rammerCollision', 10);
            }

            const nx = (this.x - ship.x) / (dShip || 1), ny = (this.y - ship.y) / (dShip || 1);
            const dot = this.vx * nx + this.vy * ny;
            this.vx = (this.vx - 2 * dot * nx) * RAMMER.REST;
            this.vy = (this.vy - 2 * dot * ny) * RAMMER.REST;
            this.bounceBoostFrames = RAMMER.BOOST_FRAMES;
            this.hitCooldown = RAMMER.HIT_CD;
            this.clampVelocity();
            this.x = ship.x + nx * (this.radius + ship.radius + 1);
            this.y = ship.y + ny * (this.radius + ship.radius + 1);

            if (!tipHit) this.takeDamage(5);
        }
    }

    handleEnemyCollisions(enemies) {
        for (let i = 0; i < enemies.length; i++) {
            const other = enemies[i];
            if (other === this) continue;
            const d = Math.hypot(this.x - other.x, this.y - other.y);
            const minD = this.radius + other.radius;
            if (d > 0 && d < minD && this.hitCooldown === 0) {
                const nx = (this.x - other.x) / d, ny = (this.y - other.y) / d;
                const overlap = minD - d;
                this.x += nx * (overlap * 0.6);
                this.y += ny * (overlap * 0.6);
                const dot2 = this.vx * nx + this.vy * ny;
                this.vx = (this.vx - 2 * dot2 * nx) * RAMMER.REST;
                this.vy = (this.vy - 2 * dot2 * ny) * RAMMER.REST;
                this.bounceBoostFrames = RAMMER.BOOST_FRAMES;
                this.hitCooldown = RAMMER.HIT_CD;
                this.clampVelocity();
                this.takeDamage(5);
            }
        }
    }

    findNearestHostileEnemy(enemies) {
        let nearest = null; let bestD2 = Infinity;

        // Prefer grid candidates if available (populated by main loop via window.rebuildEnemyGrid)
        const candIdx = (typeof queryEnemyNeighbors === 'function') ? queryEnemyNeighbors(this.x, this.y) : [];
        if (candIdx.length > 0) {
            for (let i = 0; i < candIdx.length; i++) {
                const e = enemies[candIdx[i]]; if (!e || e === this || e.isZombie) continue;
                const dx = e.x - this.x, dy = e.y - this.y; const d2 = dx * dx + dy * dy;
                if (d2 < bestD2) { bestD2 = d2; nearest = e; }
            }
        }

        // Fallback: global scan (keeps behavior identical when grid is empty/sparse)
        if (!nearest) {
            for (let i = 0; i < enemies.length; i++) {
                const e = enemies[i];
                if (!e || e === this || e.isZombie) continue;
                const dx = e.x - this.x, dy = e.y - this.y; const d2 = dx * dx + dy * dy;
                if (d2 < bestD2) { bestD2 = d2; nearest = e; }
            }
        }
        return nearest;
    }

    findNearestTarget(ship, enemies) {
        let nearest = null;
        let minDist = Infinity;

        // Check ship
        let dist = Math.hypot(ship.x - this.x, ship.y - this.y);
        if (dist < minDist) {
            minDist = dist;
            nearest = { x: ship.x, y: ship.y };
        }

        // Check modules
        for (let i = 0; i < ship.modules.length; i++) {
            const module = ship.modules[i];
            dist = Math.hypot(module.x - this.x, module.y - this.y);
            if (dist < minDist) {
                minDist = dist;
                nearest = { x: module.x, y: module.y };
            }
        }

        // Check zombies
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            if (!enemy.isZombie) continue;
            dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
            if (dist < minDist) {
                minDist = dist;
                nearest = { x: enemy.x, y: enemy.y };
            }
        }

        return nearest;
    }

    shoot(ship, enemies, projectiles) {
        if (this.type === 'rammer' || this.type === 'exploder') return;

        // Get Projectile class from window
        const Projectile = window.Projectile;

        let targetX, targetY;
        if (this.isZombie) {
            const nearestEnemy = this.findNearestHostileEnemy(enemies);
            if (!nearestEnemy) return;
            targetX = nearestEnemy.x;
            targetY = nearestEnemy.y;
        } else {
            const target = this.findNearestTarget(ship, enemies);
            if (!target) return;
            targetX = target.x;
            targetY = target.y;
        }

        const angle = Math.atan2(targetY - this.y, targetX - this.x);
        const bulletType = this.isZombie ? 'zombie' : 'enemy';

        if (this.type === 'basic') {
            projectiles.push(new Projectile(this.x, this.y, Math.cos(angle) * 4, Math.sin(angle) * 4, bulletType, 3));
        } else {
            const spread = 0.4;
            const offsets = [-2 * spread, -spread, 0, spread, 2 * spread];
            for (let i = 0; i < offsets.length; i++) {
                projectiles.push(new Projectile(this.x, this.y, Math.cos(angle + offsets[i]) * 4, Math.sin(angle + offsets[i]) * 4, bulletType));
            }
        }
    }

    takeDamage(damage, ship, enemies, particles, getParticle, gameState, projectiles) {
        this.hp -= damage;
        if (this.hp <= 0) {
            // Don't give rewards for zombie deaths
            if (!this.isZombie && ship && gameState) {
                // These will be handled by the main game logic
                // Just mark as dead here
            }
            return true;
        }
        return false;
    }

    draw(ctx) {
        const TWO_PI = Math.PI * 2;
        const HALF_PI = Math.PI / 2;

        if (this.hp < this.maxHp) {
            ctx.fillStyle = '#f00';
            ctx.fillRect(this.x - 20, this.y - this.radius - 10, 40, 4);
            ctx.fillStyle = '#0f0';
            ctx.fillRect(this.x - 20, this.y - this.radius - 10, 40 * (this.hp / this.maxHp), 4);
        }

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.type === 'rammer' ? HALF_PI : this.angle);

        if (this.type === 'rammer') {
            if (this.isStealth) {
                // Stealth rammer - space distortion effect (zombie variant uses green tint)
                this.stealthWavePhase += 0.08;

                // Color scheme: zombie = green-cyan, normal = blue-cyan
                const stealthColor = this.isZombie
                    ? { r: 100, g: 200, b: 150 }  // Green-cyan for zombie
                    : { r: 100, g: 150, b: 200 }; // Blue-cyan for normal

                for (let i = 0; i < 4; i++) {
                    const offset = this.stealthWavePhase + i * HALF_PI;
                    const rippleRadius = this.radius * 1.2 + Math.sin(offset) * 8;
                    const opacity = 0.15 + Math.sin(offset) * 0.1;

                    ctx.strokeStyle = `rgba(${stealthColor.r}, ${stealthColor.g}, ${stealthColor.b}, ${opacity})`;
                    ctx.lineWidth = 2;
                    ctx.shadowBlur = 15;
                    ctx.shadowColor = `rgba(${stealthColor.r}, ${stealthColor.g}, ${stealthColor.b}, 0.4)`;
                    ctx.beginPath();
                    ctx.arc(0, 0, rippleRadius, 0, TWO_PI);
                    ctx.stroke();
                }

                ctx.globalAlpha = 0.2 + Math.sin(this.stealthWavePhase) * 0.08;
                ctx.strokeStyle = `rgba(${stealthColor.r + 50}, ${stealthColor.g + 30}, ${stealthColor.b + 20}, 0.5)`;
                ctx.lineWidth = 1.5;
                ctx.shadowBlur = 20;
                ctx.shadowColor = `rgba(${stealthColor.r + 50}, ${stealthColor.g + 30}, ${stealthColor.b + 20}, 0.3)`;

                ctx.beginPath();
                const w = this.radius + Math.sin(this.stealthWavePhase * 2) * 2;
                const h = this.radius * 2.2 + Math.cos(this.stealthWavePhase * 1.5) * 3;
                ctx.moveTo(0, -h);
                ctx.lineTo(w, 0);
                ctx.lineTo(0, h);
                ctx.lineTo(-w, 0);
                ctx.closePath();
                ctx.stroke();

                for (let i = 0; i < 6; i++) {
                    const angle = (TWO_PI / 6) * i + this.stealthWavePhase;
                    const dist = this.radius * 1.5 + Math.sin(this.stealthWavePhase * 3 + i) * 4;
                    const px = Math.cos(angle) * dist;
                    const py = Math.sin(angle) * dist;

                    ctx.fillStyle = `rgba(${stealthColor.r + 20}, ${stealthColor.g + 10}, ${stealthColor.b}, ${0.3 + Math.sin(this.stealthWavePhase + i) * 0.2})`;
                    ctx.shadowBlur = 10;
                    ctx.beginPath();
                    ctx.arc(px, py, 1.5, 0, TWO_PI);
                    ctx.fill();
                }

                ctx.globalAlpha = 1.0;
            } else {
                // Normal or zombie rammer (zombie = green, normal = orange)
                const g = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
                g.addColorStop(0, '#fff');
                g.addColorStop(1, this.isZombie ? '#0f0' : '#ffa500');

                ctx.fillStyle = g;
                ctx.beginPath();
                const w = this.radius;
                const h = this.radius * 2.2;
                ctx.moveTo(0, -h);
                ctx.lineTo(w, 0);
                ctx.lineTo(0, h);
                ctx.lineTo(-w, 0);
                ctx.closePath();
                ctx.fill();

                ctx.strokeStyle = this.isZombie ? '#0f0' : '#ffa500';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        } else if (this.type === 'exploder') {
            ctx.rotate(this.pulsePhase);
            const pulseScale = 1 + Math.sin(this.pulsePhase * 3) * 0.15;
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius * pulseScale);
            if (this.isZombie) {
                g.addColorStop(0, '#0f0');
                g.addColorStop(0.5, '#0a0');
                g.addColorStop(1, 'rgba(0, 100, 0, 0.3)');
            } else {
                g.addColorStop(0, '#fff');
                g.addColorStop(0.5, '#fafafa');
                g.addColorStop(1, 'rgba(255, 255, 255, 0.3)');
            }
            ctx.fillStyle = g;
            ctx.beginPath();
            for (let i = 0; i < 10; i++) {
                const a = (TWO_PI / 10) * i;
                const x = Math.cos(a) * this.radius * pulseScale;
                const y = Math.sin(a) * this.radius * pulseScale;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = this.isZombie ? '#0f0' : '#fff';
            ctx.lineWidth = 3;
            ctx.shadowBlur = 15;
            ctx.shadowColor = this.isZombie ? '#0f0' : '#fff';
            ctx.stroke();

            ctx.globalAlpha = 0.2 + Math.sin(this.pulsePhase * 3) * 0.1;
            ctx.strokeStyle = this.isZombie ? '#0f0' : '#f00';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.isZombie ? '#0f0' : '#f00';
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * pulseScale * 1.5, 0, TWO_PI);
            ctx.stroke();
        } else {
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
            const baseColor = this.isZombie ? '#0f0' : (this.type === 'basic' ? '#f00' : '#f0f');
            const fadeColor = this.isZombie ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)';
            g.addColorStop(0, baseColor);
            g.addColorStop(1, fadeColor);
            ctx.fillStyle = g;
            ctx.beginPath();
            if (this.type === 'basic') {
                ctx.moveTo(this.radius, 0);
                ctx.lineTo(-this.radius, this.radius);
                ctx.lineTo(-this.radius, -this.radius);
            } else {
                for (let i = 0; i < 6; i++) {
                    const a = (TWO_PI / 6) * i;
                    const x = Math.cos(a) * this.radius;
                    const y = Math.sin(a) * this.radius;
                    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
            }
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = baseColor;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        ctx.restore();
    }
}

// Export for use in main game
window.Enemy = Enemy;
