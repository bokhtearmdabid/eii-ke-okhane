import Phaser from 'phaser';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../config/constants';
import { createPlaceholderTextures } from '../systems/PlaceholderArt';
import { createItemTextures } from '../systems/ItemArt';

/**
 * Loads all assets while showing a progress bar.
 * Nothing to load yet; real sprites, audio and JSON will be queued in preload() later.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.Preload);
  }

  preload(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const barW = 200;

    this.add.text(cx, cy - 20, 'LOADING', { fontFamily: FONT, fontSize: '10px', color: '#38e8ff' }).setOrigin(0.5);
    this.add.rectangle(cx, cy, barW + 4, 10, 0x1d1240).setStrokeStyle(1, COLORS.neonCyan);
    const fill = this.add.rectangle(cx - barW / 2, cy, 0, 6, COLORS.neonPink).setOrigin(0, 0.5);

    this.load.on('progress', (p: number) => {
      fill.width = barW * p;
    });

    // Future: this.load.setPath('assets/'); this.load.image(...); this.load.json(...);
  }

    create(): void {
    createPlaceholderTextures(this);
    createItemTextures(this);
    this.scene.start(SCENE_KEYS.Menu);
  }
}