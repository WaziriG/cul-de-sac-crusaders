class Enemy extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, texture) {
        super(scene, x, y, texture);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.hp    = 30;
        this.maxHp = 30;
        this.speed = 90;

        this._state               = 'idle';
        this._invulnUntil         = 0;
        this._attackCooldownUntil = 0;
        this._hpBarGfx            = scene.add.graphics().setDepth(15);

        this.body.setCollideWorldBounds(true);
        this.body.setDragX(1200);
    }

    update(time, delta) {
        if (this._state === 'dead') return;
        this._ai(time, delta);
        this._drawHpBar();
    }

    _ai(time, delta) { /* overridden by subclasses */ }

    takeDamage(amount, opts = {}) {
        const now = this.scene.time.now;
        if (now < this._invulnUntil || this._state === 'dead') return false;

        this._invulnUntil = now + 120;
        this.hp = Math.max(0, this.hp - amount);

        if (opts.knockbackX !== undefined) this.setVelocityX(opts.knockbackX);
        if (opts.knockbackY !== undefined) this.setVelocityY(opts.knockbackY);

        this.setTint(0xff4444);
        this.scene.time.delayedCall(120, () => {
            if (this.active) this.clearTint();
        });

        if (this.hp <= 0) this._die();
        return true;
    }

    _die() {
        this._state      = 'dead';
        this.body.enable = false;
        this._hpBarGfx.destroy();

        this.scene.tweens.add({
            targets:    this,
            alpha:      0,
            scaleY:     0,
            duration:   300,
            ease:       'Quad.easeIn',
            onComplete: () => this.destroy(),
        });
    }

    _drawHpBar() {
        const g = this._hpBarGfx;
        g.clear();
        if (!this.active) return;

        const W  = 40, H = 5;
        const bx = this.x - W / 2;
        const by = this.y - this.displayHeight / 2 - 10;

        g.fillStyle(0x000000, 0.7);
        g.fillRect(bx - 1, by - 1, W + 2, H + 2);

        const frac  = this.hp / this.maxHp;
        const color = frac > 0.5 ? 0x44ee44 : frac > 0.25 ? 0xeeee44 : 0xee4444;
        g.fillStyle(color, 1);
        g.fillRect(bx, by, W * frac, H);
    }

    destroy(...args) {
        if (this._hpBarGfx && this._hpBarGfx.active) this._hpBarGfx.destroy();
        super.destroy(...args);
    }
}
