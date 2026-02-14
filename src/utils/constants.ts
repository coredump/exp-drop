export const GRID_WIDTH = 10; // 5 tiles wide (5 * TILE_SIZE)
export let GRID_HEIGHT = 12; // 6 tiles tall (6 * TILE_SIZE) - configurable
export const SPAWN_BUFFER = 2;
export let TOTAL_HEIGHT = GRID_HEIGHT + SPAWN_BUFFER;

export let CELL_SIZE = 32; // Default, can be updated dynamically
export const TILE_SIZE = 2; // Tile occupies 2x2 grid cells
export const GRID_PADDING = 20;

export function setCellSize(size: number): void {
  CELL_SIZE = size;
}

export function setGridHeight(height: number): void {
  GRID_HEIGHT = height;
  TOTAL_HEIGHT = GRID_HEIGHT + SPAWN_BUFFER;
}

// Ensure spawn position is aligned to TILE_SIZE grid
export const SPAWN_X = Math.floor((GRID_WIDTH - TILE_SIZE) / 2 / TILE_SIZE) * TILE_SIZE;
export const SPAWN_Y = 0;

export const GRAVITY_INTERVAL_MS = 700;
export const SOFT_DROP_INTERVAL_MS = 70;
export const LOCK_DELAY_MS = 100;

// 80s Neon color palette - maximally distinct colors
export const TILE_COLORS: Record<number, number> = {
  1: 0xff00ff, // 2 - hot magenta
  2: 0x00ffff, // 4 - cyan
  3: 0x39ff14, // 8 - neon green
  4: 0xff6600, // 16 - neon orange
  5: 0xffff00, // 32 - yellow
  6: 0xff0066, // 64 - hot pink
  7: 0x00ff99, // 128 - mint
  8: 0x9933ff, // 256 - purple
  9: 0xff3300, // 512 - red-orange
  10: 0x00ccff, // 1024 - sky blue
  11: 0xff99cc, // 2048 - light pink
  12: 0xccff00, // 4096 - lime
  13: 0xff6699, // 8192 - salmon
  14: 0x66ffcc, // 16384 - aqua
  15: 0xffcc00, // 32768 - gold
  16: 0xcc66ff, // 65536 - lavender
};

export const DEFAULT_TILE_COLOR = 0xe0e0ff;

export function formatTileValue(n: number): string {
  if (n >= 1024) {
    return `${Math.floor(n / 1024)}k`;
  }
  return n.toString();
}
