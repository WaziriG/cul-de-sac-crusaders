class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        this.load.image('waz', 'assets/sprites/waz.png');
    }

    create() {
        this.WORLD_W = 5120;
        this.WORLD_H = 720;

        // Movement tuning
        this.WALK_SPEED       = 220;
        this.SPRINT_SPEED     = 410;
        this.JUMP_VY          = -530;
        this.JUMP_HOLD_ACCEL  = -680;
        this.MAX_JUMP_HOLD_MS = 270;
        this.DOUBLE_TAP_MS    = 250;

        // Runtime state
        this._sprint       = false;
        this._jumpHeld     = false;
        this._jumpHoldTime = 0;
        this._lastTap      = { left: 0, right: 0 };
        this._prevDown     = { left: false, right: false };
        this._touch        = { left: false, right: false, jumpDown: false };

        this.physics.world.setBounds(0, 0, this.WORLD_W, this.WORLD_H);

        this._buildBackground();
        this._buildPlatforms();
        this._buildPlayer();
        this._buildCamera();
        this._buildHUD();
        this._buildTouchControls();

        this.cursors = this.input.keyboard.createCursorKeys();
    }

    // ─── Background ────────────────────────────────────────────────────────────

    _buildBackground() {
        const { WORLD_W: W, WORLD_H: H } = this;
        const bg = this.add.graphics().setDepth(-20);
        const groundY = H - 42;

        // Sky — Springfield warm blue
        bg.fillStyle(0x7EC8E3);
        bg.fillRect(0, 0, W, H);

        // Sun
        bg.fillStyle(0xFFE033);
        bg.fillCircle(200, 88, 55);
        bg.lineStyle(3, 0x000000, 1);
        bg.strokeCircle(200, 88, 55);

        // Clouds
        [440, 860, 1300, 1760, 2220, 2700, 3180, 3680, 4180, 4680].forEach((cx, i) => {
            this._drawCloud(bg, cx, 62 + (i % 3) * 26);
        });

        // Road
        bg.fillStyle(0x6A6A6A);
        bg.fillRect(0, H - 25, W, 25);
        bg.fillStyle(0xFFFF44);
        for (let x = 0; x < W; x += 100) {
            bg.fillRect(x, H - 14, 55, 5);
        }
        bg.lineStyle(3, 0x000000, 1);
        bg.lineBetween(0, H - 25, W, H - 25);

        // Grass strip between road and sidewalk
        bg.fillStyle(0x7DC24B);
        bg.fillRect(0, groundY, W, H - 25 - groundY);
        bg.lineStyle(2, 0x000000, 1);
        bg.lineBetween(0, groundY, W, groundY);

        // Sidewalk — warm concrete
        bg.fillStyle(0xC8C4A8);
        bg.fillRect(0, groundY - 22, W, 22);
        bg.lineStyle(1, 0xAAAA90, 0.7);
        for (let x = 0; x < W; x += 80) {
            bg.lineBetween(x, groundY - 22, x, groundY);
        }
        bg.lineStyle(2, 0x000000, 1);
        bg.lineBetween(0, groundY - 22, W, groundY - 22);

        // Houses
        [
            { cx: 250,  wall: 0xF5E6C8, roof: 0x7A3B1E, gl: true  },
            { cx: 580,  wall: 0xD4E8C2, roof: 0x3B6040, gl: false },
            { cx: 900,  wall: 0xF0D0C0, roof: 0x8B3A3A, gl: true  },
            { cx: 1220, wall: 0xC8D8E8, roof: 0x3A5070, gl: false },
            { cx: 1540, wall: 0xF5F0C8, roof: 0x7A3B1E, gl: true  },
            { cx: 1860, wall: 0xE8D0E0, roof: 0x6B3070, gl: false },
            { cx: 2180, wall: 0xD4E8C2, roof: 0x3B6040, gl: true  },
            { cx: 2500, wall: 0xF0D0C0, roof: 0x7A3B1E, gl: false },
            { cx: 2820, wall: 0xF5E6C8, roof: 0x8B3A3A, gl: true  },
            { cx: 3140, wall: 0xC8D8E8, roof: 0x3B6040, gl: false },
            { cx: 3460, wall: 0xF5F0C8, roof: 0x3A5070, gl: true  },
            { cx: 3780, wall: 0xE8D0E0, roof: 0x7A3B1E, gl: false },
            { cx: 4100, wall: 0xD4E8C2, roof: 0x6B3070, gl: true  },
            { cx: 4420, wall: 0xF0D0C0, roof: 0x7A3B1E, gl: false },
            { cx: 4740, wall: 0xF5E6C8, roof: 0x3B6040, gl: true  },
        ].forEach(bp => this._drawHouse(bg, bp, groundY - 22));

        // Trees
        [430, 750, 1070, 1390, 1710, 2030, 2350, 2670, 2990, 3310, 3630, 3950, 4270, 4590]
            .forEach(tx => this._drawTree(bg, tx, groundY - 22));

        // Props (alternating hydrants and mailboxes)
        [345, 675, 1000, 1320, 1640, 1960, 2280, 2600, 2920, 3240, 3560, 3880, 4200, 4520, 4840]
            .forEach((px, i) => {
                if (i % 2 === 0) this._drawFireHydrant(bg, px, groundY - 22);
                else             this._drawMailbox(bg, px, groundY - 22);
            });
    }

    _drawCloud(bg, cx, cy) {
        bg.fillStyle(0xFFFFFF);
        bg.fillRoundedRect(cx - 68, cy - 10, 136, 30, 15);
        bg.fillRoundedRect(cx - 48, cy - 36, 96, 40, 20);
        bg.fillRoundedRect(cx - 22, cy - 52, 56, 28, 14);
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRoundedRect(cx - 68, cy - 10, 136, 30, 15);
        bg.strokeRoundedRect(cx - 48, cy - 36, 96, 40, 20);
    }

    _drawHouse(bg, { cx, wall, roof, gl }, baseY) {
        const BW = 165, BH = 125;
        const GW = 72,  GH = 90;
        const OVR = 12, RPK = 56;

        const totalW = BW + GW;
        const bodyX   = gl ? cx - totalW / 2 + GW : cx - totalW / 2;
        const garageX = gl ? cx - totalW / 2       : cx - totalW / 2 + BW;
        const roofBaseY = baseY - BH;

        // Garage
        bg.fillStyle(wall);
        bg.fillRect(garageX, baseY - GH, GW, GH);
        bg.fillStyle(0xD8D8C4);
        bg.fillRect(garageX + 7, baseY - GH + 10, GW - 14, GH - 16);
        // Garage door panels
        bg.lineStyle(1, 0xBBBBAA, 1);
        const gPH = (GH - 16) / 3;
        for (let p = 1; p < 3; p++) {
            bg.lineBetween(garageX + 7, baseY - GH + 10 + gPH * p, garageX + GW - 7, baseY - GH + 10 + gPH * p);
        }
        bg.lineStyle(3, 0x000000, 1);
        bg.strokeRect(garageX, baseY - GH, GW, GH);
        bg.strokeRect(garageX + 7, baseY - GH + 10, GW - 14, GH - 16);

        // House body
        bg.fillStyle(wall);
        bg.fillRect(bodyX, roofBaseY, BW, BH);
        bg.lineStyle(3, 0x000000, 1);
        bg.strokeRect(bodyX, roofBaseY, BW, BH);

        // Gable roof (over body only)
        const rL = bodyX - OVR, rR = bodyX + BW + OVR;
        const rPkX = bodyX + BW / 2, rPkY = roofBaseY - RPK;
        bg.fillStyle(roof);
        bg.fillTriangle(rL, roofBaseY, rR, roofBaseY, rPkX, rPkY);
        bg.lineStyle(3, 0x000000, 1);
        bg.beginPath();
        bg.moveTo(rL, roofBaseY);
        bg.lineTo(rPkX, rPkY);
        bg.lineTo(rR, roofBaseY);
        bg.strokePath();
        // Soffit line
        bg.lineStyle(4, 0xDDCCBB, 1);
        bg.lineBetween(rL, roofBaseY, rR, roofBaseY);
        bg.lineStyle(2, 0x000000, 1);
        bg.lineBetween(rL, roofBaseY, rR, roofBaseY);

        // Chimney
        const chX = rPkX + 28;
        bg.fillStyle(0xB07030);
        bg.fillRect(chX - 8, rPkY + 8, 16, 46);
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(chX - 8, rPkY + 8, 16, 46);
        bg.fillStyle(0x997020);
        bg.fillRect(chX - 11, rPkY + 5, 22, 7);
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(chX - 11, rPkY + 5, 22, 7);

        // Windows
        this._drawWindow(bg, bodyX + BW * 0.27, roofBaseY + BH * 0.42);
        this._drawWindow(bg, bodyX + BW * 0.73, roofBaseY + BH * 0.42);

        // Front door
        const dW = 26, dH = 48, dX = bodyX + BW / 2 - dW / 2;
        bg.fillStyle(0x7A3A1A);
        bg.fillRect(dX, baseY - dH, dW, dH);
        // Arched transom — fill arch, then cover lower half with wall color to fake arch-only-on-top
        bg.fillStyle(0x7A3A1A);
        bg.fillRoundedRect(dX, baseY - dH - 12, dW, 20, 10);
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(dX, baseY - dH, dW, dH);
        // Doorknob
        bg.fillStyle(0xFFCC00);
        bg.fillCircle(dX + 5, baseY - dH / 2, 3);

        // Bushes
        this._drawBush(bg, bodyX + 20, baseY);
        this._drawBush(bg, bodyX + BW - 20, baseY);
    }

    _drawWindow(bg, cx, cy) {
        const WW = 38, WH = 30, SW = 9;

        // Shutters
        bg.fillStyle(0x4A7040);
        bg.fillRect(cx - WW / 2 - SW - 1, cy - WH / 2, SW, WH);
        bg.fillRect(cx + WW / 2 + 1,      cy - WH / 2, SW, WH);
        // Slats
        bg.lineStyle(1, 0x3A5A30, 1);
        for (let sy = cy - WH / 2 + 6; sy < cy + WH / 2 - 2; sy += 7) {
            bg.lineBetween(cx - WW / 2 - SW - 1, sy, cx - WW / 2 - 1, sy);
            bg.lineBetween(cx + WW / 2 + 1,       sy, cx + WW / 2 + SW + 1, sy);
        }
        // Frame
        bg.fillStyle(0xEEEEDD);
        bg.fillRect(cx - WW / 2 - 3, cy - WH / 2 - 3, WW + 6, WH + 6);
        // Glass
        bg.fillStyle(0xADD8E6);
        bg.fillRect(cx - WW / 2, cy - WH / 2, WW, WH);
        // Reflection
        bg.fillStyle(0xCCEEFF);
        bg.fillRect(cx - WW / 2 + 2, cy - WH / 2 + 2, WW / 3, WH - 4);
        // Pane dividers
        bg.lineStyle(2, 0xEEEEDD, 1);
        bg.lineBetween(cx, cy - WH / 2, cx, cy + WH / 2);
        bg.lineBetween(cx - WW / 2, cy, cx + WW / 2, cy);
        // Outlines
        bg.lineStyle(3, 0x000000, 1);
        bg.strokeRect(cx - WW / 2, cy - WH / 2, WW, WH);
        bg.strokeRect(cx - WW / 2 - SW - 1, cy - WH / 2, SW, WH);
        bg.strokeRect(cx + WW / 2 + 1,      cy - WH / 2, SW, WH);
    }

    _drawBush(bg, cx, baseY) {
        bg.fillStyle(0x3A7A3A);
        bg.fillRoundedRect(cx - 22, baseY - 24, 44, 26, 13);
        bg.fillStyle(0x4A9A4A);
        bg.fillRoundedRect(cx - 16, baseY - 30, 32, 20, 10);
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRoundedRect(cx - 22, baseY - 24, 44, 26, 13);
    }

    _drawTree(bg, tx, baseY) {
        // Trunk
        bg.fillStyle(0x7A5A14);
        bg.fillRect(tx - 6, baseY - 65, 12, 45);
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(tx - 6, baseY - 65, 12, 45);
        // Three overlapping blobs — classic Springfield tree
        bg.fillStyle(0x4A8C3F);
        bg.fillCircle(tx,      baseY - 88, 32);
        bg.fillCircle(tx - 24, baseY - 73, 25);
        bg.fillCircle(tx + 24, baseY - 73, 25);
        // Highlight blob
        bg.fillStyle(0x5DB34A);
        bg.fillCircle(tx - 6,  baseY - 96, 16);
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeCircle(tx,      baseY - 88, 32);
        bg.strokeCircle(tx - 24, baseY - 73, 25);
        bg.strokeCircle(tx + 24, baseY - 73, 25);
    }

    _drawFireHydrant(bg, px, baseY) {
        bg.fillStyle(0xCC2200);
        bg.fillRect(px - 10, baseY - 9,  20, 9);   // base
        bg.fillRect(px - 8,  baseY - 27, 16, 19);  // body
        bg.fillRect(px - 11, baseY - 31, 22, 7);   // collar
        bg.fillRect(px - 5,  baseY - 37, 10, 8);   // neck
        bg.fillRoundedRect(px - 6, baseY - 43, 12, 8, 3); // cap
        bg.fillRect(px - 17, baseY - 26, 7, 10);   // left nozzle
        bg.fillRect(px + 10, baseY - 26, 7, 10);   // right nozzle
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(px - 10, baseY - 9,  20, 9);
        bg.strokeRect(px - 8,  baseY - 27, 16, 19);
        bg.strokeRect(px - 11, baseY - 31, 22, 7);
        bg.strokeRect(px - 5,  baseY - 37, 10, 8);
        bg.strokeRoundedRect(px - 6, baseY - 43, 12, 8, 3);
        bg.strokeRect(px - 17, baseY - 26, 7, 10);
        bg.strokeRect(px + 10, baseY - 26, 7, 10);
    }

    _drawMailbox(bg, px, baseY) {
        // Post
        bg.fillStyle(0x888888);
        bg.fillRect(px - 2, baseY - 38, 4, 36);
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(px - 2, baseY - 38, 4, 36);
        // Box
        bg.fillStyle(0xCCCCCC);
        bg.fillRect(px - 15, baseY - 53, 30, 17);
        bg.fillRoundedRect(px - 15, baseY - 60, 30, 20, 10);
        bg.lineStyle(2, 0x000000, 1);
        bg.strokeRect(px - 15, baseY - 53, 30, 17);
        bg.strokeRoundedRect(px - 15, baseY - 60, 30, 20, 10);
        // Red flag (up = you've got mail)
        bg.fillStyle(0xCC2200);
        bg.fillRect(px + 13, baseY - 63, 3, 16);
        bg.fillRect(px + 15, baseY - 63, 11, 9);
        bg.lineStyle(1, 0x000000, 1);
        bg.strokeRect(px + 13, baseY - 63, 3, 16);
        bg.strokeRect(px + 15, baseY - 63, 11, 9);
    }

    // ─── Platforms ─────────────────────────────────────────────────────────────

    _buildPlatforms() {
        this._staticBodies = [];

        const addPlat = (x, y, w, h, color = 0x8B6914) => {
            const r = this.add.rectangle(x, y, w, h, color).setDepth(2);
            this.physics.add.existing(r, true);
            this._staticBodies.push(r);
            return r;
        };

        // Invisible ground floor — visual is in the background layer
        const floor = this.add.rectangle(
            this.WORLD_W / 2, this.WORLD_H - 20, this.WORLD_W, 40, 0x000000, 0
        );
        this.physics.add.existing(floor, true);
        this._staticBodies.push(floor);

        // Platforms
        addPlat(580,  566, 220, 22);
        addPlat(890,  496, 200, 22);
        addPlat(1170, 428, 200, 22);
        addPlat(1460, 492, 200, 22);
        addPlat(1720, 560, 220, 22);
        addPlat(2020, 508, 280, 22);
        addPlat(2370, 440, 200, 22);
        addPlat(2660, 378, 180, 22);
        addPlat(2920, 448, 220, 22);
        addPlat(3200, 520, 260, 22);
        addPlat(3520, 460, 200, 22);
        addPlat(3820, 390, 200, 22);
        addPlat(4100, 460, 200, 22);
        addPlat(4380, 530, 220, 22);
        addPlat(4680, 470, 200, 22);
    }

    // ─── Player ────────────────────────────────────────────────────────────────

    _buildPlayer() {
        const SCALE = 0.19;

        this.player = this.physics.add.sprite(200, 520, 'waz')
            .setScale(SCALE)
            .setFlipX(true)
            .setCollideWorldBounds(true)
            .setDepth(10);

        this.player.body.setSize(320, 982);
        this.player.body.setOffset(369, 28);
        this.player.body.setDragX(1500);
        this.player.body.setMaxVelocityX(this.SPRINT_SPEED);

        this.physics.add.collider(this.player, this._staticBodies);
    }

    // ─── Camera ────────────────────────────────────────────────────────────────

    _buildCamera() {
        this.cameras.main.setBounds(0, 0, this.WORLD_W, this.WORLD_H);
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.cameras.main.setDeadzone(130, 60);
    }

    // ─── HUD ───────────────────────────────────────────────────────────────────

    _buildHUD() {
        this._debugText = this.add.text(12, 12, '', {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#ffffff',
            backgroundColor: '#00000099',
            padding: { x: 8, y: 6 },
        }).setScrollFactor(0).setDepth(100);

        this.add.rectangle(640, 712, 1280, 24, 0x000000, 0.72)
            .setScrollFactor(0).setDepth(99);
        this.add.text(640, 712,
            'Keyboard: ← → Move  |  SPACE Jump (hold = higher)  |  Double-tap = Sprint        Touch: ◀ ▶ ▲ buttons',
            { fontFamily: 'monospace', fontSize: '12px', color: '#cccccc' }
        ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(100);
    }

    // ─── Update loop ───────────────────────────────────────────────────────────

    update(time, delta) {
        this._move(time);
        this._jump(delta);
        this._updateHUD();
    }

    _move(time) {
        const lDown = this.cursors.left.isDown  || this._touch.left;
        const rDown = this.cursors.right.isDown || this._touch.right;

        if (lDown && !this._prevDown.left) {
            if (time - this._lastTap.left < this.DOUBLE_TAP_MS) this._sprint = true;
            this._lastTap.left = time;
        }
        if (rDown && !this._prevDown.right) {
            if (time - this._lastTap.right < this.DOUBLE_TAP_MS) this._sprint = true;
            this._lastTap.right = time;
        }

        if (!lDown && !rDown) this._sprint = false;

        const speed = this._sprint ? this.SPRINT_SPEED : this.WALK_SPEED;

        if (lDown) {
            this.player.setVelocityX(-speed);
            this.player.setFlipX(false);
        } else if (rDown) {
            this.player.setVelocityX(speed);
            this.player.setFlipX(true);
        }

        this._prevDown.left  = lDown;
        this._prevDown.right = rDown;
    }

    _jump(delta) {
        const onGround  = this.player.body.blocked.down;
        const spaceDown = this.cursors.space.isDown || this._touch.jumpDown;

        if (spaceDown && onGround && !this._jumpHeld) {
            this.player.setVelocityY(this.JUMP_VY);
            this._jumpHeld     = true;
            this._jumpHoldTime = 0;
        }

        if (this._jumpHeld) {
            const stillRising  = this.player.body.velocity.y < 0;
            const withinWindow = this._jumpHoldTime < this.MAX_JUMP_HOLD_MS;

            if (spaceDown && stillRising && withinWindow) {
                this.player.setAccelerationY(this.JUMP_HOLD_ACCEL);
                this._jumpHoldTime += delta;
            } else {
                this.player.setAccelerationY(0);
                this._jumpHeld = false;
            }
        }

        if (!spaceDown) {
            this._jumpHeld = false;
            this.player.setAccelerationY(0);
        }
    }

    _updateHUD() {
        const vx = Math.round(this.player.body.velocity.x);
        const vy = Math.round(this.player.body.velocity.y);
        const onGround = this.player.body.blocked.down;

        this._debugText.setText(
            `Phase 1 — Engine Bootstrap\n` +
            `Vel (${vx}, ${vy})  ${onGround ? 'Grounded' : 'Airborne'}  ${this._sprint ? 'SPRINT' : 'walk'}\n` +
            `Pos (${Math.round(this.player.x)}, ${Math.round(this.player.y)})`
        );
    }

    // ─── Touch Controls ────────────────────────────────────────────────────────

    _buildTouchControls() {
        // Support up to 3 simultaneous touch points (move + jump)
        this.input.addPointer(2);

        const R = 50, Y = 636;

        const makeBtn = (x, label, onDown, onUp) => {
            // Circle background (Arc shape so alpha changes easily)
            const bg = this.add.arc(x, Y, R, 0, 360, false, 0x000000, 0.35)
                .setScrollFactor(0)
                .setDepth(200)
                .setStrokeStyle(2.5, 0xffffff, 0.5);

            // Icon label
            this.add.text(x, Y, label, {
                fontFamily: 'Arial Black, Arial',
                fontSize: '26px',
                color: '#ffffff',
            }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(201).setAlpha(0.8);

            // Invisible interactive hit zone (slightly larger than visual for fat fingers)
            const zone = this.add.zone(x, Y, R * 2.2, R * 2.2)
                .setScrollFactor(0)
                .setDepth(202)
                .setInteractive();

            zone.on('pointerdown', () => { onDown(); bg.setFillStyle(0xffffff, 0.25); });
            zone.on('pointerup',   () => { onUp();   bg.setFillStyle(0x000000, 0.35); });
            zone.on('pointerout',  () => { onUp();   bg.setFillStyle(0x000000, 0.35); });

            return zone;
        };

        // Left — bottom left
        makeBtn(72,   Y, '◀',
            () => this._touch.left = true,
            () => this._touch.left = false
        );

        // Right — next to left
        makeBtn(186,  Y, '▶',
            () => this._touch.right = true,
            () => this._touch.right = false
        );

        // Jump — bottom right
        makeBtn(1208, Y, '▲',
            () => this._touch.jumpDown = true,
            () => this._touch.jumpDown = false
        );
    }
}
