import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import type { Player } from '../entities/Player';
import type { EnemyManager } from './EnemyManager';
import type { SpawnDef, StageDef, WaveDef } from './StageDefs';

export const EVENT_WAVE_START = 'wave-start'; // (lockX: number, waveIndex: number)
export const EVENT_WAVE_CLEAR = 'wave-clear'; // (wavesCleared: number)
export const EVENT_STAGE_COMPLETE = 'stage-complete';

export type StagePhase = 'walking' | 'locked' | 'complete';

const EDGE = 14; // how close to the screen edge the player may go while locked
const EXIT_MARGIN = 60; // after the last wave, reaching length - this completes the stage
const SPAWN_MARGIN = 24; // enemies appear this far outside the locked screen

/**
 *   walking ──(player.x >= wave.triggerX)──► locked ──(all spawned + all dead)──► walking
 *      └──(all waves cleared, reach the end)──► complete
 */
export class StageManager {
  phase: StagePhase = 'walking';
  waveIndex = 0; // the next wave to trigger (= number of waves cleared)
  lockX = 0;

  private queue: SpawnDef[] = [];
  private waveTime = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly def: StageDef,
    private readonly player: Player,
    private readonly enemies: EnemyManager,
  ) {}

  get waveCount(): number {
    return this.def.waves.length;
  }

  get allWavesCleared(): boolean {
    return this.waveIndex >= this.def.waves.length;
  }

  /** Enemies still to be defeated in the current wave (waiting to spawn + alive). */
  get remaining(): number {
    return this.queue.length + this.enemies.aliveCount;
  }

  update(dt: number): void {
    if (this.phase === 'walking') this.updateWalking();
    else if (this.phase === 'locked') this.updateLocked(dt);
  }

  private updateWalking(): void {
    const wave = this.def.waves[this.waveIndex];
    if (wave) {
      if (this.player.x >= wave.triggerX) this.startWave(wave);
    } else if (this.player.x >= this.def.length - EXIT_MARGIN) {
      this.phase = 'complete';
      this.scene.events.emit(EVENT_STAGE_COMPLETE);
    }
  }

  private startWave(wave: WaveDef): void {
    this.phase = 'locked';
    this.waveTime = 0;
    this.queue = [...wave.spawns].sort((a, b) => a.delay - b.delay);

    // Pin the camera to the screen it is showing right now (bounds exactly one screen wide)
    const cam = this.scene.cameras.main;
    this.lockX = Phaser.Math.Clamp(Math.round(cam.scrollX), 0, this.def.length - GAME_WIDTH);
    cam.setBounds(this.lockX, 0, GAME_WIDTH, GAME_HEIGHT);

    this.player.minX = this.lockX + EDGE;
    this.player.maxX = this.lockX + GAME_WIDTH - EDGE;

    this.scene.events.emit(EVENT_WAVE_START, this.lockX, this.waveIndex);
  }

  private updateLocked(dt: number): void {
    this.waveTime += dt;
    while (this.queue.length > 0 && this.queue[0].delay <= this.waveTime) {
      this.spawn(this.queue.shift() as SpawnDef);
    }
    if (this.queue.length === 0 && this.enemies.aliveCount === 0) this.clearWave();
  }

  private spawn(s: SpawnDef): void {
    const x =
      s.side === 'left' ? this.lockX - SPAWN_MARGIN : this.lockX + GAME_WIDTH + SPAWN_MARGIN;
    this.enemies.spawn(s.enemy, x, s.y);
  }

  private clearWave(): void {
    // Restore full-stage bounds; the camera follow resumes smoothly from where it is
    this.scene.cameras.main.setBounds(0, 0, this.def.length, GAME_HEIGHT);
    this.player.minX = 16;
    this.player.maxX = this.def.length - 16;

    this.waveIndex++;
    this.phase = 'walking';
    this.scene.events.emit(EVENT_WAVE_CLEAR, this.waveIndex);
  }
}