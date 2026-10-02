import Phaser from 'phaser';
import type { Fighter } from '../entities/Fighter';
import type { Box, Hittable } from './CombatSystem';

/** Press H in-game: green = hurtboxes, red = active hitboxes. */
export class DebugDraw {
  private readonly g: Phaser.GameObjects.Graphics;
  enabled = false;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(20000);
  }

  toggle(): void {
    this.enabled = !this.enabled;
  }

  draw(fighters: readonly Fighter[], props: readonly Hittable[] = []): void {
    this.g.clear();
    if (!this.enabled) return;
    for (const f of fighters) {
      this.box(f.hurtbox, 0x00ff66);
      const hb = f.hitbox();
      if (hb) this.box(hb, 0xff2244);
    }
    for (const p of props) this.box(p.hurtbox, 0xffaa00);
  }

  private box(b: Box, color: number): void {
    this.g.lineStyle(1, color, 1);
    this.g.strokeRect(b.left, b.y - b.zMax, b.right - b.left, b.zMax - b.zMin);
    this.g.lineBetween(b.left, b.y, b.right, b.y); // shows where it sits in the lane
  }
}