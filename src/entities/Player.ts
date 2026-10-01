import Phaser from 'phaser';
import { LANE_BOTTOM, LANE_TOP, WORLD_WIDTH } from '../config/constants';
import type { InputState } from '../systems/InputSystem';

export interface PlayerConfig {
  id: string;
  name: string;
  speedX: number;
  speedY: number;
  jumpVelocity: number;
  gravity: number;
  maxHealth: number;
}

/**
 * Beat 'em up movement model:
 *  - (x, groundY) is where the feet touch the street. groundY is the depth in the lane.
 *  - z is the height above the ground while jumping.
 *  - The sprite is drawn at (x, groundY - z); the shadow stays at (x, groundY).
 *  - Depth sorting uses groundY, so whoever is lower on screen is drawn in front.
 */
export class Player {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Ellipse;

  x: number;
  groundY: number;
  z = 0;
  facing: 1 | -1 = 1;
  private vz = 0;
  private walkClock = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    groundY: number,
    private readonly cfg: PlayerConfig,
  ) {
    this.x = x;
    this.groundY = groundY;
    this.shadow = scene.add.ellipse(x, groundY, 22, 6, 0x000000, 0.45);
    this.sprite = scene.add.sprite(x, groundY, 'player').setOrigin(0.5, 1);
  }

  get isGrounded(): boolean {
    return this.z <= 0;
  }

  update(dt: number, input: InputState): void {
    // Move (normalised so diagonals aren't faster). Allowed in the air too.
    let mx = input.moveX;
    let my = input.moveY;
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }

    this.x += mx * this.cfg.speedX * dt;
    this.groundY += my * this.cfg.speedY * dt;
    this.x = Phaser.Math.Clamp(this.x, 16, WORLD_WIDTH - 16);
    this.groundY = Phaser.Math.Clamp(this.groundY, LANE_TOP, LANE_BOTTOM);

    if (mx !== 0) this.facing = mx > 0 ? 1 : -1;

    // Jump (fake Z axis)
    if (input.jump && this.isGrounded) this.vz = this.cfg.jumpVelocity;
    if (this.vz !== 0 || this.z > 0) {
      this.vz -= this.cfg.gravity * dt;
      this.z += this.vz * dt;
      if (this.z <= 0) {
        this.z = 0;
        this.vz = 0;
      }
    }

    // Tiny walk bob so movement feels alive even with a static placeholder
    const moving = (mx !== 0 || my !== 0) && this.isGrounded;
    this.walkClock = moving ? this.walkClock + dt : 0;
    const bob = moving && Math.floor(this.walkClock * 8) % 2 === 1 ? 1 : 0;

    this.syncSprites(bob);
  }

  private syncSprites(bob: number): void {
    this.sprite.setPosition(Math.round(this.x), Math.round(this.groundY - this.z - bob));
    this.sprite.setFlipX(this.facing === -1);
    this.sprite.setDepth(this.groundY);

    // Shadow shrinks and fades as the player rises
    const t = Phaser.Math.Clamp(this.z / 60, 0, 1);
    this.shadow.setPosition(Math.round(this.x), Math.round(this.groundY));
    this.shadow.setScale(1 - t * 0.4);
    this.shadow.setAlpha(0.45 - t * 0.2);
    this.shadow.setDepth(this.groundY - 1);
  }
}