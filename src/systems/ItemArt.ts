import Phaser from 'phaser';

type Gfx = Phaser.GameObjects.Graphics;

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Gfx) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

export function createItemTextures(scene: Phaser.Scene): void {
  // ---- Coin ----
  make(scene, 'item-coin', 8, 8, (g) => {
    g.fillStyle(0xb8860b).fillRect(2, 0, 4, 8).fillRect(0, 2, 8, 4);
    g.fillStyle(0xffc857).fillRect(3, 1, 2, 6).fillRect(1, 3, 6, 2).fillRect(2, 2, 4, 4);
    g.fillStyle(0xfff0b0).fillRect(2, 2, 1, 2);
  });

  // ---- Food (16x16) ----
  make(scene, 'food-biryani', 16, 16, (g) => {
    g.fillStyle(0xdfe3f0).fillRect(1, 11, 14, 3); // plate
    g.fillStyle(0x9aa0c4).fillRect(2, 13, 12, 1);
    g.fillStyle(0xf3c44a).fillRect(3, 6, 10, 5).fillRect(5, 4, 6, 2); // rice heap
    g.fillStyle(0xe2a62c).fillRect(4, 8, 2, 1).fillRect(9, 7, 2, 1).fillRect(7, 9, 2, 1);
    g.fillStyle(0x7a3b1d).fillRect(10, 5, 3, 3); // meat
    g.fillStyle(0x3ddc5f).fillRect(5, 3, 1, 1).fillRect(8, 2, 1, 1); // mint
  });

  make(scene, 'food-singara', 16, 16, (g) => {
    g.fillStyle(0xa8741f).fillTriangle(8, 1, 0, 14, 15, 14);
    g.fillStyle(0xe0a840).fillTriangle(8, 4, 3, 13, 13, 13);
    g.fillStyle(0xf6d27a).fillRect(7, 8, 1, 1).fillRect(6, 11, 1, 1).fillRect(10, 11, 1, 1);
  });

  make(scene, 'food-jilapi', 16, 16, (g) => {
    g.lineStyle(3, 0xe56a10).strokeCircle(8, 8, 5);
    g.lineStyle(2, 0xff9a2e).strokeCircle(8, 8, 5);
    g.lineStyle(2, 0xff9a2e).strokeCircle(8, 8, 2);
    g.fillStyle(0xffd27a).fillRect(5, 4, 2, 1);
  });

  make(scene, 'food-cha', 16, 16, (g) => {
    g.fillStyle(0xdfe3f0).fillRect(2, 13, 12, 2); // saucer
    g.fillStyle(0xf2f2ee).fillRect(3, 7, 9, 6); // cup
    g.fillRect(12, 8, 2, 1).fillRect(13, 9, 1, 2).fillRect(12, 11, 2, 1); // handle
    g.fillStyle(0xb8692b).fillRect(4, 7, 7, 2); // tea
    g.fillStyle(0xc2183a).fillRect(3, 10, 9, 1); // painted band
    g.fillStyle(0xffffff, 0.7).fillRect(5, 3, 1, 3).fillRect(8, 2, 1, 4); // steam
  });

  make(scene, 'food-roohafza', 16, 16, (g) => {
    g.fillStyle(0xffc857).fillRect(6, 0, 4, 2); // cap
    g.fillStyle(0xf0c0cc).fillRect(6, 2, 4, 2); // neck
    g.fillStyle(0xc2183a).fillRect(4, 4, 8, 11); // syrup bottle
    g.fillStyle(0xff6f88).fillRect(5, 5, 1, 8); // highlight
    g.fillStyle(0xf2e9c9).fillRect(5, 8, 6, 4); // label
    g.fillStyle(0xe5233d).fillRect(7, 9, 2, 2); // rose
  });

  // ---- Weapons (grip on the left, pointing right) ----
  make(scene, 'weapon-lathi', 28, 3, (g) => {
    g.fillStyle(0xc9a54a).fillRect(0, 0, 28, 3);
    g.fillStyle(0xe8cf7a).fillRect(0, 0, 28, 1);
    g.fillStyle(0x8a6d1f).fillRect(10, 0, 1, 3).fillRect(17, 0, 1, 3).fillRect(24, 0, 1, 3);
    g.fillStyle(0xc2183a).fillRect(1, 0, 5, 3); // cloth grip wrap
  });

  make(scene, 'weapon-brick', 10, 5, (g) => {
    g.fillStyle(0xb5432b).fillRect(0, 0, 10, 5);
    g.fillStyle(0xd9704f).fillRect(0, 0, 10, 1);
    g.fillStyle(0x8a2f1d).fillRect(0, 4, 10, 1).fillRect(9, 0, 1, 5);
    g.fillStyle(0x6e2214).fillRect(3, 2, 1, 1).fillRect(6, 2, 1, 1);
  });

  make(scene, 'weapon-paakha', 18, 14, (g) => {
    g.fillStyle(0x8a5a2b).fillRect(0, 6, 6, 2); // handle
    g.fillStyle(0xe5233d).fillCircle(11, 7, 7); // border
    g.fillStyle(0xf2e9c9).fillCircle(11, 7, 5); // cloth
    g.fillStyle(0xffc857).fillRect(10, 3, 2, 8).fillRect(7, 6, 8, 2); // pattern
    g.fillStyle(0x38e8ff).fillRect(9, 4, 1, 1).fillRect(13, 4, 1, 1).fillRect(9, 9, 1, 1).fillRect(13, 9, 1, 1);
  });

  // ---- Breakable props ----
  make(scene, 'prop-crate', 24, 22, (g) => {
    g.fillStyle(0xa0662f).fillRect(0, 0, 24, 22);
    g.fillStyle(0x6e4219).fillRect(0, 0, 24, 2).fillRect(0, 20, 24, 2).fillRect(0, 0, 2, 22).fillRect(22, 0, 2, 22);
    g.fillStyle(0x7a4c22).fillRect(2, 10, 20, 2);
    for (let i = 0; i < 18; i++) g.fillRect(3 + i, 3 + i, 2, 2); // diagonal brace
    g.fillStyle(0xc88a4a).fillRect(2, 2, 20, 1);
  });

  make(scene, 'prop-stool', 16, 16, (g) => {
    g.fillStyle(0x8a6d1f).fillRect(2, 4, 3, 12).fillRect(11, 4, 3, 12).fillRect(4, 10, 8, 2);
    g.fillStyle(0xc9a54a).fillRect(0, 0, 16, 4); // seat
    g.fillStyle(0xe8cf7a).fillRect(0, 0, 16, 1);
    g.fillStyle(0x6e5518).fillRect(0, 3, 16, 1);
  });

  make(scene, 'prop-basket', 22, 18, (g) => {
    g.fillStyle(0xe5233d).fillRect(3, 2, 5, 5).fillRect(9, 1, 5, 5); // tomatoes
    g.fillStyle(0x3ddc5f).fillRect(15, 2, 5, 5); // greens
    g.fillStyle(0xff8a1e).fillRect(6, 0, 5, 4); // orange
    g.fillStyle(0xc9a54a).fillRect(1, 6, 20, 12); // woven body
    g.fillStyle(0x8a6d1f).fillRect(0, 5, 22, 2).fillRect(1, 9, 20, 1).fillRect(1, 12, 20, 1).fillRect(1, 15, 20, 1);
    g.fillStyle(0xe8cf7a).fillRect(3, 10, 2, 1).fillRect(9, 13, 2, 1).fillRect(15, 10, 2, 1);
  });

  make(scene, 'prop-pot', 18, 20, (g) => {
    g.fillStyle(0xb5532a).fillEllipse(9, 13, 17, 14); // body
    g.fillStyle(0x8a3a1b).fillRect(4, 0, 10, 3); // rim
    g.fillStyle(0xb5532a).fillRect(5, 3, 8, 4); // neck
    g.fillStyle(0xd37a4a).fillRect(4, 9, 2, 5); // highlight
    g.fillStyle(0x8a3a1b).fillRect(3, 12, 12, 1);
    g.fillStyle(0xf2e9c9).fillRect(6, 15, 6, 1); // painted line
  });
}