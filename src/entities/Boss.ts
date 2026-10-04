import Phaser from 'phaser';
import { FONT, FRAME_RATE } from '../config/constants';
import type { BossAttackDef, BossDef } from '../systems/BossDefs';
import type { Box } from '../systems/CombatSystem';
import { burst } from '../systems/Debris';
import { getMove, type MoveDef } from '../systems/Moves';
import { Fighter } from './Fighter';
import type { Player } from './Player';

export const EVENT_BOSS_START = 'boss-start'; // (boss: Boss, lockX: number)
export const EVENT_BOSS_PHASE = 'boss-phase'; // (phase: number, boss: Boss)
export const EVENT_BOSS_DEFEATED = 'boss-defeated'; // (boss: Boss)  the finishing blow landed
export const EVENT_BOSS_GONE = 'boss-gone'; // (boss: Boss)  the defeat animation is over

export type BossState =
  | 'intro'
  | 'idle'
  | 'approach'
  | 'telegraph'
  | 'attack'
  | 'recover'
  | 'stagger'
  | 'phaseChange'
  | 'dying'
  | 'gone';

const APPROACH_TIMEOUT = 240; // cornered or dodged around: pick a different attack
const PHASE_FRAMES = 100; // the roar between phases
const KNEEL_FRAMES = 70; // defeat: kneeling and flashing
const DISSOLVE_FRAMES = 90; // defeat: turning into light
const CRASH_RECOVERY = 28; // extra stun after a charge hits the arena wall
const MOTE_COLORS = [0xffb300, 0xfff0b0, 0xffffff];
const CRASH_DEBRIS = [0x5a4a2e, 0x8a7a4e, 0x3b2a1a];

/**
 * Base boss. Uses the same move format and hitbox system as everyone else; the boss AI
 * only decides *when* to start a move. Key rules:
 *  - Super armor: attacks are never interrupted by hits.
 *  - Poise: enough damage while idle/approach/recover staggers him (with a cooldown).
 *  - At `phaseThreshold` health he roars (invulnerable) and enters phase 2.
 *  - Every attack shows a wind-up pose, a flicker, a ground warning and a "!" alert.
 */
export abstract class Boss extends Fighter {
  bossState: BossState = 'intro';
  phase = 1;
  removed = false; // BossManager destroys the boss once this is true

  protected readonly gameScene: Phaser.Scene;
  protected clock = 0;

  private arenaMin = 0;
  private arenaMax = 0;
  private timer = 0; // frames spent in the current bossState
  private idleFor = 30;
  private plan: BossAttackDef | null = null;
  private lastMove = '';
  private poise = 0;
  private poiseTimer = 0;
  private staggerImmune = 0;
  private flash = 0;
  private crashed = false;
  private extraRecovery = 0;
  private fxTimer = 0;

  private readonly warn: Phaser.GameObjects.Graphics;
  private readonly alert: Phaser.GameObjects.Text;
  private readonly aura: Phaser.GameObjects.Ellipse;
  private readonly floorShadow: Phaser.GameObjects.Ellipse;

  constructor(
    scene: Phaser.Scene,
    x: number,
    groundY: number,
    protected readonly def: BossDef,
  ) {
    super(scene, 'enemy', x, groundY, def, `${def.texture}-idle`);
    this.gameScene = scene;
    this.facing = -1;
    this.minX = -Infinity; // he walks in from off-screen; the arena limits apply after the intro
    this.maxX = Infinity;
    this.idleFor = def.idleMin;

    this.shadow.setVisible(false); // the base 22px shadow is too small for a boss
    this.floorShadow = scene.add.ellipse(x, groundY, 46, 10, 0x000000, 0.45);
    this.aura = scene.add.ellipse(x, groundY, 60, 72, 0xff3355, 0.14).setVisible(false);
    this.warn = scene.add.graphics().setDepth(100); // above the street, below every fighter
    this.alert = scene.add
      .text(x, groundY, '!', {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#ff3355',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(9400)
      .setVisible(false);
  }

  // ---------- public info ----------

  get name(): string {
    return this.def.name;
  }

  get subtitle(): string {
    return this.def.subtitle;
  }

  get reward(): { score: number; coins: number } {
    return { score: this.def.score, coins: this.def.coinDrop };
  }

  get hurtbox(): Box {
    const h = this.def.hurtbox;
    return {
      left: this.x - h.width / 2,
      right: this.x + h.width / 2,
      zMin: this.z,
      zMax: this.z + h.height,
      y: this.groundY,
      depth: h.depth,
    };
  }

  /** Where he may walk once the intro is over (BossManager sets this from the locked screen). */
  setArena(min: number, max: number): void {
    this.arenaMin = min;
    this.arenaMax = max;
  }

  private get tempo(): number {
    return this.phase === 2 ? this.def.phase2.tempo : 1;
  }

  private get speedMul(): number {
    return this.phase === 2 ? this.def.phase2.speedMul : 1;
  }

  // ---------- subclass hooks ----------

  protected hoverOffset(): number {
    return this.def.hover + Math.sin(this.clock * 3) * 2;
  }

  /** Called once, on the first active frame of every attack (screen shake, dust, sound...). */
  protected onAttackActive(_move: MoveDef): void {
    /* subclasses add flavour */
  }

  // ---------- taking damage ----------

  receiveHit(attacker: Fighter, move: MoveDef): boolean {
    const s = this.bossState;
    if (s === 'intro' || s === 'phaseChange' || s === 'dying' || s === 'gone') return false;

    this.health = Math.max(0, this.health - move.damage);
    this.flash = 4;

    if (this.health <= 0) {
      this.beginDying();
      return true;
    }
    if (this.phase === 1 && this.health <= this.maxHealth * this.def.phaseThreshold) {
      this.beginPhaseChange();
      return true;
    }

    // Poise: only an "open" boss can be staggered. Attacks have super armor.
    this.poise += move.damage * (move.knockdown ? 1.5 : 1);
    this.poiseTimer = 120;
    const open = s === 'idle' || s === 'approach' || s === 'recover';
    if (open && this.poise >= this.def.poise && this.staggerImmune <= 0) this.beginStagger(attacker);
    return true;
  }

  // ---------- per-frame ----------

  update(dt: number, player: Player): void {
    const df = dt * FRAME_RATE;
    this.clock += dt;
    this.timer += df;
    this.flash = Math.max(0, this.flash - df);
    this.staggerImmune = Math.max(0, this.staggerImmune - df);
    if (this.poiseTimer > 0) {
      this.poiseTimer -= df;
      if (this.poiseTimer <= 0) this.poise = 0;
    }

    switch (this.bossState) {
      case 'intro':
        this.doIntro(dt, player);
        break;
      case 'idle':
        this.doIdle(player);
        break;
      case 'approach':
        this.doApproach(dt, player);
        break;
      case 'telegraph':
      case 'attack':
      case 'recover':
        this.updateAttack(dt, df, player);
        break;
      case 'stagger':
        if (this.timer >= this.def.staggerFrames) this.enterIdle(15);
        break;
      case 'phaseChange':
        if (this.timer >= PHASE_FRAMES) this.enterIdle(30);
        break;
      case 'dying':
        this.doDying(df);
        break;
      default:
        break;
    }

    this.updatePhysics(dt);
    this.draw();
  }

  destroy(): void {
    this.warn.destroy();
    this.alert.destroy();
    this.aura.destroy();
    this.floorShadow.destroy();
    super.destroy();
  }

  // ---------- state machine ----------

  private go(s: BossState): void {
    this.bossState = s;
    this.timer = 0;
  }

  private enterIdle(frames?: number): void {
    const mul = this.phase === 2 ? this.def.phase2.idleMul : 1;
    this.idleFor = frames ?? Phaser.Math.Between(this.def.idleMin, this.def.idleMax) * mul;
    this.go('idle');
  }

  private doIntro(dt: number, player: Player): void {
    this.facing = -1;
    this.x -= this.def.speed * 2 * dt;
    if (this.x <= this.arenaMax - 70) {
      this.minX = this.arenaMin;
      this.maxX = this.arenaMax;
      this.faceTarget(player);
      this.gameScene.cameras.main.shake(300, 0.004); // heavy arrival
      this.enterIdle(45);
    }
  }

  private doIdle(player: Player): void {
    this.faceTarget(player);
    if (this.timer >= this.idleFor) {
      this.plan = this.pickPlan(this.lastMove);
      this.go('approach');
    }
  }

  /** Walk (or back off) until the planned attack's distance window is reached, then start it. */
  private doApproach(dt: number, player: Player): void {
    const plan = this.plan ?? this.pickPlan(this.lastMove);
    this.plan = plan;
    this.faceTarget(player);

    const dx = Math.abs(player.x - this.x);
    const dy = Math.abs(player.groundY - this.groundY);
    const playerUp = player.state !== 'down' && player.state !== 'getup' && !player.deathPending;

    if (dx >= plan.minRange && dx <= plan.maxRange && dy <= plan.laneTolerance && playerUp) {
      this.startAttack(plan);
      return;
    }

    const side = this.x >= player.x ? 1 : -1; // which side of the player he is on
    let tx = this.x;
    if (dx < plan.minRange) tx = player.x + side * (plan.minRange + 12); // back off for room
    else if (dx > plan.maxRange) tx = player.x + side * (plan.maxRange - 6);
    tx = Phaser.Math.Clamp(tx, this.arenaMin, this.arenaMax);

    const speed = this.def.speed * this.speedMul * (dx < plan.minRange ? 1.3 : 1);
    this.moveToward(tx, player.groundY, speed, this.def.speedY * this.speedMul, dt);

    if (this.timer > APPROACH_TIMEOUT) {
      this.plan = this.pickPlan(plan.move);
      this.timer = 0;
    }
  }

  private startAttack(plan: BossAttackDef): void {
    const move = getMove(plan.move);
    this.plan = plan;
    this.attack = { id: plan.move, move, frame: 0, hit: new Set() };
    this.setState('attack');
    this.go('telegraph');
    this.lastMove = plan.move;
    this.crashed = false;
    this.extraRecovery = 0;
  }

  /** telegraph (startup) -> attack (active) -> recover, all driven by the move's frame counter. */
  private updateAttack(dt: number, df: number, player: Player): void {
    const a = this.attack;
    const plan = this.plan;
    if (!a || !plan) {
      this.finishAttack();
      return;
    }
    const m = a.move;
    a.frame += df * this.tempo;
    const activeEnd = m.startup + m.active;

    if (a.frame < m.startup) {
      this.bossState = 'telegraph';
      if (a.frame < plan.trackFrames) {
        // Still lining up: after this the warning zone is locked and can be dodged
        this.faceTarget(player);
        const step = this.def.speedY * 1.6 * dt;
        this.groundY += Phaser.Math.Clamp(player.groundY - this.groundY, -step, step);
      }
    } else if (a.frame < activeEnd) {
      if (this.bossState !== 'attack') {
        this.bossState = 'attack';
        this.timer = 0;
        this.onAttackActive(m);
      }
      if (m.lunge) {
        this.x += this.facing * m.lunge * this.tempo * dt;
        if (!this.crashed && this.hitWall()) {
          // Charged into the wall: ends the dash early and leaves him stunned
          this.crashed = true;
          a.frame = activeEnd;
          this.extraRecovery = CRASH_RECOVERY;
          this.vx = -this.facing * 70;
          this.gameScene.cameras.main.shake(200, 0.006);
          burst(this.gameScene, this.x + this.facing * 24, this.groundY - 20, CRASH_DEBRIS, 12);
        }
      }
    } else if (a.frame < activeEnd + m.recovery + this.extraRecovery) {
      this.bossState = 'recover';
    } else {
      this.finishAttack();
    }
  }

  private finishAttack(): void {
    this.setState('free'); // also clears this.attack
    this.plan = null;
    this.crashed = false;
    this.extraRecovery = 0;
    // Phase 2: sometimes he follows up straight away
    const chain = this.phase === 2 && Math.random() < this.def.phase2.chainChance;
    this.enterIdle(chain ? 6 : undefined);
  }

  private hitWall(): boolean {
    return (
      (this.facing === 1 && this.x >= this.maxX - 0.5) ||
      (this.facing === -1 && this.x <= this.minX + 0.5)
    );
  }

  private beginStagger(attacker: Fighter): void {
    this.setState('free');
    this.plan = null;
    this.poise = 0;
    this.staggerImmune = this.def.staggerFrames + 90; // no stun-locking
    this.vx = (this.x >= attacker.x ? 1 : -1) * 60;
    this.go('stagger');
  }

  private beginPhaseChange(): void {
    this.setState('free');
    this.plan = null;
    this.crashed = false;
    this.extraRecovery = 0;
    this.phase = 2;
    this.vx = 0;
    this.go('phaseChange');
    this.gameScene.events.emit(EVENT_BOSS_PHASE, 2, this);
  }

  private beginDying(): void {
    this.setState('free');
    this.plan = null;
    this.vx = 0;
    this.vz = 0;
    this.fxTimer = 0;
    this.go('dying');
    this.gameScene.events.emit(EVENT_BOSS_DEFEATED, this);
  }

  /** Kneel and flash, then dissolve into drifting motes of light. */
  private doDying(df: number): void {
    this.fxTimer += df;
    if (this.fxTimer >= (this.timer < KNEEL_FRAMES ? 9 : 4)) {
      this.fxTimer = 0;
      this.spawnMote();
    }
    if (this.timer >= KNEEL_FRAMES + DISSOLVE_FRAMES) {
      this.bossState = 'gone';
      this.removed = true;
    }
  }

  private spawnMote(): void {
    const x = this.x + Phaser.Math.Between(-14, 14);
    const y = this.groundY - this.z - Phaser.Math.Between(6, 56);
    const mote = this.gameScene.add
      .rectangle(x, y, 2, 2, Phaser.Utils.Array.GetRandom(MOTE_COLORS))
      .setDepth(9400);
    this.gameScene.tweens.add({
      targets: mote,
      y: y - 28,
      alpha: 0,
      duration: 700,
      onComplete: () => mote.destroy(),
    });
  }

  // ---------- AI helpers ----------

  private pickPlan(avoid: string): BossAttackDef {
    const key = this.phase === 2 ? 'weight2' : 'weight';
    let pool = this.def.attacks.filter((a) => a.move !== avoid && a[key] > 0);
    if (pool.length === 0) pool = this.def.attacks;

    const total = pool.reduce((sum, a) => sum + a[key], 0);
    let r = Math.random() * total;
    for (const a of pool) {
      r -= a[key];
      if (r <= 0) return a;
    }
    return pool[pool.length - 1];
  }

  private faceTarget(player: Player): void {
    this.facing = player.x >= this.x ? 1 : -1;
  }

  private moveToward(tx: number, ty: number, sx: number, sy: number, dt: number): void {
    this.x += Phaser.Math.Clamp(tx - this.x, -sx * dt, sx * dt);
    this.groundY += Phaser.Math.Clamp(ty - this.groundY, -sy * dt, sy * dt);
  }

  // ---------- drawing ----------

  private draw(): void {
    const t = this.def.texture;
    const a = this.attack;
    let tex = `${t}-idle`;
    let bob = this.hoverOffset();

    switch (this.bossState) {
      case 'telegraph':
        if (a) tex = `${t}-${a.move.pose}-windup`;
        break;
      case 'attack':
      case 'recover':
        if (a) tex = `${t}-${a.move.pose}`;
        break;
      case 'stagger':
        tex = `${t}-hurt`;
        bob = 0;
        break;
      case 'phaseChange':
        tex = `${t}-roar`;
        break;
      case 'dying':
        tex = `${t}-kneel`;
        bob = 0;
        break;
      default:
        break;
    }

    this.syncSprites(tex, bob);

    // Spirit Whirl: flip every few frames so the spin reads as motion
    if (this.bossState === 'attack' && a?.move.pose === 'sweep') {
      this.sprite.setFlipX(Math.floor(a.frame / 3) % 2 === 0);
    }

    // Telegraph: red flicker + trembling
    if (this.bossState === 'telegraph' && a) {
      if (Math.floor(a.frame / 3) % 2 === 0) this.sprite.setTint(0xff8899);
      this.sprite.x += Math.floor(a.frame / 2) % 2 === 0 ? 1 : -1;
    }
    if (this.bossState === 'phaseChange') this.sprite.x += Math.floor(this.timer / 2) % 2 === 0 ? 2 : -2;

    // Defeat: kneel and flash white, then fade to light while drifting up
    if (this.bossState === 'dying') {
      const t0 = this.timer;
      if (t0 < KNEEL_FRAMES) {
        this.sprite.x += Math.floor(t0 / 2) % 2 === 0 ? 1 : -1;
        if (Math.floor(t0 / 5) % 2 === 0) this.sprite.setTintFill(0xffffff);
      } else {
        const k = Math.min(1, (t0 - KNEEL_FRAMES) / DISSOLVE_FRAMES);
        this.sprite.setAlpha(1 - k);
        this.sprite.y -= Math.round(k * 24);
        this.sprite.setTintFill(0xfff0b0);
      }
    }

    if (this.flash > 0) this.sprite.setTintFill(0xffffff);

    this.floorShadow
      .setPosition(Math.round(this.x), Math.round(this.groundY))
      .setDepth(this.groundY - 1)
      .setAlpha(0.45 * this.sprite.alpha);

    // Phase 2 aura
    const raged = this.phase === 2 && this.bossState !== 'dying';
    this.aura.setVisible(raged);
    if (raged) {
      const pulse = 1 + Math.sin(this.clock * 6) * 0.08;
      this.aura
        .setPosition(Math.round(this.x), Math.round(this.groundY - this.z - 32 - bob))
        .setScale(pulse)
        .setDepth(this.groundY - 0.5);
    }

    // "!" just before the hit
    const showAlert = this.bossState === 'telegraph' && !!a && a.frame >= a.move.startup - 16;
    this.alert.setVisible(showAlert);
    if (showAlert && a) {
      this.alert
        .setPosition(Math.round(this.x), Math.round(this.groundY - this.z - bob - 66))
        .setAlpha(Math.floor(a.frame / 3) % 2 === 0 ? 1 : 0.5);
    }

    this.drawWarning();
  }

  /** Ground warning drawn from the move's own hitbox, so it always matches what will hit. */
  private drawWarning(): void {
    const g = this.warn;
    g.clear();
    const a = this.attack;
    if (this.bossState !== 'telegraph' || !a) return;

    const m = a.move;
    const h = m.hitbox;
    const t = Phaser.Math.Clamp(a.frame / m.startup, 0, 1); // 0 -> 1 until the hit
    const lining = !!this.plan && a.frame < this.plan.trackFrames;
    const alpha = lining ? 0.16 : 0.26 + (Math.floor(a.frame / 3) % 2) * 0.12; // blinks once locked

    const cx = this.x + this.facing * h.offsetX;
    let left = cx - h.width / 2;
    let right = cx + h.width / 2;
    if (m.lunge) {
      const travel = (m.lunge * m.active) / FRAME_RATE; // the whole dash path
      if (this.facing === 1) right += travel;
      else left -= travel;
    }
    const width = right - left;
    const top = this.groundY - h.depth / 2;

    g.fillStyle(0xff2244, alpha);
    g.lineStyle(1, 0xff6677, 0.9);
    if (m.warn === 'ellipse') {
      g.fillEllipse(cx, this.groundY, width, h.depth);
      g.strokeEllipse(cx, this.groundY, width, h.depth);
      g.fillStyle(0xffaa33, 0.35);
      g.fillEllipse(cx, this.groundY, width * t, h.depth * t); // countdown fill
    } else {
      g.fillRect(left, top, width, h.depth);
      g.strokeRect(left, top, width, h.depth);
      g.fillStyle(0xffaa33, 0.35);
      const fillW = width * t;
      g.fillRect(this.facing === 1 ? left : right - fillW, top, fillW, h.depth); // countdown fill
    }
  }
}