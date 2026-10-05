import Phaser from 'phaser';
import { MAX_ATTACKERS, WORLD_WIDTH } from '../config/constants';
import type { Enemy } from '../entities/Enemy';
import { Petni } from '../entities/Petni';
import type { Player } from '../entities/Player';
import type { CombatSystem } from './CombatSystem';

export const EVENT_ENEMY_DEFEATED = 'enemy-defeated';

type EnemyCtor = new (scene: Phaser.Scene, x: number, groundY: number) => Enemy;

/** Add new enemy types here as they're built (Shakchunni, Aleya, Paglu Dance...). */
const REGISTRY: Record<string, EnemyCtor> = {
  petni: Petni,
};

export class EnemyManager {
  readonly enemies: Enemy[] = [];

    constructor(
    private readonly scene: Phaser.Scene,
    private readonly combat: CombatSystem,
    private readonly player: Player,
    private readonly worldWidth = WORLD_WIDTH,
    public maxAttackers = MAX_ATTACKERS,
  ) {}

  get aliveCount(): number {
    return this.enemies.filter((e) => !e.isDead).length;
  }

  get attackerCount(): number {
    return this.enemies.filter((e) => !e.isDead && e.role === 'attacker').length;
  }

  spawn(id: string, x: number, groundY: number): Enemy {
    const Ctor = REGISTRY[id];
    if (!Ctor) throw new Error(`No enemy class registered for "${id}"`);
    const enemy = new Ctor(this.scene, x, groundY);
    enemy.minX = -40;
    enemy.maxX = this.worldWidth + 40;
    this.enemies.push(enemy);
    this.combat.add(enemy);
    return enemy;
  }

  banishAll(): void {
  for (const e of this.enemies) e.banish();
  }

  update(dt: number): void {
    this.assignAttackSlots();

    for (const e of this.enemies) e.update(dt, this.player, this.enemies);

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.isDead && !e.deathReported) {
        e.deathReported = true;
        this.scene.events.emit(EVENT_ENEMY_DEFEATED, e);
      }
      if (e.removed) {
        this.combat.remove(e);
        e.destroy();
        this.enemies.splice(i, 1);
      }
    }
  }

  /** Enemies release their own slot (end of swing, hurt, timeout); here we only fill free ones. */
  private assignAttackSlots(): void {
    let used = this.attackerCount;
    if (used >= this.maxAttackers) return;

    const p = this.player;
    const candidates = this.enemies
      .filter((e) => e.canTakeAttackToken)
      .sort(
        (a, b) =>
          Phaser.Math.Distance.Between(a.x, a.groundY, p.x, p.groundY) -
          Phaser.Math.Distance.Between(b.x, b.groundY, p.x, p.groundY),
      );

    for (const e of candidates) {
      if (used >= this.maxAttackers) break;
      e.role = 'attacker';
      used++;
    }
  }
}