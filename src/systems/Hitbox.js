class Hitbox extends Phaser.GameObjects.Zone {
    constructor(scene, owner, opts) {
        super(scene, owner.x, owner.y, opts.width, opts.height);
        scene.add.existing(this);
        scene.physics.add.existing(this, false);

        this.owner       = owner;
        this.opts        = opts;
        this.tag         = opts.tag;
        this._hitTargets = new Set();
        this._alive      = true;

        this.body.allowGravity = false;
        this.body.immovable    = true;

        this._reposition();
        scene.time.delayedCall(opts.lifetimeMs, () => {
            if (this._alive) this.destroy();
        });
    }

    update() {
        if (!this._alive) return;
        if (!this.owner || !this.owner.active) { this.destroy(); return; }
        this._reposition();
    }

    // Flip x-offset so hitbox is always in front of the owner regardless of facing
    _reposition() {
        if (!this.active || !this.owner) return;
        const flip = this.owner.flipX ? 1 : -1;
        this.x = this.owner.x + this.opts.x * flip;
        this.y = this.owner.y + this.opts.y;
        if (this.body) this.body.reset(this.x, this.y);
    }

    destroy(...args) {
        if (!this._alive) return;
        this._alive = false;
        super.destroy(...args);
    }
}
