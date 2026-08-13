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
    expect(gravityIntervalMs(3)).toBe(679); // first 8: 700 * 0.97
    expect(gravityIntervalMs(6)).toBe(620); // 64
  });

  it('should stay gentle - never more than a ~25% squeeze', () => {
    // Guards the design intent: this is a nudge, not a twitch mechanic.
    // A steep ramp would make the game about reaction time instead of
    // space management.
    for (let k = 1; k < 40; k++) {
      expect(gravityIntervalMs(k)).toBeGreaterThanOrEqual(GRAVITY_INTERVAL_MS * 0.75);
    }
  });

  it('should be monotonically non-increasing in k', () => {
    for (let k = 2; k < 20; k++) {
      expect(gravityIntervalMs(k + 1)).toBeLessThanOrEqual(gravityIntervalMs(k));
    }
  });

  it('should floor at the minimum interval', () => {
    expect(gravityIntervalMs(10)).toBe(GRAVITY_MIN_INTERVAL_MS); // 1024
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
