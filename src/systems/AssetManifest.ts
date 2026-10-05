import Phaser from 'phaser';
import manifestJson from '../data/assets.json';

export interface AtlasEntry {
  key: string;
  image: string; // relative to public/assets/
  data: string;
}

export interface ImageEntry {
  key: string;
  url: string;
}

interface Manifest {
  atlases: AtlasEntry[];
  images: ImageEntry[];
}

const manifest = manifestJson as unknown as Manifest;
const ASSET_ROOT = 'assets/'; // relative, so it also works inside the Android WebView

/**
 * Queue everything in assets.json. Missing files don't stop the game: the loader reports
 * them once, and every system falls back to placeholder art for anything that isn't loaded.
 */
export function queueAssets(scene: Phaser.Scene): void {
  const load = scene.load;
  const missing: string[] = [];

  load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
    if (!missing.includes(file.key)) missing.push(file.key);
  });
  load.once(Phaser.Loader.Events.COMPLETE, () => {
    if (missing.length > 0) console.info(`[art] not found, using placeholders: ${missing.join(', ')}`);
  });

  load.setPath(ASSET_ROOT);
  for (const a of manifest.atlases) load.atlas(a.key, a.image, a.data);
  for (const i of manifest.images) load.image(i.key, i.url);
  load.setPath('');
}