// WASM 碰撞檢測包裝器
let wasmModule = null;
let wasmReady = false;
let collisionState = null;

// 初始化 WASM 模塊
async function initWasm() {
    try {
        const module = await import('./wasm-pkg/collision_wasm.js');
        await module.default();  // 初始化 WASM
        wasmModule = module;

        // Initialize persistent state
        collisionState = new wasmModule.CollisionState();

        wasmReady = true;
        console.log('✅ WASM 碰撞檢測模塊已加載 (Shared Memory Mode)');
        return true;
    } catch (error) {
        console.error('❌ WASM 模塊加載失敗:', error);
        console.log('⚠️ 將使用 JavaScript 回退實現');
        wasmReady = false;
        return false;
    }
}

// 將遊戲對象寫入 WASM 共享內存
function prepareCollisionDataShared(projectiles, enemies, ship, modules, powerups, modulestars) {
    const memory = wasmModule.initSync ? wasmModule.initSync().memory : wasmModule.default.memory || wasmModule.memory;
    if (!memory) {
        // Fallback if memory not found directly (should be exported)
        console.error("WASM memory not accessible");
        return false;
    }

    // 1. Projectiles
    const projSize = projectiles.length * 5;
    collisionState.ensure_proj_buffer_size(projSize);
    const projPtr = collisionState.get_proj_buffer_ptr();
    const projView = new Float64Array(memory.buffer, projPtr, projSize);

    for (let i = 0; i < projectiles.length; i++) {
        const proj = projectiles[i];
        const offset = i * 5;
        projView[offset] = proj.x;
        projView[offset + 1] = proj.y;
        projView[offset + 2] = proj.radius;
        projView[offset + 3] = proj.damage;

        let typeNum = 0;
        if (proj.type === 'player') typeNum = 0;
        else if (proj.type === 'module') typeNum = 1;
        else if (proj.type === 'zombie') typeNum = 2;
        else if (proj.type === 'enemy') typeNum = 3;
        projView[offset + 4] = typeNum;
    }

    // 2. Enemies
    const enemySize = enemies.length * 4;
    collisionState.ensure_enemy_buffer_size(enemySize);
    const enemyPtr = collisionState.get_enemy_buffer_ptr();
    const enemyView = new Float64Array(memory.buffer, enemyPtr, enemySize);

    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        const offset = i * 4;
        enemyView[offset] = enemy.x;
        enemyView[offset + 1] = enemy.y;
        enemyView[offset + 2] = enemy.radius;
        enemyView[offset + 3] = enemy.isZombie ? 1.0 : 0.0;
    }

    // 3. Ship
    const shipPtr = collisionState.get_ship_buffer_ptr();
    const shipView = new Float64Array(memory.buffer, shipPtr, 3);
    shipView[0] = ship.x;
    shipView[1] = ship.y;
    shipView[2] = ship.radius;

    // 4. Modules
    const modSize = modules.length * 3;
    collisionState.ensure_mod_buffer_size(modSize);
    const modPtr = collisionState.get_mod_buffer_ptr();
    const modView = new Float64Array(memory.buffer, modPtr, modSize);

    for (let i = 0; i < modules.length; i++) {
        const mod = modules[i];
        const offset = i * 3;
        modView[offset] = mod.x;
        modView[offset + 1] = mod.y;
        modView[offset + 2] = mod.radius;
    }

    // 5. Powerups
    const powerupSize = powerups.length * 3;
    collisionState.ensure_powerup_buffer_size(powerupSize);
    const powerupPtr = collisionState.get_powerup_buffer_ptr();
    const powerupView = new Float64Array(memory.buffer, powerupPtr, powerupSize);

    for (let i = 0; i < powerups.length; i++) {
        const pu = powerups[i];
        const offset = i * 3;
        powerupView[offset] = pu.x;
        powerupView[offset + 1] = pu.y;
        powerupView[offset + 2] = pu.radius;
    }

    // 6. ModuleStars
    const starSize = modulestars.length * 3;
    collisionState.ensure_star_buffer_size(starSize);
    const starPtr = collisionState.get_star_buffer_ptr();
    const starView = new Float64Array(memory.buffer, starPtr, starSize);

    for (let i = 0; i < modulestars.length; i++) {
        const star = modulestars[i];
        const offset = i * 3;
        starView[offset] = star.x;
        starView[offset + 1] = star.y;
        starView[offset + 2] = star.radius;
    }

    return true;
}


// 改進的 JavaScript 碰撞檢測實現（作為 WASM 回退）
function checkCollisionsJS(projectiles, enemies, ship, modules, powerups, modulestars, gameState) {
    const results = {
        projectile_hits: [],
        enemy_hits: [],
        ship_hit: false,
        ship_damage: 0,
        powerup_collected: [],
        modulestar_collected: [],
        free: () => {} // No-op for compatibility
    };

    const removedProjs = new Set();

    // Helper function for distance squared
    const distSq = (x1, y1, x2, y2) => {
        const dx = x1 - x2;
        const dy = y1 - y2;
        return dx * dx + dy * dy;
    };

    // 1. Player/Module/Zombie Projectiles vs Enemies
    for (let i = 0; i < projectiles.length; i++) {
        if (removedProjs.has(i)) continue;
        
        const proj = projectiles[i];
        
        // Type check: player=0, module=1, zombie=2 projectiles hit enemies
        if (proj.type === 'player' || proj.type === 'module' || proj.type === 'zombie') {
            for (let j = 0; j < enemies.length; j++) {
                const enemy = enemies[j];
                
                // Zombie projectiles don't hit zombies
                if (proj.type === 'zombie' && enemy.isZombie) continue;
                
                const dist = distSq(proj.x, proj.y, enemy.x, enemy.y);
                const radiusSum = proj.radius + enemy.radius;
                
                if (dist < radiusSum * radiusSum) {
                    results.projectile_hits.push(i);
                    removedProjs.add(i);
                    
                    results.enemy_hits.push(j);
                    results.enemy_hits.push(proj.damage);
                    
                    break;
                }
            }
        }
    }

    // 2. Enemy Projectiles vs Ship/Modules/Zombies
    for (let i = 0; i < projectiles.length; i++) {
        if (removedProjs.has(i)) continue;
        
        const proj = projectiles[i];
        
        if (proj.type === 'enemy') {
            let hit = false;
            
            // Check Ship collision
            const shipDist = distSq(proj.x, proj.y, ship.x, ship.y);
            const shipRadiusSum = proj.radius + ship.radius;
            
            if (shipDist < shipRadiusSum * shipRadiusSum) {
                if (!gameState.shieldActive) {
                    results.ship_hit = true;
                    results.ship_damage += proj.damage;
                }
                results.projectile_hits.push(i);
                removedProjs.add(i);
                hit = true;
            }
            
            // Check Module collisions (if not already hit)
            if (!hit) {
                for (let m = 0; m < modules.length; m++) {
                    const module = modules[m];
                    const modDist = distSq(proj.x, proj.y, module.x, module.y);
                    const modRadiusSum = proj.radius + module.radius;
                    
                    if (modDist < modRadiusSum * modRadiusSum) {
                        results.projectile_hits.push(i);
                        removedProjs.add(i);
                        hit = true;
                        break;
                    }
                }
            }
            
            // Check Zombie collisions (if not already hit)
            if (!hit) {
                for (let j = 0; j < enemies.length; j++) {
                    const enemy = enemies[j];
                    
                    if (!enemy.isZombie) continue;
                    
                    const zombieDist = distSq(proj.x, proj.y, enemy.x, enemy.y);
                    const zombieRadiusSum = proj.radius + enemy.radius;
                    
                    if (zombieDist < zombieRadiusSum * zombieRadiusSum) {
                        results.projectile_hits.push(i);
                        removedProjs.add(i);
                        
                        results.enemy_hits.push(j);
                        results.enemy_hits.push(proj.damage);
                        
                        hit = true;
                        break;
                    }
                }
            }
        }
    }

    // 3. PowerUp Collection by Ship
    for (let i = 0; i < powerups.length; i++) {
        const powerup = powerups[i];
        const dist = distSq(ship.x, ship.y, powerup.x, powerup.y);
        const radiusSum = ship.radius + powerup.radius;
        
        if (dist < radiusSum * radiusSum) {
            results.powerup_collected.push(i);
        }
    }

    // 4. ModuleStar Collection by Ship
    for (let i = 0; i < modulestars.length; i++) {
        const star = modulestars[i];
        const dist = distSq(ship.x, ship.y, star.x, star.y);
        const radiusSum = ship.radius + star.radius;
        
        if (dist < radiusSum * radiusSum) {
            results.modulestar_collected.push(i);
        }
    }

    return results;
}

// WASM 碰撞檢測函數（帶 JS 回退）
function checkCollisionsWasm(projectiles, enemies, ship, modules, powerups, modulestars, gameState) {
    // 暫時使用 JS 實現，直到 WASM 編譯問題解決
    if (!wasmReady || !wasmModule || !collisionState) {
        return checkCollisionsJS(projectiles, enemies, ship, modules, powerups, modulestars, gameState);
    }

    try {
        // Write data to shared memory
        if (!prepareCollisionDataShared(projectiles, enemies, ship, modules, powerups, modulestars)) {
            return checkCollisionsJS(projectiles, enemies, ship, modules, powerups, modulestars, gameState);
        }

        // Run collision check
        collisionState.check_collisions_shared(
            projectiles.length,
            enemies.length,
            modules.length,
            powerups.length,
            modulestars.length,
            gameState.shieldActive
        );

        // Read results directly from memory
        const memory = wasmModule.initSync ? wasmModule.initSync().memory : wasmModule.default.memory || wasmModule.memory;

        // Projectile Hits
        const projHitsPtr = collisionState.get_projectile_hits_ptr();
        const projHitsLen = collisionState.get_projectile_hits_len();
        const projectile_hits = new Uint32Array(memory.buffer, projHitsPtr, projHitsLen);

        // Enemy Hits
        const enemyHitsPtr = collisionState.get_enemy_hits_ptr();
        const enemyHitsLen = collisionState.get_enemy_hits_len();
        const enemy_hits = new Float64Array(memory.buffer, enemyHitsPtr, enemyHitsLen);

        // Ship Hit
        const ship_hit = collisionState.get_ship_hit();
        const ship_damage = collisionState.get_ship_damage();

        // Powerup Collected
        const powerupHitsPtr = collisionState.get_powerup_collected_ptr();
        const powerupHitsLen = collisionState.get_powerup_collected_len();
        const powerup_collected = new Uint32Array(memory.buffer, powerupHitsPtr, powerupHitsLen);

        // Star Collected
        const starHitsPtr = collisionState.get_modulestar_collected_ptr();
        const starHitsLen = collisionState.get_modulestar_collected_len();
        const modulestar_collected = new Uint32Array(memory.buffer, starHitsPtr, starHitsLen);

        return {
            projectile_hits: projectile_hits,
            enemy_hits: enemy_hits,
            ship_hit: ship_hit,
            ship_damage: ship_damage,
            powerup_collected: powerup_collected,
            modulestar_collected: modulestar_collected,
            free: () => {} // No-op, memory is managed by CollisionState
        };

    } catch (error) {
        console.error('WASM 碰撞檢測錯誤，回退到 JS:', error);
        return checkCollisionsJS(projectiles, enemies, ship, modules, powerups, modulestars, gameState);
    }
}

// 導出函數
window.initWasm = initWasm;
window.checkCollisionsWasm = checkCollisionsWasm;
window.wasmReady = () => wasmReady;
