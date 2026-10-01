import Phaser from 'phaser';
import {
  COLORS,
  FONT,
  FRAME_MS,
  GAME_HEIGHT,
  LANE_BOTTOM,
  LANE_TOP,
  SCENE_KEYS,
  STREET_TOP,
  WORLD_WIDTH,
} from '../config/constants';
import dummyData from '../data/dummy.json';
import playerData from '../data/player.json';
import { Dummy } from '../entities/Dummy';
import type { Fighter } from '../entities/Fighter';
import { Player } from '../entities/Player';
import { CombatSystem, type HitEvent } from '../systems/CombatSystem';
import { DebugDraw } from '../systems/DebugDraw';
import { InputSystem } from '../systems/InputSystem';
import { ParallaxBackground } from '../systems/ParallaxBackground';
import { Hud } from '../ui/Hud';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private dummies: Dummy[] = [];
  private combat!: CombatSystem;
  private inputSystem!: InputSystem;
  private hud!: Hud;
  private debugDraw!: DebugDraw;
  private debugText!: Phaser.GameObjects.Text;

  private hitPauseMs = 0;
  private pauseTargets: Fighter[] = [];

  constructor() {
    super(SCENE_KEYS.Game);
  }

  create(): void {
    // Scene instances are reused on restart, so reset per-run state here
    this.hitPauseMs = 0;
    this.pauseTargets = [];
    this.dummies = [];

    new ParallaxBackground(this);
    this.drawStreet();

    this.inputSystem = new InputSystem(this);
    this.combat = new CombatSystem();

    this.player = new Player(this, 60, (LANE_TOP + LANE_BOTTOM) / 2, playerData);
    this.combat.add(this.player);

    const spots: [number, number][] = [
      [190, 200],
      [260, 180],
      [330, 225],
    ];
    for (const [x, y] of spots) {
      const d = new Dummy(this, x, y, dummyData);
      this.dummies.push(d);
      this.combat.add(d);
    }

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_WIDTH, GAME_HEIGHT);
    cam.startFollow(this.player.sprite, true, 0.12, 0.12);
    cam.setDeadzone(50, GAME_HEIGHT);
    cam.roundPixels = true;

    this.hud = new Hud(this, this.player, playerData.name);
    this.debugDraw = new DebugDraw(this);

    this.debugText = this.add
      .text(4, 36, '', { fontFamily: FONT, fontSize: '8px', color: '#9ff' })
      .setScrollFactor(0)
      .setDepth(10000);

    this.add
      .text(
        GAME_HEIGHT * 0.0 + 476,
        4,
        'Z/J punch  X/K kick  C/L special  Space jump  H hitboxes',
        { fontFamily: FONT, fontSize: '6px', color: '#8a85b0' },
      )
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(10000);

    this.input.keyboard?.on('keydown-H', () => this.debugDraw.toggle());
    this.input.keyboard?.once('keydown-ESC', () => this.scene.start(SCENE_KEYS.Menu));
  }

  update(_time: number, delta: number): void {
    const real = Math.min(delta, 50); // clamp so tab-switching doesn't teleport us
    const input = this.inputSystem.read();

    if (this.hitPauseMs > 0) {
      // HIT-PAUSE: the world is frozen. We only shake the victims and remember button presses.
      this.hitPauseMs -= real;
      this.player.bufferActions(input);
      const jitter = Math.floor(this.hitPauseMs / 33) % 2 === 0 ? 1 : -1;
      for (const f of this.pauseTargets) f.sprite.x = Math.round(f.x) + jitter;
    } else {
      const dt = real / 1000;
      this.player.update(dt, input);
      for (const d of this.dummies) d.update(dt);
      this.handleHits(this.combat.update());
    }

    this.hud.update();
    this.debugDraw.draw(this.combat.all);

    const p = this.player;
    this.debugText.setText(
      `state:${p.state} move:${p.attack?.id ?? '-'} z:${p.z.toFixed(0)} fps:${this.game.loop.actualFps.toFixed(0)}`,
    );
  }

  private handleHits(events: HitEvent[]): void {
    if (events.length === 0) return;

    let pauseFrames = 0;
    for (const e of events) {
      const m = e.move;
      const d = e.defender;
      const px = d.x;
      const py = d.groundY - d.z - 22;

      this.spawnSpark(px, py, !!m.knockdown);
      this.spawnDamage(px, py - 10, m.damage);
      pauseFrames = Math.max(pauseFrames, m.hitPause);
      if (m.shake) this.cameras.main.shake(90, m.shake);
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

  private spawnDamage(x: number, y: number, amount: number): void {
    const t = this.add
      .text(x, y, String(amount), {
        fontFamily: FONT,
        fontSize: '8px',
        color: '#ffc857',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(9500);
    this.tweens.add({
      targets: t,
      y: y - 16,
      alpha: 0,
      duration: 550,
      onComplete: () => t.destroy(),
    });
  }

  /** The street floor: playfield layer, scrolls 1:1 with the camera. */
  private drawStreet(): void {
    const g = this.add.graphics().setDepth(-100);
    const h = GAME_HEIGHT - STREET_TOP;

    g.fillStyle(0x2a2340).fillRect(0, STREET_TOP, WORLD_WIDTH, h);
    g.fillStyle(0x3a3158).fillRect(0, STREET_TOP, WORLD_WIDTH, 3);
    g.fillStyle(0x221b38).fillRect(0, STREET_TOP + 3, WORLD_WIDTH, 12);

    g.fillStyle(0x4a4070);
    for (let x = 0; x < WORLD_WIDTH; x += 80) g.fillRect(x, 210, 40, 2);

    g.fillStyle(0x1c162e);
    for (let x = 120; x < WORLD_WIDTH; x += 260) g.fillRect(x, 232, 14, 5);
  }
}