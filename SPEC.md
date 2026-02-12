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
- Spawn coordinates: `x = 4`, `y = 0` (centered, aligned to 2x2 grid)
- Game over if spawn position is blocked

### 2.2 Dynamic Spawn System
- **Base tiles**: 2 (60%) and 4 (30%) always available
- **Unlocking**: Higher values unlock when created on the board
- **Sliding scale**: Each tier above base has weight = previous × 0.35 (min 2%)

| Board Max | 2 | 4 | 8 | 16 | 32 |
|-----------|-----|-----|-----|------|------|
| 4 | 67% | 33% | - | - | - |
| 16 | 63% | 32% | 5% | - | - |
| 32 | 62% | 31% | 5% | 2% | - |
| 64+ | 61% | 31% | 5% | 2% | 2% |

## 3. Movement

### 3.1 Input Actions
- **Left/Right**: Move 2 cells horizontally (TILE_SIZE)
- **Soft Drop**: Move 2 cells down
- **Hard Drop**: Instant drop to lowest valid position
- **Pause**: Toggle pause state
- **Restart**: Reset game

### 3.2 Key Bindings
- Arrow keys: Left, Down, Right
- J, K, L: Left, Down, Right (vim-style)
- Space: Hard drop
- P / Escape: Pause
- R: Restart

### 3.3 Gravity
- Gravity interval: **700ms**
- Soft drop interval: **70ms**

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

### 5.1 Animation Sequence
1. **Pause** (80ms): Brief pause before animation
2. **Suck animation** (150ms): Matching tiles pull into the absorbing tile
3. **Value update**: Tile visual updates to show new value
4. **Pop animation** (180ms): Elastic scale effect on upgraded tile
5. **Gravity** (30ms delay): Tile falls to new position
6. **Chain check**: Repeat if new matches found at new position

### 5.2 Priority
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
| k | Value | Color |
|---|-------|-------|
| 1 | 2 | Hot magenta (#ff00ff) |
| 2 | 4 | Cyan (#00ffff) |
| 3 | 8 | Neon green (#39ff14) |
| 4 | 16 | Neon orange (#ff6600) |
| 5 | 32 | Yellow (#ffff00) |
| 6 | 64 | Hot pink (#ff0066) |
| 7 | 128 | Mint (#00ff99) |
| 8 | 256 | Purple (#9933ff) |
| 9 | 512 | Red-orange (#ff3300) |
| 10 | 1024 | Sky blue (#00ccff) |
| 11 | 2048 | Light pink (#ff99cc) |
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
- **Runtime**: Node.js (latest via mise)

### 9.2 Key Constants
```typescript
GRID_WIDTH = 10        // 5 tiles
GRID_HEIGHT = 12       // 6 tiles
TILE_SIZE = 2          // 2x2 cells per tile
CELL_SIZE = 32         // pixels
GRAVITY_INTERVAL_MS = 700
SOFT_DROP_INTERVAL_MS = 70
```

## 10. Build Commands

```bash
mise run install    # Install dependencies
mise run dev        # Development server
mise run build      # Production build
mise run typecheck  # TypeScript validation
mise run preview    # Preview production build
mise run clean      # Remove build artifacts
```
