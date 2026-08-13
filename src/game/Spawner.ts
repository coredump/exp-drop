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

  /**
   * How far below the spawn cap the weight peak sits. With spawnLag 3 and
   * this at 4, building a 512 moves the peak from 2s to 4s; building a 2048
   * centers the stream on 16s/32s. Lower = the pool chases progress harder.
   */
  private static readonly POOL_CENTER_LAG = 4;

  /** Per-step fade for tiers below the pool center (the "outgrown" smalls). */
  private static readonly BELOW_CENTER_DECAY = 0.65;

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
    // Two forces set the cap: spawnLag keeps the top `spawnLag` tiers of
    // what the player has CREATED merge-only, while initialMaxSpawnTier
    // floors the pool so mid tiers can appear from the very first spawn.
    const spawnCap = Math.max(this.initialMaxSpawnTier, this.maxUnlockedK - this.spawnLag);

    // The weight peak FOLLOWS PROGRESS: base2/base4 sit at the pool center
    // (and center+1), higher tiers decay by tierMultiplier as before, and
    // tiers below the center fade by BELOW_CENTER_DECAY per step instead of
    // dominating forever. The clamp keeps the early game identical to the
    // fixed ladder (center stays at k=1 until the cap exceeds
    // POOL_CENTER_LAG + 1); once the player builds past that, the stream
    // shifts upward with them - smalls persist as a tail, not a flood.
    const center = Math.max(1, spawnCap - Spawner.POOL_CENTER_LAG);

    const weights: { k: number; weight: number }[] = [];
    for (let k = Math.max(1, this.minTierK); k <= spawnCap; k++) {
      let weight: number;
      if (k <= center) {
        weight = this.baseWeights[0].weight * Spawner.BELOW_CENTER_DECAY ** (center - k);
      } else if (k === center + 1) {
        weight = this.baseWeights[1].weight;
      } else {
        weight = this.baseWeights[1].weight * this.tierMultiplier ** (k - center - 1);
      }
      weights.push({ k, weight: Math.max(this.minWeight, weight) });
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
