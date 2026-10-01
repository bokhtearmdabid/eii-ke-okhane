import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/constants';

/**
 * First scene. Keep it tiny: set global options and load anything the
 * PreloadScene needs to draw its loading bar, then hand over.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.Boot);
  }

  create(): void {
    this.input.setTopOnly(true);
    this.scene.start(SCENE_KEYS.Preload);
  }
}