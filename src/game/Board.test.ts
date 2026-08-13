import { describe, it, expect, beforeEach } from 'vitest';
import { Board } from './Board';
import { Tile } from './Tile';
import { GRID_WIDTH, GRID_HEIGHT, TILE_SIZE } from '../utils/constants';

describe('Board', () => {
  let board: Board;

  beforeEach(() => {
    board = new Board();
  });

  describe('placeTile()', () => {
    it('should occupy all TILE_SIZE^2 cells with the same reference', () => {
      const tile = new Tile(1, 4, 4);

      expect(board.placeTile(tile)).toBe(true);
      for (let dy = 0; dy < TILE_SIZE; dy++) {
        for (let dx = 0; dx < TILE_SIZE; dx++) {
          expect(board.getTile(4 + dx, 4 + dy)).toBe(tile);
        }
      }
    });

    it('should reject a placement that overlaps an existing tile', () => {
      board.placeTile(new Tile(1, 4, 4));
      const overlapping = new Tile(2, 4, 4);

      expect(board.placeTile(overlapping)).toBe(false);
    });

    it('should reject a partial overlap, leaving the grid unchanged', () => {
      const first = new Tile(1, 4, 4);
      board.placeTile(first);
      // Shares the column range but offset one row up
      const partial = new Tile(2, 4, 3);

      expect(board.placeTile(partial)).toBe(false);
      expect(board.getTile(4, 4)).toBe(first);
      expect(board.getTile(4, 3)).toBeNull();
    });
  });

  describe('canPlaceTile()', () => {
    it('should be true for an empty in-bounds position', () => {
      expect(board.canPlaceTile(4, 4)).toBe(true);
    });

    it('should be false when any of the four cells is occupied', () => {
      board.placeTile(new Tile(1, 4, 4));
      // Overlaps only on its right column
      expect(board.canPlaceTile(3, 4)).toBe(false);
    });

    it('should be false past the right edge', () => {
      expect(board.canPlaceTile(GRID_WIDTH - 1, 4)).toBe(false);
      expect(board.canPlaceTile(GRID_WIDTH - TILE_SIZE, 4)).toBe(true);
    });

    it('should be false past the bottom edge', () => {
      expect(board.canPlaceTile(4, GRID_HEIGHT - 1)).toBe(false);
      expect(board.canPlaceTile(4, GRID_HEIGHT - TILE_SIZE)).toBe(true);
    });
  });

  describe('getTile() bounds handling', () => {
    it('should return null out of bounds instead of throwing', () => {
      expect(board.getTile(-1, 4)).toBeNull();
      expect(board.getTile(GRID_WIDTH, 4)).toBeNull();
      expect(board.getTile(4, GRID_HEIGHT + 100)).toBeNull();
    });

    it('should allow reads inside the spawn buffer above the visible area', () => {
      // Negative y is inside the buffer, so it is addressable, just empty
      expect(board.isInBounds(4, -1)).toBe(true);
      expect(board.getTile(4, -1)).toBeNull();
    });
  });

  describe('removeTileFromGrid()', () => {
    it('should clear every cell the tile occupied', () => {
      const tile = new Tile(1, 4, 4);
      board.placeTile(tile);

      board.removeTileFromGrid(tile);

      expect(board.getAllTiles()).toEqual([]);
      expect(board.canPlaceTile(4, 4)).toBe(true);
    });

    it('should leave other tiles alone', () => {
      const keep = new Tile(1, 2, 4);
      const drop = new Tile(1, 4, 4);
      board.placeTile(keep);
      board.placeTile(drop);

      board.removeTileFromGrid(drop);

      expect(new Set(board.getAllTiles())).toEqual(new Set([keep]));
    });
  });

  describe('getAllTiles()', () => {
    it('should yield one entry per occupied cell, not per tile', () => {
      const tile = new Tile(1, 4, 4);
      board.placeTile(tile);

      // Documents the leaky contract callers must dedupe against
      expect(board.getAllTiles()).toHaveLength(TILE_SIZE * TILE_SIZE);
      expect(new Set(board.getAllTiles()).size).toBe(1);
    });
  });

  describe('clear()', () => {
    it('should empty the grid', () => {
      board.placeTile(new Tile(1, 4, 4));
      board.placeTile(new Tile(2, 6, 8));

      board.clear();

      expect(board.getAllTiles()).toEqual([]);
    });
  });
});
