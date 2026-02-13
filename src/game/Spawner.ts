import { SeededRNG } from '../utils/SeededRNG';
import { Tile } from './Tile';

// Base weights for the first few tiles (always available)
const BASE_WEIGHTS = [
  { k: 1, weight: 45 }, // 2
  { k: 2, weight: 40 }, // 4
];

// Weight multiplier for each additional unlocked tier (sliding scale)
// Higher tiers spawn less frequently
const TIER_WEIGHT_MULTIPLIER = 0.5;
const MIN_TIER_WEIGHT = 5;

export class Spawner {
  private rng: SeededRNG;
  private maxUnlockedK = 2; // Start with 2 and 4 available

  constructor(seed: number = Date.now()) {
    this.rng = new SeededRNG(seed);
  }

  setSeed(seed: number): void {
    this.rng.setSeed(seed);
  }

  updateMaxTile(maxK: number): void {
    // Unlock spawning for tiles up to one level below the max on board
    // This way players need to CREATE a tile before it can spawn
    if (maxK > this.maxUnlockedK) {
      this.maxUnlockedK = maxK;
    }
  }

  resetUnlocks(): void {
    this.maxUnlockedK = 2;
  }

  private getSpawnWeights(): { k: number; weight: number }[] {
    const weights = [...BASE_WEIGHTS];

    // Add weights for unlocked higher tiers
    // Each tier above k=2 gets progressively smaller weights
    let currentWeight = BASE_WEIGHTS[BASE_WEIGHTS.length - 1].weight;

    for (let k = 3; k <= this.maxUnlockedK - 1; k++) {
      currentWeight = Math.max(MIN_TIER_WEIGHT, currentWeight * TIER_WEIGHT_MULTIPLIER);
      weights.push({ k, weight: currentWeight });
    }

    return weights;
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
