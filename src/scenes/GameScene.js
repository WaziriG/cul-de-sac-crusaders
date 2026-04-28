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

        this._touch = { left: false, right: false, jumpDown: false, down: false, punch: false, punchJustDown: false };

        this.physics.world.setBounds(0, 0, this.WORLD_W, this.WORLD_H);

        this._generateRaccoonTexture();
        this._buildBackground();
        this._buildPlatforms();
        this._buildPlayer();
        this.combatFX = new CombatFX(this);
        this._buildEnemies();
        this._buildCamera();
        this._buildHUD();
        this._buildTouchControls();

        this.cursors    = this.input.keyboard.createCursorKeys();
        this._punchKey  = this.input.keyboard.addKey('J');
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

    // ─── Raccoon texture ───────────────────────────────────────────────────────

    _generateRaccoonTexture() {
        const g = this.make.graphics({ x: 0, y: 0, add: false });

        // Body
        g.fillStyle(0x777777);
        g.fillRoundedRect(10, 32, 60, 44, 12);

        // Head
        g.fillStyle(0x999999);
        g.fillCircle(40, 26, 22);

        // Ear base (grey)
        g.fillStyle(0x999999);
        g.fillTriangle(22, 10, 14, -3, 34, 6);
        g.fillTriangle(58, 10, 66, -3, 46, 6);
        // Ear inner (pink)
        g.fillStyle(0xffbbbb);
        g.fillTriangle(23, 9, 17, 1, 31, 6);
        g.fillTriangle(57, 9, 63, 1, 49, 6);

        // Eye mask patches
        g.fillStyle(0x222222);
        g.fillRoundedRect(18, 17, 16, 13, 4);
        g.fillRoundedRect(46, 17, 16, 13, 4);

        // Eyes (white + pupil)
        g.fillStyle(0xffffff);
        g.fillCircle(26, 23, 6);
        g.fillCircle(54, 23, 6);
        g.fillStyle(0x111111);
        g.fillCircle(27, 23, 3);
        g.fillCircle(55, 23, 3);

        // Nose
        g.fillStyle(0x333333);
        g.fillCircle(40, 32, 4);
        // Mouth
        g.lineStyle(2, 0x333333, 1);
        g.lineBetween(37, 35, 40, 38);
        g.lineBetween(40, 38, 43, 35);

        // Striped tail (right side)
        g.fillStyle(0x888888);
        g.fillEllipse(65, 58, 26, 16);
        g.fillStyle(0x333333);
        for (let i = 0; i < 3; i++) {
            g.fillRect(57 + i * 5, 51, 3, 14);
        }
        g.lineStyle(1.5, 0x111111, 1);
        g.strokeEllipse(65, 58, 26, 16);

        // Feet
        g.fillStyle(0x555555);
        g.fillRoundedRect(12, 71, 18, 9, 3);
        g.fillRoundedRect(50, 71, 18, 9, 3);

        // Outline
        g.lineStyle(2, 0x111111, 1);
        g.strokeCircle(40, 26, 22);
        g.strokeRoundedRect(10, 32, 60, 44, 12);

        g.generateTexture('raccoon', 80, 80);
        g.destroy();
    }

    // ─── Player ────────────────────────────────────────────────────────────────

    _buildPlayer() {
        this.player = new Player(this, 200, 520);
        this.physics.add.collider(this.player, this._staticBodies);
    }

    // ─── Enemies ───────────────────────────────────────────────────────────────

    _buildEnemies() {
        this._enemies       = this.physics.add.group();
        this._playerHitboxes = this.add.group();
        this._enemyHitboxes  = this.add.group();

        // Spawn raccoons at varied positions along the first section
        [520, 820, 1150].forEach(x => {
            const r = new Raccoon(this, x, 520);
            this._enemies.add(r);
        });

        // Enemy collides with world platforms
        this.physics.add.collider(this._enemies, this._staticBodies);

        // Player punch hitboxes → enemies
        this.physics.add.overlap(this._playerHitboxes, this._enemies, (hitbox, enemy) => {
            if (!(hitbox instanceof Hitbox)) return;
            if (hitbox._hitTargets.has(enemy)) return;
            hitbox._hitTargets.add(enemy);

            const dir = this.player.flipX ? 1 : -1;
            const hit = enemy.takeDamage(this.player.PUNCH_DAMAGE, {
                knockbackX: dir * this.player.PUNCH_KNOCKBACK_X,
                knockbackY: this.player.PUNCH_KNOCKBACK_Y,
            });
            if (hit) {
                this.combatFX.impactBlast(enemy.x, enemy.y - 20);
                this.combatFX.damageNumber(enemy.x, enemy.y - 40, this.player.PUNCH_DAMAGE);
            }
        });

        // Enemy attack hitboxes → player
        this.physics.add.overlap(this._enemyHitboxes, this.player, (hitbox, player) => {
            if (!(hitbox instanceof Hitbox)) return;
            if (hitbox._hitTargets.has(player)) return;
            hitbox._hitTargets.add(player);

            const attacker = hitbox.owner;
            const dir = attacker ? (attacker.flipX ? 1 : -1) : 1;
            const dmg = hitbox.opts.damage || 8;
            player.takeDamage(dmg, {
                knockbackX: dir * 180,
                knockbackY: -120,
            });
        });
    }

    // ─── Game Over ─────────────────────────────────────────────────────────────

    _showGameOver() {
        this.physics.world.pause();
        this.tweens.pauseAll();

        this.add.text(640, 280, 'GAME OVER', {
            fontFamily:      'monospace',
            fontSize:        '72px',
            color:           '#ff2222',
            stroke:          '#000000',
            strokeThickness: 6,
        }).setScrollFactor(0).setDepth(500).setOrigin(0.5);

        this.add.text(640, 380, 'Press R to restart', {
            fontFamily:      'monospace',
            fontSize:        '24px',
            color:           '#ffffff',
            stroke:          '#000000',
            strokeThickness: 3,
        }).setScrollFactor(0).setDepth(500).setOrigin(0.5);

        this.input.keyboard.once('keydown-R', () => this.scene.restart());
    }

    // ─── Camera ────────────────────────────────────────────────────────────────

    _buildCamera() {
        this.cameras.main.setBounds(0, 0, this.WORLD_W, this.WORLD_H);
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.cameras.main.setDeadzone(130, 60);
    }

    // ─── HUD ───────────────────────────────────────────────────────────────────

    _buildHUD() {
        // Player HP bar — always visible
        const barX = 14, barY = 14;
        const W = 160, H = 16;

        this.add.text(barX, barY, 'HP', {
            fontFamily: 'monospace', fontSize: '13px',
            color: '#ffffff', stroke: '#000000', strokeThickness: 3,
        }).setScrollFactor(0).setDepth(101);

        // Background track
        this.add.rectangle(barX + 26 + W / 2, barY + 8, W + 4, H + 4, 0x000000, 0.75)
            .setScrollFactor(0).setDepth(101).setOrigin(0.5);

        // Fill bar — width is updated each frame
        this._hpBarFill = this.add.rectangle(barX + 26, barY + 8, W, H, 0x44ee44)
            .setScrollFactor(0).setDepth(102).setOrigin(0, 0.5);
        this._hpBarMaxW = W;

        // "J = Punch" label (keyboard hint)
        this.add.text(barX, barY + 24, 'J = Punch', {
            fontFamily: 'monospace', fontSize: '11px',
            color: '#cccccc', stroke: '#000000', strokeThickness: 2,
        }).setScrollFactor(0).setDepth(101);

        // Debug overlay — press D to toggle
        this._debugVisible = false;
        this._debugText = this.add.text(12, 58, '', {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#ffffff',
            backgroundColor: '#00000099',
            padding: { x: 8, y: 6 },
        }).setScrollFactor(0).setDepth(100).setVisible(false);

        this.input.keyboard.on('keydown-D', () => {
            this._debugVisible = !this._debugVisible;
            this._debugText.setVisible(this._debugVisible);
        });
    }

    // ─── Update loop ───────────────────────────────────────────────────────────

    update(time, delta) {
        this._pollTouchButtons();
        this.player.update(time, delta, this._getInput());

        // Tick enemies
        this._enemies.getChildren().forEach(e => { if (e.active) e.update(time, delta); });

        // Tick hitboxes (reposition each frame)
        this._playerHitboxes.getChildren().forEach(h => { if (h.active && h.update) h.update(); });
        this._enemyHitboxes.getChildren().forEach(h  => { if (h.active && h.update) h.update(); });

        this._updateHUD();
    }

    _getInput() {
        return {
            left:  this.cursors.left.isDown  || this._touch.left,
            right: this.cursors.right.isDown || this._touch.right,
            down:  this.cursors.down.isDown  || this._touch.down,
            jump:  this.cursors.space.isDown || this._touch.jumpDown,
            punch: Phaser.Input.Keyboard.JustDown(this._punchKey) || this._touch.punchJustDown,
        };
    }

    _updateHUD() {
        // HP bar
        const frac  = this.player.hp / this.player.maxHp;
        this._hpBarFill.width     = this._hpBarMaxW * Math.max(0, frac);
        this._hpBarFill.fillColor = frac > 0.5 ? 0x44ee44 : frac > 0.25 ? 0xeeee44 : 0xee4444;

        if (!this._debugVisible) return;
        const vx = Math.round(this.player.body.velocity.x);
        const vy = Math.round(this.player.body.velocity.y);
        const onGround = this.player.body.blocked.down;
        const state = this.player._crawling ? 'CRAWL' : this.player._crouching ? 'CROUCH' : this.player._sprint ? 'SPRINT' : 'walk';

        this._debugText.setText(
            `Phase 2A — Combat\n` +
            `Vel (${vx}, ${vy})  ${onGround ? 'Grounded' : 'Airborne'}  ${state}\n` +
            `Pos (${Math.round(this.player.x)}, ${Math.round(this.player.y)})\n` +
            `HP ${this.player.hp}/${this.player.maxHp}  Attack: ${this.player.attackState}`
        );
    }

    // ─── Touch Controls ────────────────────────────────────────────────────────

    _buildTouchControls() {
        this.input.addPointer(3); // 4 simultaneous touches total

        // Button hit-circle definitions (x, y, radius) in game canvas space
        // Positioned at ~75% canvas height so mobile browser chrome doesn't clip them
        this._btns = {
            left:  { x: 85,   y: 510, r: 52 },
            right: { x: 305,  y: 510, r: 52 },
            down:  { x: 195,  y: 578, r: 52 },
            jump:  { x: 1195, y: 510, r: 52 },
            punch: { x: 1095, y: 580, r: 44 },
        };

        // Single graphics layer for all button visuals — redrawn each frame
        this._touchGfx = this.add.graphics().setScrollFactor(0).setDepth(200);

        // Draw initial unpressed state
        this._drawTouchButtons();
    }

    // Called every frame — polls raw pointer positions instead of relying on events
    _pollTouchButtons() {
        const prev = { ...this._touch };
        this._touch.left     = false;
        this._touch.right    = false;
        this._touch.jumpDown = false;
        this._touch.down     = false;
        this._touch.punch    = false;

        const ptrs = this.input.manager.pointers;
        for (let i = 0; i < ptrs.length; i++) {
            const p = ptrs[i];
            if (!p || !p.isDown) continue;
            if (this._inBtn(p.x, p.y, this._btns.left))  this._touch.left     = true;
            if (this._inBtn(p.x, p.y, this._btns.right)) this._touch.right    = true;
            if (this._inBtn(p.x, p.y, this._btns.jump))  this._touch.jumpDown = true;
            if (this._inBtn(p.x, p.y, this._btns.down))  this._touch.down     = true;
            if (this._inBtn(p.x, p.y, this._btns.punch)) this._touch.punch    = true;
        }

        // punchJustDown: true only on the frame the button transitions to pressed
        this._touch.punchJustDown = this._touch.punch && !prev.punch;

        const changed = this._touch.left     !== prev.left
                     || this._touch.right    !== prev.right
                     || this._touch.jumpDown !== prev.jumpDown
                     || this._touch.down     !== prev.down
                     || this._touch.punch    !== prev.punch;
        if (changed) this._drawTouchButtons();
    }

    _inBtn(px, py, btn) {
        const dx = px - btn.x, dy = py - btn.y;
        return dx * dx + dy * dy <= btn.r * btn.r;
    }

    _drawTouchButtons() {
        const g = this._touchGfx;
        g.clear();

        const drawBtn = (btn, pressed) => {
            // Background circle
            g.fillStyle(0x000000, pressed ? 0.55 : 0.28);
            g.fillCircle(btn.x, btn.y, btn.r);
            g.lineStyle(2.5, 0xffffff, pressed ? 1.0 : 0.45);
            g.strokeCircle(btn.x, btn.y, btn.r);
        };

        const drawArrow = (btn, dir, pressed) => {
            const a = pressed ? 1.0 : 0.7;
            const s = 18; // arrow half-size
            g.fillStyle(0xffffff, a);
            if (dir === 'left') {
                g.fillTriangle(
                    btn.x - s,     btn.y,
                    btn.x + s * 0.6, btn.y - s,
                    btn.x + s * 0.6, btn.y + s
                );
            } else if (dir === 'right') {
                g.fillTriangle(
                    btn.x + s,     btn.y,
                    btn.x - s * 0.6, btn.y - s,
                    btn.x - s * 0.6, btn.y + s
                );
            } else if (dir === 'up') {
                g.fillTriangle(
                    btn.x,         btn.y - s,
                    btn.x - s,     btn.y + s * 0.6,
                    btn.x + s,     btn.y + s * 0.6
                );
            } else if (dir === 'down') {
                g.fillTriangle(
                    btn.x,         btn.y + s,
                    btn.x - s,     btn.y - s * 0.6,
                    btn.x + s,     btn.y - s * 0.6
                );
            }
        };

        drawBtn(this._btns.left,  this._touch.left);
        drawBtn(this._btns.right, this._touch.right);
        drawBtn(this._btns.down,  this._touch.down);
        drawBtn(this._btns.jump,  this._touch.jumpDown);
        drawBtn(this._btns.punch, this._touch.punch);

        drawArrow(this._btns.left,  'left',  this._touch.left);
        drawArrow(this._btns.right, 'right', this._touch.right);
        drawArrow(this._btns.down,  'down',  this._touch.down);
        drawArrow(this._btns.jump,  'up',    this._touch.jumpDown);

        // Punch button — "J" label in the center
        const pb  = this._btns.punch;
        const pa  = this._touch.punch ? 1.0 : 0.7;
        const col = this._touch.punch ? '#ffffff' : '#dddddd';
        g.fillStyle(0xffffff, pa);
        // Draw fist-like shape: two rectangles (knuckles over palm)
        g.fillRoundedRect(pb.x - 14, pb.y - 16, 28, 14, 5);
        g.fillRoundedRect(pb.x - 11, pb.y - 4,  22, 12, 4);
    }
}
