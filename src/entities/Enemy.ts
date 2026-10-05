import Phaser from 'phaser';
import { FRAME_RATE, LANE_BOTTOM, LANE_TOP } from '../config/constants';
import { getMove } from '../systems/Moves';
import type { EnemyDef } from '../systems/EnemyDefs';
import { EnemyHealthBar } from '../ui/EnemyHealthBar';
import { Fighter } from './Fighter';
import type { Player } from './Player';
import { ActorAnimator } from '../systems/ActorAnimator';

export type EnemyState = 'idle' | 'approach' | 'circle' | 'attack' | 'hurt' | 'down' | 'dead';
export type EnemyRole = 'attacker' | 'waiter';

const DEAD_FRAMES = 50; // fade-out time after the knockdown on defeat
const APPROACH_TIMEOUT = 300; // give up and release the attack slot after 5 s
const CATCH_UP_DISTANCE = 140; // beyond this, enemies move faster to rejoin the fight

/**
 * Base enemy. Fighter.state handles physical reactions (hurt/down/getup/attack frames);
 * aiState is the brain on top of it:
 *
 *   idle ──► approach ──► attack ──► idle
 *     └────► circle ───────▲(slot granted by EnemyManager)
 *   any ──► hurt ──► idle        any ──► down ──► idle (or dead if health is 0)
 */
export class Enemy extends Fighter {
  private static nextId = 1;
  readonly uid = Enemy.nextId++;

  aiState: EnemyState = 'idle';
  role: EnemyRole = 'waiter'; // set by EnemyManager (attack slots)
  removed = false; // true once the death fade is over; the manager then destroys it
  deathReported = false;

  protected clock = 0;
  private cooldown: number;
  private aiTimer = 0;
  private aiDuration: number;
  private circleDir: 1 | -1;
  private readonly healthBar: EnemyHealthBar;

  constructor(
    scene: Phaser.Scene,
    x: number,
    groundY: number,
    protected readonly def: EnemyDef,
  ) {
    super(scene, 'enemy', x, groundY, def, `${def.texture}-idle`);
    this.facing = -1;
    // Stagger first attacks so a freshly spawned group doesn't swing in sync
    this.cooldown = Phaser.Math.Between(40, def.attackCooldownMin);
    this.aiDuration = Phaser.Math.Between(def.thinkMin, def.thinkMax);
    this.circleDir = Math.random() < 0.5 ? 1 : -1;
    this.healthBar = new EnemyHealthBar(scene, def.maxHealth);
    this.animator = ActorAnimator.create(scene, def.texture); // 'petni', ...
  }

  get isDead(): boolean {
    return this.aiState === 'dead';
  }

  get reward(): { score: number; coins: number } {
    return { score: this.def.score, coins: this.def.coinDrop };
  }

  get cooldownFrames(): number {
    return Math.ceil(this.cooldown);
  }

  /** The manager may promote this enemy to attacker only when it's calm and off cooldown. */
  get canTakeAttackToken(): boolean {
    return (
      this.role === 'waiter' &&
      this.state === 'free' &&
      this.cooldown <= 0 &&
      (this.aiState === 'idle' || this.aiState === 'circle')
    );
  }

  /** Subclass hook: vertical float offset in px (0 for ground enemies). */
  protected hoverOffset(): number {
    return 0;
  }

  update(dt: number, player: Player, others: readonly Enemy[]): void {
    const df = dt * FRAME_RATE;
    this.clock += dt;
    this.tickTimers(df);
    this.cooldown = Math.max(0, this.cooldown - df);

    if (this.aiState === 'dead') {
      this.aiTimer += df;
      if (this.aiTimer >= DEAD_FRAMES) this.removed = true;
    } else {
      const busy = this.updateReaction(df); // hurt / down / getup (may trigger onDefeated)
      if (busy) {
        this.role = 'waiter'; // being hit always releases the attack slot
        if ((this.aiState as EnemyState) !== 'dead') this.aiState = this.state === 'hurt' ? 'hurt' : 'down';
      } else {
        if (this.aiState === 'hurt' || this.aiState === 'down') {
          this.cooldown = Math.max(this.cooldown, 30);
          this.enter('idle', Phaser.Math.Between(10, 25));
        }
        this.runAI(dt, df, player, others);
      }
      this.updatePhysics(dt);
    }

    this.draw(df);
  }

  destroy(): void {
    this.healthBar.destroy();
    super.destroy();
  }
    /** Used when the boss falls: every remaining enemy fades away. */
  banish(): void {
    if (this.aiState === 'dead') return;
    this.health = 0;
    this.vx = 0;
    this.vz = 0;
    this.z = 0;
    this.setState('free');
    this.onDefeated(); // sets role, clears the attack, enters 'dead' (fade-out)
  }
  /** Called by Fighter when the knockdown after reaching 0 health is over. */
  protected onDefeated(): void {
    this.role = 'waiter';
    this.attack = null;
    this.enter('dead');
  }

  // ---------- state machine ----------

  private enter(s: EnemyState, duration = 0): void {
    this.aiState = s;
    this.aiTimer = 0;
    this.aiDuration = duration;
  }

  private runAI(dt: number, df: number, player: Player, others: readonly Enemy[]): void {
    switch (this.aiState) {
      case 'attack':
        this.updateAttack(dt, df);
        break;

      case 'idle':
        this.faceTarget(player);
        this.aiTimer += df;
        if (this.aiTimer >= this.aiDuration) {
          this.enter(this.role === 'attacker' ? 'approach' : 'circle', Phaser.Math.Between(60, 140));
        }
        break;

      case 'approach':
        this.doApproach(dt, df, player, others);
        break;

      case 'circle':
        this.doCircle(dt, df, player, others);
        break;

      default:
        break;
    }
  }

  /** Attacker behaviour: walk to striking distance on the player's lane, then swing. */
  private doApproach(dt: number, df: number, player: Player, others: readonly Enemy[]): void {
    this.aiTimer += df;
    this.faceTarget(player);

    const side = this.x >= player.x ? 1 : -1;
    const tx = player.x + side * (this.def.attackRange - 4);
    const far = Math.abs(player.x - this.x) > CATCH_UP_DISTANCE ? 2 : 1;
    this.moveToward(tx, player.groundY, this.def.speed * far, this.def.speedY, dt);
    this.separate(others, dt);

    const dx = Math.abs(player.x - this.x);
    const dy = Math.abs(player.groundY - this.groundY);
    const playerUp = player.state !== 'down' && player.state !== 'getup';

    if (dx <= this.def.attackRange && dy <= this.def.laneTolerance && this.cooldown <= 0 && playerUp) {
      this.startAttack();
    } else if (this.aiTimer > APPROACH_TIMEOUT) {
      this.role = 'waiter'; // couldn't reach the player: let someone else have the slot
      this.cooldown = 60;
      this.enter('circle', Phaser.Math.Between(60, 140));
    }
  }

  /** Waiter behaviour: hold a ring around the player and strafe up and down the lane. */
  private doCircle(dt: number, df: number, player: Player, others: readonly Enemy[]): void {
    this.faceTarget(player);
    if (this.role === 'attacker') {
      this.enter('approach');
      return;
    }

    this.aiTimer += df;
    if (this.aiTimer >= this.aiDuration) {
      this.circleDir = this.circleDir === 1 ? -1 : 1;
      this.enter('circle', Phaser.Math.Between(60, 140));
    }
    if (this.groundY <= LANE_TOP + 2) this.circleDir = 1;
    if (this.groundY >= LANE_BOTTOM - 2) this.circleDir = -1;

    const side = this.x >= player.x ? 1 : -1;
    const tx = player.x + side * this.def.circleRadius;
    const far = Math.abs(player.x - this.x) > CATCH_UP_DISTANCE + this.def.circleRadius ? 2 : 1;
    if (Math.abs(tx - this.x) > 4) {
      const step = Phaser.Math.Clamp(tx - this.x, -1, 1) * this.def.speed * 0.7 * far * dt;
      this.x += step;
    }
    this.groundY += this.circleDir * this.def.speedY * 0.6 * dt;
    this.separate(others, dt);
  }

  private startAttack(): void {
    const id = Phaser.Utils.Array.GetRandom(this.def.attacks);
    this.attack = { id, move: getMove(id), frame: 0, hit: new Set() };
    this.setState('attack');
    this.enter('attack');
  }

  private updateAttack(dt: number, df: number): void {
    const a = this.attack;
    if (!a) {
      this.finishAttack();
      return;
    }
    const m = a.move;
    a.frame += df;
    const activeEnd = m.startup + m.active;

    // The lunge only happens on the swing itself, so the wind-up stays readable
    if (m.lunge && a.frame >= m.startup && a.frame < activeEnd) this.x += this.facing * m.lunge * dt;
    if (a.frame >= activeEnd + m.recovery) this.finishAttack();
  }

  private finishAttack(): void {
    this.setState('free');
    this.role = 'waiter'; // release the slot
    this.cooldown = Phaser.Math.Between(this.def.attackCooldownMin, this.def.attackCooldownMax);
    this.enter('idle', Phaser.Math.Between(this.def.thinkMin, this.def.thinkMax));
  }

  // ---------- movement helpers ----------

  private faceTarget(player: Player): void {
    this.facing = player.x >= this.x ? 1 : -1;
  }

  private moveToward(tx: number, ty: number, sx: number, sy: number, dt: number): void {
    const stepX = sx * dt;
    const stepY = sy * dt;
    this.x += Phaser.Math.Clamp(tx - this.x, -stepX, stepX);
    this.groundY += Phaser.Math.Clamp(ty - this.groundY, -stepY, stepY);
  }

    private atlasFrame(): string | null {
    const an = this.animator;
    if (!an) return null;
    const st = this.stateTime / FRAME_RATE;
    const a = this.attack;

    if (this.aiState === 'dead') return an.still(['down'], 99); // last frame: lying still while fading
    if (this.state === 'down') {
      return this.isGrounded
        ? an.play(['down'], st)
        : an.still(['knockdown', 'down'], this.vz > 0 ? 0 : 1);
    }
    if (this.state === 'getup') return an.play(['getup', 'idle'], st);
    if (this.state === 'hurt') return an.play(['hurt'], st);
    if (this.state === 'attack' && a) return an.move([a.id, a.move.pose], a.frame, a.move);

    const walking = this.aiState === 'approach' || this.aiState === 'circle';
    return an.play(walking ? ['walk', 'idle'] : ['idle'], this.clock);
  }
    
  /** Gentle push away from other enemies so they don't stack on one spot. */
  private separate(others: readonly Enemy[], dt: number): void {
    for (const o of others) {
      if (o === this || o.isDead) continue;
      const ox = this.x - o.x;
      const oy = this.groundY - o.groundY;
      if (Math.abs(ox) < 20 && Math.abs(oy) < 9) {
        const tie = this.uid > o.uid ? 1 : -1;
        this.x += (Math.sign(ox) || tie) * 14 * dt;
        this.groundY += (Math.sign(oy) || tie) * 28 * dt;
      }
    }
  }

  // ---------- drawing ----------

  private draw(df: number): void {
    const t = this.def.texture;
    let tex = `${t}-idle`;
    let bob = this.hoverOffset();

    if (this.aiState === 'dead' || this.state === 'down') {
      tex = `${t}-down`;
      bob = 0;
    } else if (this.state === 'hurt') {
      tex = `${t}-hurt`;
    } else if (this.state === 'attack' && this.attack) {
      const a = this.attack;
      tex = a.frame < a.move.startup ? `${t}-windup` : `${t}-${a.move.pose}`;
    }

    const frame = this.atlasFrame();
    if (frame && this.animator) this.syncSprites(this.animator.atlas, bob, frame);
    else this.syncSprites(tex, bob);

    // Telegraph: flicker red during the wind-up so the player can react
    const a = this.attack;
    if (this.state === 'attack' && a && a.frame < a.move.startup && Math.floor(a.frame / 3) % 2 === 0) {
      this.sprite.setTint(0xff8899);
    }

    // Defeated: fade out and drift upward
    if (this.aiState === 'dead') {
      const k = Math.min(1, this.aiTimer / DEAD_FRAMES);
      this.sprite.setAlpha(1 - k);
      this.shadow.setAlpha((1 - k) * 0.45);
      this.sprite.y -= Math.round(k * 10);
    }

    this.healthBar.update(
      this.x,
      this.groundY - this.z - this.def.hover - 48,
      this.health,
      df,
      this.aiState === 'dead',
    );
  }
}