class Raccoon extends Enemy {
    constructor(scene, x, y) {
        super(scene, x, y, 'raccoon');

        this.hp    = 30;
        this.maxHp = 30;
        this.speed = 90;

        this.AGGRO_RANGE        = 380;
        this.ATTACK_RANGE       = 60;
        this.ATTACK_DAMAGE      = 8;
        this.ATTACK_COOLDOWN_MS = 1100;
        this.KNOCK_X            = 180;
        this.KNOCK_Y            = -120;

        this.setScale(0.5).setDepth(8);
        // Physics body spans most of the 80×80 texture; world size = 38×38 at 0.5 scale
        this.body.setSize(76, 76);
        this.body.setOffset(2, 2);
    }

    _ai(time, delta) {
        const player = this.scene.player;
        if (!player || !player.active) return;

        const dx   = player.x - this.x;
        const dist = Math.abs(dx);

        if (dist > this.AGGRO_RANGE) {
            this._state = 'idle';
            return;
        }

        this.setFlipX(dx > 0);

        if (dist < this.ATTACK_RANGE) {
            this._state = 'attack';
            this.setVelocityX(0);
            this._tryAttack(time);
        } else {
            this._state = 'aggro';
            this.setVelocityX((dx > 0 ? 1 : -1) * this.speed);
        }
    }

    _tryAttack(time) {
        if (time < this._attackCooldownUntil) return;
        this._attackCooldownUntil = time + this.ATTACK_COOLDOWN_MS;

        const hb = new Hitbox(this.scene, this, {
            x:          35,
            y:          0,
            width:      40,
            height:     30,
            tag:        'enemy_attack',
            lifetimeMs: 200,
            damage:     this.ATTACK_DAMAGE,
        });
        this.scene._enemyHitboxes.add(hb);
    }
}
