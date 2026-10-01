import Phaser from 'phaser';
import {
  COLORS,
  FONT,
  GAME_HEIGHT,
  GAME_WIDTH,
  LANE_BOTTOM,
  LANE_TOP,
  SCENE_KEYS,
} from '../config/constants';

/** Placeholder stage: shows the lane band so we can see the playfield. Gameplay starts in Step 2. */
export class GameScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.Game);
  }

  create(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, LANE_TOP - 20, COLORS.night).setOrigin(0);
    this.add
      .rectangle(0, LANE_TOP - 20, GAME_WIDTH, GAME_HEIGHT - LANE_TOP + 20, COLORS.street)
      .setOrigin(0);

    // Lane band outline (where fighters' feet will be allowed)
    this.add
      .rectangle(0, LANE_TOP, GAME_WIDTH, LANE_BOTTOM - LANE_TOP, 0x000000, 0)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.neonCyan, 0.6);

    this.add
      .text(GAME_WIDTH / 2, 60, 'GAME SCENE (placeholder)', {
        fontFamily: FONT,
        fontSize: '12px',
        color: '#38e8ff',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 80, 'ESC or tap top-left to return to menu', {
        fontFamily: FONT,
        fontSize: '8px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const back = (): void => {
      this.scene.start(SCENE_KEYS.Menu);
    };
    this.input.keyboard?.once('keydown-ESC', back);

    // Invisible tap zone at the top-left so phones can go back too
    this.add
      .zone(0, 0, 60, 40)
      .setOrigin(0)
      .setInteractive()
      .once('pointerdown', back);
  }
}