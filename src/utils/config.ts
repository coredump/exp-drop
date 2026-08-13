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

export async function loadConfig(): Promise<GameConfig> {
  try {
    const response = await fetch('/game.config.json');
    if (!response.ok) {
      console.warn('Config file not found, using defaults');
      return DEFAULT_CONFIG;
    }

    const partial = (await response.json()) as Partial<GameConfig>;
    return deepMerge(DEFAULT_CONFIG, partial);
  } catch (error) {
    console.warn('Failed to load config, using defaults:', error);
    return DEFAULT_CONFIG;
  }
}
