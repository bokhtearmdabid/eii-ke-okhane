import Phaser from 'phaser';

type Gfx = Phaser.GameObjects.Graphics;

const SKIN = 0xc68a5b;
const PANJABI = 0xf2f2ee;
const PYJAMA = 0x3b3b5c;
const STICK = 0x8a5a2b;
const GHOST = 0xa9d6e5;

// ---------- Petni ----------
const PETNI_SKIN = 0xd8d2e6;
const PETNI_SAREE = 0xece8f4;
const PETNI_BORDER = 0xc2183a;
const PETNI_HAIR = 0x0b0b16;
const PETNI_EYE = 0xff3355;
const PETNI_CLAW = 0x2a2a3a;

type PetniArms = 'down' | 'up' | 'reach';
type PetniEyes = 'normal' | 'angry' | 'hurt';

interface Parts {
  armR?: boolean;
  armL?: boolean;
  legR?: boolean;
  legTuck?: boolean;
  armsUp?: boolean;
  eyeX?: boolean;
}

function make(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (g: Gfx) => void
): void {
  if (scene.textures.exists(key)) {
    return;
  }

  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

/** Fighter body in a 40x40 frame, facing right, feet at the bottom. */
function drawFighter(g: Gfx, p: Parts = {}): void {
  const {
    armR = true,
    armL = true,
    legR = true
  } = p;

  // Legs
  g.fillStyle(PYJAMA);
  g.fillRect(15, 32, 4, p.legTuck ? 5 : 8);

  if (legR) {
    g.fillStyle(PYJAMA);
    g.fillRect(21, 32, 4, 8);
  }

  // Body
  g.fillStyle(PANJABI);
  g.fillRect(14, 14, 12, 18);

  // Arms
  const armY = p.armsUp ? 8 : 16;

  g.fillStyle(SKIN);

  if (armL) {
    g.fillRect(11, armY, 3, 10);
  }

  if (armR) {
    g.fillRect(26, armY, 3, 10);
  }

  // Head
  g.fillStyle(SKIN);
  g.fillRect(16, 4, 8, 10);

  // Tupi
  g.fillStyle(0xffffff);
  g.fillRect(15, 2, 10, 3);

  // Eye
  g.fillStyle(0x111111);

  if (p.eyeX) {
    g.fillRect(21, 7, 3, 1);
    g.fillRect(22, 9, 1, 1);
  } else {
    g.fillRect(21, 8, 2, 2);
  }
}

// ---------- Petni ----------

function drawPetni(
  g: Gfx,
  arms: PetniArms,
  eyes: PetniEyes
): void {
  // Spectral glow
  g.fillStyle(0x9b7bff, 0.16);
  g.fillEllipse(20, 22, 36, 40);

  // Long black hair
  g.fillStyle(PETNI_HAIR);
  g.fillRect(10, 3, 6, 28);
  g.fillRect(14, 2, 12, 4);

  // Body fades into a wispy tail
  g.fillStyle(PETNI_SAREE);
  g.fillRect(14, 15, 12, 17);
  g.fillRect(16, 32, 8, 4);
  g.fillRect(18, 36, 4, 3);

  // Saree border
  g.fillStyle(PETNI_BORDER);
  g.fillRect(14, 15, 2, 17);
  g.fillRect(14, 28, 12, 2);

  // Face
  g.fillStyle(PETNI_SKIN);
  g.fillRect(16, 5, 8, 10);

  // Eyes
  if (eyes === 'hurt') {
    g.fillStyle(0x111111);
    g.fillRect(21, 7, 3, 1);
    g.fillRect(22, 9, 1, 1);
  } else if (eyes === 'angry') {
    g.fillStyle(0x111111);
    g.fillRect(20, 6, 4, 1);

    g.fillStyle(PETNI_EYE);
    g.fillRect(21, 8, 3, 2);
  } else {
    g.fillStyle(PETNI_EYE);
    g.fillRect(21, 8, 2, 2);
  }

  // Arms
  g.fillStyle(PETNI_SKIN);

  if (arms === 'down') {
    g.fillRect(11, 17, 3, 10);
    g.fillRect(26, 17, 3, 10);

    g.fillStyle(PETNI_CLAW);
    g.fillRect(11, 27, 3, 2);
    g.fillRect(26, 27, 3, 2);
  } else if (arms === 'up') {
    g.fillRect(11, 6, 3, 12);
    g.fillRect(26, 6, 3, 12);

    g.fillStyle(PETNI_CLAW);
    g.fillRect(10, 4, 5, 2);
    g.fillRect(25, 4, 5, 2);
  } else {
    g.fillRect(11, 17, 3, 10);
    g.fillRect(26, 17, 11, 3);

    g.fillStyle(PETNI_CLAW);
    g.fillRect(36, 15, 4, 2);
    g.fillRect(36, 20, 4, 2);
  }
}

function createPetniTextures(scene: Phaser.Scene): void {
  make(scene, 'petni-idle', 40, 40, (g) => {
    drawPetni(g, 'down', 'normal');
  });

  make(scene, 'petni-windup', 40, 40, (g) => {
    drawPetni(g, 'up', 'angry');
  });

  make(scene, 'petni-attack', 40, 40, (g) => {
    drawPetni(g, 'reach', 'angry');
  });

  make(scene, 'petni-hurt', 40, 40, (g) => {
    drawPetni(g, 'up', 'hurt');
  });

  make(scene, 'petni-down', 40, 16, (g) => {
    g.fillStyle(PETNI_SAREE);
    g.fillRect(8, 4, 28, 9);

    g.fillStyle(PETNI_BORDER);
    g.fillRect(8, 10, 28, 2);

    g.fillStyle(PETNI_HAIR);
    g.fillRect(0, 3, 10, 11);

    g.fillStyle(PETNI_SKIN);
    g.fillRect(3, 5, 6, 6);
  });
}

/** Generates all placeholder textures. */
export function createPlaceholderTextures(
  scene: Phaser.Scene
): void {
  // ---- Player poses (40x40) ----

  make(scene, 'player-idle', 40, 40, (g) => {
    drawFighter(g);
  });

  make(scene, 'player-punch', 40, 40, (g) => {
    drawFighter(g, { armR: false });

    g.fillStyle(SKIN);
    g.fillRect(26, 17, 11, 3);
    g.fillRect(36, 16, 4, 5);
  });

  make(scene, 'player-kick', 40, 40, (g) => {
    drawFighter(g, { legR: false });

    g.fillStyle(PYJAMA);
    g.fillRect(25, 29, 11, 4);

    g.fillStyle(0x111111);
    g.fillRect(35, 28, 5, 6);
  });

  make(scene, 'player-jumpKick', 40, 40, (g) => {
    drawFighter(g, {
      legR: false,
      legTuck: true
    });

    g.fillStyle(PYJAMA);
    g.fillRect(25, 27, 11, 4);

    g.fillStyle(0x111111);
    g.fillRect(35, 26, 5, 6);
  });

  make(scene, 'player-swing', 40, 40, (g) => {
    drawFighter(g, { armR: false });
    g.fillStyle(SKIN);
    g.fillRect(26, 17, 8, 3);
  });

  make(scene, 'player-spin', 40, 40, (g) => {
    drawFighter(g, {
      armR: false,
      armL: false
    });

    // Lathi across the body
    g.fillStyle(STICK);
    g.fillRect(0, 18, 40, 3);

    // Hands
    g.fillStyle(SKIN);
    g.fillRect(10, 18, 4, 3);
    g.fillRect(26, 18, 4, 3);
  });

  make(scene, 'player-hurt', 40, 40, (g) => {
    drawFighter(g, {
      armsUp: true,
      eyeX: true
    });
  });

  make(scene, 'player-down', 40, 16, (g) => {
    g.fillStyle(PYJAMA);
    g.fillRect(24, 5, 14, 3);
    g.fillRect(24, 10, 14, 3);

    g.fillStyle(PANJABI);
    g.fillRect(10, 4, 14, 10);

    g.fillStyle(SKIN);
    g.fillRect(2, 5, 8, 9);

    g.fillStyle(0xffffff);
    g.fillRect(2, 4, 8, 2);
  });

  // ---- Training dummy ----

  make(scene, 'dummy-idle', 40, 40, (g) => {
    g.fillStyle(GHOST);
    g.fillRect(12, 8, 16, 26);

    g.fillStyle(0xc9e8f2);
    g.fillRect(13, 2, 14, 12);

    g.fillStyle(GHOST);
    g.fillRect(8, 16, 4, 8);
    g.fillRect(28, 16, 4, 8);

    // Ragged hem
    g.fillRect(12, 34, 4, 6);
    g.fillRect(18, 36, 4, 4);
    g.fillRect(24, 34, 4, 6);

    // Face
    g.fillStyle(0x111111);
    g.fillRect(16, 7, 2, 3);
    g.fillRect(22, 7, 2, 3);
    g.fillRect(18, 11, 4, 2);
  });

  make(scene, 'dummy-down', 40, 16, (g) => {
    g.fillStyle(GHOST);
    g.fillRect(4, 4, 32, 10);

    g.fillStyle(0xc9e8f2);
    g.fillRect(2, 3, 10, 11);

    g.fillStyle(0x111111);
    g.fillRect(5, 6, 2, 3);
  });
  createPetniTextures(scene);
}