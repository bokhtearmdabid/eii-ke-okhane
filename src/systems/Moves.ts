import movesJson from '../data/moves.json';

export interface HitboxDef {
  offsetX: number;
  width: number;
  zMin: number;
  zMax: number;
  depth: number;
}

export interface MoveDef {
  name: string;
  pose: string;
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  hitstun: number;
  knockbackX: number;
  hitPause: number;
  hitbox: HitboxDef;
  knockdown?: boolean;
  launch?: number;
  shake?: number;
  energyGain?: number;
  energyCost?: number;
  lunge?: number;
  invincible?: boolean;
  endOnLand?: boolean;
  next?: string;
}

export const MOVES = movesJson as unknown as Record<string, MoveDef>;

/** Throws a readable error if a moveset points at a move that isn't in moves.json. */
export function getMove(id: string): MoveDef {
  const move = MOVES[id];
  if (!move) throw new Error(`Unknown move "${id}" (check moves.json)`);
  return move;
}