/** Progress that carries across stages: score, coins, lives. */
export class RunState {
  score = 0;
  coins = 0;

  constructor(public lives = 3) {}
}