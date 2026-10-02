import Phaser from 'phaser';

const DEPTH = 8000; // above fighters (depth = lane y), below the HUD
const SHOW_FRAMES = 180; // stays visible this long after the last hit
const TRAIL_DELAY = 24; // frames before the yellow "damage trail" starts draining
const BAR_H = 5;

/** Small bar above an enemy. Appears when hurt, shows a yellow trail of recent damage. */
export class EnemyHealthBar {
  private readonly back: Phaser.GameObjects.Rectangle;
  private readonly trail: Phaser.GameObjects.Rectangle;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly inner: number;
  private lastHp: number;
  private trailHp: number;
  private trailDelay = 0;
  private visibleFor = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly maxHp: number,
    private readonly width = 24,
  ) {
    this.inner = width - 2;
    this.lastHp = maxHp;
    this.trailHp = maxHp;
    this.back = scene.add.rectangle(0, 0, width, BAR_H, 0x000000).setOrigin(0).setDepth(DEPTH);
    this.trail = scene.add
      .rectangle(0, 0, this.inner, BAR_H - 2, 0xffc857)
      .setOrigin(0)
      .setDepth(DEPTH + 1);
    this.fill = scene.add
      .rectangle(0, 0, this.inner, BAR_H - 2, 0xe5233d)
      .setOrigin(0)
      .setDepth(DEPTH + 2);
    this.setVisible(false);
  }

  /** df = frames elapsed (60 fps units). hide = force hidden (e.g. dead). */
  update(centerX: number, topY: number, hp: number, df: number, hide: boolean): void {
    if (hp < this.lastHp) {
      this.trailDelay = TRAIL_DELAY;
      this.visibleFor = SHOW_FRAMES;
    }
    this.lastHp = hp;

    if (this.trailDelay > 0) this.trailDelay -= df;
    else if (this.trailHp > hp) this.trailHp = Math.max(hp, this.trailHp - this.maxHp * 0.015 * df);
    if (this.trailHp < hp) this.trailHp = hp;

    this.visibleFor = Math.max(0, this.visibleFor - df);
    const show = !hide && this.visibleFor > 0;
    this.setVisible(show);
    if (!show) return;

    const left = Math.round(centerX - this.width / 2);
    const top = Math.round(topY);
    this.back.setPosition(left, top);
    this.trail.setPosition(left + 1, top + 1);
    this.fill.setPosition(left + 1, top + 1);
    this.trail.width = this.inner * (this.trailHp / this.maxHp);
    this.fill.width = this.inner * (hp / this.maxHp);
  }

  destroy(): void {
    this.back.destroy();
    this.trail.destroy();
    this.fill.destroy();
  }

  private setVisible(v: boolean): void {
    this.back.setVisible(v);
    this.trail.setVisible(v);
    this.fill.setVisible(v);
  }
}