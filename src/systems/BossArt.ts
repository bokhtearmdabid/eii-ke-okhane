import Phaser from 'phaser';

type Gfx = Phaser.GameObjects.Graphics;

const SHROUD = 0xd9d6e8;
const SHROUD_SHADE = 0xaaa6c4;
const SKIN = 0xbfc4cc; // ash-grey
const BARK = 0x6b5a3e;
const BARK_DARK = 0x3b2a1a;
const LEAF = 0x4caf50;
const EYE = 0xffb300;

type Arms = 'down' | 'raised' | 'smash' | 'wide' | 'back' | 'reach';

interface Pose {
  arms: Arms;
  eyes?: 'normal' | 'angry' | 'hurt';
  lean?: number; // upper body shifts forward (px)
  drop?: number; // everything shifts down (kneeling)
  blur?: boolean; // motion streaks
}

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Gfx) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

/** 64x64 frame, facing right, feet at the bottom. */
function drawBrahma(g: Gfx, p: Pose): void {
  const dy = p.drop ?? 0;
  const lx = p.lean ?? 0;
  const rect = (c: number, x: number, y: number, w: number, h: number, upper = false, a = 1): void => {
    g.fillStyle(c, a);
    g.fillRect(x + (upper ? lx : 0), y + dy, w, h);
  };

  g.fillStyle(0xffb300, 0.09).fillEllipse(32, 34 + dy, 58, 62); // faint amber glow

  // Roots under the hem: he is rooted to the old banyan
  rect(BARK_DARK, 20, 57, 4, 7);
  rect(BARK_DARK, 27, 59, 3, 5);
  rect(BARK_DARK, 35, 58, 4, 6);
  rect(BARK_DARK, 41, 57, 4, 7);

  // Plain white shroud
  rect(SHROUD, 21, 38, 22, 20);
  rect(SHROUD_SHADE, 21, 56, 22, 2);
  rect(SHROUD, 22, 20, 20, 20, true);
  rect(SHROUD_SHADE, 30, 24, 1, 30, true);
  rect(SHROUD_SHADE, 36, 26, 1, 28, true);
  rect(SHROUD, 23, 58, 4, 3);
  rect(SHROUD, 31, 58, 5, 4);
  rect(SHROUD, 38, 58, 4, 3);

  // Head with a crown of banyan aerial roots and leaves
  rect(SKIN, 26, 6, 12, 14, true);
  rect(BARK_DARK, 25, 3, 14, 4, true);
  rect(BARK_DARK, 24, 6, 2, 18, true);
  rect(BARK_DARK, 38, 6, 2, 18, true);
  rect(LEAF, 27, 0, 4, 4, true);
  rect(LEAF, 33, 1, 4, 3, true);
  rect(LEAF, 38, 2, 3, 3, true);

  const eyes = p.eyes ?? 'normal';
  if (eyes === 'hurt') {
    rect(0x111111, 33, 10, 3, 1, true);
    rect(0x111111, 34, 12, 1, 1, true);
  } else {
    rect(EYE, 33, 11, 3, 2, true);
    if (eyes === 'angry') rect(0x111111, 31, 9, 6, 1, true);
  }
  rect(0x111111, 31, 16, 6, 1, true); // mouth

  // Gnarled, bark-coloured arms
  switch (p.arms) {
    case 'down':
      rect(BARK, 16, 24, 6, 24, true);
      rect(BARK, 42, 24, 6, 24, true);
      rect(SKIN, 15, 48, 8, 4, true);
      rect(SKIN, 41, 48, 8, 4, true);
      break;
    case 'raised':
      rect(BARK, 16, 4, 6, 22, true);
      rect(BARK, 42, 4, 6, 22, true);
      rect(SKIN, 15, 1, 8, 4, true);
      rect(SKIN, 41, 1, 8, 4, true);
      break;
    case 'smash':
      rect(BARK, 16, 10, 6, 18, true);
      rect(SKIN, 15, 8, 8, 3, true);
      rect(BARK, 44, 20, 7, 30, true);
      rect(SKIN, 42, 48, 12, 8, true);
      break;
    case 'wide':
      rect(BARK, 2, 24, 20, 6, true);
      rect(BARK, 42, 24, 20, 6, true);
      rect(SKIN, 0, 22, 4, 10, true);
      rect(SKIN, 60, 22, 4, 10, true);
      break;
    case 'back':
      rect(BARK, 6, 26, 16, 6, true);
      rect(BARK, 10, 35, 14, 5, true);
      rect(SKIN, 4, 24, 4, 9, true);
      break;
    case 'reach':
      rect(BARK, 42, 26, 20, 6, true);
      rect(SKIN, 60, 24, 4, 10, true);
      rect(BARK, 16, 24, 6, 22, true);
      break;
  }

  if (p.blur) {
    rect(0xffffff, 0, 28, 16, 1, false, 0.4);
    rect(0xffffff, 4, 36, 12, 1, false, 0.3);
    rect(0xffffff, 2, 44, 14, 1, false, 0.25);
  }
}

export function createBossTextures(scene: Phaser.Scene): void {
  const T = 'brahma';
  const mk = (suffix: string, pose: Pose): void =>
    make(scene, `${T}-${suffix}`, 64, 64, (g) => drawBrahma(g, pose));

  mk('idle', { arms: 'down' });
  mk('slam-windup', { arms: 'raised', eyes: 'angry', lean: -2 });
  mk('slam', { arms: 'smash', eyes: 'angry', lean: 3 });
  mk('sweep-windup', { arms: 'wide', eyes: 'angry', lean: -1 });
  mk('sweep', { arms: 'wide', eyes: 'angry', blur: true });
  mk('charge-windup', { arms: 'back', eyes: 'angry', lean: 4 });
  mk('charge', { arms: 'reach', eyes: 'angry', lean: 5, blur: true });
  mk('roar', { arms: 'raised', eyes: 'angry' });
  mk('hurt', { arms: 'raised', eyes: 'hurt', lean: -3 });
  mk('kneel', { arms: 'down', eyes: 'hurt', drop: 14, lean: 2 });
}