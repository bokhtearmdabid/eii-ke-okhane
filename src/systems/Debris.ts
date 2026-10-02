import Phaser from 'phaser';

/** A quick burst of little squares flying out and fading: breaking crates, pots, weapons. */
export function burst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  colors: number[],
  count = 8,
): void {
  for (let i = 0; i < count; i++) {
    const size = Phaser.Math.Between(2, 4);
    const piece = scene.add
      .rectangle(x, y, size, size, colors[i % colors.length])
      .setDepth(9400);
    const dx = Phaser.Math.Between(-30, 30);
    const peak = Phaser.Math.Between(14, 34);

    scene.tweens.add({
      targets: piece,
      duration: 480,
      alpha: { from: 1, to: 0 },
      onUpdate: (tw: Phaser.Tweens.Tween) => {
        const t = tw.progress;
        piece.x = x + dx * t;
        piece.y = y - 4 * peak * t * (1 - t) + 14 * t; // arc up, then fall
      },
      onComplete: () => piece.destroy(),
    });
  }
}