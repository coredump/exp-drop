import { describe, it, expect, beforeEach } from 'vitest';
import { Spawner, SpawnerConfig } from './Spawner';

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

  describe('spawnLag', () => {
    const lagConfig = (spawnLag: number): SpawnerConfig => ({
      spawnWeights: { base2: 45, base4: 40, tierMultiplier: 0.5, minWeight: 5 },
      tierWindowSize: 18,
      spawnLag,
    });

    it('should default to lag 1 (spawn up to one below max)', () => {
      const s = new Spawner(42);
      s.updateMaxTile(4);

      const spawns = new Set<number>();
      for (let i = 0; i < 300; i++) spawns.add(s.getNextExponent());

      expect(spawns.has(3)).toBe(true);
      expect(spawns.has(4)).toBe(false);
    });

    it('should keep the top spawnLag tiers unspawnable', () => {
      const s = new Spawner(42, lagConfig(3));
      s.updateMaxTile(6); // best tile 64: with lag 3, only up to k=3 may spawn

      const spawns = new Set<number>();
      for (let i = 0; i < 500; i++) spawns.add(s.getNextExponent());

      expect(spawns.has(3)).toBe(true);
      expect(spawns.has(4)).toBe(false);
      expect(spawns.has(5)).toBe(false);
      expect(spawns.has(6)).toBe(false);
    });

    it('should spawn only base tiles until max clears the lag', () => {
      const s = new Spawner(42, lagConfig(3));
      s.updateMaxTile(4); // 4 - 3 = 1: no tier past the base pair unlocks

      const spawns = new Set<number>();
      for (let i = 0; i < 300; i++) spawns.add(s.getNextExponent());

      expect([...spawns].sort()).toEqual([1, 2]);
    });
  });

  describe('initialMaxSpawnTier', () => {
    const cfg = (initialMaxSpawnTier: number): SpawnerConfig => ({
      spawnWeights: { base2: 55, base4: 45, tierMultiplier: 0.35, minWeight: 1 },
      tierWindowSize: 18,
      spawnLag: 3,
      initialMaxSpawnTier,
    });

    it('should default to base tiles only (2s and 4s)', () => {
      const s = new Spawner(42);
      const spawns = new Set<number>();
      for (let i = 0; i < 500; i++) spawns.add(s.getNextExponent());
      expect([...spawns].sort()).toEqual([1, 2]);
    });

    it('should offer mid tiers from the very first spawn, capped at the tier', () => {
      const s = new Spawner(42, cfg(5));
      const spawns = new Set<number>();
      for (let i = 0; i < 3000; i++) spawns.add(s.getNextExponent());
      expect(spawns.has(3)).toBe(true); // 8
      expect(spawns.has(4)).toBe(true); // 16
      expect(spawns.has(5)).toBe(true); // 32
      expect(spawns.has(6)).toBe(false); // 64 stays locked
    });

    it('should keep the initial mid tiers rare', () => {
      const s = new Spawner(42, cfg(5));
      let high = 0;
      const n = 3000;
      for (let i = 0; i < n; i++) if (s.getNextExponent() >= 4) high++;
      // 16s + 32s together ~6% by ladder weights; allow slack for the
      // anti-streak redistribution
      expect(high / n).toBeLessThan(0.12);
    });

    it('should act as a floor: created tiers still extend the pool past it', () => {
      const s = new Spawner(42, cfg(5));
      s.updateMaxTile(9); // created 512: cap = max(5, 9-3) = 6
      const spawns = new Set<number>();
      for (let i = 0; i < 5000; i++) spawns.add(s.getNextExponent());
      expect(spawns.has(6)).toBe(true); // 64 now spawnable
      expect(spawns.has(7)).toBe(false); // 128 still merge-only
    });
  });

  describe('anti-streak', () => {
    it('should never spawn the same value three times in a row', () => {
      for (const seed of [1, 42, 7919, 123456]) {
        const s = new Spawner(seed);
        s.updateMaxTile(6); // widen the pool a bit
        let last = 0;
        let run = 0;
        for (let i = 0; i < 1000; i++) {
          const k = s.getNextExponent();
          run = k === last ? run + 1 : 1;
          last = k;
          expect(run).toBeLessThanOrEqual(2);
        }
      }
    });

    it('should keep both base tiles well represented', () => {
      const s = new Spawner(42);
      const counts = new Map<number, number>();
      for (let i = 0; i < 1000; i++) {
        const k = s.getNextExponent();
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      // 45/40 base weights with a run cap of 2 - both should stay near half
      expect((counts.get(1) ?? 0) / 1000).toBeGreaterThan(0.35);
      expect((counts.get(2) ?? 0) / 1000).toBeGreaterThan(0.35);
    });

    it('should keep preview consistent with the actual draw', () => {
      const s = new Spawner(42);
      // Exercise across enough draws to cross run-cap boundaries, where a
      // preview that advanced run tracking would diverge from the real draw.
      for (let i = 0; i < 200; i++) {
        const previewed = s.previewNextExponent();
        const secondPreview = s.previewNextExponent();
        expect(secondPreview).toBe(previewed); // peeking is idempotent
        expect(s.getNextExponent()).toBe(previewed);
      }
    });

    it('should reset the run tracking on resetUnlocks()', () => {
      const s = new Spawner(42);
      s.getNextExponent();
      s.getNextExponent();
      s.resetUnlocks();
      // No third-in-a-row constraint should carry across a restart; we just
      // assert it still draws from the base pool without throwing.
      expect([1, 2]).toContain(s.getNextExponent());
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
