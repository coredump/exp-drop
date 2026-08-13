import { describe, it, expect, vi, afterEach } from 'vitest';
import { deepMerge, loadConfig, configUrl, DEFAULT_CONFIG, GameConfig } from './config';

describe('configUrl()', () => {
  it('should resolve against a sub-path deployment (GitHub Pages)', () => {
    // Regression: a root-absolute '/game.config.json' 404s under /exp-drop/,
    // silently reverting the game to DEFAULT_CONFIG in production.
    expect(configUrl('/exp-drop/')).toBe('/exp-drop/game.config.json');
  });

  it('should resolve at the site root', () => {
    expect(configUrl('/')).toBe('/game.config.json');
  });

  it('should tolerate a base without a trailing slash', () => {
    expect(configUrl('/exp-drop')).toBe('/exp-drop/game.config.json');
  });

  it('should never produce a root-absolute path under a sub-path base', () => {
    expect(configUrl('/exp-drop/').startsWith('/game.config.json')).toBe(false);
  });
});

describe('deepMerge()', () => {
  it('should return defaults untouched for an empty partial', () => {
    expect(deepMerge(DEFAULT_CONFIG, {})).toEqual(DEFAULT_CONFIG);
  });

  it('should override a single top-level value without losing the rest', () => {
    const merged = deepMerge(DEFAULT_CONFIG, { gridHeight: 20 });

    expect(merged.gridHeight).toBe(20);
    expect(merged.tierWindowSize).toBe(DEFAULT_CONFIG.tierWindowSize);
    expect(merged.spawnWeights).toEqual(DEFAULT_CONFIG.spawnWeights);
  });

  it('should merge nested objects rather than replacing them', () => {
    const merged = deepMerge(DEFAULT_CONFIG, {
      spawnWeights: { base2: 99 } as GameConfig['spawnWeights'],
    });

    expect(merged.spawnWeights.base2).toBe(99);
    // Siblings survive the partial nested override
    expect(merged.spawnWeights.base4).toBe(DEFAULT_CONFIG.spawnWeights.base4);
    expect(merged.spawnWeights.tierMultiplier).toBe(DEFAULT_CONFIG.spawnWeights.tierMultiplier);
    expect(merged.spawnWeights.minWeight).toBe(DEFAULT_CONFIG.spawnWeights.minWeight);
  });

  it('should ignore undefined values instead of erasing defaults', () => {
    const merged = deepMerge(DEFAULT_CONFIG, { gridHeight: undefined });
    expect(merged.gridHeight).toBe(DEFAULT_CONFIG.gridHeight);
  });

  it('should not mutate the defaults object', () => {
    const before = structuredClone(DEFAULT_CONFIG);
    deepMerge(DEFAULT_CONFIG, { gridHeight: 99, spawnWeights: { base2: 1 } as never });
    expect(DEFAULT_CONFIG).toEqual(before);
  });
});

describe('loadConfig()', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should merge a partial config from the network over defaults', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ gridHeight: 14, tierWindowSize: 18 }),
      })
    );

    const config = await loadConfig();

    expect(config.gridHeight).toBe(14);
    expect(config.tierWindowSize).toBe(18);
    expect(config.spawnWeights).toEqual(DEFAULT_CONFIG.spawnWeights);
  });

  it('should request the config relative to the deployment base', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    await loadConfig();

    const requested = String(fetchMock.mock.calls[0][0]);
    expect(requested.endsWith('game.config.json')).toBe(true);
    expect(requested).toBe(configUrl());
  });

  it('should fall back to defaults on a 404 without warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    await expect(loadConfig()).resolves.toEqual(DEFAULT_CONFIG);
    // A missing file is a supported path, not a deployment fault
    expect(warn).not.toHaveBeenCalled();
  });

  it('should warn loudly on a non-404 failure', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(loadConfig()).resolves.toEqual(DEFAULT_CONFIG);
    expect(warn).toHaveBeenCalled();
  });

  it('should fall back to defaults when fetch rejects', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(loadConfig()).resolves.toEqual(DEFAULT_CONFIG);
  });

  it('should fall back to defaults when the body is not valid JSON', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Unexpected token')),
      })
    );

    await expect(loadConfig()).resolves.toEqual(DEFAULT_CONFIG);
  });
});
