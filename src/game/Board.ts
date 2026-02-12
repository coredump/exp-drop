import { GRID_WIDTH, GRID_HEIGHT, SPAWN_BUFFER, TOTAL_HEIGHT, TILE_SIZE } from '../utils/constants';
import { Tile } from './Tile';

export class Board {
  private grid: (Tile | null)[][];

  constructor() {
    this.grid = [];
    for (let y = 0; y < TOTAL_HEIGHT; y++) {
      this.grid[y] = new Array(GRID_WIDTH).fill(null);
    }
  }

  toGridY(y: number): number {
    return y + SPAWN_BUFFER;
  }

  fromGridY(gridY: number): number {
    return gridY - SPAWN_BUFFER;
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

  isInVisibleBounds(x: number, y: number): boolean {
    return x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT;
  }

  canMove(x: number, y: number): boolean {
    return this.isInBounds(x, y) && !this.isOccupied(x, y);
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

  isTileInBounds(x: number, y: number): boolean {
    return x >= 0 && x + TILE_SIZE <= GRID_WIDTH && 
           this.toGridY(y) >= 0 && this.toGridY(y + TILE_SIZE - 1) < TOTAL_HEIGHT;
  }

  isTileInVisibleBounds(x: number, y: number): boolean {
    return x >= 0 && x + TILE_SIZE <= GRID_WIDTH && 
           y >= 0 && y + TILE_SIZE <= GRID_HEIGHT;
  }

  moveTile(fromX: number, fromY: number, toX: number, toY: number): boolean {
    const tile = this.getTile(fromX, fromY);
    if (!tile) return false;
    if (!this.canMove(toX, toY)) return false;

    this.setTile(fromX, fromY, null);
    tile.setPosition(toX, toY);
    this.setTile(toX, toY, tile);
    return true;
  }

  removeTile(x: number, y: number): Tile | null {
    const tile = this.getTile(x, y);
    if (tile) {
      this.setTile(x, y, null);
    }
    return tile;
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
        if (this.grid[y][x]) {
          tiles.push(this.grid[y][x]!);
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
