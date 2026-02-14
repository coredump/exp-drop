# AGENTS.md - exp^drop

> AI-agent documentation for the exp^drop puzzle game

## Project Overview

**exp^drop** is a retro 80s neon-styled browser puzzle game where tiles with power-of-two values fall and merge. Built with PixiJS 8.x and TypeScript.

**Repository**: https://github.com/coredump/exp-drop

## Prerequisites

- **Node.js** (latest): Managed via [mise](https://mise.jdx.dev/)
- **npm**: Comes with Node.js

Install mise if not already available:

```bash
curl https://mise.run | sh
```

## Quick Start

### Single Command Setup

```bash
npm install
```

### Development Server

```bash
npm run dev
# Or via mise:
mise run dev
```

Opens at http://localhost:5173

### Production Build

```bash
npm run build
# Or via mise:
mise run build
```

Output in `dist/` directory.

## Development Workflow

### Code Quality Checks

```bash
# Type checking
npm run typecheck
mise run typecheck

# Linting
npm run lint          # Check for issues
npm run lint:fix      # Auto-fix issues

# Formatting
npm run format        # Format all code
npm run format:check  # Check formatting

# Run all quality checks
npm run quality       # typecheck + lint + test
mise run quality
```

### Testing

```bash
# Run tests once
npm run test
mise run test

# Watch mode (re-run on changes)
npm run test:watch

# Coverage report
npm run test:coverage

# Interactive UI
npm run test:ui
```

**Coverage Thresholds**: 60% lines/functions, 50% branches

### Pre-commit Hooks

Git hooks automatically run on commit:

1. **lint-staged**: Formats and lints changed files
2. **tests**: Runs full test suite

Commits are **blocked** if checks fail.

## Project Structure

```
src/
├── main.ts                    # Entry point - loading screen, config, PixiJS init
├── game/
│   ├── Game.ts               # Main controller, state machine, touch zones
│   ├── Board.ts              # 10x12 grid (5x6 tiles, each 2x2 cells)
│   ├── Tile.ts               # Tile class with merge/remove animations
│   ├── Physics.ts            # Gravity, collision, merge logic
│   ├── Spawner.ts            # Dynamic weighted tile spawning (configurable)
│   └── InputHandler.ts       # Keyboard + touch controls, gesture detection
├── renderer/
│   ├── BoardRenderer.ts      # Grid and tile rendering
│   └── UIRenderer.ts         # Score, next, pause/restart buttons, overlays
└── utils/
    ├── constants.ts          # Grid size, colors, timings
    ├── config.ts             # Game configuration loader
    └── SeededRNG.ts          # Deterministic RNG (Mulberry32)

game.config.json               # External game configuration (project root)
```

## Controls

### Keyboard Controls

- **Arrow Left / J**: Move tile left
- **Arrow Right / L**: Move tile right
- **Arrow Down / K / Space**: Hard drop (instant drop to bottom)
- **P / Escape**: Pause/unpause game
- **R**: Restart game

### Mobile Touch Controls

- **Tap left of tile (on board)**: Slide tile to that column, then hard drop
- **Tap right of tile (on board)**: Slide tile to that column, then hard drop
- **Tap on tile**: Enable soft drop (faster falling, 70ms vs 700ms)
- **Tap below tile (same column)**: Hard drop
- **Tap left of board**: Move tile one column left
- **Tap right of board**: Move tile one column right
- **Drag left/right**: Move tile by columns as finger crosses column boundaries (grid-aligned movement)
- **Pause button**: Text-based button in top-right corner (touch devices only)
  - Shows "PAUSE" (cyan) when playing
  - Shows "CONTINUE" (green) when paused
- **Restart button**: Appears on game over screen (touch devices only)

**Touch-to-Drop Animation:**

When tapping on the board to drop a tile to a different column, the tile smoothly slides horizontally before dropping:

- Duration: 120ms
- Easing: Quadratic ease-out (smooth deceleration)
- State: Game enters `'animating'` state during slide, blocking other inputs
- Sequence: Slide animation → update position → hard drop

**Touch Zones:**

- Column width: 64 pixels (TILE_SIZE × CELL_SIZE = 2 × 32)
- Tile bounds: tileScreenX to tileScreenX+tileWidth, tileScreenY to tileScreenY+tileHeight
- Any tap on board outside tile column = dropToColumn with slide animation
- Any tap below tile (within column) = hardDrop

**Input Cooldown:**

- 100ms cooldown after restart to prevent accidental drops from lingering touch events
- Only affects game actions (movement/drops), not pause/restart commands

**Important**:

- Tiles move in discrete column steps during drag (not free-form)
- Soft drop activates when tapping directly on the tile
- Pause and restart buttons only visible on touch devices

## Key Technical Details

### Game Configuration

The game supports external configuration via `game.config.json` in the project root. If the file is missing or invalid, defaults are used.

**File: `game.config.json`**

```json
{
  "gridHeight": 12,
  "spawnWeights": {
    "base2": 45,
    "base4": 40,
    "tierMultiplier": 0.5,
    "minWeight": 5
  },
  "tierWindowSize": 6
}
```

| Parameter                     | Description                                         | Default |
| ----------------------------- | --------------------------------------------------- | ------- |
| `gridHeight`                  | Number of visible rows (not including spawn buffer) | 12      |
| `spawnWeights.base2`          | Spawn weight for k=1 (value 2) tiles                | 45      |
| `spawnWeights.base4`          | Spawn weight for k=2 (value 4) tiles                | 40      |
| `spawnWeights.tierMultiplier` | Weight decay for each additional tier               | 0.5     |
| `spawnWeights.minWeight`      | Minimum spawn weight for any tier                   | 5       |
| `tierWindowSize`              | Number of tiers to keep in spawn pool               | 6       |

**Loading Behavior:**

- Config is loaded asynchronously at startup
- Partial configs are merged with defaults (can override single values)
- A loading screen with "Start" button appears while config/fonts load
- Game only initializes after user clicks Start

**Implementation:**

- `src/utils/config.ts` - `GameConfig` interface, `loadConfig()`, `DEFAULT_CONFIG`
- `src/main.ts` - Loading overlay and start button
- `src/game/Spawner.ts` - Accepts `SpawnerConfig` in constructor

### Grid System

- **Grid Size**: 10 columns × 12 rows (GRID_WIDTH, GRID_HEIGHT) - height is configurable
- **Tile Size**: Each tile occupies 2×2 cells (TILE_SIZE = 2)
- **Cell Size**: 32 pixels (CELL_SIZE = 32)
- **Spawn Buffer**: 2 rows above visible area

**Important**: All tile positions must be multiples of TILE_SIZE (2) to maintain grid alignment.

### Merge Rules

- Tiles merge **only when orthogonally adjacent AND have equal value**
- `k == k` → merge allowed (e.g., 4 + 4)
- `k != k` → no merge (e.g., 4 + 8)
- New tile absorbs ALL matching neighbors simultaneously
- New exponent: `kNew = kOriginal + numberOfTilesAbsorbed`
- Example: k=3 (value 8) absorbs two k=3 neighbors → k=5 (value 32)

### Spawn System (Dynamic Progression)

- **Initial**: Only k=1 (2) and k=2 (4) spawn with configurable weights
- **Unlock**: When you create a tile of value X, tiles of value X/2 can spawn
- **Scaling**: Each tier has weight = previous × tierMultiplier (minimum minWeight)
- **Tier Window**: Only the most recent `tierWindowSize` tiers remain in the spawn pool

```
Timing constants in src/utils/constants.ts:
- GRAVITY_INTERVAL_MS = 700      // Drop speed
- SOFT_DROP_INTERVAL_MS = 70     // Fast drop speed

Spawn weights in game.config.json (or defaults):
- spawnWeights.base2 = 45        // 2s base spawn rate
- spawnWeights.base4 = 40        // 4s base spawn rate
- spawnWeights.tierMultiplier = 0.5  // Decay for higher tiers
- spawnWeights.minWeight = 5     // Minimum spawn weight
- tierWindowSize = 6             // Tiers kept in pool
```

### Scoring Formula

```
points = floor(basePoints × multiMergeMultiplier × comboMultiplier)

basePoints = 2^(newK)
multiMergeMultiplier = tilesAbsorbed (1x, 2x, 3x, 4x)
comboMultiplier = 1 + (comboCount - 1) × 0.5
```

### Animation Sequence

**Merge Animation:**

1. **Pause** (80ms) - Brief delay before merge
2. **Suck** (150ms) - Tiles pull into absorber with scale anticipation
3. **Value Update** - Tile visual updates to new number
4. **Pop** (180ms) - Elastic bounce on upgraded tile
5. **Gravity** (30ms delay) - Tile falls to new position
6. **Chain Check** - Repeat if new matches found

**Other Animations:**

- **Horizontal slide** (120ms) - Touch-to-drop column movement with ease-out
- **Disappear** (200ms) - Tile shrink/fade when removed

### UI Layout (Responsive)

**Top Bar** (compact, grid-aligned):

- **Score**: Two-line format "Score\n0", 12px font, center-anchored at `gridX + 40`
- **Next Preview**: Centered within grid width, label + 2×2 tile box
- **Pause Button**: Right-aligned at `gridX + gridWidth - 80`
- All positioned at `topBarY = gridY - previewHeight - 10`

**Spacing**:

- Preview height: `18px (label) + (TILE_SIZE × CELL_SIZE + 20)px (box)`
- Reserved top: 90px to accommodate variable cell sizes
- Side margins: 20px

## Code Conventions

### TypeScript

- **Strict Mode**: Enabled in `tsconfig.json`
- **Type Safety**: No `any` types, explicit return types required
- **Naming**:
  - Classes/Interfaces: PascalCase (e.g., `BoardRenderer`)
  - Variables/Functions: camelCase (e.g., `canMoveDown`)
  - Constants: UPPER_SNAKE_CASE (e.g., `GRID_WIDTH`)

### Code Quality

- **Complexity Limit**: Max 10 cyclomatic complexity
- **Function Length**: Max 50 lines (excluding blanks/comments)
- **Max Depth**: 3 levels of nesting

### Testing

- Test files: `*.test.ts` alongside source files
- Framework: Vitest with jsdom environment
- Coverage: Must meet 60% thresholds
- Focus areas:
  - Core game logic (Physics, Spawner)
  - Deterministic behavior (SeededRNG)
  - Edge cases (boundaries, collisions)

## Git Workflow

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new tile animation
fix: correct merge detection for corner tiles
docs: update AGENTS.md with spawn system
chore: update dependencies
test: add Physics collision tests
```

**Types**: `feat`, `fix`, `docs`, `chore`, `test`, `refactor`, `ci`

### Pull Requests

- All checks must pass (tests, linting, type checking)
- Pre-commit hooks enforce code quality
- No force-push to main branch

## Deployment

### GitHub Pages

Auto-deployed on push to main via `.github/workflows/deploy.yml`

### Docker

```bash
# Using pre-built image
docker run -p 8080:80 ghcr.io/coredump/exp-drop:latest

# Using docker-compose
docker compose up

# Build locally
docker build -t exp-drop .
docker run -p 8080:80 exp-drop
```

### Release

Create a tag to trigger release workflow:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Generates zip and tar.gz archives in GitHub Releases.

## Troubleshooting

### Tests Failing

```bash
# Run with verbose output
npm run test -- --reporter=verbose

# Check specific test file
npm run test -- src/game/Physics.test.ts
```

### Linting Errors

```bash
# Auto-fix most issues
npm run lint:fix

# Check specific file
npx eslint src/game/Game.ts
```

### Type Errors

```bash
# Full type check
npm run typecheck

# Watch mode
npx tsc --noEmit --watch
```

### Pre-commit Hook Blocked

```bash
# Fix linting and formatting
npm run lint:fix
npm run format

# Re-run tests
npm run test

# Then retry commit
git commit
```

## Resources

- **PixiJS Docs**: https://pixijs.com/
- **Vitest Docs**: https://vitest.dev/
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/
- **Factory Droid**: https://factory.ai/
- **AGENTS.md Standard**: https://docs.factory.ai/factory-docs/agents-md

## Development Tips for AI Agents

1. **Always run quality checks** before committing: `npm run quality`
2. **Maintain grid alignment**: All tile positions must be multiples of `TILE_SIZE`
3. **Test determinism**: Use fixed seeds in tests to ensure reproducibility
4. **Follow merge rules**: Only equal values merge (`k == k`)
5. **Respect animation sequence**: Don't skip visual updates in the resolution chain
6. **Update config**: Game balance parameters are in `game.config.json` (spawn weights, grid height, tier window)
7. **Update constants**: Timing and visual constants are in `src/utils/constants.ts`
8. **Check coverage**: `npm run test:coverage` shows what needs testing
9. **Touch zone updates**: Call `updateTouchZone()` after every tile movement/spawn
10. **Font loading**: Use `display=block` to prevent fallback flash
11. **Responsive layout**: Preview height calculation prevents UI overlap
12. **Config loading**: Config is async - use `loadConfig()` before game starts

## License

MIT - See [LICENSE](LICENSE) file for details.
