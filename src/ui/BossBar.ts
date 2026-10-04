import Phaser from 'phaser';
import { FONT, GAME_WIDTH } from '../config/constants';

const W = 200;
const H = 8;
const X = (GAME_WIDTH - W) / 2;
const Y = 35; // sits under the padlock icon, clear of the player HUD
const INNER = W - 4;

/** Large boss health bar at the top centre: fills on intro, yellow damage trail, 50% marker. */
export class BossBar {
  private readonly box: Phaser.GameObjects.Container;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly trail: Phaser.GameObjects.Rectangle;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private shownHp = 0;
  private trailHp = 0;
  private trailDelay = 0;
  private flash = 0;
  private filling = false;

  constructor(scene: Phaser.Scene) {
    const frame = scene.add
      .rectangle(X, Y, W, H, 0x12060a)
      .setOrigin(0)
      .setStrokeStyle(1, 0xffffff);
    this.trail = scene.add.rectangle(X + 2, Y + 2, INNER, H - 4, 0xffc857).setOrigin(0);
    this.fill = scene.add.rectangle(X + 2, Y + 2, INNER, H - 4, 0xe5233d).setOrigin(0);
    const marker = scene.add.rectangle(X + 2 + INNER / 2, Y, 1, H, 0xffffff, 0.8).setOrigin(0.5, 0);
    this.nameText = scene.add
      .text(GAME_WIDTH / 2, Y - 2, '', {
        fontFamily: FONT,
        fontSize: '8px',
        color: '#ffc857',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5, 1);

    this.box = scene.add
      .container(0, 0, [frame, this.trail, this.fill, marker, this.nameText])
      .setScrollFactor(0)
      .setDepth(9100)
      .setVisible(false);
  }

  show(name: string): void {
    this.nameText.setText(name);
    this.shownHp = 0;
    this.trailHp = 0;
    this.trailDelay = 0;
    this.flash = 0;
    this.filling = true;
    this.fill.width = 0;
    this.trail.width = 0;
    this.box.setVisible(true);
  }

  hide(): void {
    this.box.setVisible(false);
  }

  /** df = frames elapsed (60 fps units). */
  update(df: number, hp: number, maxHp: number, phase: number): void {
    if (!this.box.visible) return;

    if (this.filling) {
      this.shownHp = Math.min(hp, this.shownHp + maxHp * 0.025 * df);
      this.trailHp = this.shownHp;
      if (this.shownHp >= hp) this.filling = false;
    } else {
      if (hp < this.shownHp) {
        this.trailDelay = 24;
        this.flash = 4;
      }
      this.shownHp = hp;
      if (this.trailDelay > 0) this.trailDelay -= df;
      else if (this.trailHp > hp) this.trailHp = Math.max(hp, this.trailHp - maxHp * 0.012 * df);
      if (this.trailHp < hp) this.trailHp = hp;
    }

    this.flash = Math.max(0, this.flash - df);
    this.fill.width = INNER * (this.shownHp / maxHp);
    this.trail.width = INNER * (this.trailHp / maxHp);
    this.fill.setFillStyle(this.flash > 0 ? 0xffffff : phase >= 2 ? 0xff4f8b : 0xe5233d);
  }
}