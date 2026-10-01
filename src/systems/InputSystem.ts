import Phaser from 'phaser';

/**
 * Device snapshot of what the player wants this frame.
 */
export interface InputState {
  moveX: number; // -1..1
  moveY: number; // -1..1
  jump: boolean; // true only on the frame the button goes down
}

export class InputSystem {
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly wasd: Record<string, Phaser.Input.Keyboard.Key>;
  private readonly jumpKey: Phaser.Input.Keyboard.Key;

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.cursors = kb.createCursorKeys();
    this.wasd = kb.addKeys({ up: K.W, down: K.S, left: K.A, right: K.D }) as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
    this.jumpKey = kb.addKey(K.SPACE);
  }

  read(): InputState {
    const left = this.cursors.left.isDown || this.wasd.left.isDown;
    const right = this.cursors.right.isDown || this.wasd.right.isDown;
    const up = this.cursors.up.isDown || this.wasd.up.isDown;
    const down = this.cursors.down.isDown || this.wasd.down.isDown;

    return {
      moveX: (right ? 1 : 0) - (left ? 1 : 0),
      moveY: (down ? 1 : 0) - (up ? 1 : 0),
      jump: Phaser.Input.Keyboard.JustDown(this.jumpKey),
    };
  }
}