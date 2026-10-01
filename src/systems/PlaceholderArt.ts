import Phaser from 'phaser';

type Gfx = Phaser.GameObjects.Graphics;

const SKIN = 0xc68a5b;
const PANJABI = 0xf2f2ee;
const PYJAMA = 0x3b3b5c;
const STICK = 0x8a5a2b;
const GHOST = 0xa9d6e5;

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Gfx) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

interface Parts {
  armR?: boolean;
  armL?: boolean;
  legR?: boolean;
  legTuck?: boolean;
  armsUp?: boolean;
  eyeX?: boolean;
}

/** Fighter body in a 40x40 frame, facing right, feet at the bottom. */
function drawFighter(g: Gfx, p: Parts = {}): void {
  const { armR = true, armL = true, legR = true } = p;
  g.fillStyle(PYJAMA).fillRect(15, 32, 4, p.legTuck ? 5 : 8); // left leg
  if (legR) g.fillStyle(PYJAMA).fillRect(21, 32, 4, 8); // right leg
  g.fillStyle(PANJABI).fillRect(14, 14, 12, 18); // panjabi
  const armY = p.armsUp ? 8 : 16;
  g.fillStyle(SKIN);
  if (armL) g.fillRect(11, armY, 3, 10);
  if (armR) g.fillRect(26, armY, 3, 10);
  g.fillStyle(SKIN).fillRect(16, 4, 8, 10); // head
  g.fillStyle(0xffffff).fillRect(15, 2, 10, 3); // tupi
  g.fillStyle(0x111111);
  if (p.eyeX) g.fillRect(21, 7, 3, 1).fillRect(22, 9, 1, 1);
  else g.fillRect(21, 8, 2, 2); // eye shows facing
}

/** Generates all placeholder textures. Replaced by real pixel art later. */
export function createPlaceholderTextures(scene: Phaser.Scene): void {
  // ---- Player poses (40x40) ----
  make(scene, 'player-idle', 40, 40, (g) => drawFighter(g));

  make(scene, 'player-punch', 40, 40, (g) => {
    drawFighter(g, { armR: false });
    g.fillStyle(SKIN).fillRect(26, 17, 11, 3).fillRect(36, 16, 4, 5);
  });

  make(scene, 'player-kick', 40, 40, (g) => {
    drawFighter(g, { legR: false });
    g.fillStyle(PYJAMA).fillRect(25, 29, 11, 4);
    g.fillStyle(0x111111).fillRect(35, 28, 5, 6);
  });

  make(scene, 'player-jumpKick', 40, 40, (g) => {
    drawFighter(g, { legR: false, legTuck: true });
    g.fillStyle(PYJAMA).fillRect(25, 27, 11, 4);
    g.fillStyle(0x111111).fillRect(35, 26, 5, 6);
  });

  make(scene, 'player-spin', 40, 40, (g) => {
    drawFighter(g, { armR: false, armL: false });
    g.fillStyle(STICK).fillRect(0, 18, 40, 3); // lathi across the body
    g.fillStyle(SKIN).fillRect(10, 18, 4, 3).fillRect(26, 18, 4, 3); // hands
  });

  make(scene, 'player-hurt', 40, 40, (g) => drawFighter(g, { armsUp: true, eyeX: true }));

  make(scene, 'player-down', 40, 16, (g) => {
    g.fillStyle(PYJAMA).fillRect(24, 5, 14, 3).fillRect(24, 10, 14, 3);
    g.fillStyle(PANJABI).fillRect(10, 4, 14, 10);
    g.fillStyle(SKIN).fillRect(2, 5, 8, 9);
    g.fillStyle(0xffffff).fillRect(2, 4, 8, 2);
  });

  // ---- Training dummy: a pale ghost placeholder ----
  make(scene, 'dummy-idle', 40, 40, (g) => {
    g.fillStyle(GHOST).fillRect(12, 8, 16, 26); // body
    g.fillStyle(0xc9e8f2).fillRect(13, 2, 14, 12); // head
    g.fillStyle(GHOST).fillRect(8, 16, 4, 8).fillRect(28, 16, 4, 8); // arms
    g.fillRect(12, 34, 4, 6).fillRect(18, 36, 4, 4).fillRect(24, 34, 4, 6); // ragged hem
    g.fillStyle(0x111111).fillRect(16, 7, 2, 3).fillRect(22, 7, 2, 3).fillRect(18, 11, 4, 2);
  });

  make(scene, 'dummy-down', 40, 16, (g) => {
    g.fillStyle(GHOST).fillRect(4, 4, 32, 10);
    g.fillStyle(0xc9e8f2).fillRect(2, 3, 10, 11);
    g.fillStyle(0x111111).fillRect(5, 6, 2, 3);
  });
}