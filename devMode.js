// ============ SECURE DEV MODE SYSTEM ============
// Multi-layer security:
// 1. Complex key sequence (must be pressed in exact order within 5 seconds)
// 2. SHA-256 password hash verification

class DevMode {
    constructor() {
        this.active = false;
        this.keySequence = [];
        this.sequenceTimer = null;
        this.sequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
        this.passwordHash = '90888bf5f250df0a05b3f255e33c2ad229d905f9361b906cc311a90e0ab70644';

        // Death cause tracking
        this.damageLog = this.resetDamageLog();
    }

    resetDamageLog() {
        return {
            enemyBullets: 0,
            rammerCollisions: 0,
            exploderExplosions: 0,
            splitDrain: 0,
            shieldCost: 0,
            supernovaCost: 0,
            playerShots: 0,
            timestamp: performance.now()
        };
    }

    logDamage(type, amount) {
        if (!this.active) return;

        switch (type) {
            case 'enemyBullet':
                this.damageLog.enemyBullets += amount;
                break;
            case 'rammerCollision':
                this.damageLog.rammerCollisions += amount;
                break;
            case 'exploderExplosion':
                this.damageLog.exploderExplosions += amount;
                break;
            case 'splitDrain':
                this.damageLog.splitDrain += amount;
                break;
            case 'shield':
                this.damageLog.shieldCost += amount;
                break;
            case 'supernova':
                this.damageLog.supernovaCost += amount;
                break;
            case 'playerShot':
                this.damageLog.playerShots += amount;
                break;
        }
    }

    reportDeathCause(gameState, ship) {
        if (!this.active) return;

        const survivalTime = ((performance.now() - this.damageLog.timestamp) / 1000).toFixed(1);
        const totalDamage = this.damageLog.enemyBullets + this.damageLog.rammerCollisions + this.damageLog.exploderExplosions;
        const totalEnergyCost = this.damageLog.splitDrain + this.damageLog.shieldCost + this.damageLog.supernovaCost + this.damageLog.playerShots;

        console.log('%c💀 ===== DEATH REPORT ===== 💀', 'color: #f00; font-size: 20px; font-weight: bold; background: #000; padding: 10px;');
        console.log('%c⏱️ 生存時間:', 'color: #0ff; font-weight: bold;', `${survivalTime} 秒`);
        console.log('%c🌊 波數:', 'color: #0ff; font-weight: bold;', gameState.wave);
        console.log('%c🎯 分數:', 'color: #0ff; font-weight: bold;', gameState.score);
        console.log('%c🔥 連擊:', 'color: #0ff; font-weight: bold;', `${gameState.combo}x (最高: ${gameState.maxCombo}x)`);

        console.log('\n%c📊 傷害來源統計:', 'color: #ff0; font-size: 16px; font-weight: bold;');

        if (totalDamage > 0) {
            console.log('%c  🎯 敵人子彈傷害:', 'color: #f0f;', `${this.damageLog.enemyBullets} (${(this.damageLog.enemyBullets / totalDamage * 100).toFixed(1)}%)`);
            console.log('%c  💥 Rammer 撞擊:', 'color: #ffa500;', `${this.damageLog.rammerCollisions} (${(this.damageLog.rammerCollisions / totalDamage * 100).toFixed(1)}%)`);
            console.log('%c  💣 Exploder 爆炸:', 'color: #fff;', `${this.damageLog.exploderExplosions} (${(this.damageLog.exploderExplosions / totalDamage * 100).toFixed(1)}%)`);
            console.log('%c  📉 總傷害:', 'color: #f00; font-weight: bold;', totalDamage);
        } else {
            console.log('%c  ✅ 無直接傷害', 'color: #0f0;');
        }

        console.log('\n%c⚡ 能量消耗統計:', 'color: #ff0; font-size: 16px; font-weight: bold;');
        console.log('%c  🔄 分裂模式耗能:', 'color: #0ff;', this.damageLog.splitDrain);
        console.log('%c  🛡️ 護盾消耗:', 'color: #0ff;', this.damageLog.shieldCost);
        console.log('%c  💥 超新星消耗:', 'color: #0ff;', this.damageLog.supernovaCost);
        console.log('%c  🔫 射擊消耗:', 'color: #0ff;', this.damageLog.playerShots);
        console.log('%c  📉 總消耗:', 'color: #0ff; font-weight: bold;', totalEnergyCost);

        console.log('\n%c🔍 死因分析:', 'color: #ff0; font-size: 16px; font-weight: bold;');

        // Determine primary cause of death
        let primaryCause = '';
        let causeColor = '#fff';

        if (totalDamage === 0 && totalEnergyCost > 0) {
            primaryCause = '能量管理不當 - 過度使用能力/分裂模式';
            causeColor = '#0ff';
        } else if (this.damageLog.rammerCollisions > totalDamage * 0.5) {
            primaryCause = 'Rammer 壓制 - 撞擊傷害佔主導';
            causeColor = '#ffa500';
        } else if (this.damageLog.exploderExplosions > totalDamage * 0.4) {
            primaryCause = 'Exploder 包圍 - 爆炸傷害致命';
            causeColor = '#fff';
        } else if (this.damageLog.enemyBullets > totalDamage * 0.6) {
            primaryCause = '彈幕壓制 - 敵人火力過強';
            causeColor = '#f0f';
        } else if (this.damageLog.splitDrain > 50) {
            primaryCause = '分裂過久 - 能量持續流失';
            causeColor = '#0ff';
        } else {
            primaryCause = '混合傷害 - 多種威脅同時存在';
            causeColor = '#f00';
        }

        console.log(`%c  ⚠️ ${primaryCause}`, `color: ${causeColor}; font-weight: bold;`);

        // Survival tips
        console.log('\n%c💡 生存建議:', 'color: #0f0; font-size: 16px; font-weight: bold;');
        if (this.damageLog.rammerCollisions > 20) {
            console.log('%c  • 使用護盾反彈 Rammer', 'color: #0f0;');
        }
        if (this.damageLog.exploderExplosions > 30) {
            console.log('%c  • 保持距離，優先擊殺 Exploder', 'color: #0f0;');
        }
        if (this.damageLog.splitDrain > 30) {
            console.log('%c  • 減少分裂時間，及時合併模組', 'color: #0f0;');
        }
        if (this.damageLog.enemyBullets > 50) {
            console.log('%c  • 提升走位，善用護盾吸收子彈', 'color: #0f0;');
        }
        if (ship.modules.length < 3) {
            console.log('%c  • 收集紫色星星增加模組數量', 'color: #0f0;');
        }

        console.log('\n%c🔧 飛船狀態:', 'color: #ff0; font-size: 16px; font-weight: bold;');
        console.log('%c  🚀 模組數:', 'color: #a0f;', ship.modules.length);
        console.log('%c  🔄 分裂狀態:', 'color: #a0f;', ship.isSplit ? '✅ 已分裂' : '❌ 未分裂');
        console.log('%c  🛡️ 護盾冷卻:', 'color: #a0f;', gameState.shieldCooldown > 0 ? `${gameState.shieldCooldown} 幀` : '✅ 就緒');
        console.log('%c  💥 超新星冷卻:', 'color: #a0f;', gameState.supernovaCooldown > 0 ? `${gameState.supernovaCooldown} 幀` : '✅ 就緒');

        console.log('\n%c=========================', 'color: #f00; font-size: 20px; font-weight: bold;');

        // Reset log for next game
        this.damageLog = this.resetDamageLog();
    }

    async sha256(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    handleKeyPress(e) {
        if (this.active) return;

        // Track key sequence
        this.keySequence.push(e.code);

        // Reset timer
        if (this.sequenceTimer) clearTimeout(this.sequenceTimer);
        this.sequenceTimer = setTimeout(() => {
            this.keySequence = [];
        }, 5000);

        // Check if sequence matches
        if (this.keySequence.length > this.sequence.length) {
            this.keySequence.shift();
        }

        if (this.keySequence.length === this.sequence.length) {
            let match = true;
            for (let i = 0; i < this.sequence.length; i++) {
                if (this.keySequence[i] !== this.sequence[i]) {
                    match = false;
                    break;
                }
            }

            if (match) {
                // Sequence matched! Now prompt for password
                const password = prompt('🔐 驗證碼:');
                if (password) {
                    this.sha256(password).then(hash => {
                        if (hash === this.passwordHash) {
                            this.active = true;
                            document.getElementById('devModePanel').style.display = 'block';
                            console.log('%c🔓 DEV MODE ACTIVATED', 'color: #f0f; font-size: 20px; font-weight: bold;');
                        } else {
                            console.log('❌ Invalid credentials');
                        }
                    });
                }
                this.keySequence = [];
            }
        }
    }

    setupButtons(gameState, ship, enemies, particles, getParticle, MAX_MODULES, Module, spawnWave, TWO_PI) {
        // Add energy
        document.getElementById('devAddEnergy').addEventListener('click', () => {
            if (!this.active) return;
            gameState.energy = Math.min(gameState.energy + 1000, gameState.maxEnergy);
            // Update UI to reflect energy change immediately
            if (typeof updateUI === 'function') {
                updateUI();
            } else {
                // Fallback to direct DOM updates if updateUI is not available in scope
                const energyEl = document.getElementById('energy');
                if (energyEl) {
                    energyEl.textContent = Math.max(0, gameState.energy);
                    energyEl.style.color = gameState.energy < 30 ? '#f00' : '#0ff';
                }
            }
        });

        // Max modules
        document.getElementById('devMaxModules').addEventListener('click', () => {
            if (!this.active) return;
            while (ship.modules.length < MAX_MODULES) {
                ship.modules.push(new Module(ship.x, ship.y));
            }
        });

        // Kill all enemies
        document.getElementById('devKillAll').addEventListener('click', () => {
            if (!this.active) return;
            for (let i = enemies.length - 1; i >= 0; i--) {
                const enemy = enemies[i];
                for (let j = 0; j < 10; j++) particles.push(getParticle(enemy.x, enemy.y, enemy.isZombie));
            }
            enemies.length = 0;
        });

        // Set rammer kills
        document.getElementById('devSetRammerKills').addEventListener('click', () => {
            if (!this.active) return;
            gameState.rammerKillCount += 18;
            document.getElementById('devRammerCount').textContent = gameState.rammerKillCount;
        });

        // Unlock zombie mode
        document.getElementById('devUnlockZombie').addEventListener('click', () => {
            if (!this.active) return;
            gameState.zombieUnlocked = true;
            gameState.zombieKillCount = 15;
            console.log('%c🧟 ZOMBIE MODE UNLOCKED!', 'color: #0f0; font-size: 16px; font-weight: bold;');

            // Visual feedback - briefly change button color
            const btn = document.getElementById('devUnlockZombie');
            btn.style.background = 'rgba(0, 255, 0, 0.5)';
            btn.textContent = '✅ 殭屍模式已解鎖';
            setTimeout(() => {
                btn.style.background = 'rgba(0, 255, 0, 0.2)';
            }, 1000);
        });

        // Next wave
        document.getElementById('devNextWave').addEventListener('click', () => {
            if (!this.active) return;
            enemies.length = 0;
            gameState.pendingWave = true;
            gameState.wave += 1;
            setTimeout(() => spawnWave(), 100);
        });

        // Spawn enemy
        document.getElementById('devSpawnEnemy').addEventListener('click', () => {
            if (!this.active) return;

            const spawnType = document.getElementById('devSpawnType').value;
            const asZombie = document.getElementById('devSpawnAsZombie').checked;

            // Spawn offset from player
            const offsetAngle = Math.random() * TWO_PI;
            const offsetDist = 100;
            const spawnX = ship.x + Math.cos(offsetAngle) * offsetDist;
            const spawnY = ship.y + Math.sin(offsetAngle) * offsetDist;

            let enemy;

            // This needs Enemy class from gameAI.js
            const Enemy = window.Enemy;

            switch (spawnType) {
                case 'basic':
                    enemy = new Enemy(spawnX, spawnY, 'basic', asZombie, false);
                    break;
                case 'elite':
                    enemy = new Enemy(spawnX, spawnY, 'elite', asZombie, false);
                    break;
                case 'rammer':
                    enemy = new Enemy(spawnX, spawnY, 'rammer', asZombie, false);
                    break;
                case 'rammer-stealth':
                    enemy = new Enemy(spawnX, spawnY, 'rammer', asZombie, true);
                    break;
                case 'exploder':
                    enemy = new Enemy(spawnX, spawnY, 'exploder', asZombie, false);
                    break;
            }

            if (enemy) {
                enemies.push(enemy);
                // Visual feedback with zombie-specific color
                for (let i = 0; i < 15; i++) {
                    particles.push(getParticle(spawnX, spawnY, asZombie));
                }
            }
        });

        // Update dev panel info regularly
        setInterval(() => {
            if (this.active) {
                document.getElementById('devRammerCount').textContent = gameState.rammerKillCount;
                // Update FPS display
                const fps = window.currentFPS || 60;
                document.getElementById('devFPS').textContent = fps;
                // Update zombie mode status
                const zombieStatus = document.getElementById('devZombieStatus');
                if (gameState.zombieUnlocked) {
                    zombieStatus.textContent = '✅ 已解鎖';
                    zombieStatus.style.color = '#0f0';
                } else {
                    zombieStatus.textContent = '❌ 未解鎖';
                    zombieStatus.style.color = '#f00';
                }
            }
        }, 100);
    }
}

// Export for use in main game
window.DevMode = DevMode;
