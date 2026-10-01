import type { Fighter } from '../entities/Fighter';
import type { MoveDef } from './Moves';

/**
 * A box in "beat 'em up space":
 *  - left/right: horizontal extent
 *  - zMin/zMax: height above the ground
 *  - y/depth: position and thickness in the lane (so you can't punch someone far "behind" you)
 */
export interface Box {
  left: number;
  right: number;
  zMin: number;
  zMax: number;
  y: number;
  depth: number;
}

export interface HitEvent {
  attacker: Fighter;
  defender: Fighter;
  move: MoveDef;
}

export function boxesOverlap(a: Box, b: Box): boolean {
  return (
    a.left < b.right &&
    a.right > b.left &&
    a.zMin < b.zMax &&
    a.zMax > b.zMin &&
    Math.abs(a.y - b.y) <= (a.depth + b.depth) / 2
  );
}

export class CombatSystem {
  private readonly fighters: Fighter[] = [];

  add(f: Fighter): void {
    this.fighters.push(f);
  }

  get all(): readonly Fighter[] {
    return this.fighters;
  }

  /** Call once per frame after all fighters have updated. Returns the hits that landed. */
  update(): HitEvent[] {
    const events: HitEvent[] = [];

    for (const attacker of this.fighters) {
      const box = attacker.hitbox();
      const atk = attacker.attack;
      if (!box || !atk) continue;

      for (const defender of this.fighters) {
        if (defender.team === attacker.team || atk.hit.has(defender)) continue;
        if (!boxesOverlap(box, defender.hurtbox)) continue;

        if (defender.receiveHit(attacker, atk.move)) {
          atk.hit.add(defender); // one hit per target per swing
          attacker.onHitLanded(atk.move);
          events.push({ attacker, defender, move: atk.move });
        }
      }
    }
    return events;
  }
}