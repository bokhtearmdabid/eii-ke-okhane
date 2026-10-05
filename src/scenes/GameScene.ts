import Phaser from 'phaser';
import {
  COLORS,
  FONT,
  FRAME_MS,
  GAME_HEIGHT,
  GAME_WIDTH,
  SCENE_KEYS,
  STREET_TOP,
} from '../config/constants';
import playerData from '../data/player.json';
import {
  type Boss,
  EVENT_BOSS_DEFEATED,
  EVENT_BOSS_GONE,
  EVENT_BOSS_PHASE,
  EVENT_BOSS_START,
} from '../entities/Boss';
import type { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { Backdrop } from '../systems/Backdrop';
import { BossManager } from '../systems/BossManager';
import { CombatSystem, type HitEvent, type Hittable } from '../systems/CombatSystem';
import { DebugDraw } from '../systems/DebugDraw';
import { EnemyManager, EVENT_ENEMY_DEFEATED } from '../systems/EnemyManager';
import type { InputState } from '../systems/InputSystem';
import { InputSystem } from '../systems/InputSystem';
import type { BreakableDef, DropEntry, FoodDef, WeaponDef } from '../systems/ItemDefs';
import {
  EVENT_COIN,
  EVENT_FOOD,
  EVENT_WEAPON_BROKE,
  EVENT_WEAPON_PICKED,
  ItemManager,
} from '../systems/ItemManager';
import { ParallaxBackground } from '../systems/ParallaxBackground';
import { EVENT_PROP_BROKEN, PropManager } from '../systems/PropManager';
import { RunState } from '../systems/RunState';
import { getStage } from '../systems/StageDefs';
import {
  EVENT_STAGE_COMPLETE,
  EVENT_WAVE_CLEAR,
  EVENT_WAVE_START,
  StageManager,
} from '../systems/StageManager';
import { BossBar } from '../ui/BossBar';
import { GateLock } from '../ui/GateLock';
import { GoArrow } from '../ui/GoArrow';
import { Hud } from '../ui/Hud';

const START_LIVES = 3;
const COIN_SCORE = 10;
const LIFE_BONUS = 1000; // stage-clear bonus per remaining life
const LETTERBOX_H = 16;
const SLOWMO_MS = 900; // real time spent in slow motion after the boss's final blow
const SLOWMO_SCALE = 0.3;

/** Fed to the player while a cutscene is playing. */
const NO_INPUT: InputState = {
  moveX: 0,
  moveY: 0,
  jump: false,
  punch: false,
  kick: false,
  special: false,
  interact: false,
};

/** Small chance that a defeated enemy drops something to eat. */
const ENEMY_DROPS: DropEntry[] = [
  { kind: 'food', id: 'singara', chance: 0.06 },
  { kind: 'food', id: 'jilapi', chance: 0.04 },
  { kind: 'food', id: 'cha', chance: 0.04 },
];

export class GameScene extends Phaser.Scene {
  private stageId = 'stage1';
  private run!: RunState;
  private player!: Player;
  private enemies!: EnemyManager;
  private bosses!: BossManager;
  private items!: ItemManager;
  private props!: PropManager;
  private stage!: StageManager;
  private combat!: CombatSystem;
  private inputSystem!: InputSystem;
  private backdrop!: Backdrop;
  private hud!: Hud;
  private bossBar!: BossBar;
  private gate!: GateLock;
  private goArrow!: GoArrow;
  private debugDraw!: DebugDraw;
  private debugText!: Phaser.GameObjects.Text;

  private ended = false; // game over or stage clear: the world is frozen
  private cutscene = false; // boss defeat: player input is ignored
  private slowUntil = 0;
  private bars: Phaser.GameObjects.Rectangle[] = [];
  private hitPauseMs = 0;
  private pauseTargets: Hittable[] = [];

  constructor() {
    super(SCENE_KEYS.Game);
  }

  /** scene.start(SCENE_KEYS.Game, { stage: 'stage2' }) will pick another stage later. */
  init(data: { stage?: string }): void {
    this.stageId = data.stage ?? 'stage1';
  }

  create(): void {
    // Scene instances are reused on restart, so reset per-run state here
    this.hitPauseMs = 0;
    this.pauseTargets = [];
    this.ended = false;
    this.cutscene = false;
    this.slowUntil = 0;
    this.bars = [];

    const def = getStage(this.stageId);
    this.run = new RunState(START_LIVES);

    // Real background art when it has been delivered, procedural placeholders otherwise
    this.backdrop = new Backdrop(this, def.background, def.length);
    if (!this.backdrop.hasLayers) new ParallaxBackground(this, def.length);
    if (!this.backdrop.hasFloor) this.drawStreet(def.length);

    this.inputSystem = new InputSystem(this);
    this.combat = new CombatSystem();

    this.player = new Player(this, def.playerStart.x, def.playerStart.y, playerData);
    this.player.maxX = def.length - 16;
    this.combat.add(this.player);

    this.enemies = new EnemyManager(this, this.combat, this.player, def.length);
    this.bosses = new BossManager(this, this.combat, this.player);
    this.items = new ItemManager(this, this.combat, this.player);
    this.props = new PropManager(this, this.combat, this.items);
    this.stage = new StageManager(this, def, this.player, this.enemies, this.bosses);

    for (const p of def.props ?? []) this.props.spawn(p.type, p.x, p.y);
    for (const k of def.pickups ?? []) this.items.place(k.kind, k.id, k.x, k.y);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, def.length, GAME_HEIGHT);
    cam.startFollow(this.player.sprite, true, 0.12, 0.12);
    cam.setDeadzone(50, GAME_HEIGHT);
    cam.roundPixels = true;

    // Dev shortcut: open the game as http://localhost:5173/?boss to skip straight to the boss
    if (new URLSearchParams(window.location.search).has('boss')) this.stage.debugSkipToBoss();

    this.hud = new Hud(this, this.player, this.run, playerData.name);
    this.bossBar = new BossBar(this);
    this.gate = new GateLock(this);
    this.goArrow = new GoArrow(this);
    this.debugDraw = new DebugDraw(this);

    this.debugText = this.add
      .text(4, 48, '', { fontFamily: FONT, fontSize: '8px', color: '#9ff' })
      .setScrollFactor(0)
      .setDepth(10000);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 8, 'Z attack  X kick  C special  Space jump  V pick/throw  H debug', {
        fontFamily: FONT,
        fontSize: '6px',
        color: '#8a85b0',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(10000);

    // Game events
    this.listen(EVENT_ENEMY_DEFEATED, (e: Enemy) => this.onEnemyDefeated(e));
    this.listen(EVENT_COIN, () => {
      this.run.coins++;
      this.run.score += COIN_SCORE;
    });
    this.listen(
      EVENT_FOOD,
      (food: FoodDef, x: number, y: number, healed: number, energy: number) => {
        if (healed > 0) this.floatText(x, y, `+${healed} HP`, '#5cff7a');
        if (energy > 0) this.floatText(x, y + (healed > 0 ? 9 : 0), `+${energy} EN`, '#38e8ff');
        this.floatText(x, y - 10, food.name.toUpperCase(), '#ffffff');
      },
    );
    this.listen(EVENT_WEAPON_PICKED, (w: WeaponDef, x: number, y: number) =>
      this.floatText(x, y, w.name.toUpperCase(), '#ffc857'),
    );
    this.listen(EVENT_WEAPON_BROKE, (x: number, y: number) => this.floatText(x, y, 'BROKE!', '#ff6677'));
    this.listen(EVENT_PROP_BROKEN, (d: BreakableDef, x: number, y: number) => {
      this.run.score += d.score;
      this.floatText(x, y - 4, `+${d.score}`, '#ffffff');
    });
    this.listen(EVENT_WAVE_START, (lockX: number) => {
      this.gate.lock(lockX);
      this.goArrow.hide();
    });
    this.listen(EVENT_WAVE_CLEAR, () => {
      this.gate.unlock();
      this.goArrow.show();
      this.banner('AREA CLEAR!');
    });
    this.listen(EVENT_STAGE_COMPLETE, () => this.finishStage());

    // Boss events
    this.listen(EVENT_BOSS_START, (boss: Boss, lockX: number) => {
      this.gate.lock(lockX, false); // padlock only: the boss walks in through the right edge
      this.gate.setText('BOSS');
      this.goArrow.hide();
      this.bossBar.show(boss.name.toUpperCase());
      this.banner(`${boss.name.toUpperCase()}\n${boss.subtitle.toUpperCase()}`);
    });
    this.listen(EVENT_BOSS_PHASE, () => {
      this.stage.spawnBossSummons();
      this.cameras.main.flash(250, 255, 80, 120);
      this.cameras.main.shake(500, 0.005);
      this.banner('THE SPIRIT RAGES!');
    });
    this.listen(EVENT_BOSS_DEFEATED, () => this.startBossCutscene());
    this.listen(EVENT_BOSS_GONE, (boss: Boss) => this.endBossCutscene(boss));

    this.input.keyboard?.on('keydown-H', () => this.debugDraw.toggle());
    // Boss test keys (only while the H overlay is on): B = boss to 52% HP, M = boss to 12 HP
    this.input.keyboard?.on('keydown-B', () => this.debugBossHp(0.52));
    this.input.keyboard?.on('keydown-M', () => this.debugBossHp(0, 12));
    this.input.keyboard?.once('keydown-ESC', () => this.scene.start(SCENE_KEYS.Menu));

    this.banner(`${def.title}\n${def.name.toUpperCase()}`);
  }

  update(_time: number, delta: number): void {
    if (this.ended) {
      this.hud.update();
      return;
    }

    const real = Math.min(delta, 50); // clamp so tab-switching doesn't teleport us
    const read = this.inputSystem.read(); // always read so key presses are consumed
    const input = this.cutscene ? NO_INPUT : read;

    if (this.hitPauseMs > 0) {
      // HIT-PAUSE: the world is frozen. Only shake the victims and remember button presses.
      this.hitPauseMs -= real;
      this.player.bufferActions(input);
      const jitter = Math.floor(this.hitPauseMs / 33) % 2 === 0 ? 1 : -1;
      for (const f of this.pauseTargets) f.sprite.x = Math.round(f.x) + jitter;
    } else {
      const slow = this.time.now < this.slowUntil ? SLOWMO_SCALE : 1;
      const dt = (real / 1000) * slow;
      this.player.update(dt, input);
      this.enemies.update(dt);
      this.bosses.update(dt);
      this.stage.update(dt);
      const thrownHits = this.items.update(dt);
      this.props.update(dt);
      this.handleHits([...thrownHits, ...this.combat.update()]);
      if (this.player.deathPending) this.onPlayerDown();
    }

    if (this.stage.phase === 'locked') this.gate.setRemaining(this.stage.remaining);

    const boss = this.bosses.boss;
    if (boss) this.bossBar.update(real / FRAME_MS, boss.health, boss.maxHealth, boss.phase);

    this.hud.update();
    this.debugDraw.draw(this.combat.all, this.combat.targetList);
    this.updateDebugText();
  }

  // ---------- run flow ----------

  private onEnemyDefeated(e: Enemy): void {
    const r = e.reward;
    this.run.score += r.score;
    this.items.dropCoins(e.x, e.groundY, r.coins);
    this.items.rollDrops(ENEMY_DROPS, e.x, e.groundY);
    this.floatText(e.x, e.groundY - 40, `+${r.score}`, '#ffffff');
  }

  private onPlayerDown(): void {
    this.run.lives -= 1;
    if (this.run.lives <= 0) {
      this.showEndScreen('GAME OVER', '#ff4f6d', [`SCORE ${this.run.score}`, `COINS ${this.run.coins}`]);
    } else {
      this.player.respawn();
    }
  }

  private finishStage(): void {
    this.goArrow.hide();
    const bonus = this.run.lives * LIFE_BONUS;
    this.run.score += bonus;
    this.showEndScreen('STAGE CLEAR', '#38e8ff', [
      `LIFE BONUS ${bonus}`,
      `SCORE ${this.run.score}`,
      `COINS ${this.run.coins}`,
    ]);
  }

  // ---------- boss defeat cutscene ----------

  /** Finishing blow: flash, slow motion, letterbox, minions fade, bar hides. */
  private startBossCutscene(): void {
    this.cutscene = true;
    this.slowUntil = this.time.now + SLOWMO_MS;
    this.bossBar.hide();
    this.enemies.banishAll();
    this.cameras.main.flash(350, 255, 255, 255);
    this.cameras.main.shake(900, 0.006);
    this.showLetterbox(true);
  }

  /** The boss has dissolved: give control back, burst coins, announce peace. */
  private endBossCutscene(boss: Boss): void {
    this.cutscene = false;
    this.showLetterbox(false);

    const r = boss.reward;
    this.run.score += r.score;
    this.items.dropCoins(boss.x, boss.groundY, r.coins);
    this.floatText(boss.x, boss.groundY - 50, `+${r.score}`, '#ffffff');

    this.gate.unlock();
    this.banner('THE RESTLESS SPIRIT\nIS AT PEACE');
  }

  private showLetterbox(on: boolean): void {
    if (this.bars.length === 0) {
      for (const top of [true, false]) {
        this.bars.push(
          this.add
            .rectangle(0, top ? -LETTERBOX_H : GAME_HEIGHT, GAME_WIDTH, LETTERBOX_H, 0x000000)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(10800),
        );
      }
    }
    const [top, bottom] = this.bars;
    this.tweens.add({ targets: top, y: on ? 0 : -LETTERBOX_H, duration: 400 });
    this.tweens.add({
      targets: bottom,
      y: on ? GAME_HEIGHT - LETTERBOX_H : GAME_HEIGHT,
      duration: 400,
    });
  }

  private debugBossHp(fraction: number, flat?: number): void {
    const b = this.bosses.boss;
    if (!b || !this.debugDraw.enabled) return;
    b.health = Math.min(b.health, flat ?? Math.floor(b.maxHealth * fraction));
  }

  // ---------- end screen ----------

  private showEndScreen(title: string, color: string, lines: string[]): void {
    this.ended = true;
    const fix = <
      T extends Phaser.GameObjects.GameObject &
        Phaser.GameObjects.Components.ScrollFactor &
        Phaser.GameObjects.Components.Depth,
    >(
      o: T,
      d: number,
    ): T => {
      o.setScrollFactor(0);
      o.setDepth(11000 + d);
      return o;
    };

    fix(this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.65).setOrigin(0), 0);
    fix(
      this.add
        .text(GAME_WIDTH / 2, 70, title, {
          fontFamily: FONT,
          fontSize: '24px',
          color,
          stroke: '#000000',
          strokeThickness: 4,
        })
        .setOrigin(0.5),
      1,
    );
    fix(
      this.add
        .text(GAME_WIDTH / 2, 110, lines.join('\n'), {
          fontFamily: FONT,
          fontSize: '10px',
          color: '#ffffff',
          align: 'center',
          lineSpacing: 4,
        })
        .setOrigin(0.5, 0),
      1,
    );
    const prompt = fix(
      this.add
        .text(GAME_WIDTH / 2, 215, 'TAP OR PRESS ENTER', {
          fontFamily: FONT,
          fontSize: '8px',
          color: '#ffc857',
        })
        .setOrigin(0.5),
      1,
    );
    this.tweens.add({ targets: prompt, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });

    // Small delay so a button mash during the final blow doesn't skip the screen
    this.time.delayedCall(700, () => {
      const toMenu = (): void => {
        this.scene.start(SCENE_KEYS.Menu);
      };
      this.input.keyboard?.once('keydown-ENTER', toMenu);
      this.input.once('pointerdown', toMenu);
    });
  }

  // ---------- feedback ----------

  private banner(text: string): void {
    const t = this.add
      .text(GAME_WIDTH / 2, 80, text, {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#ffc857',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(10500)
      .setAlpha(0);
    this.tweens.add({
      targets: t,
      alpha: 1,
      duration: 250,
      hold: 1100,
      yoyo: true,
      onComplete: () => t.destroy(),
    });
  }

  private handleHits(events: HitEvent[]): void {
    if (events.length === 0) return;

    let pauseFrames = 0;
    for (const e of events) {
      const m = e.move;
      const d = e.defender;
      const px = d.x;
      const py = d.groundY - d.z - 22;
      const playerHurt = d.team === 'player';

      this.spawnSpark(px, py, !!m.knockdown);
      if (d.team !== 'neutral') {
        this.floatText(px, py - 10, String(m.damage), playerHurt ? '#ff6677' : '#ffc857');
      }
      pauseFrames = Math.max(pauseFrames, m.hitPause);
      if (m.shake) this.cameras.main.shake(90, m.shake);
      else if (playerHurt) this.cameras.main.shake(70, 0.002);
    }

    this.hitPauseMs = pauseFrames * FRAME_MS;
    this.pauseTargets = events.map((e) => e.defender);
  }

  private spawnSpark(x: number, y: number, heavy: boolean): void {
    const star = this.add
      .star(x, y, 6, 2, heavy ? 11 : 7, heavy ? COLORS.neonPink : 0xffffff)
      .setDepth(9500);
    this.tweens.add({
      targets: star,
      scale: 1.8,
      alpha: 0,
      angle: 45,
      duration: 180,
      onComplete: () => star.destroy(),
    });
  }

  private floatText(x: number, y: number, text: string, color: string): void {
    const t = this.add
      .text(x, y, text, {
        fontFamily: FONT,
        fontSize: '8px',
        color,
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(9500);
    this.tweens.add({
      targets: t,
      y: y - 16,
      alpha: 0,
      duration: 750,
      onComplete: () => t.destroy(),
    });
  }

  // ---------- helpers ----------

  /** Scene events outlive a restart, so every listener is removed again on shutdown. */
  private listen<A extends unknown[]>(event: string, fn: (...args: A) => void): void {
    this.events.on(event, fn);
    this.events.once('shutdown', () => this.events.off(event, fn));
  }

  private updateDebugText(): void {
    const p = this.player;
    const s = this.stage;
    const e = this.enemies;
    const b = this.bosses.boss;
    const lines = [
      `player:${p.state} hp:${p.health} weapon:${p.weapon ? `${p.weapon.id} x${p.weapon.uses}` : '-'} fps:${this.game.loop.actualFps.toFixed(0)}`,
      `stage:${s.phase} wave:${Math.min(s.waveIndex + 1, s.waveCount)}/${s.waveCount} left:${s.remaining}`,
      `enemies:${e.aliveCount} attackers:${e.attackerCount}/${e.maxAttackers} items:${this.items.itemCount} props:${this.props.count}`,
    ];
    if (b) lines.push(`boss:${b.bossState} phase:${b.phase} hp:${b.health}/${b.maxHealth}`);
    if (this.debugDraw.enabled) {
      for (const en of e.enemies) {
        lines.push(
          `#${en.uid} ${en.aiState}${en.role === 'attacker' ? ' [ATK]' : ''} cd:${en.cooldownFrames}`,
        );
      }
    }
    this.debugText.setText(lines);
  }

  /** The street floor: playfield layer, scrolls 1:1 with the camera. */
  private drawStreet(length: number): void {
    const g = this.add.graphics().setDepth(-100);
    const h = GAME_HEIGHT - STREET_TOP;

    g.fillStyle(0x2a2340).fillRect(0, STREET_TOP, length, h);
    g.fillStyle(0x3a3158).fillRect(0, STREET_TOP, length, 3);
    g.fillStyle(0x221b38).fillRect(0, STREET_TOP + 3, length, 12);

    g.fillStyle(0x4a4070);
    for (let x = 0; x < length; x += 80) g.fillRect(x, 210, 40, 2);

    g.fillStyle(0x1c162e);
    for (let x = 120; x < length; x += 260) g.fillRect(x, 232, 14, 5);
  }
}