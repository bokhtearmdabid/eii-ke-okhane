import Phaser from 'phaser';
import { FONT, GAME_WIDTH, LANE_BOTTOM } from '../config/constants';

const GATE_H = 96;
const GATE_BASE_Y = LANE_BOTTOM + 8;

function ensureTextures(scene: Phaser.Scene): void {
  const make = (
    key: string,
    w: number,
    h: number,
    draw: (g: Phaser.GameObjects.Graphics) => void,
  ): void => {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };

  make('lock-closed', 12, 16, (g) => {
    g.fillStyle(0xcfd3e6).fillRect(3, 0, 6, 2).fillRect(3, 0, 2, 8).fillRect(7, 0, 2, 8);
    g.fillStyle(0xe5233d).fillRect(1, 7, 10, 9);
    g.fillStyle(0x1a0a10).fillRect(5, 10, 2, 3);
  });

  make('lock-open', 12, 16, (g) => {
    g.fillStyle(0xcfd3e6).fillRect(3, 0, 6, 2).fillRect(3, 0, 2, 8).fillRect(7, 0, 2, 3);
    g.fillStyle(0x3ddc5f).fillRect(1, 7, 10, 9);
    g.fillStyle(0x0a2a14).fillRect(5, 10, 2, 3);
  });

  make('gate', 12, GATE_H, (g) => {
    g.fillStyle(0x4a4e6e).fillRect(0, 0, 12, 4).fillRect(0, GATE_H - 4, 12, 4);
    g.fillStyle(0x9aa0c4);
    for (const x of [1, 5, 9]) g.fillRect(x, 4, 2, GATE_H - 8);
    g.fillStyle(0xe5233d).fillRect(4, 1, 4, 2); // warning lamp
  });
}

export class GateLock {
  private readonly icon: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private gate: Phaser.GameObjects.Image | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    ensureTextures(scene);
    this.icon = scene.add
      .image(GAME_WIDTH / 2 - 16, 6, 'lock-closed')
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(9000)
      .setVisible(false);
    this.label = scene.add
      .text(GAME_WIDTH / 2, 8, '', { fontFamily: FONT, fontSize: '10px', color: '#ff6677' })
      .setScrollFactor(0)
      .setDepth(9000)
      .setVisible(false);
  }

  lock(lockX: number): void {
    this.scene.tweens.killTweensOf([this.icon, this.label]);
    this.icon.setTexture('lock-closed').setAlpha(1).setVisible(true);
    this.label.setColor('#ff6677').setAlpha(1).setVisible(true);

    this.gate?.destroy();
    const gate = this.scene.add
      .image(lockX + GAME_WIDTH - 5, GATE_BASE_Y - 60, 'gate')
      .setOrigin(0.5, 1)
      .setDepth(-50)
      .setAlpha(0);
    this.gate = gate;
    this.scene.tweens.add({
      targets: gate,
      y: GATE_BASE_Y,
      alpha: 1,
      duration: 350,
      ease: 'Bounce.Out',
    });
  }

  setRemaining(n: number): void {
    this.label.setText(`x${n}`);
  }

  unlock(): void {
    this.icon.setTexture('lock-open');
    this.label.setText('OPEN').setColor('#3ddc5f');
    this.scene.tweens.add({
      targets: [this.icon, this.label],
      alpha: 0,
      delay: 1200,
      duration: 400,
    });

    const gate = this.gate;
    this.gate = null;
    if (gate) {
      this.scene.tweens.add({
        targets: gate,
        y: gate.y - 70,
        alpha: 0,
        duration: 450,
        ease: 'Quad.In',
        onComplete: () => gate.destroy(),
      });
    }
  }
}