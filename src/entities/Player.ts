import Phaser from 'phaser';
import { FRAME_RATE, INPUT_BUFFER_FRAMES } from '../config/constants';
import { getMove, type MoveDef } from '../systems/Moves';
import type { InputState } from '../systems/InputSystem';
import { Fighter, type FighterStats } from './Fighter';

export interface PlayerConfig extends FighterStats {
  id: string;
  name: string;
  speedX: number;
  speedY: number;
  jumpVelocity: number;
  maxEnergy: number;
  energyRegen: number; // per second
  moveset: { punch: string; kick: string; airAttack: string; special: string };
}

export class Player extends Fighter {
  energy: number;
  energyDenied = 0; // frames left to flash the energy bar after a failed special

  private readonly buffer = { jump: 0, punch: 0, kick: 0, special: 0 };
  private walkClock = 0;
  private bob = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    groundY: number,
    private readonly cfg: PlayerConfig,
  ) {
    super(scene, 'player', x, groundY, cfg, 'player-idle');
    this.energy = cfg.maxEnergy;
  }

  get maxEnergy(): number {
    return this.cfg.maxEnergy;
  }

  /** Moves count as invincible during their own frames (e.g. the special). */
  get invincible(): boolean {
    return super.invincible || (this.state === 'attack' && !!this.attack?.move.invincible);
  }
  
  deathPending = false; // GameScene checks this to spend a life

  /** Fighter calls this when the knockdown after reaching 0 health is over. */
  protected onDefeated(): void {
    this.deathPending = true;
  }

  /** Back on your feet with full health, blinking invincible for 2.5 s. */
  respawn(): void {
    this.deathPending = false;
    this.health = this.stats.maxHealth;
    this.energy = this.cfg.maxEnergy;
    this.beginGetUp();
    this.invincibleFrames = 150;
  }

  onHitLanded(move: MoveDef): void {
    this.energy = Math.min(this.cfg.maxEnergy, this.energy + (move.energyGain ?? 0));
  }

  /** Remember presses. GameScene also calls this during hit-pause so no input is lost. */
  bufferActions(input: InputState): void {
    const n = INPUT_BUFFER_FRAMES;
    if (input.jump) this.buffer.jump = n;
    if (input.punch) this.buffer.punch = n;
    if (input.kick) this.buffer.kick = n;
    if (input.special) this.buffer.special = n;
  }

  update(dt: number, input: InputState): void {
    const df = dt * FRAME_RATE;

    this.bufferActions(input);
    this.tickTimers(df);
    this.energy = Math.min(this.cfg.maxEnergy, this.energy + this.cfg.energyRegen * dt);
    this.energyDenied = Math.max(0, this.energyDenied - df);

    if (!this.updateReaction(df)) {
      if (this.state === 'attack') this.updateAttack(dt, df, input);
      else this.updateFree(dt, input);
    }

    this.updatePhysics(dt);

    for (const k of Object.keys(this.buffer) as (keyof typeof this.buffer)[]) {
      this.buffer[k] = Math.max(0, this.buffer[k] - df);
    }
    this.draw();
  }

  // ---------- states ----------

  private updateFree(dt: number, input: InputState): void {
    let mx = input.moveX;
    let my = input.moveY;
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    this.x += mx * this.cfg.speedX * dt;
    this.groundY += my * this.cfg.speedY * dt;
    if (mx !== 0) this.facing = mx > 0 ? 1 : -1;

    if (this.buffer.jump > 0 && this.isGrounded) {
      this.vz = this.cfg.jumpVelocity;
      this.buffer.jump = 0;
    }

    this.tryStartAttack();

    const moving = (mx !== 0 || my !== 0) && this.isGrounded;
    this.walkClock = moving ? this.walkClock + dt : 0;
    this.bob = moving && Math.floor(this.walkClock * 8) % 2 === 1 ? 1 : 0;
  }

  private tryStartAttack(): void {
    const ms = this.cfg.moveset;
    const b = this.buffer;

    if (b.special > 0) {
      if (this.energy >= (getMove(ms.special).energyCost ?? 0)) {
        this.startAttack(ms.special);
        return;
      }
      b.special = 0;
      this.energyDenied = 20;
    }

    if (!this.isGrounded) {
      if (b.punch > 0 || b.kick > 0) this.startAttack(ms.airAttack);
    } else if (b.kick > 0) {
      this.startAttack(ms.kick);
    } else if (b.punch > 0) {
      this.startAttack(ms.punch);
    }
  }

  private startAttack(id: string): void {
    const move = getMove(id);
    this.energy -= move.energyCost ?? 0;
    this.attack = { id, move, frame: 0, hit: new Set() };
    this.setState('attack');
    this.buffer.punch = this.buffer.kick = this.buffer.special = 0;
    this.bob = 0;
  }

  private updateAttack(dt: number, df: number, input: InputState): void {
    const a = this.attack!;
    const m = a.move;
    a.frame += df;
    const activeEnd = m.startup + m.active;

    if (m.lunge && a.frame < activeEnd) this.x += this.facing * m.lunge * dt;
    if (!this.isGrounded) this.x += input.moveX * this.cfg.speedX * 0.5 * dt; // air drift

    // Combo: a punch buffered during the swing chains once the hit frames are over
    if (m.next && a.frame >= activeEnd && this.buffer.punch > 0) {
      if (input.moveX !== 0) this.facing = input.moveX > 0 ? 1 : -1;
      this.startAttack(m.next);
      return;
    }

    if (!m.endOnLand && a.frame >= activeEnd + m.recovery) this.setState('free');
  }

  protected onLand(): void {
    super.onLand();
    if (this.state === 'attack' && this.attack?.move.endOnLand) this.setState('free');
  }

  private draw(): void {
    let tex = 'player-idle';
    if (this.state === 'attack' && this.attack) tex = `player-${this.attack.move.pose}`;
    else if (this.state === 'hurt') tex = 'player-hurt';
    else if (this.state === 'down') tex = 'player-down';
    this.syncSprites(tex, this.bob);
  }
}