class Deer extends Enemy {
    constructor(scene, x, y) {
        super(scene, x, y, 'deer');

        this.hp    = 60;
        this.maxHp = 60;
        this.speed = 70;

        this.AGGRO_RANGE             = 480;
        this.WIND_UP_MS              = 700;
        this.CHARGE_SPEED            = 520;
        this.CHARGE_MAX_MS           = 1400;
        this.RECOVERY_MS             = 900;
        this.CHARGE_DAMAGE           = 22;
        this.CHARGE_KNOCKBACK_X      = 480;
        this.CHARGE_KNOCKBACK_Y      = -240;
        this.POST_CHARGE_COOLDOWN_MS = 600;
        this.KNOCK_RESISTANCE        = 1.6;

        this._chargeState      = 'idle';
        this._chargeStateTimer = 0;
        this._chargeDirection  = 0;
        this._chargeHitbox     = null;
        this._didConnectCharge = false;

        this.setScale(0.7).setDepth(8);
        this.body.setSize(140, 110);
        this.body.setOffset(30, 30);
    }

    _ai(time, delta) {
        const player = this.scene.player;
        if (!player || !player.active) return;
        if (this._chargeStateTimer > 0) this._chargeStateTimer -= delta;

        switch (this._chargeState) {
            case 'idle': {
                const dx   = player.x - this.x;
                const dist = Math.abs(dx);
                if (dist > this.AGGRO_RANGE) {
                    this.body.setVelocityX(0);
                    this.setFlipX(dx > 0);
                    return;
                }
                this._enterWindUp(dx);
                break;
            }
            case 'wind_up': {
                this.body.setVelocityX(0);
                if (this._chargeStateTimer <= 0) this._enterCharging();
                break;
            }
            case 'charging': {
                this.body.setVelocityX(this.CHARGE_SPEED * this._chargeDirection);
                const stuckOnWall = Math.abs(this.body.velocity.x) < 50;
                if (this._chargeStateTimer <= 0 || stuckOnWall) this._enterRecovery();
                break;
            }
            case 'recovering': {
                this.body.setDragX(this.body.velocity.x !== 0 ? 1200 : 800);
                if (this._chargeStateTimer <= 0) {
                    this.body.setDragX(800);
                    this._enterCooldown();
                }
                break;
            }
            case 'cooldown': {
                this.body.setVelocityX(0);
                if (this._chargeStateTimer <= 0) this._chargeState = 'idle';
                break;
            }
        }
    }

    _enterWindUp(dx) {
        this._chargeState      = 'wind_up';
        this._chargeStateTimer = this.WIND_UP_MS;
        this._chargeDirection  = Math.sign(dx) || 1;
        this.setFlipX(this._chargeDirection > 0);
        this._didConnectCharge = false;

        this.setTint(0xff6666);
        this.scene.tweens.add({
            targets:  this,
            y:        this.y - 20,
            duration: this.WIND_UP_MS * 0.4,
            yoyo:     true,
            ease:     'Sine.easeInOut',
        });
        this.scene.tweens.add({
            targets:    this,
            duration:   180,
            repeat:     3,
            yoyo:       true,
            onYoyo:     () => this.clearTint(),
            onRepeat:   () => this.setTint(0xff6666),
            onComplete: () => this.clearTint(),
        });
    }

    _enterCharging() {
        this._chargeState      = 'charging';
        this._chargeStateTimer = this.CHARGE_MAX_MS;
        this.clearTint();
        this.setRotation(0.15 * this._chargeDirection);

        const facing = this._chargeDirection;
        this._chargeHitbox = new Hitbox(this.scene, this, {
            x:          60 * facing,
            y:          0,
            width:      110,
            height:     100,
            damage:     this.CHARGE_DAMAGE,
            knockbackX: this.CHARGE_KNOCKBACK_X * facing,
            knockbackY: this.CHARGE_KNOCKBACK_Y,
            lifetimeMs: this.CHARGE_MAX_MS + 50,
            tag:        'enemy_attack',
            onHit: (target) => {
                if (this._didConnectCharge) return;
                this._didConnectCharge = true;
                this._chargeStateTimer = 0;
            },
        });
        this.scene._enemyHitboxes.add(this._chargeHitbox);
    }

    _enterRecovery() {
        this._chargeState      = 'recovering';
        this._chargeStateTimer = this.RECOVERY_MS;
        this.setRotation(0);
        if (this._chargeHitbox) {
            this._chargeHitbox.destroy();
            this._chargeHitbox = null;
        }
        this.scene.tweens.add({
            targets:    this,
            angle:      { from: -3, to: 3 },
            duration:   220,
            yoyo:       true,
            repeat:     2,
            ease:       'Sine.easeInOut',
            onComplete: () => this.setAngle(0),
        });
    }

    _enterCooldown() {
        this._chargeState      = 'cooldown';
        this._chargeStateTimer = this.POST_CHARGE_COOLDOWN_MS;
    }

    takeDamage(amount, opts = {}) {
        // Reduce incoming knockback by resistance factor — heavier than raccoon
        if (opts.knockbackX !== undefined) {
            opts = { ...opts, knockbackX: opts.knockbackX / this.KNOCK_RESISTANCE };
        }
        const hit = super.takeDamage(amount, opts);
        if (hit && this._chargeState === 'wind_up') {
            this._chargeStateTimer = 0;
            this._enterRecovery();
        }
        return hit;
        // charging is uninterruptible — by design
    }

    _die() {
        if (this._chargeHitbox) {
            this._chargeHitbox.destroy();
            this._chargeHitbox = null;
        }
        super._die();
    }
}
