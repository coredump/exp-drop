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
};

function deepMerge<T extends object>(defaults: T, partial: Partial<T>): T {
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

let cachedConfig: GameConfig | null = null;

export async function getConfig(): Promise<GameConfig> {
  cachedConfig ??= await loadConfig();
  return cachedConfig;
}

export function getConfigSync(): GameConfig {
  if (!cachedConfig) {
    throw new Error('Config not loaded. Call loadConfig() first.');
  }
  return cachedConfig;
}
