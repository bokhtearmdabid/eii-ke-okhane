import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

const SRC = 'art/src';
const OUT = 'public/assets/atlases';
const ASEPRITE = process.env.ASEPRITE ?? 'aseprite';

mkdirSync(OUT, { recursive: true });
const files = readdirSync(SRC).filter((f) => /\.(aseprite|ase)$/.test(f));
if (files.length === 0) console.log(`No .aseprite files in ${SRC}`);

for (const file of files) {
  const name = basename(file).replace(/\.(aseprite|ase)$/, '');
  execFileSync(
    ASEPRITE,
    [
      '-b',
      join(SRC, file),
      '--sheet', join(OUT, `${name}.png`),
      '--data', join(OUT, `${name}.json`),
      '--format', 'json-array',
      '--sheet-pack',
      '--filename-format', '{tag}/{tagframe}',
      '--list-tags',
      '--border-padding', '1',
      '--shape-padding', '2',
    ],
    { stdio: 'inherit' },
  );
  console.log(`exported ${name}`);
}