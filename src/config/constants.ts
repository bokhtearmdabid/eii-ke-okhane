export const GAME_TITLE = 'Eii Ke Okhane';

// Internal render resolution (16:9). Phaser scales it up with nearest-neighbour filtering.
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 270;

// Walkable street band (y range for fighters' feet). Used from Step 2 onward.
export const LANE_TOP = 165;
export const LANE_BOTTOM = 252;

export const SCENE_KEYS = {
  Boot: 'BootScene',
  Preload: 'PreloadScene',
  Menu: 'MenuScene',
  Game: 'GameScene',
} as const;

export const COLORS = {
  bg: 0x05040d,
  night: 0x120a2a,
  street: 0x2a2340,
  neonPink: 0xff4f8b,
  neonCyan: 0x38e8ff,
  neonAmber: 0xffc857,
} as const;

export const FONT = 'monospace';