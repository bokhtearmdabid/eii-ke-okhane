import Phaser from 'phaser';

/** Generates colored-rectangle placeholder textures. Replaced by real pixel art later. */
export function createPlaceholderTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('player')) return;

  // 24x40 fighter: white panjabi, dark pyjama, skin tone, white tupi cap
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xf2f2ee).fillRect(6, 14, 12, 18); // panjabi
  g.fillStyle(0x3b3b5c).fillRect(7, 32, 4, 8).fillRect(13, 32, 4, 8); // pyjama legs
  g.fillStyle(0xc68a5b).fillRect(3, 16, 3, 10).fillRect(18, 16, 3, 10); // arms
  g.fillStyle(0xc68a5b).fillRect(8, 4, 8, 10); // head
  g.fillStyle(0xffffff).fillRect(7, 2, 10, 3); // tupi
  g.fillStyle(0x111111).fillRect(13, 8, 2, 2); // eye: shows facing direction
  g.generateTexture('player', 24, 40);
  g.destroy();
}