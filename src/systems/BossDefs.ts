import bossesJson from '../data/bosses.json';
import type { FighterStats } from '../entities/Fighter';

export interface BossAttackDef {
  move: string; // id in moves.json
  minRange: number;
  maxRange: number;
  laneTolerance: number;
  trackFrames: number;
  weight: number; // phase 1
  weight2: number; // phase 2
}

export interface BossPhase2Def {
  tempo: number;
  speedMul: number;
  idleMul: number;
  chainChance: number;
}

export interface BossDef extends FighterStats {
  id: string;
  name: string;
  subtitle: string;
  texture: string; // prefix: `${texture}-idle`, `-hurt`, `-roar`, `-kneel`, `-<pose>`, `-<pose>-windup`
  speed: number;
  speedY: number;
  hover: number;
  poise: number;
  staggerFrames: number;
  phaseThreshold: number; // fraction of max health where phase 2 begins
  idleMin: number;
  idleMax: number;
  score: number;
  coinDrop: number;
  hurtbox: { width: number; height: number; depth: number };
  phase2: BossPhase2Def;
  attacks: BossAttackDef[];
}

const BOSSES = bossesJson as unknown as Record<string, BossDef>;

export function getBossDef(id: string): BossDef {
  const def = BOSSES[id];
  if (!def) throw new Error(`Unknown boss "${id}" (check bosses.json)`);
  return def;
}