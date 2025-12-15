// /Users/dark34611/spacegame/powerups.js

const TWO_PI = Math.PI * 2;
const HALF_PI = Math.PI / 2;

class PowerUp {
    constructor(x, y) { this.x = x; this.y = y; this.radius = 10; this.pulse = 0; }
    update(ship) {
        this.pulse += 0.1;
        const dx = ship.x - this.x, dy = ship.y - this.y, dist = Math.hypot(dx, dy);
        if (dist < 100) { this.x += (dx / dist) * 3; this.y += (dy / dist) * 3; }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.pulse);
        const scale = 1 + Math.sin(this.pulse) * 0.2;
        ctx.scale(scale, scale);

        ctx.fillStyle = '#0f0';
        ctx.strokeStyle = '#0f0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (TWO_PI / 5) * i - HALF_PI;
            const x = Math.cos(angle) * this.radius; const y = Math.sin(angle) * this.radius;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            const innerAngle = angle + Math.PI / 5;
            const innerX = Math.cos(innerAngle) * (this.radius / 2); const innerY = Math.sin(innerAngle) * (this.radius / 2);
            ctx.lineTo(innerX, innerY);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

class ModuleStar {
    constructor(x, y) { this.x = x; this.y = y; this.radius = 12; this.pulse = 0; }
    update(ship) {
        this.pulse += 0.1;
        const dx = ship.x - this.x, dy = ship.y - this.y, dist = Math.hypot(dx, dy);
        if (dist < 120) { this.x += (dx / (dist || 1)) * 2.8; this.y += (dy / (dist || 1)) * 2.8; }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.pulse);
        const scale = 1 + Math.sin(this.pulse) * 0.2;
        ctx.scale(scale, scale);

        ctx.fillStyle = '#a0f';
        ctx.strokeStyle = '#a0f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (TWO_PI / 5) * i - HALF_PI;
            const x = Math.cos(angle) * this.radius; const y = Math.sin(angle) * this.radius;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            const innerAngle = angle + Math.PI / 5;
            const innerX = Math.cos(innerAngle) * (this.radius / 2.2); const innerY = Math.sin(innerAngle) * (this.radius / 2.2);
            ctx.lineTo(innerX, innerY);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

window.PowerUp = PowerUp;
window.ModuleStar = ModuleStar;
