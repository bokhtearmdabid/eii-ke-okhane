import enemiesJson from '../data/enemies.json';
import type { FighterStats } from '../entities/Fighter';

export interface EnemyDef extends FighterStats {
  id: string;
  name: string;
  texture: string; // texture prefix: `${texture}-idle`, `-windup`, `-attack`, `-hurt`, `-down`
  speed: number;
  speedY: number;
  attackRange: number;
  laneTolerance: number;
  circleRadius: number;
  attackCooldownMin: number;
  attackCooldownMax: number;
  thinkMin: number;
  thinkMax: number;
  hover: number;
  score: number; 
  coinDrop: number; 
  attacks: string[]; // move ids from moves.json
}

export const ENEMIES = enemiesJson as unknown as Record<string, EnemyDef>;

export function getEnemyDef(id: string): EnemyDef {
  const def = ENEMIES[id];
  if (!def) throw new Error(`Unknown enemy "${id}" (check enemies.json)`);
  return def;
}