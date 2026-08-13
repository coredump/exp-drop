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
    expect(gravityIntervalMs(3)).toBe(630); // first 8: 700 * 0.9
    expect(gravityIntervalMs(6)).toBe(459); // 64
    expect(gravityIntervalMs(10)).toBe(301); // 1024
  });

  it('should be monotonically non-increasing in k', () => {
    for (let k = 2; k < 20; k++) {
      expect(gravityIntervalMs(k + 1)).toBeLessThanOrEqual(gravityIntervalMs(k));
    }
  });

  it('should floor at the minimum interval', () => {
    expect(gravityIntervalMs(12)).toBe(GRAVITY_MIN_INTERVAL_MS);
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
