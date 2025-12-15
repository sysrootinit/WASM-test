// Particle WASM Wrapper - JavaScript interface for particle WASM module
let particleWasmModule = null;
let particleWasmReady = false;
let particleState = null;

// Initialize Particle WASM module
async function initParticleWasm() {
    try {
        const module = await import('./particle-wasm/pkg/particle_wasm.js');
        await module.default(); // Initialize WASM
        particleWasmModule = module;

        particleWasmReady = true;
        console.log('✅ Particle WASM module loaded successfully');
        return true;
    } catch (error) {
        console.error('❌ Particle WASM module failed to load:', error);
        console.log('⚠️ Falling back to JavaScript particle implementation');
        particleWasmReady = false;
        return false;
    }
}

// Convert JS Particle array to WASM format and update
function updateParticlesWasm(particles) {
    if (!particleWasmReady || !particleWasmModule || particles.length === 0) {
        return null; // Fallback to JS
    }

    try {
        // Prepare flat array: [x, y, vx, vy, life, hue, ...]
        const flatData = new Float64Array(particles.length * 6);

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const offset = i * 6;

            flatData[offset] = p.x;
            flatData[offset + 1] = p.y;
            flatData[offset + 2] = p.vx;
            flatData[offset + 3] = p.vy;
            flatData[offset + 4] = p.life;

            // Extract hue from color string "hsl(value, ...)"
            const hueMatch = p.color.match(/hsl\((\d+(?:\.\d+)?)/);
            flatData[offset + 5] = hueMatch ? parseFloat(hueMatch[1]) : 0;
        }

        // Call WASM update function - it returns only alive particles
        const resultData = particleWasmModule.update_particles(flatData);

        // Convert back to JS Particle objects
        const aliveCount = resultData.length / 6;
        const survivingParticles = [];

        for (let i = 0; i < aliveCount; i++) {
            const offset = i * 6;

            // Try to reuse existing particle object
            const p = i < particles.length ? particles[i] : {};

            p.x = resultData[offset];
            p.y = resultData[offset + 1];
            p.vx = resultData[offset + 2];
            p.vy = resultData[offset + 3];
            p.life = resultData[offset + 4];

            const hue = resultData[offset + 5];
            p.color = `hsl(${hue}, 100%, 50%)`;

            survivingParticles.push(p);
        }

        return survivingParticles;

    } catch (error) {
        console.error('WASM particle update error:', error);
        return null;
    }
}

// Create explosion particles using WASM
function createExplosionParticlesWasm(x, y, count, isZombie, getParticle) {
    if (!particleWasmReady || !particleWasmModule) {
        // Fallback to JS
        const particles = [];
        for (let i = 0; i < count; i++) {
            particles.push(getParticle(x, y, isZombie));
        }
        return particles;
    }

    try {
        const particleData = particleWasmModule.create_explosion_particles(x, y, count, isZombie);
        const particles = [];

        // Convert flat array to Particle objects
        for (let i = 0; i < count; i++) {
            const offset = i * 6;
            const p = getParticle(x, y, isZombie);
            p.x = particleData[offset];
            p.y = particleData[offset + 1];
            p.vx = particleData[offset + 2];
            p.vy = particleData[offset + 3];
            p.life = particleData[offset + 4];
            const hue = particleData[offset + 5];
            p.color = `hsl(${hue}, 100%, 50%)`;
            particles.push(p);
        }

        return particles;

    } catch (error) {
        console.error('WASM explosion creation error:', error);
        // Fallback to JS
        const particles = [];
        for (let i = 0; i < count; i++) {
            particles.push(getParticle(x, y, isZombie));
        }
        return particles;
    }
}

// Export functions
window.initParticleWasm = initParticleWasm;
window.updateParticlesWasm = updateParticlesWasm;
window.createExplosionParticlesWasm = createExplosionParticlesWasm;
window.particleWasmReady = () => particleWasmReady;
