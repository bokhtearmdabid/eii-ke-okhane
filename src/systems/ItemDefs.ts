import breakablesJson from '../data/breakables.json';
import foodsJson from '../data/foods.json';
import weaponsJson from '../data/weapons.json';

export interface FoodDef {
  name: string;
  texture: string;
  heal: number;
  energy: number;
}

export interface WeaponDef {
  name: string;
  texture: string;
  attack: string; // first move of the combo (moves.json)
  durability: number;
  originX: number;
  carry: number;
  swingFrom: number;
  swingTo: number;
  throwSpeed: number;
  throwSpin: number;
  throwDamage: number;
  throwKnockdown: boolean;
  throwKnockback: number;
}

export interface DropEntry {
  kind: 'coin' | 'food' | 'weapon';
  id?: string; // food / weapon id
  count?: [number, number]; // coins only: min, max
  chance: number; // 0..1, rolled independently
}

export interface BreakableDef {
  name: string;
  texture: string;
  maxHealth: number;
  width: number;
  height: number;
  depth: number;
  score: number;
  debris: string[]; // "#rrggbb"
  drops: DropEntry[];
}

const FOODS = foodsJson as unknown as Record<string, FoodDef>;
const WEAPONS = weaponsJson as unknown as Record<string, WeaponDef>;
const BREAKABLES = breakablesJson as unknown as Record<string, BreakableDef>;

function lookup<T>(table: Record<string, T>, kind: string, id: string): T {
  const def = table[id];
  if (!def) throw new Error(`Unknown ${kind} "${id}" (check its JSON file)`);
  return def;
}

export const getFood = (id: string): FoodDef => lookup(FOODS, 'food', id);
export const getWeapon = (id: string): WeaponDef => lookup(WEAPONS, 'weapon', id);
export const getBreakable = (id: string): BreakableDef => lookup(BREAKABLES, 'breakable', id);