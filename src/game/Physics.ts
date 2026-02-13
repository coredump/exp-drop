import { Board } from './Board';
import { Tile } from './Tile';
import { GRID_WIDTH, TILE_SIZE } from '../utils/constants';

export interface RemovedTileInfo {
  tile: Tile;
  fromX: number;
  fromY: number;
}

export interface MergeResult {
  merged: boolean;
  removedTiles: RemovedTileInfo[];
  upgradedTile: Tile | null;
  basePoints: number;
  tilesAbsorbed: number;
}

export interface ResolutionResult {
  merges: MergeResult[];
  totalPoints: number;
}

export class Physics {
  private board: Board;

  constructor(board: Board) {
    this.board = board;
  }

  canMoveDown(tile: Tile): boolean {
    const newY = tile.y + TILE_SIZE;
    for (let dx = 0; dx < TILE_SIZE; dx++) {
      for (let dy = 0; dy < TILE_SIZE; dy++) {
        const checkY = newY + dy;
        if (!this.board.isInBounds(tile.x + dx, checkY)) return false;
        const occupant = this.board.getTile(tile.x + dx, checkY);
        if (occupant && occupant !== tile) return false;
      }
    }
    return true;
  }

  canMoveLeft(tile: Tile): boolean {
    const newX = tile.x - TILE_SIZE;
    if (newX < 0) return false;
    for (let dy = 0; dy < TILE_SIZE; dy++) {
      for (let dx = 0; dx < TILE_SIZE; dx++) {
        const occupant = this.board.getTile(newX + dx, tile.y + dy);
        if (occupant && occupant !== tile) return false;
      }
    }
    return true;
  }

  canMoveRight(tile: Tile): boolean {
    const newX = tile.x + TILE_SIZE;
    if (newX + TILE_SIZE > GRID_WIDTH) return false;
    for (let dy = 0; dy < TILE_SIZE; dy++) {
      for (let dx = 0; dx < TILE_SIZE; dx++) {
        const occupant = this.board.getTile(newX + dx, tile.y + dy);
        if (occupant && occupant !== tile) return false;
      }
    }
    return true;
  }

  getNeighbors(tile: Tile): {
    down: Tile | null;
    left: Tile | null;
    right: Tile | null;
    up: Tile | null;
  } {
    let down: Tile | null = null;
    let left: Tile | null = null;
    let right: Tile | null = null;
    let up: Tile | null = null;

    // Check down (row below the tile's bottom edge)
    for (let dx = 0; dx < TILE_SIZE && !down; dx++) {
      const neighbor = this.board.getTile(tile.x + dx, tile.y + TILE_SIZE);
      if (neighbor && neighbor !== tile) down = neighbor;
    }

    // Check left (column to the left of tile's left edge)
    for (let dy = 0; dy < TILE_SIZE && !left; dy++) {
      const neighbor = this.board.getTile(tile.x - TILE_SIZE, tile.y + dy);
      if (neighbor && neighbor !== tile) left = neighbor;
    }

    // Check right (column to the right of tile's right edge)
    for (let dy = 0; dy < TILE_SIZE && !right; dy++) {
      const neighbor = this.board.getTile(tile.x + TILE_SIZE, tile.y + dy);
      if (neighbor && neighbor !== tile) right = neighbor;
    }

    // Check up (row above the tile's top edge)
    for (let dx = 0; dx < TILE_SIZE && !up; dx++) {
      const neighbor = this.board.getTile(tile.x + dx, tile.y - TILE_SIZE);
      if (neighbor && neighbor !== tile) up = neighbor;
    }

    return { down, left, right, up };
  }

  tryMerge(tileA: Tile): MergeResult {
    const neighbors = this.getNeighbors(tileA);

    // Find ALL neighbors with the same value
    const matchingNeighbors: Tile[] = [];
    const allNeighbors = [neighbors.down, neighbors.left, neighbors.right, neighbors.up];

    for (const neighbor of allNeighbors) {
      if (tileA.k === neighbor?.k) {
        matchingNeighbors.push(neighbor);
      }
    }

    if (matchingNeighbors.length === 0) {
      return {
        merged: false,
        removedTiles: [],
        upgradedTile: null,
        basePoints: 0,
        tilesAbsorbed: 0,
      };
    }

    // Store positions before removing
    const removedTilesInfo: RemovedTileInfo[] = matchingNeighbors.map((t) => ({
      tile: t,
      fromX: t.x,
      fromY: t.y,
    }));

    // Pull all matching neighbors into tileA
    // Each neighbor adds +1 to the exponent (one level up per merge)
    const newK = tileA.k + matchingNeighbors.length;
    const basePoints = Math.pow(2, newK);

    // Remove all matching neighbors from grid
    for (const neighbor of matchingNeighbors) {
      this.board.removeTileFromGrid(neighbor);
    }

    // Update tileA's exponent but DON'T render yet - visual update happens after animation
    tileA.setExponentWithoutRender(newK);

    return {
      merged: true,
      removedTiles: removedTilesInfo,
      upgradedTile: tileA,
      basePoints,
      tilesAbsorbed: matchingNeighbors.length,
    };
  }

  applyGravity(): Tile[] {
    const movedTiles: Tile[] = [];
    let moved = true;

    // Keep applying gravity until nothing moves
    while (moved) {
      moved = false;

      // Get all unique tiles, sorted by Y position (bottom first)
      const tiles = this.board.getAllTiles();
      const uniqueTiles = [...new Set(tiles)].sort((a, b) => b.y - a.y);

      for (const tile of uniqueTiles) {
        // Check if this tile can fall by TILE_SIZE
        if (this.canTileFallTo(tile, tile.y + TILE_SIZE)) {
          this.board.removeTileFromGrid(tile);
          tile.setPosition(tile.x, tile.y + TILE_SIZE);
          this.board.placeTile(tile);
          movedTiles.push(tile);
          moved = true;
        }
      }
    }

    return movedTiles;
  }

  private canTileFallTo(tile: Tile, newY: number): boolean {
    for (let dx = 0; dx < TILE_SIZE; dx++) {
      for (let dy = 0; dy < TILE_SIZE; dy++) {
        const checkY = newY + dy;
        if (!this.board.isInBounds(tile.x + dx, checkY)) return false;
        const occupant = this.board.getTile(tile.x + dx, checkY);
        if (occupant && occupant !== tile) return false;
      }
    }
    return true;
  }

  tryMergeForTile(tile: Tile): MergeResult {
    return this.tryMerge(tile);
  }

  canTileFall(tile: Tile): boolean {
    const newY = tile.y + TILE_SIZE;
    for (let dx = 0; dx < TILE_SIZE; dx++) {
      for (let dy = 0; dy < TILE_SIZE; dy++) {
        const checkY = newY + dy;
        if (!this.board.isInBounds(tile.x + dx, checkY)) return false;
        const occupant = this.board.getTile(tile.x + dx, checkY);
        if (occupant && occupant !== tile) return false;
      }
    }
    return true;
  }

  doMergePass(): ResolutionResult {
    const allMerges: MergeResult[] = [];
    let totalPoints = 0;

    // Single merge pass (top-to-bottom, left-to-right)
    const tiles = this.getTilesSortedForMerge();
    for (const tile of tiles) {
      // Verify tile still exists at its position
      if (this.board.getTile(tile.x, tile.y) !== tile) continue;

      const result = this.tryMerge(tile);
      if (result.merged) {
        allMerges.push(result);
        totalPoints += result.basePoints;
      }
    }

    return { merges: allMerges, totalPoints };
  }

  resolveBoard(): ResolutionResult {
    const allMerges: MergeResult[] = [];
    let totalPoints = 0;
    let stable = false;

    while (!stable) {
      stable = true;

      // Phase A: Merge pass FIRST (top-to-bottom, left-to-right)
      const mergeResult = this.doMergePass();
      if (mergeResult.merges.length > 0) {
        allMerges.push(...mergeResult.merges);
        totalPoints += mergeResult.totalPoints;
        stable = false;
      }

      // Phase B: Gravity pass AFTER merges
      const movedTiles = this.applyGravity();
      if (movedTiles.length > 0) {
        stable = false;
      }
    }

    return { merges: allMerges, totalPoints };
  }

  private getTilesSortedForMerge(): Tile[] {
    // Get unique tiles, sorted top-to-bottom, left-to-right
    // This ensures newly placed tiles (often above) evaluate first and absorb neighbors
    const tiles = this.board.getAllTiles();
    const uniqueTiles = [...new Set(tiles)];
    return uniqueTiles.sort((a, b) => {
      // Top-to-bottom: lower y first
      if (a.y !== b.y) return a.y - b.y;
      // Left-to-right: lower x first
      return a.x - b.x;
    });
  }

  hardDrop(tile: Tile): number {
    let distance = 0;
    while (this.board.canMove(tile.x, tile.y + 1)) {
      this.board.moveTile(tile.x, tile.y, tile.x, tile.y + 1);
      distance++;
    }
    return distance;
  }
}
