import Phaser from 'phaser';
import type { Box, Hittable } from '../systems/CombatSystem';
import type { BreakableDef } from '../systems/ItemDefs';
import type { MoveDef } from '../systems/Moves';
import type { Fighter } from './Fighter';

const FLASH_FRAMES = 5;
const SHAKE_FRAMES = 10;

/** A smashable prop standing in the lane. PropManager removes it once `broken` is set. */
export class Breakable implements Hittable {
  readonly team = 'neutral' as const;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly z = 0;

  health: number;
  broken = false;

  private readonly shadow: Phaser.GameObjects.Ellipse;
  private flash = 0;
  private shake = 0;

  constructor(
    scene: Phaser.Scene,
    readonly def: BreakableDef,
    readonly x: number,
    readonly groundY: number,
  ) {
    this.health = def.maxHealth;
    this.shadow = scene.add
      .ellipse(x, groundY, def.width + 2, 5, 0x000000, 0.4)
      .setDepth(groundY - 1);
    this.sprite = scene.add.sprite(x, groundY, def.texture).setOrigin(0.5, 1).setDepth(groundY);
  }

  get hurtbox(): Box {
    return {
      left: this.x - this.def.width / 2,
      right: this.x + this.def.width / 2,
      zMin: 0,
      zMax: this.def.height,
      y: this.groundY,
      depth: this.def.depth,
    };
  }

  receiveHit(_attacker: Fighter, move: MoveDef): boolean {
    if (this.broken) return false;
    this.health -= move.damage;
    this.flash = FLASH_FRAMES;
    this.shake = SHAKE_FRAMES;
    if (this.health <= 0) this.broken = true;
    return true;
  }

  update(df: number): void {
    this.flash = Math.max(0, this.flash - df);
    this.shake = Math.max(0, this.shake - df);

    const offset = this.shake > 0 ? (Math.floor(this.shake / 2) % 2 === 0 ? 1 : -1) : 0;
    this.sprite.setPosition(Math.round(this.x) + offset, Math.round(this.groundY));
    if (this.flash > 0) this.sprite.setTintFill(0xffffff);
    else this.sprite.clearTint();
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}