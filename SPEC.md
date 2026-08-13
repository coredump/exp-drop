# SPEC.md - exp^drop (Technical Specification)

> Vibecoded from zero using [Factory Droid](https://factory.ai/) and Claude.

This document is the source of truth for the game implementation.

## 1. Grid & Tiles

### 1.1 Board

- Grid size: **10 columns x 12 rows** (5 tiles wide x 6 tiles tall)
- Spawn buffer: **2 rows** above visible area
- Cell size: **32x32 pixels**
- Coordinate system: `(x, y)` where x increases right, y increases down

### 1.2 Tiles

- Each tile occupies a **2x2 cell area** (64x64 pixels)
- Tile value is a power of two: `value = 2^k` where `k >= 1`
- Tiles can only exist at aligned positions (x and y must be multiples of 2)

## 2. Spawn Rules

### 2.1 Spawn Position

- Spawn coordinates: `x = SPAWN_X` (4), `y = 0` (centered, aligned to 2x2 grid)
- Game over when **any** column stacks to the top row — i.e. a settled tile
  rests at `y = 0` after resolution. (Tiles are 2x2 at even y, so this also
  covers the spawn cells being blocked.) A tile that touches the top
  mid-cascade and merges away does not end the game.

### 2.2 Dynamic Spawn System

- **Base tiles**: 2 and 4 always available
- **Initial pool**: tiers up to `initialMaxSpawnTier` may spawn from the very
  first drop, at ladder rarity (shipped: 8 ≈ 13%, 16 ≈ 4.5%, 32 ≈ 1.6%). It
  acts as a floor under the unlock cap
- **Unlocking**: creating a tile of tier `k` allows tiers up to `k - spawnLag`
  to spawn. The top `spawnLag` tiers never spawn — they must be built by
  merging. (`spawnLag: 1` is the original "one below max" behavior.)
- **Sliding scale**: each tier above base has weight = previous × `tierMultiplier`,
  floored at `minWeight`
- **Anti-streak**: a value spawns at most **twice in a row**. On the third
  draw it is excluded and the remaining weights are renormalized (unless the
  pool has only one tier, where a repeat is unavoidable). The NEXT preview
  respects this — peeking never changes what will actually spawn.
- **Tier window**: only the most recent `tierWindowSize` tiers stay in the pool;
  tiles below that threshold are culled from the board

Actual weights are config-driven. Two sets are in play — do not "fix" one to
match the other:

| Parameter             | `DEFAULT_CONFIG` (used when the file is absent) | Shipped `game.config.json` |
| --------------------- | ----------------------------------------------- | -------------------------- |
| `base2`               | 45                                              | 55                         |
| `base4`               | 40                                              | 45                         |
| `tierMultiplier`      | 0.5                                             | 0.35                       |
| `minWeight`           | 5                                               | 1                          |
| `tierWindowSize`      | 6                                               | 18                         |
| `spawnLag`            | 1                                               | 3                          |
| `initialMaxSpawnTier` | 2                                               | 5                          |
| `gridHeight`          | 12                                              | 14                         |

The shipped `tierWindowSize: 18` is deliberate balance tuning: at 6, low tiers
were culled fast enough to keep clearing the board, which made the game too
easy. At 18 the culling path is effectively dormant (it needs a 2^19 tile), and
that is intended. The code is retained because the threshold is config-driven.

The shipped `spawnLag: 3` + `tierMultiplier: 0.35` slow top-end progression:
high tiers must be hand-built for the last three doublings, and unlocked mid
tiers spawn rarely (8 ≈ 13%, 16 ≈ 4%, 32+ ≈ 1% each), so 2s and 4s stay ~80%
of spawns forever. Simulated effect (greedy merge bot, 60 seeds): turns to
reach 1024 went from ~378 to ~668 (~1.8x slower) versus lag 1 / 0.5.

## 3. Movement

### 3.1 Input Actions

- **Left/Right**: Move 2 cells horizontally (TILE_SIZE)
- **Hard Drop**: Instant drop to lowest valid position
- **Pause**: Toggle pause state
- **Restart**: Reset game

> Soft drop was specified but never implemented, and was removed outright
> rather than left as a dead action. Down / K map to hard drop.

### 3.2 Key Bindings

- Arrow keys: Left, Down (hard drop), Right
- J, K, L: Left, Down (hard drop), Right (vim-style)
- Space: Hard drop
- P / Escape: Pause
- R: Restart

### 3.3 Gravity

- Base gravity interval: **700ms**
- **Ramp**: every tier created above 4 multiplies the interval by **0.97**
  (permanent for the run), floored at **550ms**. First 8 → 679ms,
  64 → 620ms, 1024+ → 550ms. Resets on restart.
- Driven by the highest tier _created_, not the board's current maximum —
  merging your best tile away does not slow the game back down.

> **The ramp is deliberately gentle and must stay that way.** exp^drop is a
> construction puzzle — difficulty comes from running out of space, and the
> way out is building bigger numbers to reclaim it. Hard drop is the primary
> input, so the fall interval rarely changes _where_ a tile lands; it only
> caps how long the player may deliberate. A steep ramp therefore adds no
> spatial depth, it just converts the game into a reaction test. An earlier
> 0.9 / 250ms version did exactly that and was dialled back. Total squeeze
> is ~21%, spread across the entire climb to 1024.

### 3.4 Touch Controls

- **Tap on tile**: Hard drop
- **Tap below tile (same column)**: Hard drop
- **Tap on board (different column)**: Slide to column + hard drop
- **Drag left/right**: Move tile by columns (grid-aligned)

**Touch-to-Drop Animation:**

- When tapping a different column, tile slides horizontally before dropping
- Duration: **120ms**
- Easing: Quadratic ease-out
- Game state: `'animating'` during slide (blocks other inputs)

**Input Cooldown:**

- **100ms** cooldown after restart to prevent accidental drops
- Only affects game actions, not UI buttons

## 4. Merge Rules (Equal Only)

### 4.1 Merge Condition

- Tiles merge **only when orthogonally adjacent AND have the same exponent**
- `kA == kB` → merge allowed
- `kA != kB` → no merge
- Diagonal contact **never** merges

### 4.2 Multi-Merge

- The newly placed/moved tile checks ALL four directions
- ALL matching neighbors are absorbed simultaneously
- Each absorbed tile adds +1 to the exponent

### 4.3 Merge Result

- `kNew = kOriginal + numberOfTilesAbsorbed`
- Example: 8 (k=3) absorbs two 8s → k = 3 + 2 = 5 (value 32)

### 4.4 Neighbor Check Priority

When evaluating, check neighbors in order: Down, Left, Right, Up

## 5. Resolution Process

### 5.1 Merge Animation Sequence

1. **Pause** (80ms): Brief pause before animation
2. **Suck animation** (150ms): Matching tiles pull into the absorbing tile
3. **Value update**: Tile visual updates to show new value
4. **Pop animation** (180ms): Elastic scale effect on upgraded tile
5. **Gravity** (30ms delay): Tile falls to new position
6. **Chain check**: Repeat if new matches found at new position

### 5.2 Other Animations

- **Horizontal slide** (120ms): Touch-to-drop column movement with quadratic ease-out
- **Disappear** (200ms): Tile shrink and fade when removed

### 5.3 Priority

- The most recently placed/moved tile always takes priority
- It absorbs neighbors; neighbors don't absorb it

## 6. Scoring

### 6.1 Base Points

`basePoints = 2^(newK)` where newK is the resulting exponent

### 6.2 Multi-Merge Multiplier

- 1 tile absorbed = 1x
- 2 tiles absorbed = 2x
- 3 tiles absorbed = 3x
- 4 tiles absorbed = 4x

### 6.3 Combo Multiplier

- 1st merge = 1x
- 2nd merge = 1.5x
- 3rd merge = 2x
- 4th merge = 2.5x
- Pattern: `1 + (comboCount - 1) * 0.5`

### 6.4 Total Points

`points = floor(basePoints × multiMergeMultiplier × comboMultiplier)`

Combo resets when a new tile spawns.

## 7. Visual Style

### 7.1 Theme

80s Neon aesthetic with:

- Deep purple-black background (#0d0221)
- Bright neon tile colors (magenta, cyan, green, orange, etc.)
- Magenta grid border
- Cyan UI accents

### 7.2 Font

**Press Start 2P** (Google Fonts) - pixel arcade style

### 7.3 Color Palette

| k   | Value  | Color                              |
| --- | ------ | ---------------------------------- |
| 1   | 2      | Hot magenta (#ff00ff)              |
| 2   | 4      | Cyan (#00ffff)                     |
| 3   | 8      | Neon green (#39ff14)               |
| 4   | 16     | Neon orange (#ff6600)              |
| 5   | 32     | Yellow (#ffff00)                   |
| 6   | 64     | Hot pink (#ff0066)                 |
| 7   | 128    | Mint (#00ff99)                     |
| 8   | 256    | Purple (#9933ff)                   |
| 9   | 512    | Red-orange (#ff3300)               |
| 10  | 1024   | Sky blue (#00ccff)                 |
| 11  | 2048   | Light pink (#ff99cc)               |
| 12+ | Higher | Lime, salmon, aqua, gold, lavender |

## 8. UI Elements

- **Score**: Top-left, cyan text
- **Multiplier popup**: Center of grid, blinking magenta/cyan animation
- **Next preview**: Right side, cyan border
- **Game Over/Pause**: Center overlay with magenta border

## 9. Technical Implementation

### 9.1 Tech Stack

- **Renderer**: PixiJS 8.x (WebGL/WebGPU)
- **Build**: Vite 6.x
- **Language**: TypeScript 5.x
- **Runtime**: Node.js 24 (pinned by the Nix devshell in `flake.nix`)

### 9.2 Key Constants

```typescript
GRID_WIDTH = 10; // 5 tiles
GRID_HEIGHT = 12; // 6 tiles
TILE_SIZE = 2; // 2x2 cells per tile
CELL_SIZE = 32; // pixels
GRAVITY_INTERVAL_MS = 700;
```

## 10. Build Commands

Enter the devshell first (`nix develop`, or automatically via direnv):

```bash
npm install         # Install dependencies
npm run dev         # Development server
npm run build       # Production build
npm run typecheck   # TypeScript validation
npm run preview     # Preview production build
npm run quality     # typecheck + lint + test
```
