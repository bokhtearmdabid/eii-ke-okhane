import Phaser from 'phaser';
import type { Player } from '../entities/Player';

const GRAVITY = 500;
const LIFETIME = 9; // seconds before an uncollected coin disappears
const BLINK_TIME = 2; // blinks during the last N seconds
const ARM_TIME = 0.35; // can't be collected while still popping out
const PICKUP_DX = 14;
const PICKUP_DY = 10;

interface Coin {
  body: Phaser.GameObjects.Arc;
  shadow: Phaser.GameObjects.Ellipse;
  x: number;
  y: number; // lane position (feet)
  z: number;
  vx: number;
  vz: number;
  age: number;
  bounced: boolean;
}

/** Coins that pop out of defeated enemies and are collected by walking over them. */
export class CoinManager {
  private readonly coins: Coin[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly onCollect: () => void,
  ) {}

  drop(x: number, groundY: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const body = this.scene.add.circle(x, groundY, 3, 0xffc857).setStrokeStyle(1, 0xb8860b);
      const shadow = this.scene.add.ellipse(x, groundY, 7, 3, 0x000000, 0.4);
      this.coins.push({
        body,
        shadow,
        x,
        y: groundY,
        z: 0,
        vx: Phaser.Math.FloatBetween(-45, 45),
        vz: Phaser.Math.FloatBetween(120, 150),
        age: 0,
        bounced: false,
      });
    }
  }

  update(dt: number): void {
    const p = this.player;

    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.age += dt;

      if (c.z > 0 || c.vz !== 0) {
        c.vz -= GRAVITY * dt;
        c.z += c.vz * dt;
        c.x += c.vx * dt;
        if (c.z <= 0) {
          c.z = 0;
          if (!c.bounced) {
            c.bounced = true;
            c.vz = 70;
          } else {
            c.vz = 0;
            c.vx = 0;
          }
        }
      }
      // Keep coins reachable: inside whatever area the player is allowed to walk
      c.x = Phaser.Math.Clamp(c.x, p.minX, p.maxX);

      const near = Math.abs(p.x - c.x) <= PICKUP_DX && Math.abs(p.groundY - c.y) <= PICKUP_DY;
      if (c.age > ARM_TIME && c.z < 24 && near && p.state !== 'down') {
        this.onCollect();
        this.remove(i);
        continue;
      }
      if (c.age > LIFETIME) {
        this.remove(i);
        continue;
      }

      const visible = c.age < LIFETIME - BLINK_TIME || Math.floor(c.age * 10) % 2 === 0;
      c.body.setVisible(visible);
      c.body.setPosition(Math.round(c.x), Math.round(c.y - c.z - 3)).setDepth(c.y);
      c.shadow.setPosition(Math.round(c.x), Math.round(c.y)).setDepth(c.y - 1);
    }
  }

  private remove(i: number): void {
    const c = this.coins[i];
    c.body.destroy();
    c.shadow.destroy();
    this.coins.splice(i, 1);
  }
}