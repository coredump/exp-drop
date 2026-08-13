import { GRID_WIDTH, SPAWN_BUFFER, TOTAL_HEIGHT, TILE_SIZE } from '../utils/constants';
import { Tile } from './Tile';

export class Board {
  private grid: (Tile | null)[][];

  constructor() {
    this.grid = [];
    for (let y = 0; y < TOTAL_HEIGHT; y++) {
      this.grid[y] = new Array<Tile | null>(GRID_WIDTH).fill(null);
    }
  }

  toGridY(y: number): number {
    return y + SPAWN_BUFFER;
  }

  getTile(x: number, y: number): Tile | null {
    const gridY = this.toGridY(y);
    if (x < 0 || x >= GRID_WIDTH || gridY < 0 || gridY >= TOTAL_HEIGHT) {
      return null;
    }
    return this.grid[gridY][x];
  }

  setTile(x: number, y: number, tile: Tile | null): void {
    const gridY = this.toGridY(y);
    if (x >= 0 && x < GRID_WIDTH && gridY >= 0 && gridY < TOTAL_HEIGHT) {
      this.grid[gridY][x] = tile;
    }
  }

  isOccupied(x: number, y: number): boolean {
    return this.getTile(x, y) !== null;
  }

  isInBounds(x: number, y: number): boolean {
    const gridY = this.toGridY(y);
    return x >= 0 && x < GRID_WIDTH && gridY >= 0 && gridY < TOTAL_HEIGHT;
  }

  canPlaceTile(x: number, y: number): boolean {
    for (let dy = 0; dy < TILE_SIZE; dy++) {
      for (let dx = 0; dx < TILE_SIZE; dx++) {
        if (!this.isInBounds(x + dx, y + dy) || this.isOccupied(x + dx, y + dy)) {
          return false;
        }
      }
    }
    return true;
  }

  placeTile(tile: Tile): boolean {
    for (let dy = 0; dy < TILE_SIZE; dy++) {
      for (let dx = 0; dx < TILE_SIZE; dx++) {
        if (this.isOccupied(tile.x + dx, tile.y + dy)) {
          return false;
        }
      }
    }
    for (let dy = 0; dy < TILE_SIZE; dy++) {
      for (let dx = 0; dx < TILE_SIZE; dx++) {
        this.setTile(tile.x + dx, tile.y + dy, tile);
      }
    }
    return true;
  }

  removeTileFromGrid(tile: Tile): void {
    for (let dy = 0; dy < TILE_SIZE; dy++) {
      for (let dx = 0; dx < TILE_SIZE; dx++) {
        if (this.getTile(tile.x + dx, tile.y + dy) === tile) {
          this.setTile(tile.x + dx, tile.y + dy, null);
        }
      }
    }
  }

  getAllTiles(): Tile[] {
    const tiles: Tile[] = [];
    for (let y = 0; y < TOTAL_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const tile = this.grid[y][x];
        if (tile !== null) {
          tiles.push(tile);
        }
      }
    }
    return tiles;
  }

  clear(): void {
    for (let y = 0; y < TOTAL_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const tile = this.grid[y][x];
        if (tile) {
          tile.destroy();
        }
        this.grid[y][x] = null;
      }
    }
  }
}
