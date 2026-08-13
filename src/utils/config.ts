export interface SpawnWeightsConfig {
  base2: number;
  base4: number;
  tierMultiplier: number;
  minWeight: number;
}

export interface GameConfig {
  gridHeight: number;
  spawnWeights: SpawnWeightsConfig;
  tierWindowSize: number;
  /**
   * How many tiers below the highest-created tile spawning is capped at.
   * 1 = tiles up to one below your max can spawn (the original behavior);
   * higher values force the player to build the top tiers by merging alone.
   */
  spawnLag: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  gridHeight: 12,
  spawnWeights: {
    base2: 45,
    base4: 40,
    tierMultiplier: 0.5,
    minWeight: 5,
  },
  tierWindowSize: 6,
  spawnLag: 1,
};

export function deepMerge<T extends object>(defaults: T, partial: Partial<T>): T {
  const result = { ...defaults };

  for (const key in partial) {
    if (Object.prototype.hasOwnProperty.call(partial, key)) {
      const value = partial[key];
      const defaultValue = defaults[key];

      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        defaultValue !== null &&
        typeof defaultValue === 'object' &&
        !Array.isArray(defaultValue)
      ) {
        result[key] = deepMerge(defaultValue as object, value as object) as T[Extract<
          keyof T,
          string
        >];
      } else if (value !== undefined) {
        result[key] = value as T[Extract<keyof T, string>];
      }
    }
  }

  return result;
}

/**
 * URL of the config file, resolved against the deployment's base path.
 *
 * This MUST stay relative to BASE_URL. A root-absolute '/game.config.json'
 * works on a dev server but 404s on GitHub Pages, where the site is served
 * from '/exp-drop/' - and because loadConfig() falls back to DEFAULT_CONFIG
 * on failure, the whole balance config goes silently inert in production.
 */
export function configUrl(baseUrl: string = import.meta.env.BASE_URL): string {
  return `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}game.config.json`;
}

export async function loadConfig(): Promise<GameConfig> {
  try {
    const response = await fetch(configUrl());
    if (!response.ok) {
      // 404 is the documented "delete the file to use defaults" path; anything
      // else is a deployment problem worth distinguishing.
      if (response.status === 404) {
        console.info('No game.config.json found, using built-in defaults');
      } else {
        console.warn(
          `Failed to load game.config.json (HTTP ${response.status}), using defaults. ` +
            `Tried: ${configUrl()}`
        );
      }
      return DEFAULT_CONFIG;
    }

    const partial = (await response.json()) as Partial<GameConfig>;
    return deepMerge(DEFAULT_CONFIG, partial);
  } catch (error) {
    console.warn(`Failed to load ${configUrl()}, using defaults:`, error);
    return DEFAULT_CONFIG;
  }
}
