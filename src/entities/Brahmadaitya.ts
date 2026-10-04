import Phaser from 'phaser';
import { getBossDef } from '../systems/BossDefs';
import { burst } from '../systems/Debris';
import type { MoveDef } from '../systems/Moves';
import { Boss } from './Boss';

const ROOT_DUST = [0x5a4a2e, 0x8a7a4e, 0x3b2a1a];
const LEAVES = [0x4caf50, 0x2e7d32, 0xffb300];

/**
 * Brahmadaitya: the restless spirit said to dwell in an old banyan tree.
 * Gaunt and ash-grey in a plain white shroud, crowned with banyan roots and leaves.
 * Slam, whirl and charge are all defined in moves.json; this class only adds flavour.
 */
export class Brahmadaitya extends Boss {
  constructor(scene: Phaser.Scene, x: number, groundY: number) {
    super(scene, x, groundY, getBossDef('brahmadaitya'));
  }

  protected hoverOffset(): number {
    return 3 + Math.sin(this.clock * 2) * 3; // slow, heavy drift
  }

  protected onAttackActive(move: MoveDef): void {
    const cam = this.gameScene.cameras.main;
    const cx = this.x + this.facing * move.hitbox.offsetX;

    switch (move.pose) {
      case 'slam':
        burst(this.gameScene, cx, this.groundY - 6, ROOT_DUST, 12);
        cam.shake(140, 0.004);
        break;
      case 'sweep':
        burst(this.gameScene, this.x, this.groundY - 10, LEAVES, 14);
        break;
      default:
        burst(this.gameScene, this.x - this.facing * 10, this.groundY - 4, ROOT_DUST, 8);
        break;
    }
  }
}