import Phaser from 'phaser';
import { GAME_WIDTH, STREET_TOP } from '../config/constants';
import type { BackgroundDef } from './StageDefs';

/**
 * Image-based stage background. Parallax layers are tiled copies of a seamless strip, placed
 * across the whole distance each layer travels and scrolled by Phaser's own scrollFactor
 * (no per-frame code, no lag). The floor strip tiles 1:1 along the stage.
 * If any needed texture is missing, hasLayers / hasFloor are false and GameScene keeps
 * using the procedural placeholder for that part.
 */
export class Backdrop {
  readonly hasLayers: boolean;
  readonly hasFloor: boolean;

  constructor(scene: Phaser.Scene, def: BackgroundDef | undefined, length: number) {
    const tex = scene.textures;
    const layers = def?.layers ?? [];
    const floorKey = def?.floor;

    this.hasLayers = layers.length > 0 && layers.every((l) => tex.exists(l.key));
    this.hasFloor = !!floorKey && tex.exists(floorKey);

    if (this.hasLayers) {
      layers.forEach((l, i) => {
        const frame = tex.getFrame(l.key);
        // How far this layer's visible window travels over the whole stage
        const reach = Math.ceil(GAME_WIDTH + (length - GAME_WIDTH) * l.factor);
        for (let x = 0; x < reach; x += frame.width) {
          scene.add
            .image(x, STREET_TOP - frame.height, l.key)
            .setOrigin(0)
            .setScrollFactor(l.factor, 0)
            .setDepth(-900 + i * 100);
        }
      });
    }

    if (floorKey && this.hasFloor) {
      const frame = tex.getFrame(floorKey);
      for (let x = 0; x < length; x += frame.width) {
        scene.add.image(x, STREET_TOP, floorKey).setOrigin(0).setDepth(-100);
      }
    }
  }
}