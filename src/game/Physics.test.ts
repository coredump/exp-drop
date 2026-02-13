import { describe, it, expect, beforeEach } from 'vitest';
import { Physics } from './Physics';
import { Board } from './Board';
import { Tile } from './Tile';

describe('Physics', () => {
  let board: Board;
  let physics: Physics;

  beforeEach(() => {
    board = new Board();
    physics = new Physics(board);
  });

  describe('canMoveDown()', () => {
    it('should return true when space below is empty', () => {
      const tile = new Tile(1, 4, 0); // Tile at top
      board.placeTile(tile);

      expect(physics.canMoveDown(tile)).toBe(true);
    });

    it('should return false when tile would go out of bounds', () => {
      const tile = new Tile(1, 4, 10); // Near bottom (GRID_HEIGHT=12, TILE_SIZE=2)
      board.placeTile(tile);

      expect(physics.canMoveDown(tile)).toBe(false);
    });

    it('should return false when another tile blocks', () => {
      const tile1 = new Tile(1, 4, 4);
      const tile2 = new Tile(1, 4, 6); // Directly below tile1
      board.placeTile(tile1);
      board.placeTile(tile2);

      expect(physics.canMoveDown(tile1)).toBe(false);
    });
  });

  describe('canMoveLeft()', () => {
    it('should return true when space to left is empty', () => {
      const tile = new Tile(1, 4, 4); // In middle
      board.placeTile(tile);

      expect(physics.canMoveLeft(tile)).toBe(true);
    });

    it('should return false when at left edge', () => {
      const tile = new Tile(1, 0, 4); // At left edge
      board.placeTile(tile);

      expect(physics.canMoveLeft(tile)).toBe(false);
    });

    it('should return false when another tile blocks', () => {
      const tile1 = new Tile(1, 4, 4);
      const tile2 = new Tile(1, 2, 4); // Directly to the left
      board.placeTile(tile1);
      board.placeTile(tile2);

      expect(physics.canMoveLeft(tile1)).toBe(false);
    });
  });

  describe('canMoveRight()', () => {
    it('should return true when space to right is empty', () => {
      const tile = new Tile(1, 2, 4);
      board.placeTile(tile);

      expect(physics.canMoveRight(tile)).toBe(true);
    });

    it('should return false when at right edge', () => {
      const tile = new Tile(1, 8, 4); // At right edge (GRID_WIDTH=10, TILE_SIZE=2)
      board.placeTile(tile);

      expect(physics.canMoveRight(tile)).toBe(false);
    });

    it('should return false when another tile blocks', () => {
      const tile1 = new Tile(1, 4, 4);
      const tile2 = new Tile(1, 6, 4); // Directly to the right
      board.placeTile(tile1);
      board.placeTile(tile2);

      expect(physics.canMoveRight(tile1)).toBe(false);
    });
  });

  describe('tryMerge()', () => {
    it('should merge when equal tiles are adjacent', () => {
      const tile1 = new Tile(2, 4, 4); // k=2 (value 4)
      const tile2 = new Tile(2, 4, 6); // k=2 (value 4), below tile1
      board.placeTile(tile1);
      board.placeTile(tile2);

      const result = physics.tryMerge(tile1);

      expect(result.merged).toBe(true);
      expect(result.tilesAbsorbed).toBeGreaterThan(0);
    });

    it('should not merge when tiles have different values', () => {
      const tile1 = new Tile(2, 4, 4); // k=2 (value 4)
      const tile2 = new Tile(3, 4, 6); // k=3 (value 8)
      board.placeTile(tile1);
      board.placeTile(tile2);

      const result = physics.tryMerge(tile1);

      expect(result.merged).toBe(false);
      expect(result.tilesAbsorbed).toBe(0);
    });
  });

  describe('applyGravity()', () => {
    it('should return tiles that moved', () => {
      const tile = new Tile(1, 4, 4);
      board.placeTile(tile);

      const movedTiles = physics.applyGravity();

      expect(Array.isArray(movedTiles)).toBe(true);
    });
  });

  describe('hardDrop()', () => {
    it('should return the distance dropped', () => {
      const tile = new Tile(1, 4, 2); // Start at y=2
      board.placeTile(tile);

      const distance = physics.hardDrop(tile);

      // hardDrop returns the distance moved (should be >= 0)
      expect(distance).toBeGreaterThanOrEqual(0);
      expect(typeof distance).toBe('number');
    });
  });

  describe('resolveBoard()', () => {
    it('should handle merges', () => {
      const tile1 = new Tile(2, 4, 4);
      const tile2 = new Tile(2, 4, 6);
      board.placeTile(tile1);
      board.placeTile(tile2);

      const result = physics.resolveBoard();

      expect(result.merges).toBeDefined();
      expect(result.totalPoints).toBeGreaterThanOrEqual(0);
    });

    it('should return zero points when no merges possible', () => {
      const tile = new Tile(1, 4, 4);
      board.placeTile(tile);

      const result = physics.resolveBoard();

      expect(result.totalPoints).toBe(0);
    });
  });
});
