import Phaser from 'phaser';
import {
  FONT,
  GAME_HEIGHT,
  LANE_BOTTOM,
  LANE_TOP,
  SCENE_KEYS,
  STREET_TOP,
  WORLD_WIDTH,
} from '../config/constants';
import playerData from '../data/player.json';
import { Player } from '../entities/Player';
import { InputSystem } from '../systems/InputSystem';
import { ParallaxBackground } from '../systems/ParallaxBackground';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private inputSystem!: InputSystem;
  private debugText!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE_KEYS.Game);
  }

  create(): void {
    new ParallaxBackground(this);
    this.drawStreet();

    this.inputSystem = new InputSystem(this);
    this.player = new Player(this, 60, (LANE_TOP + LANE_BOTTOM) / 2, playerData);

    // Camera: horizontal follow only (bounds height == screen height, so no vertical scroll)
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_WIDTH, GAME_HEIGHT);
    cam.startFollow(this.player.sprite, true, 0.12, 0.12);
    cam.setDeadzone(50, GAME_HEIGHT);
    cam.roundPixels = true;

    this.debugText = this.add
      .text(4, 4, '', { fontFamily: FONT, fontSize: '8px', color: '#9ff' })
      .setScrollFactor(0)
      .setDepth(10000);

    // Back to menu (keyboard + top-right tap zone)
    const back = (): void => {
      this.scene.start(SCENE_KEYS.Menu);
    };
    this.input.keyboard?.once('keydown-ESC', back);
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000; // clamp so tab-switching doesn't teleport us
    this.player.update(dt, this.inputSystem.read());

    const p = this.player;
    this.debugText.setText(
      `x:${p.x.toFixed(0)} y:${p.groundY.toFixed(0)} z:${p.z.toFixed(0)}  fps:${this.game.loop.actualFps.toFixed(0)}`,
    );
  }

  /** The street floor: playfield layer, scrolls 1:1 with the camera. */
  private drawStreet(): void {
    const g = this.add.graphics().setDepth(-100);
    const h = GAME_HEIGHT - STREET_TOP;

    g.fillStyle(0x2a2340).fillRect(0, STREET_TOP, WORLD_WIDTH, h);
    g.fillStyle(0x3a3158).fillRect(0, STREET_TOP, WORLD_WIDTH, 3); // footpath edge
    g.fillStyle(0x221b38).fillRect(0, STREET_TOP + 3, WORLD_WIDTH, 12); // gutter strip

    // Painted dashes so you can feel the scroll
    g.fillStyle(0x4a4070);
    for (let x = 0; x < WORLD_WIDTH; x += 80) g.fillRect(x, 210, 40, 2);

    // Faint manhole-style marks for extra motion cues
    g.fillStyle(0x1c162e);
    for (let x = 120; x < WORLD_WIDTH; x += 260) g.fillRect(x, 232, 14, 5);
  }
}