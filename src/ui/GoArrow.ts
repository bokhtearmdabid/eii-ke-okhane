import Phaser from 'phaser';
import { FONT, GAME_WIDTH } from '../config/constants';

const BASE_X = GAME_WIDTH - 46;

/** Blinking "GO ->" on the right side of the screen. */
export class GoArrow {
  private readonly box: Phaser.GameObjects.Container;

  constructor(private readonly scene: Phaser.Scene) {
    const label = scene.add
      .text(0, 0, 'GO', {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#ffc857',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    const arrow = scene.add
      .triangle(24, 0, 0, -8, 0, 8, 14, 0, 0xffc857)
      .setStrokeStyle(2, 0x000000);

    this.box = scene.add
      .container(BASE_X, 118, [label, arrow])
      .setScrollFactor(0)
      .setDepth(9500)
      .setVisible(false);
  }

  get visible(): boolean {
    return this.box.visible;
  }

  show(): void {
    if (this.box.visible) return;
    this.scene.tweens.killTweensOf(this.box);
    this.box.setVisible(true).setAlpha(1).setX(BASE_X);
    this.scene.tweens.add({
      targets: this.box,
      alpha: 0.15,
      x: BASE_X + 6,
      duration: 380,
      yoyo: true,
      repeat: -1,
    });
  }

  hide(): void {
    this.scene.tweens.killTweensOf(this.box);
    this.box.setVisible(false).setX(BASE_X);
  }
}