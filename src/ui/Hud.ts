import Phaser from 'phaser';
import { COLORS, FONT } from '../config/constants';
import type { Player } from '../entities/Player';

const HP_W = 80;
const EN_W = 60;
const DEPTH = 9000;

/** Top-left HUD: portrait, red health bar, green energy bar. A coin counter comes later. */
export class Hud {
  private readonly hp: Phaser.GameObjects.Rectangle;
  private readonly en: Phaser.GameObjects.Rectangle;

  constructor(
    scene: Phaser.Scene,
    private readonly player: Player,
    name: string,
  ) {
    const fix = <T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(
      o: T,
      d = 0,
    ): T => {
      o.setScrollFactor(0);
      o.setDepth(DEPTH + d);
      return o;
    };

    fix(scene.add.rectangle(4, 4, 28, 28, 0x1d1240).setOrigin(0).setStrokeStyle(1, COLORS.neonCyan));
    fix(
      scene.add
        .text(18, 18, name.charAt(0), { fontFamily: FONT, fontSize: '14px', color: '#ffc857' })
        .setOrigin(0.5),
      1,
    );
    fix(
      scene.add.text(38, 3, name.toUpperCase(), { fontFamily: FONT, fontSize: '8px', color: '#ffffff' }),
      1,
    );

    fix(scene.add.rectangle(38, 13, HP_W + 2, 8, 0x2a0a14).setOrigin(0).setStrokeStyle(1, 0xffffff));
    this.hp = fix(scene.add.rectangle(39, 14, HP_W, 6, 0xe5233d).setOrigin(0), 1);

    fix(scene.add.rectangle(38, 23, EN_W + 2, 6, 0x0a2a14).setOrigin(0).setStrokeStyle(1, 0xffffff));
    this.en = fix(scene.add.rectangle(39, 24, EN_W, 4, 0x3ddc5f).setOrigin(0), 1);
  }

  update(): void {
    const p = this.player;
    this.hp.width = HP_W * Phaser.Math.Clamp(p.health / p.maxHealth, 0, 1);
    this.en.width = EN_W * Phaser.Math.Clamp(p.energy / p.maxEnergy, 0, 1);
    // Flash the energy bar when a special is attempted without enough energy
    this.en.setFillStyle(p.energyDenied > 0 && Math.floor(p.energyDenied / 4) % 2 === 0 ? 0xff4f4f : 0x3ddc5f);
  }
}