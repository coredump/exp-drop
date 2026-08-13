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

  describe('tryMerge() multi-neighbour', () => {
    it('should absorb ALL matching neighbours at once (k + n)', () => {
      // Centre tile with three equal neighbours: left, right, below
      const centre = new Tile(3, 4, 4);
      const left = new Tile(3, 2, 4);
      const right = new Tile(3, 6, 4);
      const below = new Tile(3, 4, 6);
      [centre, left, right, below].forEach((t) => board.placeTile(t));

      const result = physics.tryMerge(centre);

      expect(result.merged).toBe(true);
      expect(result.tilesAbsorbed).toBe(3);
      expect(result.upgradedTile).toBe(centre);
      expect(centre.k).toBe(6); // 3 + 3 absorbed
      expect(result.basePoints).toBe(2 ** 6);
      expect(result.removedTiles.map((r) => r.tile)).toEqual(
        expect.arrayContaining([left, right, below])
      );
      // Absorbed tiles are gone from the grid
      expect(board.getTile(2, 4)).toBeNull();
      expect(board.getTile(6, 4)).toBeNull();
      expect(board.getTile(4, 6)).toBeNull();
    });

    it('should ignore non-matching neighbours while absorbing matching ones', () => {
      const centre = new Tile(2, 4, 4);
      const matching = new Tile(2, 2, 4);
      const different = new Tile(5, 6, 4);
      [centre, matching, different].forEach((t) => board.placeTile(t));

      const result = physics.tryMerge(centre);

      expect(result.tilesAbsorbed).toBe(1);
      expect(centre.k).toBe(3);
      expect(board.getTile(6, 4)).toBe(different); // untouched
    });

    it('should not merge diagonally adjacent equal tiles', () => {
      const centre = new Tile(2, 4, 4);
      const diagonal = new Tile(2, 6, 6);
      board.placeTile(centre);
      board.placeTile(diagonal);

      expect(physics.tryMerge(centre).merged).toBe(false);
    });
  });

  describe('applyGravity()', () => {
    it('should drop a floating tile to the floor and report it once', () => {
      const tile = new Tile(1, 4, 4); // floating well above the floor
      board.placeTile(tile);

      const movedTiles = physics.applyGravity();

      // GRID_HEIGHT=12, TILE_SIZE=2 -> lowest resting y is 10
      expect(tile.y).toBe(10);
      expect(board.getTile(4, 10)).toBe(tile);
      expect(board.getTile(4, 4)).toBeNull();
      // Deduplicated: one entry despite falling three rows
      expect(movedTiles).toEqual([tile]);
    });

    it('should stack tiles without overlapping', () => {
      const lower = new Tile(1, 4, 6);
      const upper = new Tile(2, 4, 2);
      board.placeTile(lower);
      board.placeTile(upper);

      physics.applyGravity();

      expect(lower.y).toBe(10);
      expect(upper.y).toBe(8); // resting directly on top of `lower`
    });

    it('should report nothing when every tile is already settled', () => {
      const tile = new Tile(1, 4, 10);
      board.placeTile(tile);

      expect(physics.applyGravity()).toEqual([]);
    });
  });

  describe('resolveBoard()', () => {
    it('should merge, award 2^newK, and settle the result on the floor', () => {
      const tile1 = new Tile(2, 4, 4);
      const tile2 = new Tile(2, 4, 6);
      board.placeTile(tile1);
      board.placeTile(tile2);

      const result = physics.resolveBoard();

      expect(result.merges).toHaveLength(1);
      expect(result.merges[0].tilesAbsorbed).toBe(1);
      expect(result.totalPoints).toBe(2 ** 3); // k=2 + 1 absorbed -> k=3
      // Survivor fell to the floor after the merge
      expect(tile1.k).toBe(3);
      expect(tile1.y).toBe(10);
    });

    it('should cascade: a merge result that merges again', () => {
      // Two 4s stack into an 8, which lands beside an existing 8 -> 16
      const a = new Tile(2, 4, 4);
      const b = new Tile(2, 4, 6);
      const existing8 = new Tile(3, 6, 10);
      [a, b, existing8].forEach((t) => board.placeTile(t));

      const result = physics.resolveBoard();

      expect(result.merges.length).toBeGreaterThanOrEqual(2);
      // Final survivor is a 16 (k=4)
      const survivors = [...new Set(board.getAllTiles())];
      expect(survivors).toHaveLength(1);
      expect(survivors[0].k).toBe(4);
      expect(result.totalPoints).toBe(2 ** 3 + 2 ** 4);
    });

    it('should return zero points when no merges possible', () => {
      const tile = new Tile(1, 4, 4);
      board.placeTile(tile);

      const result = physics.resolveBoard();

      expect(result.totalPoints).toBe(0);
      expect(result.merges).toEqual([]);
    });
  });
});
