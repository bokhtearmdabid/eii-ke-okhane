import Phaser from 'phaser';

/**
 * Device-independent snapshot of what the player wants this frame.
 * Keyboard fills it now; touch controls will fill the same shape later.
 */
export interface InputState {
  moveX: number; // -1..1
  moveY: number; // -1..1
  jump: boolean; // true only on the frame the button goes down
  punch: boolean;
  kick: boolean;
  special: boolean;
  interact: boolean;
}

type Key = Phaser.Input.Keyboard.Key;

export class InputSystem {
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly wasd: Record<string, Key>;
  private readonly jumpKeys: Key[];
  private readonly punchKeys: Key[];
  private readonly kickKeys: Key[];
  private readonly specialKeys: Key[];
  private readonly interactKeys: Key[];

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.cursors = kb.createCursorKeys();
    this.wasd = kb.addKeys({ up: K.W, down: K.S, left: K.A, right: K.D }) as Record<string, Key>;
    this.jumpKeys = [kb.addKey(K.SPACE)];
    this.punchKeys = [kb.addKey(K.Z), kb.addKey(K.J)];
    this.kickKeys = [kb.addKey(K.X), kb.addKey(K.K)];
    this.specialKeys = [kb.addKey(K.C), kb.addKey(K.L)];
    this.interactKeys = [kb.addKey(K.V), kb.addKey(K.E)];
  }

  /** JustDown must be called on every key so each press is consumed exactly once. */
  private pressed(keys: Key[]): boolean {
    let any = false;
    for (const k of keys) if (Phaser.Input.Keyboard.JustDown(k)) any = true;
    return any;
  }

  read(): InputState {
    const left = this.cursors.left.isDown || this.wasd.left.isDown;
    const right = this.cursors.right.isDown || this.wasd.right.isDown;
    const up = this.cursors.up.isDown || this.wasd.up.isDown;
    const down = this.cursors.down.isDown || this.wasd.down.isDown;

    return {
      moveX: (right ? 1 : 0) - (left ? 1 : 0),
      moveY: (down ? 1 : 0) - (up ? 1 : 0),
      jump: this.pressed(this.jumpKeys),
      punch: this.pressed(this.punchKeys),
      kick: this.pressed(this.kickKeys),
      special: this.pressed(this.specialKeys),
      interact: this.pressed(this.interactKeys),
    };
  }
}