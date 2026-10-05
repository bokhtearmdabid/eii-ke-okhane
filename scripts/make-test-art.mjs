import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import pkg from 'pngjs';

const { PNG } = pkg;
const FORCE = process.argv.includes('--force');
const ATLAS_DIR = 'public/assets/atlases';
const BG_DIR = 'public/assets/images/bg';
const animations = JSON.parse(readFileSync('src/data/animations.json', 'utf8'));

function write(path, data) {
  if (existsSync(path) && !FORCE) {
    console.log(`skip   ${path} (exists, use art:test:force to overwrite)`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  console.log(`wrote  ${path}`);
}

function rect(img, x0, y0, w, h, [r, g, b, a = 255]) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
      const i = (img.width * y + x) << 2;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = a;
    }
  }
}

function colorFor(name) {
  const h = [...name].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 7);
  return [70 + (h & 0x7f), 70 + ((h >> 7) & 0x7f), 70 + ((h >> 14) & 0x7f)];
}

/**
 * One test frame: a body box in the animation's colour, a white "eye" on the right (shows
 * facing), (index+1) white dots along the top, a dark line on the bottom row (ground contact),
 * a faint cell outline, and a RED square on the frames that should line up with the hitbox.
 */
function drawFrame(img, ox, oy, cell, anim, index, spec) {
  const bodyW = Math.round(cell * 0.3);
  const bodyH = Math.round(cell * 0.62);
  const bx = ox + Math.round((cell - bodyW) / 2);
  const by = oy + cell - bodyH;

  rect(img, bx, by, bodyW, bodyH, colorFor(anim));
  rect(img, bx + bodyW - 5, by + 4, 3, 3, [255, 255, 255]);
  rect(img, bx, oy + cell - 2, bodyW, 2, [20, 20, 30]);
  for (let n = 0; n <= index; n++) rect(img, ox + 2 + n * 5, oy + 2, 3, 3, [255, 255, 255]);

  const edge = [255, 255, 255, 40];
  rect(img, ox, oy, cell, 1, edge);
  rect(img, ox, oy + cell - 1, cell, 1, edge);
  rect(img, ox, oy, 1, cell, edge);
  rect(img, ox + cell - 1, oy, 1, cell, edge);

  if (spec.impact !== undefined) {
    const first = spec.impact;
    const last = first + (spec.hitFrames ?? 1) - 1;
    if (index >= first && index <= last) rect(img, ox + cell - 9, oy + 2, 6, 6, [255, 40, 60]);
  }
}

function buildAtlas(actor, spec) {
  const cell = spec.cell;
  const pad = 2;
  const list = [];
  for (const [anim, a] of Object.entries(spec.anims)) {
    for (let i = 0; i < a.frames; i++) list.push({ anim, i, a });
  }

  const cols = 8;
  const rows = Math.ceil(list.length / cols);
  const W = cols * (cell + pad);
  const H = rows * (cell + pad);
  const img = new PNG({ width: W, height: H });

  const frames = list.map((f, n) => {
    const x = (n % cols) * (cell + pad);
    const y = Math.floor(n / cols) * (cell + pad);
    drawFrame(img, x, y, cell, f.anim, f.i, f.a);
    return {
      filename: `${f.anim}/${f.i}`,
      frame: { x, y, w: cell, h: cell },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: cell, h: cell },
      sourceSize: { w: cell, h: cell },
      duration: 100,
    };
  });

  const data = {
    frames,
    meta: {
      app: 'make-test-art',
      version: '1.0',
      image: `${actor}.png`,
      format: 'RGBA8888',
      size: { w: W, h: H },
      scale: '1',
    },
  };
  return { png: PNG.sync.write(img), json: JSON.stringify(data, null, 2) };
}

for (const [actor, spec] of Object.entries(animations)) {
  const { png, json } = buildAtlas(actor, spec);
  write(`${ATLAS_DIR}/${actor}.png`, png);
  write(`${ATLAS_DIR}/${actor}.json`, json);
}

// ---- background strips: periodic patterns whose period divides the width, so they tile seamlessly ----
const lerp = (a, b, t) => Math.round(a + (b - a) * t);

function strip(w, h, pixel) {
  const img = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = pixel(x, y);
      const i = (w * y + x) << 2;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = a;
    }
  }
  return PNG.sync.write(img);
}

write(
  `${BG_DIR}/bg-shakhari-far.png`,
  strip(480, 145, (x, y) => {
    const t = y / 145;
    const lift = x % 60 < 2 ? 25 : 0; // a pale tick every 60 px
    return [lerp(10, 52, t) + lift, lerp(6, 26, t) + lift, lerp(32, 74, t) + lift, 255];
  }),
);

write(
  `${BG_DIR}/bg-shakhari-mid.png`,
  strip(480, 145, (x, y) => {
    const h = 40 + (Math.floor(x / 80) % 3) * 20;
    return x % 80 < 66 && y > 145 - h ? [18, 12, 44, 255] : [0, 0, 0, 0];
  }),
);

write(
  `${BG_DIR}/bg-shakhari-near.png`,
  strip(640, 145, (x, y) => {
    if (x % 64 >= 56 || y < 70) return [0, 0, 0, 0];
    const lit = x % 64 >= 10 && x % 64 < 20 && y % 20 < 8 && y > 90;
    return lit ? [255, 200, 87, 255] : [38, 26, 74, 255];
  }),
);

write(
  `${BG_DIR}/floor-shakhari.png`,
  strip(480, 125, (x, y) => {
    if (y < 3) return [58, 49, 88, 255];
    if (x % 40 < 2) return [74, 64, 112, 255];
    return [42, 35, 64, 255];
  }),
);