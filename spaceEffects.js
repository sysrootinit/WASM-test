// /Users/dark34611/spacegame/spaceEffects.js

class SpaceDebris {
    constructor(canvas, TWO_PI) {
        this.canvas = canvas;
        this.TWO_PI = TWO_PI;
        this.x = Math.random() * this.canvas.width;
        this.y = Math.random() * this.canvas.height;
        this.size = Math.random() * 3 + 1;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.rotation = Math.random() * this.TWO_PI;
        this.rotationSpeed = (Math.random() - 0.5) * 0.1;
        this.type = Math.random() < 0.7 ? 'rock' : 'metal';
        this.trail = [];
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.rotationSpeed;

        // 添加軌跡
        this.trail.push({ x: this.x, y: this.y, life: 20 });
        if (this.trail.length > 8) this.trail.shift();

        // 更新軌跡生命
        this.trail.forEach(point => point.life--);
        this.trail = this.trail.filter(point => point.life > 0);

        // 邊界重置
        if (this.x < -10) this.x = this.canvas.width + 10;
        if (this.x > this.canvas.width + 10) this.x = -10;
        if (this.y < -10) this.y = this.canvas.height + 10;
        if (this.y > this.canvas.height + 10) this.y = -10;
    }

    draw(ctx) {
        ctx.save();

        // 繪製軌跡
        this.trail.forEach((point, index) => {
            ctx.globalAlpha = (point.life / 20) * 0.3;
            ctx.fillStyle = this.type === 'rock' ? '#8b4513' : '#c0c0c0';
            ctx.beginPath();
            ctx.arc(point.x, point.y, this.size * 0.3, 0, this.TWO_PI);
            ctx.fill();
        });

        // 主體
        ctx.globalAlpha = 0.8;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        ctx.fillStyle = this.type === 'rock' ? '#654321' : '#a0a0a0';
        ctx.beginPath();

        // 不規則形狀
        const sides = 6;
        for (let i = 0; i < sides; i++) {
            const angle = (i * this.TWO_PI) / sides;
            const radius = this.size * (0.7 + Math.random() * 0.6);
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }

        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

class Star {
    constructor(canvas, Sprites) {
        this.canvas = canvas;
        this.Sprites = Sprites;
        this.x = Math.random() * this.canvas.width;
        this.y = Math.random() * this.canvas.height;
        this.size = Math.random() * 2.5;
        this.speed = this.size / 2;
        this.opacity = Math.random();
        this.twinkleSpeed = 0.5 + Math.random() * 1.5;
        this.hue = Math.random() > 0.95 ? 180 + Math.random() * 60 : 0; // Some stars are blue
    }
    update() {
        this.y += this.speed;
        if (this.y > this.canvas.height) { this.y = 0; this.x = Math.random() * this.canvas.width; }
        this.opacity = 0.3 + Math.sin(Date.now() * 0.001 * this.twinkleSpeed + this.x) * 0.7;
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        const sprite = (this.hue > 0) ? this.Sprites.stars.blue : this.Sprites.stars.white;
        const sw = sprite.width || sprite.bitmapWidth;
        const sh = sprite.height || sprite.bitmapHeight;
        const scale = this.size / 2.5; // base sprite was authored at 2.5 radius
        const w = sw * scale, h = sh * scale;
        ctx.drawImage(sprite, this.x - w / 2, this.y - h / 2, w, h);
        ctx.restore();
    }
}

window.SpaceDebris = SpaceDebris;
window.Star = Star;
