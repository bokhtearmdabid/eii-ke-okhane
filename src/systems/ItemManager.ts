import Phaser from 'phaser';
import { FONT } from '../config/constants';
import type { Player } from '../entities/Player';
import type { Box, CombatSystem, HitEvent, Hittable } from './CombatSystem';
import { burst } from './Debris';
import { getFood, getWeapon, type DropEntry, type WeaponDef } from './ItemDefs';
import type { MoveDef } from './Moves';

export const EVENT_COIN = 'coin-collected'; // ()
export const EVENT_FOOD = 'food-eaten'; // (food: FoodDef, x, y, healed, energyGained)
export const EVENT_WEAPON_PICKED = 'weapon-picked'; // (def: WeaponDef, x, y)
export const EVENT_WEAPON_BROKE = 'weapon-broke'; // (x, y)

export type ItemKind = 'coin' | 'food' | 'weapon';

const GRAVITY = 500;
const PROJECTILE_GRAVITY = 300;
const ARM_TIME = 0.35; // seconds before a fresh drop can be collected
const PICKUP_DX = 14; // coins and food
const PICKUP_DY = 10;
const WEAPON_DX = 20; // weapons are picked up on button press, so the range is more generous
const WEAPON_DY = 12;
const BLINK_TIME = 2.5;
const LIFETIME: Record<ItemKind, number> = { coin: 9, food: 14, weapon: Infinity };
const WEAPON_DEBRIS: Record<string, number[]> = {
  lathi: [0xc9a54a, 0x8a6d1f],
  brick: [0xb5432b, 0x8a2f1d],
  paakha: [0xe5233d, 0xf2e9c9],
};

interface GroundItem {
  kind: ItemKind;
  id: string;
  uses: number; // weapons: remaining durability
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  x: number;
  y: number; // lane position (feet)
  z: number;
  vx: number;
  vz: number;
  age: number;
  bounced: boolean;
}

interface Projectile {
  id: string;
  uses: number;
  def: WeaponDef;
  move: MoveDef;
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  dir: 1 | -1;
  hit: Set<Hittable>;
}

interface SpawnOpts {
  uses?: number;
  vx?: number;
  vz?: number;
  z?: number;
}

/**
 * Everything lying on the street: coins, food, weapons. Also owns thrown weapons in flight,
 * the pick-up / swap / throw button, and the "[V]" prompt above a weapon you can grab.
 */
export class ItemManager {
  private readonly items: GroundItem[] = [];
  private readonly projectiles: Projectile[] = [];
  private readonly throwMoves = new Map<string, MoveDef>();
  private readonly prompt: Phaser.GameObjects.Text;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly combat: CombatSystem,
    private readonly player: Player,
  ) {
    this.prompt = scene.add
      .text(0, 0, '', {
        fontFamily: FONT,
        fontSize: '6px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5, 1)
      .setDepth(9400)
      .setVisible(false);
  }

  get itemCount(): number {
    return this.items.length;
  }

  // ---------- spawning ----------

  /** Put an item on the street without a pop-out animation (stage layout). */
  place(kind: 'food' | 'weapon', id: string, x: number, y: number): void {
    this.spawn(kind, id, x, y);
  }

  dropCoins(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) this.spawn('coin', 'coin', x, y, this.pop());
  }

  /** Each entry rolls independently. Used by breakables and enemies. */
  rollDrops(entries: readonly DropEntry[], x: number, y: number): void {
    for (const d of entries) {
      if (Math.random() > d.chance) continue;
      if (d.kind === 'coin') {
        const [lo, hi] = d.count ?? [1, 1];
        this.dropCoins(x, y, Phaser.Math.Between(lo, hi));
      } else if (d.id) {
        this.spawn(d.kind, d.id, x, y, this.pop());
      }
    }
  }

  private pop(): SpawnOpts {
    return { vx: Phaser.Math.FloatBetween(-45, 45), vz: Phaser.Math.FloatBetween(110, 150) };
  }

  private spawn(kind: ItemKind, id: string, x: number, y: number, opts: SpawnOpts = {}): void {
    let texture = 'item-coin';
    let uses = 0;
    if (kind === 'food') texture = getFood(id).texture;
    if (kind === 'weapon') {
      const def = getWeapon(id);
      texture = def.texture;
      uses = opts.uses ?? def.durability;
    }

    const z = opts.z ?? 0;
    const vz = opts.vz ?? 0;
    const img = this.scene.add.image(x, y, texture).setOrigin(0.5, 1);
    const shadow = this.scene.add.ellipse(x, y, kind === 'weapon' ? 18 : 9, 3, 0x000000, 0.4);

    this.items.push({
      kind,
      id,
      uses,
      img,
      shadow,
      x,
      y,
      z,
      vx: opts.vx ?? 0,
      vz,
      age: 0,
      bounced: z === 0 && vz === 0, // items placed on the ground never bounce
    });
  }

  // ---------- per-frame ----------

  /** Returns hits landed by thrown weapons so the scene can show sparks and hit-pause. */
  update(dt: number): HitEvent[] {
    this.dropIfDown();
    this.reportBroken();
    this.handleInteract();
    this.updateGround(dt);
    const hits = this.updateProjectiles(dt);
    this.updatePrompt();
    return hits;
  }

  private updateGround(dt: number): void {
    const p = this.player;

    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.age += dt;

      if (it.z > 0 || it.vz !== 0) {
        it.vz -= GRAVITY * dt;
        it.z += it.vz * dt;
        it.x += it.vx * dt;
        if (it.z <= 0) {
          it.z = 0;
          if (!it.bounced) {
            it.bounced = true;
            it.vz = 70;
          } else {
            it.vz = 0;
            it.vx = 0;
          }
        }
        // While moving, stay inside the area the player may walk in (so it's always reachable)
        it.x = Phaser.Math.Clamp(it.x, p.minX, p.maxX);
      }

      if (this.tryCollect(it)) {
        this.removeAt(i);
        continue;
      }

      const life = LIFETIME[it.kind];
      if (it.age > life) {
        this.removeAt(i);
        continue;
      }

      const visible = life - it.age > BLINK_TIME || Math.floor(it.age * 10) % 2 === 0;
      it.img
        .setVisible(visible)
        .setPosition(Math.round(it.x), Math.round(it.y - it.z))
        .setDepth(it.y - 0.5);
      it.shadow.setVisible(visible).setPosition(Math.round(it.x), Math.round(it.y)).setDepth(it.y - 1);
    }
  }

  /** Coins and food are collected by walking over them. Weapons need the button. */
  private tryCollect(it: GroundItem): boolean {
    const p = this.player;
    if (it.kind === 'weapon') return false;
    if (it.age < ARM_TIME || it.z >= 24 || p.state === 'down' || p.deathPending) return false;
    if (Math.abs(p.x - it.x) > PICKUP_DX || Math.abs(p.groundY - it.y) > PICKUP_DY) return false;

    if (it.kind === 'coin') {
      this.scene.events.emit(EVENT_COIN);
      return true;
    }
    return this.eat(it);
  }

  /** Food stays on the ground if it would be wasted (full health and, for drinks, full energy). */
  private eat(it: GroundItem): boolean {
    const p = this.player;
    const food = getFood(it.id);
    const healed = Math.min(food.heal, p.maxHealth - p.health);
    const energy = Math.min(food.energy, p.maxEnergy - p.energy);
    if (healed < 1 && energy < 1) return false;

    p.health += Math.max(0, healed);
    p.energy += Math.max(0, energy);
    this.scene.events.emit(EVENT_FOOD, food, p.x, p.groundY - 40, Math.round(healed), Math.round(energy));
    return true;
  }

  // ---------- weapons: pick up, swap, throw ----------

  private nearestWeapon(): GroundItem | null {
    const p = this.player;
    let best: GroundItem | null = null;
    let bestD = Infinity;
    for (const it of this.items) {
      if (it.kind !== 'weapon' || it.age < 0.25 || it.z >= 24) continue;
      const dx = Math.abs(p.x - it.x);
      const dy = Math.abs(p.groundY - it.y);
      if (dx > WEAPON_DX || dy > WEAPON_DY) continue;
      const d = dx + dy * 2;
      if (d < bestD) {
        bestD = d;
        best = it;
      }
    }
    return best;
  }

  private handleInteract(): void {
    const p = this.player;
    if (!p.wantsInteract) return;
    if (p.state !== 'free' || !p.isGrounded) return; // stays buffered for a few frames

    p.consumeInteract();
    const near = this.nearestWeapon();
    if (near) this.pickUp(near);
    else if (p.weapon) this.throwWeapon();
  }

  private pickUp(it: GroundItem): void {
    const p = this.player;
    const id = it.id;
    const uses = it.uses;
    this.removeItem(it);

    const old = p.unequip();
    p.equip(id, uses);
    if (old) {
      this.spawn('weapon', old.id, p.x, p.groundY, { uses: old.uses, vz: 90, vx: -p.facing * 30 });
    }
    this.scene.events.emit(EVENT_WEAPON_PICKED, getWeapon(id), p.x, p.groundY - 46);
  }

  /** If the player is knocked down, the weapon falls out of their hands. */
  private dropIfDown(): void {
    const p = this.player;
    if (p.state !== 'down' || !p.weapon) return;
    const w = p.unequip();
    if (w) this.spawn('weapon', w.id, p.x, p.groundY, { uses: w.uses, vz: 100, vx: -p.facing * 40 });
  }

  private reportBroken(): void {
    const id = this.player.takeBrokenWeapon();
    if (!id) return;
    const p = this.player;
    burst(this.scene, p.x + p.facing * 14, p.groundY - p.z - 20, WEAPON_DEBRIS[id] ?? [0xcccccc], 8);
    this.scene.events.emit(EVENT_WEAPON_BROKE, p.x, p.groundY - 46);
  }

  private throwWeapon(): void {
    const p = this.player;
    const w = p.unequip();
    if (!w) return;

    const def = getWeapon(w.id);
    this.projectiles.push({
      id: w.id,
      uses: w.uses,
      def,
      move: this.throwMove(w.id, def),
      img: this.scene.add.image(0, 0, def.texture).setOrigin(0.5, 0.5),
      shadow: this.scene.add.ellipse(0, 0, 12, 3, 0x000000, 0.4),
      x: p.x + p.facing * 14,
      y: p.groundY,
      z: p.z + 20,
      vx: p.facing * def.throwSpeed,
      vz: 45,
      dir: p.facing,
      hit: new Set(),
    });
  }

  private throwMove(id: string, def: WeaponDef): MoveDef {
    let m = this.throwMoves.get(id);
    if (!m) {
      m = {
        name: `${def.name} Throw`,
        pose: 'throw',
        startup: 0,
        active: 1,
        recovery: 0,
        damage: def.throwDamage,
        hitstun: 18,
        knockbackX: def.throwKnockback,
        knockdown: def.throwKnockdown,
        launch: 120,
        hitPause: 5,
        hitbox: { offsetX: 0, width: 14, zMin: 0, zMax: 8, depth: 16 },
      };
      this.throwMoves.set(id, m);
    }
    return m;
  }

  private updateProjectiles(dt: number): HitEvent[] {
    const events: HitEvent[] = [];
    const p = this.player;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.x += pr.vx * dt;
      pr.vz -= PROJECTILE_GRAVITY * dt;
      pr.z += pr.vz * dt;
      pr.img.angle += pr.def.throwSpin * pr.dir * dt;

      const box: Box = {
        left: pr.x - 7,
        right: pr.x + 7,
        zMin: pr.z - 4,
        zMax: pr.z + 4,
        y: pr.y,
        depth: 16,
      };
      const hits = this.combat.strike(p, box, pr.move, pr.hit, false);
      events.push(...hits);

      const outOfBounds = pr.x < p.minX - 10 || pr.x > p.maxX + 10;

      if (hits.length > 0) {
        pr.uses -= 1;
        if (pr.uses <= 0) {
          burst(this.scene, pr.x, pr.y - pr.z, WEAPON_DEBRIS[pr.id] ?? [0xcccccc], 8);
        } else {
          this.spawn('weapon', pr.id, pr.x, pr.y, {
            uses: pr.uses,
            z: Math.max(0, pr.z),
            vz: 50,
            vx: -pr.dir * 40,
          });
        }
        this.removeProjectile(i);
      } else if (pr.z <= 0 || outOfBounds) {
        const x = Phaser.Math.Clamp(pr.x, p.minX, p.maxX);
        this.spawn('weapon', pr.id, x, pr.y, {
          uses: pr.uses,
          vz: 55,
          vx: outOfBounds ? 0 : pr.vx * 0.35,
        });
        this.removeProjectile(i);
      } else {
        pr.img.setPosition(Math.round(pr.x), Math.round(pr.y - pr.z)).setDepth(pr.y + 1);
        pr.shadow.setPosition(Math.round(pr.x), Math.round(pr.y)).setDepth(pr.y - 1);
      }
    }
    return events;
  }

  private updatePrompt(): void {
    const p = this.player;
    const w = p.state === 'free' && p.isGrounded ? this.nearestWeapon() : null;
    if (!w) {
      this.prompt.setVisible(false);
      return;
    }
    this.prompt
      .setText(p.weapon ? '[V] SWAP' : '[V] PICK UP')
      .setPosition(Math.round(w.x), Math.round(w.y - w.z - 14))
      .setVisible(true);
  }

  // ---------- cleanup ----------

  private removeAt(i: number): void {
    const it = this.items[i];
    it.img.destroy();
    it.shadow.destroy();
    this.items.splice(i, 1);
  }

  private removeItem(it: GroundItem): void {
    const i = this.items.indexOf(it);
    if (i >= 0) this.removeAt(i);
  }

  private removeProjectile(i: number): void {
    const pr = this.projectiles[i];
    pr.img.destroy();
    pr.shadow.destroy();
    this.projectiles.splice(i, 1);
  }
}