import Phaser from 'phaser';
import { LANE_BOTTOM, LANE_TOP, WORLD_WIDTH } from '../config/constants';
import type { MoveDef } from '../systems/Moves';
import type { Box, Hittable } from '../systems/CombatSystem';

export interface FighterStats {
  maxHealth: number;
  gravity: number;
  iFramesOnHit: number; // invincibility after a non-knockdown hit
  getupIFrames: number; // invincibility after standing up
}

export type FighterState = 'free' | 'attack' | 'hurt' | 'down' | 'getup';
export type Team = 'player' | 'enemy';

export interface AttackState {
  id: string;
  move: MoveDef;
  frame: number; // float frames since the move began
  hit: Set<Hittable>; // who this swing has already hit (fighters and breakables)
}

const GROUND_FRICTION = 500; // px/s^2
const AIR_FRICTION = 40;
const DOWN_FRAMES = 40; // time spent lying on the ground
const GETUP_FRAMES = 16;
const HURT_WIDTH = 16;
const HURT_HEIGHT = 38;
const HURT_DEPTH = 14;

export abstract class Fighter {
  readonly sprite: Phaser.GameObjects.Sprite;
  protected readonly shadow: Phaser.GameObjects.Ellipse;

  x: number;
  groundY: number;
  z = 0;
  vz = 0;
  vx = 0; // knockback velocity only (walking moves x directly)
  facing: 1 | -1 = 1;
  minX = 16; // horizontal limits (the stage manager narrows these during a screen lock)
  maxX = WORLD_WIDTH - 16;

  health: number;
  state: FighterState = 'free';
  attack: AttackState | null = null;
  invincibleFrames = 0;

  protected stateTime = 0;
  protected hurtDuration = 0;

  constructor(
    scene: Phaser.Scene,
    readonly team: Team,
    x: number,
    groundY: number,
    protected readonly stats: FighterStats,
    texture: string,
  ) {
    this.x = x;
    this.groundY = groundY;
    this.health = stats.maxHealth;
    this.shadow = scene.add.ellipse(x, groundY, 22, 6, 0x000000, 0.45);
    this.sprite = scene.add.sprite(x, groundY, texture).setOrigin(0.5, 1);
  }

  get maxHealth(): number {
    return this.stats.maxHealth;
  }

  get isGrounded(): boolean {
    return this.z <= 0 && this.vz <= 0;
  }

  get invincible(): boolean {
    return this.invincibleFrames > 0;
  }
  
  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
  }

  // ---------- boxes ----------

  get hurtbox(): Box {
    return {
      left: this.x - HURT_WIDTH / 2,
      right: this.x + HURT_WIDTH / 2,
      zMin: this.z,
      zMax: this.z + HURT_HEIGHT,
      y: this.groundY,
      depth: HURT_DEPTH,
    };
  }

  isHitActive(): boolean {
    const a = this.attack;
    return !!a && a.frame >= a.move.startup && a.frame < a.move.startup + a.move.active;
  }

  hitbox(): Box | null {
    if (!this.attack || !this.isHitActive()) return null;
    const h = this.attack.move.hitbox;
    const cx = this.x + this.facing * h.offsetX;
    return {
      left: cx - h.width / 2,
      right: cx + h.width / 2,
      zMin: this.z + h.zMin,
      zMax: this.z + h.zMax,
      y: this.groundY,
      depth: h.depth,
    };
  }

  // ---------- taking damage ----------

  /** Returns true if the hit landed (false if blocked by invincibility / already down). */
  receiveHit(attacker: Fighter, move: MoveDef): boolean {
    if (this.invincible || this.state === 'down' || this.state === 'getup') return false;

    this.health = Math.max(0, this.health - move.damage);

    // Knock away from the attacker, and turn to face them
    const away: 1 | -1 =
      this.x === attacker.x ? attacker.facing : this.x > attacker.x ? 1 : -1;
    this.facing = away === 1 ? -1 : 1;
    this.vx = away * move.knockbackX;

    const knockdown = !!move.knockdown || this.health <= 0 || !this.isGrounded;
    if (knockdown) {
      this.vz = move.launch ?? 100;
      this.setState('down');
    } else {
      this.setState('hurt');
      this.hurtDuration = move.hitstun;
      this.invincibleFrames = Math.max(this.invincibleFrames, this.stats.iFramesOnHit);
    }
    return true;
  }

  /** Called when this fighter's attack connects. */
  onHitLanded(_move: MoveDef): void {
    /* Player overrides to build energy */
  }

  // ---------- state helpers ----------

  protected setState(s: FighterState): void {
    this.state = s;
    this.stateTime = 0;
    if (s !== 'attack') this.attack = null;
  }

  protected tickTimers(df: number): void {
    if (this.invincibleFrames > 0) this.invincibleFrames = Math.max(0, this.invincibleFrames - df);
  }

  /** Handles hurt/down/getup. Returns true if the fighter is busy reacting (no control). */
  protected updateReaction(df: number): boolean {
    switch (this.state) {
      case 'hurt':
        this.stateTime += df;
        if (this.stateTime >= this.hurtDuration) this.setState('free');
        return true;
      case 'down':
        if (this.isGrounded) {
          this.stateTime += df;
          if (this.stateTime >= DOWN_FRAMES) {
            if (this.health <= 0) this.onDefeated();
            else this.beginGetUp();
          }
        }
        return true;
      case 'getup':
        this.stateTime += df;
        if (this.stateTime >= GETUP_FRAMES) this.setState('free');
        return true;
      default:
        return false;
    }
  }

  protected beginGetUp(): void {
    this.setState('getup');
    this.invincibleFrames = Math.max(this.invincibleFrames, this.stats.getupIFrames);
  }

  /** Placeholder for the test phase: revive. Real death/lives/enemy removal comes later. */
  protected onDefeated(): void {
    this.health = this.stats.maxHealth;
    this.beginGetUp();
  }

  protected onLand(): void {
    if (this.state === 'down') {
      this.stateTime = 0; // start the "lying on the ground" timer
      this.vx *= 0.5;
    }
  }

  // ---------- physics ----------

  protected updatePhysics(dt: number): void {
    // Knockback slide
    if (this.vx !== 0) {
      this.x += this.vx * dt;
      const f = (this.isGrounded ? GROUND_FRICTION : AIR_FRICTION) * dt;
      this.vx = Math.abs(this.vx) <= f ? 0 : this.vx - Math.sign(this.vx) * f;
    }

    // Fake-Z gravity
    if (this.vz !== 0 || this.z > 0) {
      this.vz -= this.stats.gravity * dt;
      this.z += this.vz * dt;
      if (this.z <= 0) {
        this.z = 0;
        this.vz = 0;
        this.onLand();
      }
    }

    this.x = Phaser.Math.Clamp(this.x, this.minX, this.maxX);
    this.groundY = Phaser.Math.Clamp(this.groundY, LANE_TOP, LANE_BOTTOM);
  }

  // ---------- drawing ----------

  protected syncSprites(texture: string, bob = 0): void {
    if (this.sprite.texture.key !== texture) this.sprite.setTexture(texture);

    this.sprite.setPosition(Math.round(this.x), Math.round(this.groundY - this.z - bob));
    this.sprite.setFlipX(this.facing === -1);
    this.sprite.setDepth(this.groundY);

    // White flash on the first frames of hit-stun
    if (this.state === 'hurt' && this.stateTime < 3) this.sprite.setTintFill(0xffffff);
    else this.sprite.clearTint();

    // Blink while invincible after a hit / get-up
    const blinking = this.invincibleFrames > 0 && (this.state === 'free' || this.state === 'getup');
    this.sprite.setAlpha(blinking && Math.floor(this.invincibleFrames / 3) % 2 === 0 ? 0.35 : 1);

    const t = Phaser.Math.Clamp(this.z / 60, 0, 1);
    this.shadow.setPosition(Math.round(this.x), Math.round(this.groundY));
    this.shadow.setScale(1 - t * 0.4);
    this.shadow.setAlpha(0.45 - t * 0.2);
    this.shadow.setDepth(this.groundY - 1);
  }
}