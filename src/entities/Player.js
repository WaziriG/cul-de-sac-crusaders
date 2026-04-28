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

        // Combat state
        this.hp   = 100;
        this.maxHp = 100;
        this.PUNCH_WINDUP_MS   = 30;
        this.PUNCH_ACTIVE_MS   = 90;
        this.PUNCH_RECOVER_MS  = 120;
        this.PUNCH_DAMAGE      = 10;
        this.PUNCH_KNOCKBACK_X = 280;
        this.PUNCH_KNOCKBACK_Y = -160;
        this.PUNCH_RADIUS         = 120;
        this.KICK_WINDUP_MS       = 160;
        this.KICK_ACTIVE_MS       = 110;
        this.KICK_RECOVER_MS      = 280;
        this.KICK_DAMAGE          = 22;
        this.KICK_KNOCKBACK_X     = 460;
        this.KICK_KNOCKBACK_Y     = -260;
        this.KICK_HIT_PAUSE_MS    = 110;
        this.KICK_SHAKE_MS        = 200;
        this.KICK_SHAKE_INTENSITY = 0.014;
        this.KICK_RADIUS          = 140;
        // none | punch_windup | punch_active | punch_recover
        //       | kick_windup  | kick_active  | kick_recover
        this.attackState    = 'none';
        this._attackTimer   = 0;
        this._invulnUntil   = 0;
        this._activeHitbox  = null;

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
        this._updateAttack(delta, input);

        // Animation state machine — punch overrides ground movement but not air states
        const onGround    = this.body.blocked.down;
        const justLanded  = onGround && !this._wasOnGround;
        this._wasOnGround = onGround;

        if (this._landTimer > 0) this._landTimer -= delta;

        let newState;
        if      (!onGround && this.body.velocity.y < 0)  newState = 'jump_rise';
        else if (!onGround && this.body.velocity.y >= 0) newState = 'jump_fall';
        else if (justLanded)                             newState = 'land';
        else if (this._landTimer > 0)                    newState = 'land';
        else if (this.attackState !== 'none')            newState = this.attackState;
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

    // ─── Combat ────────────────────────────────────────────────────────────────

    _updateAttack(delta, input) {
        if (this.attackState === 'none') {
            if (input.punch && this.body.blocked.down) {
                this.attackState  = 'punch_windup';
                this._attackTimer = this.PUNCH_WINDUP_MS;
            } else if (input.kick && this.body.blocked.down && !this._crouching) {
                this.attackState  = 'kick_windup';
                this._attackTimer = this.KICK_WINDUP_MS;
            }
            return;
        }

        this._attackTimer -= delta;

        switch (this.attackState) {
            case 'punch_windup':
                if (this._attackTimer <= 0) {
                    this.attackState  = 'punch_active';
                    this._attackTimer = this.PUNCH_ACTIVE_MS;
                    this._doPunchHit();
                }
                break;
            case 'punch_active':
                if (this._attackTimer <= 0) {
                    this.attackState  = 'punch_recover';
                    this._attackTimer = this.PUNCH_RECOVER_MS;
                }
                break;
            case 'punch_recover':
                if (this._attackTimer <= 0) {
                    this.attackState  = 'none';
                    this._attackTimer = 0;
                }
                break;
            case 'kick_windup':
                if (this._attackTimer <= 0) {
                    this.attackState  = 'kick_active';
                    this._attackTimer = this.KICK_ACTIVE_MS;
                    this._doKickHit();
                }
                break;
            case 'kick_active':
                if (this._attackTimer <= 0) {
                    this.attackState  = 'kick_recover';
                    this._attackTimer = this.KICK_RECOVER_MS;
                }
                break;
            case 'kick_recover':
                if (this._attackTimer <= 0) {
                    this.attackState  = 'none';
                    this._attackTimer = 0;
                }
                break;
        }
    }

    _doPunchHit() {
        if (!this.scene._enemies) return;

        const dir = this.flipX ? 1 : -1;

        this.scene._enemies.getChildren().forEach(enemy => {
            if (!enemy.active || enemy._state === 'dead') return;

            // Radius check — enemies pass through the player without a collider, so
            // directional AABB misses them when they've overshooting. Pure distance
            // catches them regardless of which side they ended up on.
            const dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
            if (dist > this.PUNCH_RADIUS) return;

            const hit = enemy.takeDamage(this.PUNCH_DAMAGE, {
                knockbackX: dir * this.PUNCH_KNOCKBACK_X,
                knockbackY: this.PUNCH_KNOCKBACK_Y,
            });
            if (hit && this.scene.combatFX) {
                this.scene.combatFX.impactBlast(enemy.x, enemy.y - 20);
                this.scene.combatFX.damageNumber(enemy.x, enemy.y - 40, this.PUNCH_DAMAGE);
            }
        });
    }

    _doKickHit() {
        if (!this.scene._enemies) return;
        const dir = this.flipX ? 1 : -1;

        this.scene._enemies.getChildren().forEach(enemy => {
            if (!enemy.active || enemy._state === 'dead') return;
            const dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
            if (dist > this.KICK_RADIUS) return;

            const hit = enemy.takeDamage(this.KICK_DAMAGE, {
                knockbackX: dir * this.KICK_KNOCKBACK_X,
                knockbackY: this.KICK_KNOCKBACK_Y,
            });
            if (hit && this.scene.combatFX) {
                this.scene.combatFX.hitPause(this.KICK_HIT_PAUSE_MS);
                this.scene.combatFX.screenShake(this.KICK_SHAKE_MS, this.KICK_SHAKE_INTENSITY);
                this.scene.combatFX.hitSpark(enemy.x, enemy.y - 20, 0xff9933);
                this.scene.combatFX.damageNumber(enemy.x, enemy.y - 40, this.KICK_DAMAGE, 0xff9933);
            }
        });
    }

    takeDamage(amount, opts = {}) {
        const now = this.scene.time.now;
        if (now < this._invulnUntil) return false;

        this._invulnUntil = now + 600;
        this.hp = Math.max(0, this.hp - amount);

        if (opts.knockbackX !== undefined) this.setVelocityX(opts.knockbackX);
        if (opts.knockbackY !== undefined) this.setVelocityY(opts.knockbackY);

        this.setTint(0xffffff);
        this.scene.time.delayedCall(200, () => {
            if (this.active) this.clearTint();
        });

        if (this.hp <= 0) this._die();
        return true;
    }

    _die() {
        this.body.enable = false;
        this.scene.tweens.add({
            targets:  this,
            alpha:    0,
            scaleX:   0,
            scaleY:   0,
            duration: 500,
            ease:     'Quad.easeIn',
            onComplete: () => this.scene._showGameOver(),
        });
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
        // Attack sub-states animate from wherever the scale currently sits;
        // all other states reset to neutral first.
        if (!state.startsWith('punch_') && !state.startsWith('kick_')) {
            this._animScale.x  = 1;
            this._animScale.y  = 1;
        }
        this._animRotation = 0;

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

            case 'punch_windup':
                this._animScale.x = 0.85;
                this._animScale.y = 1.1;
                break;

            case 'punch_active':
                this._animScale.x = 1.18;
                this._animScale.y = 0.88;
                this._animTweens.push(this.scene.tweens.add({
                    targets:  this._animScale,
                    x:        1,
                    y:        1,
                    duration: this.PUNCH_ACTIVE_MS,
                    ease:     'Back.easeOut',
                }));
                break;

            case 'punch_recover':
                this._animTweens.push(this.scene.tweens.add({
                    targets:  this._animScale,
                    x:        1,
                    y:        1,
                    duration: this.PUNCH_RECOVER_MS,
                    ease:     'Sine.easeOut',
                }));
                break;

            case 'kick_windup':
                // Crouch/coil — taller and slightly narrower, telegraphs the kick
                this._animTweens.push(this.scene.tweens.add({
                    targets:  this._animScale,
                    x:        0.9,
                    y:        1.08,
                    duration: 100,
                    ease:     'Sine.easeIn',
                }));
                break;

            case 'kick_active':
                // Big horizontal lunge — wider and squatter than punch
                this._animScale.x = 1.25;
                this._animScale.y = 0.85;
                this._animTweens.push(this.scene.tweens.add({
                    targets:  this._animScale,
                    x:        1,
                    y:        1,
                    duration: this.KICK_ACTIVE_MS,
                    ease:     'Back.easeOut',
                }));
                break;

            case 'kick_recover':
                // Long spring-back — exposes the committal window
                this._animTweens.push(this.scene.tweens.add({
                    targets:  this._animScale,
                    x:        1,
                    y:        1,
                    duration: this.KICK_RECOVER_MS,
                    ease:     'Sine.easeOut',
                }));
                break;
        }
    }

    // Applied every frame — multiplies base scale by anim layer and keeps the
    // physics body at a constant absolute size and position in world space.
    _applyVisualScale() {
        const sx = this._baseScale.x * this._animScale.x;
        const sy = this._baseScale.y * this._animScale.y;
        this.setScale(sx, sy);

        // Force-sync body scale cache — Phaser updates body._sx/_sy in preUpdate
        // (before our update() runs), so on abrupt animScale transitions the stale
        // value causes setSize to compute wrong body dimensions for one frame.
        this.body._sx = sx;
        this.body._sy = sy;

        // Keep body.bottom / body.left fixed regardless of animScale.
        //
        // body.bottom = player.y + scaleY * (offsetY_tex + sourceH - T/2)   [T=1024]
        //
        // With sourceH = baseH / animScale.y, solving for offsetY_tex so body.bottom
        // stays constant gives:
        //   offsetY_tex = T/2 - (T/2 - baseOffY) / animScale.y
        //
        // The WRONG formula (baseOffY / animScale.y) keeps offset proportional to
        // scale but shifts body.bottom downward when squashed, driving the body into
        // the ground and causing the physics engine to bounce the character upward.
        //
        // Same derivation applies to offsetX.
        const ax = this._animScale.x;
        const ay = this._animScale.y;
        const offX = 512 - 143 / ax;   // 143 = 512 - 369  (T/2 - base x offset)

        if (this._crouching) {
            this.body.setSize(320 / ax,  580 / ay);
            this.body.setOffset(offX,    512 - 82  / ay);  //  82 = 512 - 430
        } else {
            this.body.setSize(320 / ax,  982 / ay);
            this.body.setOffset(offX,    512 - 484 / ay);  // 484 = 512 - 28
        }

        // _animRotation is unsigned magnitude; sign from facing direction
        const sign = this.flipX ? 1 : -1;
        this.setRotation(this._animRotation * sign);
    }
}
