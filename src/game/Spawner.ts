import { SeededRNG } from '../utils/SeededRNG';
import { Tile } from './Tile';
import { SpawnWeightsConfig, DEFAULT_CONFIG } from '../utils/config';

export interface SpawnerConfig {
  spawnWeights: SpawnWeightsConfig;
  tierWindowSize: number;
}

export class Spawner {
  private rng: SeededRNG;
  private maxUnlockedK = 2; // Start with 2 and 4 available
  private minTierK = 1; // Minimum tier that can spawn (increases when higher tiers unlock)

  private readonly baseWeights: { k: number; weight: number }[];
  private readonly tierMultiplier: number;
  private readonly minWeight: number;
  private readonly tierWindowSize: number;

  constructor(seed: number = Date.now(), config?: SpawnerConfig) {
    this.rng = new SeededRNG(seed);

    const spawnWeights = config?.spawnWeights ?? DEFAULT_CONFIG.spawnWeights;
    this.baseWeights = [
      { k: 1, weight: spawnWeights.base2 },
      { k: 2, weight: spawnWeights.base4 },
    ];
    this.tierMultiplier = spawnWeights.tierMultiplier;
    this.minWeight = spawnWeights.minWeight;
    this.tierWindowSize = config?.tierWindowSize ?? DEFAULT_CONFIG.tierWindowSize;
  }

  setSeed(seed: number): void {
    this.rng.setSeed(seed);
  }

  /**
   * Calculate minimum spawn tier based on max unlocked tier.
   * Formula: minTierK = max(1, maxUnlockedK - tierWindowSize) keeps ~tierWindowSize tiers available.
   */
  private calculateMinTier(maxK: number): number {
    return Math.max(1, maxK - this.tierWindowSize);
  }

  /**
   * Update spawn pool based on highest tile on board.
   * Returns true if the minimum tier threshold changed (lower tiers should be removed).
   */
  updateMaxTile(maxK: number): boolean {
    // Unlock spawning for tiles up to one level below the max on board
    // This way players need to CREATE a tile before it can spawn
    if (maxK > this.maxUnlockedK) {
      this.maxUnlockedK = maxK;
    }

    const newMinTier = this.calculateMinTier(this.maxUnlockedK);
    if (newMinTier > this.minTierK) {
      this.minTierK = newMinTier;
      return true; // Threshold changed - lower tiers should be removed
    }
    return false;
  }

  getMinTierK(): number {
    return this.minTierK;
  }

  resetUnlocks(): void {
    this.maxUnlockedK = 2;
    this.minTierK = 1;
  }

  private getSpawnWeights(): { k: number; weight: number }[] {
    const weights: { k: number; weight: number }[] = [];

    // Start from baseWeights but filter out tiers below minTierK
    for (const w of this.baseWeights) {
      if (w.k >= this.minTierK) {
        weights.push(w);
      }
    }

    // Add weights for unlocked higher tiers (also respecting minTierK)
    let currentWeight = this.baseWeights[this.baseWeights.length - 1].weight;

    for (let k = 3; k <= this.maxUnlockedK - 1; k++) {
      currentWeight = Math.max(this.minWeight, currentWeight * this.tierMultiplier);
      if (k >= this.minTierK) {
        weights.push({ k, weight: currentWeight });
      }
    }

    return weights;
  }

  /**
   * Validate that an exponent is still valid for spawning.
   * If not, upgrade it to the minimum valid tier.
   */
  validateExponent(k: number): number {
    if (k < this.minTierK) {
      return this.minTierK;
    }
    return k;
  }

  getNextExponent(): number {
    const weights = this.getSpawnWeights();
    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    const roll = this.rng.next() * totalWeight;
    let cumulative = 0;

    for (const { k, weight } of weights) {
      cumulative += weight;
      if (roll < cumulative) {
        return k;
      }
    }

    return weights[weights.length - 1].k;
  }

  createTile(x: number, y: number): Tile {
    const k = this.getNextExponent();
    return new Tile(k, x, y);
  }

  previewNextExponent(): number {
    const currentState = this.rng.getState();
    const k = this.getNextExponent();
    this.rng.setState(currentState);
    return k;
  }

  getUnlockedTiers(): { k: number; weight: number }[] {
    return this.getSpawnWeights();
  }
}
