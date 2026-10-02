import Phaser from 'phaser';
import { COLORS, FONT, GAME_WIDTH } from '../config/constants';
import type { Player } from '../entities/Player';
import type { RunState } from '../systems/RunState';
import { getWeapon } from '../systems/ItemDefs';

const HP_W = 80;
const EN_W = 60;
const DEPTH = 9000;

type HudObject = Phaser.GameObjects.GameObject &
  Phaser.GameObjects.Components.ScrollFactor &
  Phaser.GameObjects.Components.Depth;

/** Pin an object to the screen (ignores camera scroll) and set its HUD depth. */
function pin<T extends HudObject>(o: T, d = 0): T {
  o.setScrollFactor(0);
  o.setDepth(DEPTH + d);
  return o;
}

/**
 * Top-left: portrait, name, red health bar, green energy bar, lives, coins.
 * Top-right: score.
 */
export class Hud {
  private readonly hp: Phaser.GameObjects.Rectangle;
  private readonly en: Phaser.GameObjects.Rectangle;
  private readonly livesText: Phaser.GameObjects.Text;
  private readonly coinText: Phaser.GameObjects.Text;
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly weaponIcon: Phaser.GameObjects.Image;
  private readonly weaponText: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    private readonly player: Player,
    private readonly run: RunState,
    name: string,
  ) {
    const label = { fontFamily: FONT, fontSize: '8px', color: '#ffffff' };

    // Portrait: head and shoulders cut out of the placeholder sprite (swap for real art later)
    const tex = scene.textures.get('player-idle');
    if (!tex.has('portrait')) tex.add('portrait', 0, 8, 0, 24, 24);
    pin(scene.add.rectangle(4, 4, 28, 28, 0x1d1240).setOrigin(0).setStrokeStyle(1, COLORS.neonCyan));
    pin(scene.add.image(6, 6, 'player-idle', 'portrait').setOrigin(0), 1);

    pin(scene.add.text(38, 3, name.toUpperCase(), label), 1);

    pin(scene.add.rectangle(38, 13, HP_W + 2, 8, 0x2a0a14).setOrigin(0).setStrokeStyle(1, 0xffffff));
    this.hp = pin(scene.add.rectangle(39, 14, HP_W, 6, 0xe5233d).setOrigin(0), 1);

    pin(scene.add.rectangle(38, 23, EN_W + 2, 6, 0x0a2a14).setOrigin(0).setStrokeStyle(1, 0xffffff));
    this.en = pin(scene.add.rectangle(39, 24, EN_W, 4, 0x3ddc5f).setOrigin(0), 1);

    this.livesText = pin(scene.add.text(4, 35, '', label), 1);
    pin(scene.add.circle(47, 39, 3, 0xffc857).setStrokeStyle(1, 0xb8860b), 1);
    this.coinText = pin(scene.add.text(53, 35, '', label), 1);
    this.weaponIcon = pin(scene.add.image(100, 40, 'weapon-lathi').setVisible(false), 1);
    this.weaponText = pin(scene.add.text(114, 35, '', label), 1);

    this.scoreText = pin(
      scene.add.text(GAME_WIDTH - 4, 4, '', { ...label, color: '#ffc857' }).setOrigin(1, 0),
      1,
    );
  }

  update(): void {
    const p = this.player;
    this.hp.width = HP_W * Phaser.Math.Clamp(p.health / p.maxHealth, 0, 1);
    this.en.width = EN_W * Phaser.Math.Clamp(p.energy / p.maxEnergy, 0, 1);
    // Flash the energy bar when a special is attempted without enough energy
    this.en.setFillStyle(
      p.energyDenied > 0 && Math.floor(p.energyDenied / 4) % 2 === 0 ? 0xff4f4f : 0x3ddc5f,
    );

    this.sync(this.livesText, `LIVES ${Math.max(0, this.run.lives)}`);
    this.sync(this.coinText, `x${this.run.coins}`);
    this.sync(this.scoreText, `SCORE ${String(this.run.score).padStart(6, '0')}`);

    const w = p.weapon;
    if (w) {
      const def = getWeapon(w.id);
      if (this.weaponIcon.texture.key !== def.texture) this.weaponIcon.setTexture(def.texture);
      const s = Math.min(1, 18 / Math.max(this.weaponIcon.width, this.weaponIcon.height));
      this.weaponIcon.setScale(s).setVisible(true);
      this.sync(this.weaponText, `x${w.uses}`);
    } else {
      this.weaponIcon.setVisible(false);
      this.sync(this.weaponText, '');
    }
  }

  private sync(t: Phaser.GameObjects.Text, value: string): void {
    if (t.text !== value) t.setText(value);
  }
  
}