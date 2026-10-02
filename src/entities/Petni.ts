import Phaser from 'phaser';
import { getEnemyDef } from '../systems/EnemyDefs';
import { Enemy } from './Enemy';

/**
 * Petni: the restless ghost of a woman, drifting above the street in a white saree.
 * Floats (shadow stays on the ground), winds up, then rakes with her claws.
 */
export class Petni extends Enemy {
  constructor(scene: Phaser.Scene, x: number, groundY: number) {
    super(scene, x, groundY, getEnemyDef('petni'));
  }

  protected hoverOffset(): number {
    return this.def.hover + Math.sin(this.clock * 4 + this.uid * 1.7) * 2.5;
  }
}