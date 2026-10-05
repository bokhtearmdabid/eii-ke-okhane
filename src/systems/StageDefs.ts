import { GAME_WIDTH, LANE_BOTTOM, LANE_TOP } from '../config/constants';
import stage1 from '../data/stages/stage1.json';

export interface SpawnDef {
  enemy: string; // key in EnemyManager's registry
  side: 'left' | 'right';
  delay: number; // seconds after the wave starts
  y: number; // lane position
}

export interface PropDef {
  type: string; // key in breakables.json
  x: number;
  y: number;
}

export interface WaveDef {
  id: string;
  triggerX: number;
  spawns: SpawnDef[];
}

export interface StageDef {
  id: string;
  title: string;
  name: string;
  length: number;
  playerStart: { x: number; y: number };
  waves: WaveDef[];
  props?: PropDef[];
  pickups?: PickupDef[];
  boss?: BossStageDef;
  background?: BackgroundDef;
}

export interface PickupDef {
  kind: 'weapon' | 'food';
  id: string; // key in weapons.json / foods.json
  x: number;
  y: number;
}

export interface BossSummonDef {
  enemy: string; // key in EnemyManager's registry
  side: 'left' | 'right';
  y: number;
}

export interface BossStageDef {
  id: string; // key in bosses.json and BossManager's registry
  triggerX: number; // player x that starts the fight (must be after the last wave)
  summons?: BossSummonDef[]; // arrive when the boss enters phase 2
}

/** Register new stages here as you add JSON files. */
const STAGES: Record<string, StageDef> = {
  stage1: stage1 as unknown as StageDef,
};

/** Catches typos in stage JSON with a readable message instead of a weird in-game bug. */
function validate(def: StageDef): StageDef {
  const fail = (msg: string): never => {
    throw new Error(`Stage "${def.id}": ${msg}`);
  };

  if (def.length < GAME_WIDTH) fail(`length must be at least ${GAME_WIDTH}`);

  let prev = -Infinity;
  for (const w of def.waves) {
    if (w.triggerX <= prev) fail(`wave "${w.id}" triggerX must be greater than the previous wave`);
    if (w.triggerX > def.length - GAME_WIDTH / 2) fail(`wave "${w.id}" triggerX is too close to the end`);
    if (w.spawns.length === 0) fail(`wave "${w.id}" has no spawns`);
    for (const s of w.spawns) {
      if (s.side !== 'left' && s.side !== 'right') fail(`wave "${w.id}": side must be left or right`);
      if (s.y < LANE_TOP || s.y > LANE_BOTTOM) fail(`wave "${w.id}": y ${s.y} is outside the lane`);
    }
    prev = w.triggerX;
  }
    for (const o of [...(def.props ?? []), ...(def.pickups ?? [])]) {
    if (o.x < 0 || o.x > def.length) fail(`object at x ${o.x} is outside the stage`);
    if (o.y < LANE_TOP || o.y > LANE_BOTTOM) fail(`object at y ${o.y} is outside the lane`);
  }
  return def;
}

export function getStage(id: string): StageDef {
  const def = STAGES[id];
  if (!def) throw new Error(`Unknown stage "${id}" (check StageDefs.ts)`);
  return validate(def);
}

export interface BackgroundDef {
  layers: { key: string; factor: number }[]; // far -> near; keys come from assets.json
  floor?: string;
}