import Phaser from 'phaser';
import { FRAME_RATE } from '../config/constants';
import { Fighter, type FighterStats } from './Fighter';

/** A punching bag with a health bar. It never attacks. Real enemies replace it in Step 4. */
export class Dummy extends Fighter {
  private readonly hpBack: Phaser.GameObjects.Rectangle;
  private readonly hpFill: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, x: number, groundY: number, stats: FighterStats) {
    super(scene, 'enemy', x, groundY, stats, 'dummy-idle');
    this.facing = -1;
    this.hpBack = scene.add.rectangle(0, 0, 22, 4, 0x000000).setOrigin(0).setDepth(9000);
    this.hpFill = scene.add.rectangle(0, 0, 20, 2, 0xff3355).setOrigin(0).setDepth(9001);
  }

  update(dt: number): void {
    const df = dt * FRAME_RATE;
    this.tickTimers(df);
    this.updateReaction(df);
    this.updatePhysics(dt);

    this.syncSprites(this.state === 'down' ? 'dummy-down' : 'dummy-idle');

    const bx = Math.round(this.x) - 11;
    const by = Math.round(this.groundY - this.z) - 50;
    this.hpBack.setPosition(bx, by);
    this.hpFill.setPosition(bx + 1, by + 1);
    this.hpFill.width = 20 * (this.health / this.maxHealth);
  }
}