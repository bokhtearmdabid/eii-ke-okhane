import Phaser from 'phaser';
import animationsJson from '../data/animations.json';
import type { MoveDef } from './Moves';

export interface AnimSpec {
  frames: number; // expected frame count (validated against the atlas)
  fps?: number; // free-running speed (default 8)
  loop?: boolean; // free-running: loop, or hold the last frame
  impact?: number; // move-synced: index of the first hit frame (default 1)
  hitFrames?: number; // move-synced: frames shown during the active window (default 1)
}

interface ActorSpec {
  cell: number;
  anims: Record<string, AnimSpec>;
}

interface AnimEntry {
  spec: AnimSpec;
  frames: string[]; // atlas frame names in play order
}

type AnimTable = Map<string, AnimEntry>;

const SPECS = animationsJson as unknown as Record<string, ActorSpec>;
const tables = new Map<string, AnimTable>();

/** Group atlas frames named "<anim>/<index>" into ordered animations, and check them against the spec. */
function buildTable(scene: Phaser.Scene, key: string): AnimTable {
  const cached = tables.get(key);
  if (cached) return cached;

  const spec = SPECS[key];
  const groups = new Map<string, { index: number; name: string }[]>();
  const names = scene.textures.get(key).getFrameNames();

  for (const name of names) {
    const slash = name.lastIndexOf('/');
    const index = Number(name.slice(slash + 1));
    if (slash < 0 || !Number.isInteger(index)) {
      console.warn(`[art] ${key}: frame "${name}" ignored (expected "<animation>/<index>")`);
      continue;
    }
    const anim = name.slice(0, slash);
    const list = groups.get(anim) ?? [];
    list.push({ index, name });
    groups.set(anim, list);
  }

  const table: AnimTable = new Map();
  for (const [anim, list] of groups) {
    list.sort((a, b) => a.index - b.index);
    const animSpec = spec?.anims[anim] ?? { frames: list.length, fps: 8, loop: true };
    table.set(anim, { spec: animSpec, frames: list.map((f) => f.name) });
  }

  if (!spec) {
    console.warn(`[art] ${key}: no entry in animations.json, using defaults`);
  } else {
    if (names.length > 0) {
      const f = scene.textures.getFrame(key, names[0]);
      if (f.realWidth !== spec.cell || f.realHeight !== spec.cell) {
        console.warn(`[art] ${key}: cell is ${f.realWidth}x${f.realHeight}, spec says ${spec.cell}x${spec.cell}`);
      }
    }
    for (const [anim, a] of Object.entries(spec.anims)) {
      const got = table.get(anim)?.frames.length ?? 0;
      if (got === 0) console.warn(`[art] ${key}: animation "${anim}" is missing (spec: ${a.frames} frames)`);
      else if (got !== a.frames) console.warn(`[art] ${key}: "${anim}" has ${got} frames, spec says ${a.frames}`);
    }
    for (const anim of table.keys()) {
      if (!(anim in spec.anims)) console.warn(`[art] ${key}: "${anim}" is not in animations.json (using defaults)`);
    }
  }

  tables.set(key, table);
  return table;
}

/**
 * Picks the atlas frame to show. Stateless: the caller supplies the time or attack frame,
 * so there is nothing to get out of sync. Every method takes a list of candidate animation
 * names (first one that exists wins) and returns null if none exist, so the caller can fall
 * back to its placeholder texture.
 */
export class ActorAnimator {
  private constructor(
    readonly atlas: string,
    private readonly table: AnimTable,
  ) {}

  /** Null when the atlas isn't loaded (art not delivered yet). */
  static create(scene: Phaser.Scene, atlas: string): ActorAnimator | null {
    if (!scene.textures.exists(atlas)) return null;
    const table = buildTable(scene, atlas);
    return table.size > 0 ? new ActorAnimator(atlas, table) : null;
  }

  private find(names: readonly string[]): AnimEntry | null {
    for (const n of names) {
      const e = this.table.get(n);
      if (e) return e;
    }
    return null;
  }

  /** Free-running animation at `seconds` since it started (loops or holds, per animations.json). */
  play(names: readonly string[], seconds: number): string | null {
    const e = this.find(names);
    if (!e) return null;
    const i = Math.floor(seconds * (e.spec.fps ?? 8));
    return e.frames[e.spec.loop ? i % e.frames.length : Math.min(i, e.frames.length - 1)];
  }

  /** A fixed frame by index (clamped): used for velocity-driven poses like jump and knockdown. */
  still(names: readonly string[], index: number): string | null {
    const e = this.find(names);
    return e ? e.frames[Phaser.Math.Clamp(index, 0, e.frames.length - 1)] : null;
  }

  /**
   * Frame for an attack, stretched to the move's own timing:
   *   frames before `impact`  -> spread over startup (the telegraph)
   *   `hitFrames` frames      -> spread over the active window (when the hitbox is live)
   *   remaining frames        -> spread over recovery
   */
  move(names: readonly string[], attackFrame: number, move: MoveDef): string | null {
    const e = this.find(names);
    if (!e) return null;

    const n = e.frames.length;
    const k = Math.min(e.spec.impact ?? 1, n - 1);
    const h = Math.max(1, Math.min(e.spec.hitFrames ?? 1, n - k));
    const tail = n - k - h;
    const startup = move.startup;
    const active = Math.max(1, move.active);
    const recovery = Math.max(1, move.recovery);

    let idx: number;
    if (attackFrame < startup) {
      idx = k > 0 ? Math.floor((attackFrame / startup) * k) : 0;
    } else if (attackFrame < startup + active) {
      idx = k + Math.min(h - 1, Math.floor(((attackFrame - startup) / active) * h));
    } else if (tail > 0) {
      idx = k + h + Math.min(tail - 1, Math.floor(((attackFrame - startup - active) / recovery) * tail));
    } else {
      idx = k + h - 1;
    }
    return e.frames[Phaser.Math.Clamp(idx, 0, n - 1)];
  }
}