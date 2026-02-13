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
├── main.ts                    # Entry point - PixiJS app initialization
├── game/
│   ├── Game.ts               # Main controller, state machine, game loop
│   ├── Board.ts              # 10x12 grid (5x6 tiles, each 2x2 cells)
│   ├── Tile.ts               # Tile class with merge/remove animations
│   ├── Physics.ts            # Gravity, collision, merge logic
│   ├── Spawner.ts            # Dynamic weighted tile spawning
│   └── InputHandler.ts       # Keyboard + touch controls
├── renderer/
│   ├── BoardRenderer.ts      # Grid and tile rendering
│   └── UIRenderer.ts         # Score, next preview, overlays
└── utils/
    ├── constants.ts          # Grid size, colors, timings
    └── SeededRNG.ts          # Deterministic RNG (Mulberry32)
```

## Key Technical Details

### Grid System

- **Grid Size**: 10 columns × 12 rows (GRID_WIDTH, GRID_HEIGHT)
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

- **Initial**: Only k=1 (2) at 60% and k=2 (4) at 30%
- **Unlock**: When you create a tile of value X, tiles of value X/2 can spawn
- **Scaling**: Each tier has weight = previous × 0.35 (minimum 2%)

```
Constants in src/utils/constants.ts:
- GRAVITY_INTERVAL_MS = 700      // Drop speed
- SOFT_DROP_INTERVAL_MS = 70     // Fast drop speed
- BASE_WEIGHTS = [45, 40]        // 2s and 4s base spawn rates
- TIER_WEIGHT_MULTIPLIER = 0.5   // Decay for higher tiers
- MIN_TIER_WEIGHT = 5            // Minimum spawn weight
```

### Scoring Formula

```
points = floor(basePoints × multiMergeMultiplier × comboMultiplier)

basePoints = 2^(newK)
multiMergeMultiplier = tilesAbsorbed (1x, 2x, 3x, 4x)
comboMultiplier = 1 + (comboCount - 1) × 0.5
```

### Animation Sequence

1. **Pause** (80ms) - Brief delay before merge
2. **Suck** (150ms) - Tiles pull into absorber with scale anticipation
3. **Value Update** - Tile visual updates to new number
4. **Pop** (180ms) - Elastic bounce on upgraded tile
5. **Gravity** (30ms delay) - Tile falls to new position
6. **Chain Check** - Repeat if new matches found

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
6. **Update constants**: Game balance is in `src/utils/constants.ts`
7. **Check coverage**: `npm run test:coverage` shows what needs testing

## License

MIT - See [LICENSE](LICENSE) file for details.
