import Phaser from 'phaser';
import { GAME_WIDTH, STREET_TOP, WORLD_WIDTH } from '../config/constants';

type Rng = Phaser.Math.RandomDataGenerator;
type Draw = (g: Phaser.GameObjects.Graphics, w: number, h: number, rng: Rng) => void;

interface LayerDef {
  key: string;
  scrollFactor: number;
  depth: number;
  draw: Draw;
}

const WINDOW_COLORS = [0xffc857, 0xff4f8b, 0x38e8ff];

/** Far: night sky, moon, stars, distant skyline. */
const drawFar: Draw = (g, w, h, rng) => {
  const bands = [0x0a0620, 0x0e0828, 0x120a2a, 0x1a0e36, 0x24123f, 0x341a4a];
  const bh = Math.ceil(h / bands.length);
  bands.forEach((c, i) => g.fillStyle(c).fillRect(0, i * bh, w, bh));

  g.fillStyle(0xffffff, 0.8);
  for (let i = 0; i < 40; i++) g.fillRect(rng.between(0, w), rng.between(0, 60), 1, 1);

  g.fillStyle(0xf6e7b4).fillCircle(Math.floor(w * 0.75), 30, 10); // moon
  g.fillStyle(0x24123f).fillCircle(Math.floor(w * 0.75) + 4, 28, 9); // crescent cut

  g.fillStyle(0x1a1038);
  for (let x = 0; x < w; x += 0) {
    const bw = rng.between(12, 28);
    const bhh = rng.between(20, 50);
    g.fillRect(x, h - bhh, bw, bhh);
    x += bw + rng.between(0, 3);
  }
};

/** Mid: apartment blocks with lit windows. */
const drawMid: Draw = (g, w, h, rng) => {
  for (let x = 0; x < w; ) {
    const bw = rng.between(40, 70);
    const bhh = rng.between(55, 100);
    const top = h - bhh;
    g.fillStyle(0x0f0a26).fillRect(x, top, bw, bhh);
    g.fillStyle(0x1b1238).fillRect(x, top, bw, 2); // roof edge
    for (let wy = top + 8; wy < h - 12; wy += 14) {
      for (let wx = x + 6; wx < x + bw - 8; wx += 14) {
        if (rng.frac() > 0.55) g.fillStyle(rng.pick(WINDOW_COLORS), 0.9).fillRect(wx, wy, 6, 7);
      }
    }
    x += bw + rng.between(0, 4);
  }
};

/** Near: low shopfronts with awnings and signboards, hanging wires, lamp posts. */
const drawNear: Draw = (g, w, h, rng) => {
  const awnings = [0xff4f8b, 0x38e8ff, 0xffc857, 0x7be06b];
  for (let x = 0; x < w; ) {
    const bw = rng.between(56, 84);
    const bhh = rng.between(48, 62);
    const top = h - bhh;
    g.fillStyle(0x261a4a).fillRect(x, top, bw, bhh); // wall
    g.fillStyle(rng.pick(awnings)).fillRect(x, top + 14, bw, 6); // awning
    g.fillStyle(0x000000, 0.35).fillRect(x, top + 20, bw, 3); // awning shade
    g.fillStyle(0x0c0820).fillRect(x + 6, top + 26, bw - 12, bhh - 26); // shop opening
    g.fillStyle(rng.pick(WINDOW_COLORS), 0.7).fillRect(x + 10, top + 30, bw - 20, 8); // lit goods
    // signboard (blocks stand in for Bangla lettering until real art)
    g.fillStyle(0xf2e9c9).fillRect(x + 4, top + 3, bw - 8, 9);
    g.fillStyle(0x7a1f2b);
    for (let sx = x + 7; sx < x + bw - 10; sx += 5) g.fillRect(sx, top + 5, 3, 5);
    x += bw + 2;
  }

  // Lamp posts with a glow
  for (let x = 90; x < w; x += rng.between(180, 240)) {
    g.fillStyle(0x0c0820).fillRect(x, h - 80, 2, 80);
    g.fillStyle(0xffc857, 0.25).fillCircle(x + 1, h - 82, 9);
    g.fillStyle(0xffe9a8).fillCircle(x + 1, h - 82, 3);
  }

  // Sagging electric wires (Dhaka classic)
  g.lineStyle(1, 0x05030f, 0.9);
  for (let row = 0; row < 3; row++) {
    const y0 = 10 + row * 9;
    for (let x = 0; x < w - 90; x += 90) {
      for (let sx = 0; sx < 90; sx += 6) {
        const sag = (t: number): number => y0 + Math.sin(Math.PI * t) * 7;
        g.lineBetween(x + sx, sag(sx / 90), x + sx + 6, sag((sx + 6) / 90));
      }
    }
  }
};

/**
 * Builds parallax layers as wide textures and lets Phaser's scrollFactor do the work.
 * Width = screen + (stage - screen) * factor, so the layer's right edge meets the
 * screen edge exactly when the camera reaches the end of the stage.
 */
export class ParallaxBackground {
  private static readonly LAYERS: LayerDef[] = [
    { key: 'bg-far', scrollFactor: 0.1, depth: -900, draw: drawFar },
    { key: 'bg-mid', scrollFactor: 0.4, depth: -800, draw: drawMid },
    { key: 'bg-near', scrollFactor: 0.75, depth: -700, draw: drawNear },
  ];

  constructor(scene: Phaser.Scene) {
    for (const layer of ParallaxBackground.LAYERS) {
      const w = Math.ceil(GAME_WIDTH + (WORLD_WIDTH - GAME_WIDTH) * layer.scrollFactor);
      const h = STREET_TOP;

      if (!scene.textures.exists(layer.key)) {
        const g = scene.make.graphics({ x: 0, y: 0 }, false);
        layer.draw(g, w, h, new Phaser.Math.RandomDataGenerator([layer.key]));
        g.generateTexture(layer.key, w, h);
        g.destroy();
      }

      scene.add
        .image(0, 0, layer.key)
        .setOrigin(0, 0)
        .setScrollFactor(layer.scrollFactor, 0)
        .setDepth(layer.depth);
    }
  }
}