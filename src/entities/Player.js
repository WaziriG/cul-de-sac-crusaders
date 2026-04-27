class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'waz');

        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Movement tuning
        this.WALK_SPEED       = 220;
        this.SPRINT_SPEED     = 410;
        this.JUMP_VY          = -530;
        this.JUMP_HOLD_ACCEL  = -680;
        this.MAX_JUMP_HOLD_MS = 270;
        this.DOUBLE_TAP_MS    = 250;
        this.CROUCH_SPEED     = 80;
        this.CRAWL_SPEED      = 110;

        // Runtime state
        this._sprint       = false;
        this._jumpHeld     = false;
        this._jumpHoldTime = 0;
        this._lastTap      = { left: 0, right: 0 };
        this._prevDown     = { left: false, right: false };
        this._crouching    = false;
        this._crawling     = false;
        this._lastDownTap  = 0;
        this._prevDownDown = false;

        // Sprite & body setup
        const SCALE = 0.19;
        this.setScale(SCALE)
            .setFlipX(true)
            .setCollideWorldBounds(true)
            .setDepth(10);

        this.body.setSize(320, 982);
        this.body.setOffset(369, 28);
        this.body.setDragX(1500);
        this.body.setMaxVelocityX(this.SPRINT_SPEED);
    }

    // ─── Public update ─────────────────────────────────────────────────────────

    update(time, delta, input) {
        this._move(time, input);
        this._jump(delta, input);
    }

    // ─── Movement ──────────────────────────────────────────────────────────────

    _move(time, input) {
        const lDown = input.left;
        const rDown = input.right;
        const dDown = input.down;

        // Double-tap ↓ toggles crawl mode
        if (dDown && !this._prevDownDown) {
            if (time - this._lastDownTap < this.DOUBLE_TAP_MS) {
                this._crawling = !this._crawling;
            }
            this._lastDownTap = time;
        }
        this._prevDownDown = dDown;

        // Crouching = holding ↓ OR crawl toggled on
        this._crouching = dDown || this._crawling;

        // Sprint detection via double-tap ← or →
        if (lDown && !this._prevDown.left) {
            if (time - this._lastTap.left < this.DOUBLE_TAP_MS) this._sprint = true;
            this._lastTap.left = time;
        }
        if (rDown && !this._prevDown.right) {
            if (time - this._lastTap.right < this.DOUBLE_TAP_MS) this._sprint = true;
            this._lastTap.right = time;
        }
        if (!lDown && !rDown) this._sprint = false;
        if (this._crouching)  this._sprint = false;

        // Speed selection
        let speed;
        if (this._crouching) {
            speed = this._crawling ? this.CRAWL_SPEED : this.CROUCH_SPEED;
        } else {
            speed = this._sprint ? this.SPRINT_SPEED : this.WALK_SPEED;
        }

        if (lDown) {
            this.setVelocityX(-speed);
            this.setFlipX(false);
        } else if (rDown) {
            this.setVelocityX(speed);
            this.setFlipX(true);
        }

        this._prevDown.left  = lDown;
        this._prevDown.right = rDown;

        this._applyCrouchPhysics();
    }

    _jump(delta, input) {
        const onGround  = this.body.blocked.down;
        const spaceDown = input.jump;

        if (spaceDown && onGround && !this._jumpHeld && !this._crouching) {
            this.setVelocityY(this.JUMP_VY);
            this._jumpHeld     = true;
            this._jumpHoldTime = 0;
        }

        if (this._jumpHeld) {
            const stillRising  = this.body.velocity.y < 0;
            const withinWindow = this._jumpHoldTime < this.MAX_JUMP_HOLD_MS;

            if (spaceDown && stillRising && withinWindow) {
                this.setAccelerationY(this.JUMP_HOLD_ACCEL);
                this._jumpHoldTime += delta;
            } else {
                this.setAccelerationY(0);
                this._jumpHeld = false;
            }
        }

        if (!spaceDown) {
            this._jumpHeld = false;
            this.setAccelerationY(0);
        }
    }

    _applyCrouchPhysics() {
        const SCALE = 0.19;
        if (this._crouching) {
            // Shrink hitbox to upper half; offset keeps feet anchored to ground
            this.body.setSize(320, 580);
            this.body.setOffset(369, 430);
            this.setScale(SCALE, SCALE * 0.6);
        } else {
            this.body.setSize(320, 982);
            this.body.setOffset(369, 28);
            this.setScale(SCALE, SCALE);
        }
    }
}
