import { describe, it, expect, beforeEach } from 'vitest';
import { Spawner } from './Spawner';

describe('Spawner', () => {
  let spawner: Spawner;

  beforeEach(() => {
    spawner = new Spawner(12345); // Fixed seed for deterministic tests
  });

  describe('initial state', () => {
    it('should only spawn k=1 (2) or k=2 (4) initially', () => {
      const spawns = new Set<number>();

      for (let i = 0; i < 100; i++) {
        const k = spawner.getNextExponent();
        spawns.add(k);
      }

      expect(spawns.size).toBeLessThanOrEqual(2);
      expect(spawns.has(1)).toBe(true);
      expect(spawns.has(2)).toBe(true);
    });

    it('should spawn more 2s than 4s (45% vs 40%)', () => {
      let count2 = 0;
      let count4 = 0;

      for (let i = 0; i < 1000; i++) {
        const k = spawner.getNextExponent();
        if (k === 1) count2++;
        if (k === 2) count4++;
      }

      // With 1000 samples, expect roughly 45% 2s and 40% 4s
      expect(count2).toBeGreaterThan(count4);
      expect(count2).toBeGreaterThan(400); // At least 40%
      expect(count4).toBeGreaterThan(350); // At least 35%
    });
  });

  describe('unlock progression', () => {
    it('should unlock k=3 (8) when maxK is updated to 4', () => {
      spawner.updateMaxTile(4); // Unlock 8s (one below max)

      const spawns = new Set<number>();
      for (let i = 0; i < 200; i++) {
        spawns.add(spawner.getNextExponent());
      }

      expect(spawns.has(3)).toBe(true);
    });

    it('should not unlock tiles at or above current max', () => {
      spawner.updateMaxTile(4); // Max tile is 16, should unlock up to 8

      const spawns = new Set<number>();
      for (let i = 0; i < 200; i++) {
        spawns.add(spawner.getNextExponent());
      }

      expect(spawns.has(4)).toBe(false); // Should not spawn 16s
      expect(spawns.has(5)).toBe(false); // Should not spawn 32s
    });

    it('should not decrease maxUnlockedK when given lower value', () => {
      spawner.updateMaxTile(5); // Unlock up to k=4
      const spawnsBefore = new Set<number>();
      for (let i = 0; i < 100; i++) {
        spawnsBefore.add(spawner.getNextExponent());
      }

      spawner.updateMaxTile(3); // Try to go backwards
      const spawnsAfter = new Set<number>();
      for (let i = 0; i < 100; i++) {
        spawnsAfter.add(spawner.getNextExponent());
      }

      // Should still have access to higher tiers
      expect(spawnsAfter).toEqual(spawnsBefore);
    });
  });

  describe('resetUnlocks()', () => {
    it('should reset to base state (only 2s and 4s)', () => {
      spawner.updateMaxTile(6); // Unlock higher tiers
      spawner.resetUnlocks();

      const spawns = new Set<number>();
      for (let i = 0; i < 100; i++) {
        spawns.add(spawner.getNextExponent());
      }

      expect(spawns.size).toBeLessThanOrEqual(2);
      expect(spawns.has(1)).toBe(true);
      expect(spawns.has(2)).toBe(true);
    });
  });

  describe('setSeed()', () => {
    it('should produce same sequence after setting same seed', () => {
      spawner.setSeed(99999);
      const sequence1 = [
        spawner.getNextExponent(),
        spawner.getNextExponent(),
        spawner.getNextExponent(),
      ];

      spawner.setSeed(99999);
      const sequence2 = [
        spawner.getNextExponent(),
        spawner.getNextExponent(),
        spawner.getNextExponent(),
      ];

      expect(sequence1).toEqual(sequence2);
    });
  });

  describe('createTile()', () => {
    it('should create tile at specified position with random exponent', () => {
      const tile = spawner.createTile(4, 0);

      expect(tile.x).toBe(4);
      expect(tile.y).toBe(0);
      expect(tile.k).toBeGreaterThanOrEqual(1);
      expect(tile.k).toBeLessThanOrEqual(2); // Initially only 1 or 2
    });
  });

  describe('previewNextExponent()', () => {
    it('should return next exponent without advancing RNG state', () => {
      const preview = spawner.previewNextExponent();
      const actual = spawner.getNextExponent();

      expect(preview).toBe(actual);
    });

    it('should not affect subsequent spawns', () => {
      spawner.previewNextExponent();
      spawner.previewNextExponent();

      const sequence = [spawner.getNextExponent(), spawner.getNextExponent()];

      spawner.setSeed(12345); // Reset to same seed
      const sequenceWithoutPreview = [spawner.getNextExponent(), spawner.getNextExponent()];

      expect(sequence).toEqual(sequenceWithoutPreview);
    });
  });

  describe('getUnlockedTiers()', () => {
    it('should return only base tiers initially', () => {
      const tiers = spawner.getUnlockedTiers();

      expect(tiers.length).toBe(2);
      expect(tiers[0].k).toBe(1);
      expect(tiers[1].k).toBe(2);
    });

    it('should return additional tiers after unlocking', () => {
      spawner.updateMaxTile(5); // Unlock up to k=4

      const tiers = spawner.getUnlockedTiers();

      expect(tiers.length).toBeGreaterThan(2);
      expect(tiers.some((t) => t.k === 3)).toBe(true);
      expect(tiers.some((t) => t.k === 4)).toBe(true);
    });
  });
});
