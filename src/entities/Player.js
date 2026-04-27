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

        // Movement runtime state
        this._sprint       = false;
        this._jumpHeld     = false;
        this._jumpHoldTime = 0;
        this._lastTap      = { left: 0, right: 0 };
        this._prevDown     = { left: false, right: false };
        this._crouching    = false;
        this._crawling     = false;
        this._lastDownTap  = 0;
        this._prevDownDown = false;

        // Animation state — two-layer scale: _baseScale (physics state) × _animScale (tween layer)
        this._baseScale     = { x: 0.19, y: 0.19 };
        this._animScale     = { x: 1, y: 1 };
        this._animRotation  = 0;   // unsigned tilt magnitude; sign applied at render time
        this._animTweens    = [];
        this._prevAnimState = null;
        this._wasOnGround   = true;
        this._landTimer     = 0;

        // Sprite & body setup
        this.setFlipX(true)
            .setCollideWorldBounds(true)
            .setDepth(10);

        this.body.setSize(320, 982);
        this.body.setOffset(369, 28);
        this.body.setDragX(1500);
        this.body.setMaxVelocityX(this.SPRINT_SPEED);

        this._applyVisualScale();
    }

    // ─── Public update ─────────────────────────────────────────────────────────

    update(time, delta, input) {
        this._move(time, input);
        this._jump(delta, input);

        // Animation state machine
        const onGround    = this.body.blocked.down;
        const justLanded  = onGround && !this._wasOnGround;
        this._wasOnGround = onGround;

        if (this._landTimer > 0) this._landTimer -= delta;

        let newState;
        if      (!onGround && this.body.velocity.y < 0)  newState = 'jump_rise';
        else if (!onGround && this.body.velocity.y >= 0) newState = 'jump_fall';
        else if (justLanded)                             newState = 'land';
        else if (this._landTimer > 0)                    newState = 'land';
        else if (this._crawling)                         newState = 'crawl';
        else if (this._crouching)                        newState = 'crouch_idle';
        else if (Math.abs(this.body.velocity.x) < 5)    newState = 'idle';
        else if (this._sprint)                           newState = 'run';
        else                                             newState = 'walk';

        if (newState !== this._prevAnimState) {
            this._enterAnimState(newState);
            this._prevAnimState = newState;
        }

        this._applyVisualScale();
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
        // Only update _baseScale — _applyVisualScale owns all setSize/setOffset calls
        if (this._crouching) {
            this._baseScale.x = 0.19;
            this._baseScale.y = 0.19 * 0.6;
        } else {
            this._baseScale.x = 0.19;
            this._baseScale.y = 0.19;
        }
    }

    // ─── Animation ─────────────────────────────────────────────────────────────

    _killAnimTweens() {
        for (const t of this._animTweens) t.stop();
        this._animTweens = [];
    }

    _enterAnimState(state) {
        this._killAnimTweens();
        this._animScale.x   = 1;
        this._animScale.y   = 1;
        this._animRotation  = 0;

        switch (state) {

            case 'idle':
                this._animTweens.push(this.scene.tweens.add({
                    targets:  this._animScale,
                    y:        1.02,
                    duration: 1400,
                    yoyo:     true,
                    repeat:   -1,
                    ease:     'Sine.easeInOut',
                }));
                break;

            case 'walk':
                this._animTweens.push(this.scene.tweens.add({
                    targets:  this._animScale,
                    y:        0.97,
                    duration: 280,
                    yoyo:     true,
                    repeat:   -1,
                    ease:     'Sine.easeInOut',
                }));
                this._animTweens.push(this.scene.tweens.add({
                    targets:  this,
                    _animRotation: 0.04,
                    duration: 280,
                    yoyo:     true,
                    repeat:   -1,
                    ease:     'Sine.easeInOut',
                }));
                break;

            case 'run':
                this._animTweens.push(this.scene.tweens.add({
                    targets:  this._animScale,
                    y:        0.92,
                    duration: 180,
                    yoyo:     true,
                    repeat:   -1,
                    ease:     'Sine.easeInOut',
                }));
                this._animTweens.push(this.scene.tweens.add({
                    targets:  this,
                    _animRotation: 0.09,
                    duration: 180,
                    yoyo:     true,
                    repeat:   -1,
                    ease:     'Sine.easeInOut',
                }));
                break;

            case 'jump_rise':
                this._animTweens.push(this.scene.tweens.add({
                    targets:  this._animScale,
                    x:        0.88,
                    y:        1.18,
                    duration: 90,
                    ease:     'Quad.easeOut',
                }));
                break;

            case 'jump_fall':
                this._animTweens.push(this.scene.tweens.add({
                    targets:  this._animScale,
                    x:        1.05,
                    y:        0.96,
                    duration: 140,
                    ease:     'Sine.easeInOut',
                }));
                break;

            case 'land':
                this._landTimer   = 120;
                this._animScale.x = 1.25;
                this._animScale.y = 0.7;
                this._animTweens.push(this.scene.tweens.add({
                    targets:  this._animScale,
                    x:        1,
                    y:        1,
                    duration: 160,
                    ease:     'Back.easeOut',
                }));
                break;

            case 'crouch_idle':
                this._animTweens.push(this.scene.tweens.add({
                    targets:  this._animScale,
                    y:        1.03,
                    duration: 1600,
                    yoyo:     true,
                    repeat:   -1,
                    ease:     'Sine.easeInOut',
                }));
                break;

            case 'crawl':
                this._animTweens.push(this.scene.tweens.add({
                    targets:  this._animScale,
                    x:        1.04,
                    duration: 600,
                    yoyo:     true,
                    repeat:   -1,
                    ease:     'Sine.easeInOut',
                }));
                this._animTweens.push(this.scene.tweens.add({
                    targets:  this,
                    _animRotation: 0.025,
                    duration: 600,
                    yoyo:     true,
                    repeat:   -1,
                    ease:     'Sine.easeInOut',
                }));
                break;
        }
    }

    // Applied every frame after all state updates — multiplies base scale by anim layer.
    // Also compensates physics body so absolute collision size never changes regardless
    // of _animScale (Phaser multiplies setSize values by its internal scale cache).
    _applyVisualScale() {
        const sx = this._baseScale.x * this._animScale.x;
        const sy = this._baseScale.y * this._animScale.y;
        this.setScale(sx, sy);

        // Phaser's body caches _sx/_sy from the PREVIOUS frame (updated in preUpdate,
        // which runs before our update()). On transition frames where _animScale changes
        // abruptly (e.g. land snap to 0.7), the stale cache causes setSize to compute
        // a wildly wrong body height for one frame — enough to bounce the character off
        // the floor and start the jump/land loop. Force-sync the cache now so setSize
        // uses the scale we just set.
        this.body._sx = sx;
        this.body._sy = sy;

        // Divide body dims by _animScale to cancel Phaser's scale multiplication,
        // keeping the absolute collision box constant.
        if (this._crouching) {
            this.body.setSize(320 / this._animScale.x,   580 / this._animScale.y);
            this.body.setOffset(369 / this._animScale.x, 430 / this._animScale.y);
        } else {
            this.body.setSize(320 / this._animScale.x,   982 / this._animScale.y);
            this.body.setOffset(369 / this._animScale.x,  28 / this._animScale.y);
        }

        // _animRotation is unsigned magnitude; sign from facing direction
        const sign = this.flipX ? 1 : -1;
        this.setRotation(this._animRotation * sign);
    }
}
