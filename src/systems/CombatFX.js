class CombatFX {
    constructor(scene) {
        this.scene = scene;
    }

    hitPause(durationMs = 80) {
        this.scene.physics.world.pause();
        this.scene.tweens.pauseAll();
        this.scene.time.delayedCall(durationMs, () => {
            this.scene.physics.world.resume();
            this.scene.tweens.resumeAll();
        });
    }

    screenShake(durationMs = 120, intensity = 0.008) {
        this.scene.cameras.main.shake(durationMs, intensity);
    }

    hitSpark(x, y, color = 0xfff7a8) {
        const g = this.scene.add.graphics().setDepth(50);
        g.fillStyle(color, 1);
        g.fillCircle(0, 0, 14);
        g.x = x;
        g.y = y;
        this.scene.tweens.add({
            targets:    g,
            scaleX:     2.5,
            scaleY:     2.5,
            alpha:      0,
            duration:   200,
            ease:       'Quad.easeOut',
            onComplete: () => g.destroy(),
        });
    }

    damageNumber(x, y, amount, color = 0xffe14a) {
        const hex = '#' + color.toString(16).padStart(6, '0');
        const txt = this.scene.add.text(x, y, `-${amount}`, {
            fontFamily:      'monospace',
            fontSize:        '20px',
            color:           hex,
            stroke:          '#000000',
            strokeThickness: 3,
        }).setDepth(60).setOrigin(0.5);

        this.scene.tweens.add({
            targets:    txt,
            y:          y - 60,
            alpha:      0,
            duration:   600,
            ease:       'Quad.easeOut',
            onComplete: () => txt.destroy(),
        });
    }

    impactBlast(x, y) {
        this.hitSpark(x, y);
        this.screenShake(100, 0.006);
        this.hitPause(60);
    }
}
