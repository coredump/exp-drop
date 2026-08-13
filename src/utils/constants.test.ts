import { describe, it, expect } from 'vitest';
import {
  gravityIntervalMs,
  GRAVITY_INTERVAL_MS,
  GRAVITY_MIN_INTERVAL_MS,
  formatTileValue,
} from './constants';

describe('gravityIntervalMs()', () => {
  it('should stay at the base interval until a tier above 4 is created', () => {
    expect(gravityIntervalMs(1)).toBe(GRAVITY_INTERVAL_MS);
    expect(gravityIntervalMs(2)).toBe(GRAVITY_INTERVAL_MS);
  });

  it('should shrink by the ramp factor per tier created', () => {
    expect(gravityIntervalMs(3)).toBe(808); // first 8: 850 * 0.95
    expect(gravityIntervalMs(6)).toBe(692); // 64: past the old fixed 700ms
    expect(gravityIntervalMs(10)).toBe(564); // 1024
  });

  it('should ramp gently - at most a 5% step per tier, never below the floor', () => {
    // Guards the design intent: speed is pacing, not a twitch mechanic
    // (see the spatial-vs-temporal principle in CLAUDE.md). The envelope
    // (850 -> 450) is deliberate, user-tuned; the per-tier gentleness and
    // the floor are what must not regress.
    for (let k = 2; k < 40; k++) {
      const step = gravityIntervalMs(k + 1) / gravityIntervalMs(k);
      expect(step).toBeGreaterThanOrEqual(0.94);
      expect(gravityIntervalMs(k)).toBeGreaterThanOrEqual(GRAVITY_MIN_INTERVAL_MS);
    }
  });

  it('should be monotonically non-increasing in k', () => {
    for (let k = 2; k < 20; k++) {
      expect(gravityIntervalMs(k + 1)).toBeLessThanOrEqual(gravityIntervalMs(k));
    }
  });

  it('should floor at the minimum interval', () => {
    expect(gravityIntervalMs(15)).toBe(GRAVITY_MIN_INTERVAL_MS); // 32768
    expect(gravityIntervalMs(50)).toBe(GRAVITY_MIN_INTERVAL_MS);
  });
});

describe('formatTileValue()', () => {
  it('should print small values verbatim', () => {
    expect(formatTileValue(2)).toBe('2');
    expect(formatTileValue(512)).toBe('512');
  });

  it('should abbreviate 1024 and above as k-units', () => {
    expect(formatTileValue(1024)).toBe('1k');
    expect(formatTileValue(2048)).toBe('2k');
    expect(formatTileValue(65536)).toBe('64k');
  });
});
