import { SeededRNG } from '../utils/SeededRNG';
import { Tile } from './Tile';
import { SpawnWeightsConfig, DEFAULT_CONFIG } from '../utils/config';

export interface SpawnerConfig {
  spawnWeights: SpawnWeightsConfig;
  tierWindowSize: number;
  spawnLag?: number;
  initialMaxSpawnTier?: number;
}

export class Spawner {
  /** A value may spawn at most this many times consecutively. */
  private static readonly MAX_SPAWN_REPEAT = 2;

  /**
   * Weight multiplier applied to the just-spawned value on the next draw.
   * The hard MAX_SPAWN_REPEAT cap alone produced an "alternating pairs"
   * rhythm (2 2 4 4 2 2 ...) in the base-tile-dominated pool: repeats were
   * likely until the cap forced a switch, which usually landed on the other
   * base value. Discouraging the immediate repeat softly breaks that rhythm
   * and gives the rest of the pool more room.
   */
  private static readonly REPEAT_WEIGHT_PENALTY = 0.45;

  private rng: SeededRNG;
  private maxUnlockedK = 2; // Start with 2 and 4 available
  private minTierK = 1; // Minimum tier that can spawn (increases when higher tiers unlock)
  private lastSpawnedK = 0; // 0 = no spawn yet
  private spawnRun = 0;

  private readonly baseWeights: { k: number; weight: number }[];
  private readonly tierMultiplier: number;
  private readonly minWeight: number;
  private readonly tierWindowSize: number;
  private readonly spawnLag: number;
  private readonly initialMaxSpawnTier: number;

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
    this.spawnLag = config?.spawnLag ?? DEFAULT_CONFIG.spawnLag;
    this.initialMaxSpawnTier = config?.initialMaxSpawnTier ?? DEFAULT_CONFIG.initialMaxSpawnTier;
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
    this.lastSpawnedK = 0;
    this.spawnRun = 0;
  }

  private getSpawnWeights(): { k: number; weight: number }[] {
    const weights: { k: number; weight: number }[] = [];

    // Start from baseWeights but filter out tiers below minTierK
    for (const w of this.baseWeights) {
      if (w.k >= this.minTierK) {
        weights.push(w);
      }
    }

    // Add weights for higher tiers (also respecting minTierK). Two forces
    // set the cap: spawnLag keeps the top `spawnLag` tiers of what the
    // player has CREATED merge-only, while initialMaxSpawnTier floors the
    // pool so mid tiers can appear (rarely) from the very first spawn.
    const spawnCap = Math.max(this.initialMaxSpawnTier, this.maxUnlockedK - this.spawnLag);
    let currentWeight = this.baseWeights[this.baseWeights.length - 1].weight;

    for (let k = 3; k <= spawnCap; k++) {
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
    const k = this.rollExponent();
    // Track the run so the anti-streak filter can act on the NEXT roll
    this.spawnRun = k === this.lastSpawnedK ? this.spawnRun + 1 : 1;
    this.lastSpawnedK = k;
    return k;
  }

  /**
   * Weighted roll with anti-streak: the just-spawned value is down-weighted
   * by REPEAT_WEIGHT_PENALTY, and after MAX_SPAWN_REPEAT identical spawns in
   * a row it is excluded outright (weights renormalized over the rest), so
   * the same number never spawns three times consecutively.
   * Reads run-tracking state but never writes it - previewNextExponent()
   * depends on that.
   */
  private rollExponent(): number {
    let weights = this.getSpawnWeights();

    if (this.spawnRun >= Spawner.MAX_SPAWN_REPEAT) {
      const filtered = weights.filter((w) => w.k !== this.lastSpawnedK);
      // Degenerate configs can leave a single-tier pool; a forced repeat
      // beats returning nothing.
      if (filtered.length > 0) weights = filtered;
    } else if (this.spawnRun >= 1) {
      weights = weights.map((w) =>
        w.k === this.lastSpawnedK ? { k: w.k, weight: w.weight * Spawner.REPEAT_WEIGHT_PENALTY } : w
      );
    }

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
    // rollExponent (not getNextExponent): peeking must not advance the
    // run tracking, or the previewed value and the real draw would diverge.
    const k = this.rollExponent();
    this.rng.setState(currentState);
    return k;
  }

  getUnlockedTiers(): { k: number; weight: number }[] {
    return this.getSpawnWeights();
  }
}
