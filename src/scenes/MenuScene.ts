import Phaser from 'phaser';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, GAME_TITLE, SCENE_KEYS } from '../config/constants';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.Menu);
  }

  create(): void {
    const cx = GAME_WIDTH / 2;

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.night).setOrigin(0);

    this.add
      .text(cx, 90, GAME_TITLE.toUpperCase(), {
        fontFamily: FONT,
        fontSize: '28px',
        color: '#ff4f8b',
        stroke: '#38e8ff',
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 125, 'A Bangladeshi folklore brawler', {
        fontFamily: FONT,
        fontSize: '8px',
        color: '#ffc857',
      })
      .setOrigin(0.5);

    const prompt = this.add
      .text(cx, 200, 'TAP OR PRESS ENTER TO START', {
        fontFamily: FONT,
        fontSize: '10px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.tweens.add({ targets: prompt, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });

    const start = (): void => {
      this.scene.start(SCENE_KEYS.Game);
    };
    this.input.once('pointerdown', start);
    this.input.keyboard?.once('keydown-ENTER', start);
    this.input.keyboard?.once('keydown-SPACE', start);
  }
}