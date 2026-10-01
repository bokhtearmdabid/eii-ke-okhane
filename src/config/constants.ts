export const GAME_TITLE = 'Eii Ke Okhane';

// Internal resolution (16:9)
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 270;

// Where the street starts (everything above is background/shopfronts).
export const STREET_TOP = 145;

// Walkable band: y range for fighters' feet.
export const LANE_TOP = 165;
export const LANE_BOTTOM = 252;

// Test stage 
export const WORLD_WIDTH = 1600;

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

export const FRAME_RATE = 60; 
export const FRAME_MS = 1000 / FRAME_RATE;
export const INPUT_BUFFER_FRAMES = 10; 

export const FONT = 'monospace';