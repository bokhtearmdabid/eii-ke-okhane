import Phaser from 'phaser';
import { FRAME_RATE } from '../config/constants';
import { Breakable } from '../entities/Breakable';
import type { CombatSystem } from './CombatSystem';
import { burst } from './Debris';
import { getBreakable } from './ItemDefs';
import type { ItemManager } from './ItemManager';

export const EVENT_PROP_BROKEN = 'prop-broken'; // (def: BreakableDef, x: number, y: number)

/** Owns the breakables: registers them as hit targets, and turns a broken one into debris + drops. */
export class PropManager {
  private readonly props: Breakable[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly combat: CombatSystem,
    private readonly items: ItemManager,
  ) {}

  get count(): number {
    return this.props.length;
  }

  spawn(type: string, x: number, groundY: number): Breakable {
    const prop = new Breakable(this.scene, getBreakable(type), x, groundY);
    this.props.push(prop);
    this.combat.addTarget(prop);
    return prop;
  }

  update(dt: number): void {
    const df = dt * FRAME_RATE;

    for (let i = this.props.length - 1; i >= 0; i--) {
      const b = this.props[i];
      b.update(df);
      if (!b.broken) continue;

      const colors = b.def.debris.map((c) => Phaser.Display.Color.HexStringToColor(c).color);
      burst(this.scene, b.x, b.groundY - b.def.height / 2, colors, 10);
      this.items.rollDrops(b.def.drops, b.x, b.groundY);
      this.scene.events.emit(EVENT_PROP_BROKEN, b.def, b.x, b.groundY - b.def.height);

      this.combat.removeTarget(b);
      b.destroy();
      this.props.splice(i, 1);
    }
  }
}