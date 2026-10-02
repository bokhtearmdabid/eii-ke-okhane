import Phaser from 'phaser';
import type { Fighter, Team } from '../entities/Fighter';
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

/** Anything a hit can land on: fighters and breakable props. */
export interface Hittable {
  readonly team: Team | 'neutral';
  readonly x: number;
  readonly groundY: number;
  readonly z: number;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly hurtbox: Box;
  /** Returns true if the hit landed. */
  receiveHit(attacker: Fighter, move: MoveDef): boolean;
}

export interface HitEvent {
  attacker: Fighter;
  defender: Hittable;
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
  private readonly targets: Hittable[] = []; // breakables (neutral)

  add(f: Fighter): void {
    this.fighters.push(f);
  }

  remove(f: Fighter): void {
    const i = this.fighters.indexOf(f);
    if (i >= 0) this.fighters.splice(i, 1);
  }

  addTarget(t: Hittable): void {
    this.targets.push(t);
  }

  removeTarget(t: Hittable): void {
    const i = this.targets.indexOf(t);
    if (i >= 0) this.targets.splice(i, 1);
  }

  get all(): readonly Fighter[] {
    return this.fighters;
  }

  get targetList(): readonly Hittable[] {
    return this.targets;
  }

  /** Call once per frame after all fighters have updated. Returns the hits that landed. */
  update(): HitEvent[] {
    const events: HitEvent[] = [];
    for (const attacker of this.fighters) {
      const box = attacker.hitbox();
      const atk = attacker.attack;
      if (!box || !atk) continue;
      events.push(...this.strike(attacker, box, atk.move, atk.hit));
    }
    return events;
  }

  /**
   * Applies one box of damage from `owner`. Used by melee swings and thrown weapons.
   * `hit` remembers who was already hit so one swing can't hit the same target twice.
   * `credit` lets the owner gain energy (melee only).
   */
  strike(owner: Fighter, box: Box, move: MoveDef, hit: Set<Hittable>, credit = true): HitEvent[] {
    const events: HitEvent[] = [];
    const candidates: Hittable[] = [...this.fighters, ...this.targets];

    for (const d of candidates) {
      if (d.team === owner.team || hit.has(d)) continue;
      if (d.team === 'neutral' && owner.team !== 'player') continue; // enemies don't smash props
      if (!boxesOverlap(box, d.hurtbox)) continue;

      if (d.receiveHit(owner, move)) {
        hit.add(d);
        if (credit) owner.onHitLanded(move);
        events.push({ attacker: owner, defender: d, move });
      }
    }
    return events;
  }
}