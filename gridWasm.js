// gridWasm.js
let gridWasmModule = null;
let gridWasmReady = false;

async function initGridWasm() {
    try {
        const module = await import('./grid-wasm/pkg/grid_wasm.js');
        await module.default(); // Initialize WASM
        gridWasmModule = module;
        gridWasmReady = true;
        console.log('✅ WASM Grid System module loaded');
        return true;
    } catch (error) {
        console.error('❌ WASM Grid System module failed to load:', error);
        console.log('⚠️ Falling back to JavaScript implementation for Grid System');
        gridWasmReady = false;
        return false;
    }
}

function rebuildEnemyGridWasm(enemies) {
    if (!gridWasmReady || !gridWasmModule) {
        // Fallback to JS if WASM not ready
        return window.rebuildEnemyGridJS(enemies);
    }
    const enemyPositions = new Float64Array(enemies.length * 2);
    for (let i = 0; i < enemies.length; i++) {
        enemyPositions[i * 2] = enemies[i].x;
        enemyPositions[i * 2 + 1] = enemies[i].y;
    }
    gridWasmModule.rebuild_grid(enemyPositions);
}

function queryEnemyNeighborsWasm(x, y) {
    if (!gridWasmReady || !gridWasmModule) {
        // Fallback to JS if WASM not ready
        return window.queryEnemyNeighborsJS(x, y);
    }
    return gridWasmModule.query_neighbors(x, y);
}

// Export for main game
window.initGridWasm = initGridWasm;
window.rebuildEnemyGrid = rebuildEnemyGridWasm;
window.queryEnemyNeighbors = queryEnemyNeighborsWasm;
