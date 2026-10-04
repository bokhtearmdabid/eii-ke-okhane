import Phaser from 'phaser';
import { GAME_WIDTH, LANE_BOTTOM, LANE_TOP } from '../config/constants';
import { type Boss, EVENT_BOSS_GONE, EVENT_BOSS_START } from '../entities/Boss';
import { Brahmadaitya } from '../entities/Brahmadaitya';
import type { Player } from '../entities/Player';
import type { CombatSystem } from './CombatSystem';

type BossCtor = new (scene: Phaser.Scene, x: number, groundY: number) => Boss;

/** Add new bosses here as they're built. */
const REGISTRY: Record<string, BossCtor> = {
  brahmadaitya: Brahmadaitya,
};

const ARENA_MARGIN = 30; // how close to the screen edges the boss may go

export class BossManager {
  boss: Boss | null = null;
  finished = false; // true once the boss has fully dissolved

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly combat: CombatSystem,
    private readonly player: Player,
  ) {}

  /** The boss walks in from just outside the right edge of the locked screen. */
  spawn(id: string, lockX: number): Boss {
    const Ctor = REGISTRY[id];
    if (!Ctor) throw new Error(`No boss class registered for "${id}"`);

    const boss = new Ctor(this.scene, lockX + GAME_WIDTH + 40, (LANE_TOP + LANE_BOTTOM) / 2);
    boss.setArena(lockX + ARENA_MARGIN, lockX + GAME_WIDTH - ARENA_MARGIN);
    this.boss = boss;
    this.combat.add(boss);
    this.scene.events.emit(EVENT_BOSS_START, boss, lockX);
    return boss;
  }

  update(dt: number): void {
    const b = this.boss;
    if (!b) return;

    b.update(dt, this.player);

    if (b.removed) {
      this.scene.events.emit(EVENT_BOSS_GONE, b); // listeners read position/reward before destroy
      this.combat.remove(b);
      b.destroy();
      this.boss = null;
      this.finished = true;
    }
  }
}