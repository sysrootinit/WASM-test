// AI WASM Wrapper - JavaScript interface for AI WASM module
let aiWasmModule = null;
let aiWasmReady = false;

// Initialize AI WASM module
async function initAIWasm() {
    try {
        const module = await import('./ai-wasm/pkg/ai_wasm.js');
        await module.default(); // Initialize WASM
        aiWasmModule = module;
        aiWasmReady = true;
        console.log('✅ AI WASM module loaded successfully');
        return true;
    } catch (error) {
        console.error('❌ AI WASM module failed to load:', error);
        console.log('⚠️ Falling back to JavaScript AI implementation');
        aiWasmReady = false;
        return false;
    }
}

// Prepare enemy data for WASM (flat array format)
function prepareEnemyData(enemies) {
    const STRIDE = 21;
    const data = new Float64Array(enemies.length * STRIDE);

    for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        const offset = i * STRIDE;

        data[offset] = e.x;
        data[offset + 1] = e.y;
        data[offset + 2] = e.vx || 0;
        data[offset + 3] = e.vy || 0;

        // Type mapping: basic=0, elite=1, rammer=2, exploder=3
        let typeId = 0;
        if (e.type === 'basic') typeId = 0;
        else if (e.type === 'elite') typeId = 1;
        else if (e.type === 'rammer') typeId = 2;
        else if (e.type === 'exploder') typeId = 3;
        data[offset + 4] = typeId;

        data[offset + 5] = e.isZombie ? 1.0 : 0.0;
        data[offset + 6] = e.isStealth ? 1.0 : 0.0;
        data[offset + 7] = e.radius;
        data[offset + 8] = e.hp;
        data[offset + 9] = e.maxHp;
        data[offset + 10] = e.shootCooldown || 0;
        data[offset + 11] = e.angle || 0;
        data[offset + 12] = e.bounceBoostFrames || 0;
        data[offset + 13] = e.hitCooldown || 0;
        data[offset + 14] = e.chargeCooldown || 0;
        data[offset + 15] = e.chargeFrames || 0;
        data[offset + 16] = e.aggression || 1.0;
        data[offset + 17] = e.pulsePhase || 0;
        data[offset + 18] = e.zombieLifetime || 0;
        data[offset + 19] = e.stealthWavePhase || 0;
        data[offset + 20] = e.splitLevel || 0;
    }

    return data;
}

// Prepare module data
function prepareModuleData(modules) {
    const data = new Float64Array(modules.length * 3);
    for (let i = 0; i < modules.length; i++) {
        data[i * 3] = modules[i].x;
        data[i * 3 + 1] = modules[i].y;
        data[i * 3 + 2] = modules[i].radius;
    }
    return data;
}

// Prepare projectile data
function prepareProjectileData(projectiles) {
    const data = new Float64Array(projectiles.length * 5);
    for (let i = 0; i < projectiles.length; i++) {
        const p = projectiles[i];
        data[i * 5] = p.x;
        data[i * 5 + 1] = p.y;
        data[i * 5 + 2] = p.vx;
        data[i * 5 + 3] = p.vy;

        // Type mapping: player=0, module=1, zombie=2, enemy=3
        let typeNum = 3;
        if (p.type === 'player') typeNum = 0;
        else if (p.type === 'module') typeNum = 1;
        else if (p.type === 'zombie') typeNum = 2;
        data[i * 5 + 4] = typeNum;
    }
    return data;
}

// Update enemies using WASM
function updateEnemiesWasm(enemies, ship, modules, projectiles, canvas) {
    if (!aiWasmReady || !aiWasmModule) {
        return null; // Fallback to JS
    }

    try {
        const enemyData = prepareEnemyData(enemies);
        const moduleData = prepareModuleData(modules);
        const projectileData = prepareProjectileData(projectiles);

        const results = aiWasmModule.update_enemies(
            enemyData,
            ship.x,
            ship.y,
            ship.radius,
            moduleData,
            projectileData,
            canvas.width,
            canvas.height,
            false // shield_active - would need to pass gameState
        );

        // Apply results back to enemy objects
        for (let i = 0; i < enemies.length && i < results.length; i++) {
            const updated = results[i];
            const enemy = enemies[i];

            enemy.x = updated[0];
            enemy.y = updated[1];
            enemy.vx = updated[2];
            enemy.vy = updated[3];
            // Type remains same
            enemy.isZombie = updated[5];
            enemy.isStealth = updated[6];
            // Radius remains same
            enemy.hp = updated[8];
            // maxHp remains same
            enemy.shootCooldown = updated[10];
            enemy.angle = updated[11];
            enemy.bounceBoostFrames = updated[12];
            enemy.hitCooldown = updated[13];
            enemy.chargeCooldown = updated[14];
            enemy.chargeFrames = updated[15];
            enemy.aggression = updated[16];
            enemy.pulsePhase = updated[17];
            enemy.zombieLifetime = updated[18];
            enemy.stealthWavePhase = updated[19];
            enemy.splitLevel = updated[20];
        }

        return true;
    } catch (error) {
        console.error('WASM AI update error:', error);
        return null;
    }
}

// Rebuild enemy grid using WASM
function rebuildEnemyGridWasm(enemies) {
    if (!aiWasmReady || !aiWasmModule) {
        return window.rebuildEnemyGridJS(enemies);
    }

    const positions = new Float64Array(enemies.length * 2);
    for (let i = 0; i < enemies.length; i++) {
        positions[i * 2] = enemies[i].x;
        positions[i * 2 + 1] = enemies[i].y;
    }
    aiWasmModule.rebuild_enemy_grid(positions);
}

// Query enemy neighbors using WASM
function queryEnemyNeighborsWasm(x, y) {
    if (!aiWasmReady || !aiWasmModule) {
        return window.queryEnemyNeighborsJS(x, y);
    }
    return aiWasmModule.query_enemy_neighbors(x, y);
}

// Find module targets using WASM
function findModuleTargetsWasm(modules, enemies) {
    if (!aiWasmReady || !aiWasmModule) {
        return null; // Fallback to JS
    }

    try {
        const moduleData = prepareModuleData(modules);
        const enemyData = prepareEnemyData(enemies);

        const results = aiWasmModule.find_module_targets(moduleData, enemyData);
        return results;
    } catch (error) {
        console.error('WASM module targeting error:', error);
        return null;
    }
}

// Export functions
window.initAIWasm = initAIWasm;
window.updateEnemiesWasm = updateEnemiesWasm;
window.rebuildEnemyGridAI = rebuildEnemyGridWasm;
window.queryEnemyNeighborsAI = queryEnemyNeighborsWasm;
window.findModuleTargetsWasm = findModuleTargetsWasm;
window.aiWasmReady = () => aiWasmReady;
