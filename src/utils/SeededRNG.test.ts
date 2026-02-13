import { describe, it, expect } from 'vitest';
import { SeededRNG } from './SeededRNG';

describe('SeededRNG', () => {
  describe('deterministic output', () => {
    it('should produce same sequence with same seed', () => {
      const rng1 = new SeededRNG(12345);
      const rng2 = new SeededRNG(12345);

      const sequence1 = [rng1.next(), rng1.next(), rng1.next()];
      const sequence2 = [rng2.next(), rng2.next(), rng2.next()];

      expect(sequence1).toEqual(sequence2);
    });

    it('should produce different sequences with different seeds', () => {
      const rng1 = new SeededRNG(12345);
      const rng2 = new SeededRNG(54321);

      const val1 = rng1.next();
      const val2 = rng2.next();

      expect(val1).not.toEqual(val2);
    });
  });

  describe('next()', () => {
    it('should return values between 0 and 1', () => {
      const rng = new SeededRNG(42);

      for (let i = 0; i < 100; i++) {
        const value = rng.next();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it('should produce different values on successive calls', () => {
      const rng = new SeededRNG(777);
      const values = new Set<number>();

      for (let i = 0; i < 20; i++) {
        values.add(rng.next());
      }

      // At least 15 unique values out of 20 (allowing for rare collisions)
      expect(values.size).toBeGreaterThan(15);
    });
  });

  describe('nextInt()', () => {
    it('should return integers within specified range', () => {
      const rng = new SeededRNG(999);

      for (let i = 0; i < 100; i++) {
        const value = rng.nextInt(5, 10);
        expect(value).toBeGreaterThanOrEqual(5);
        expect(value).toBeLessThanOrEqual(10);
        expect(Number.isInteger(value)).toBe(true);
      }
    });

    it('should return min when min equals max', () => {
      const rng = new SeededRNG(123);
      const value = rng.nextInt(7, 7);
      expect(value).toBe(7);
    });

    it('should cover full range over many samples', () => {
      const rng = new SeededRNG(456);
      const values = new Set<number>();

      for (let i = 0; i < 200; i++) {
        values.add(rng.nextInt(1, 5));
      }

      // Should hit all values 1-5 over 200 samples
      expect(values.size).toBe(5);
      expect(values.has(1)).toBe(true);
      expect(values.has(5)).toBe(true);
    });
  });

  describe('setSeed()', () => {
    it('should reset sequence to match new seed', () => {
      const rng = new SeededRNG(100);
      rng.next(); // Advance state
      rng.next();

      rng.setSeed(200);
      const value1 = rng.next();

      const rng2 = new SeededRNG(200);
      const value2 = rng2.next();

      expect(value1).toEqual(value2);
    });
  });
});
