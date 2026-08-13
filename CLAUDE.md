# CLAUDE.md - exp^drop

> AI-agent documentation for the exp^drop puzzle game

## Project Overview

**exp^drop** is a retro 80s neon-styled browser puzzle game where tiles with power-of-two values fall and merge. Built with PixiJS 8.x and TypeScript.

**Repository**: https://github.com/coredump/exp-drop

## Prerequisites

- **Nix** with flakes enabled — provides the toolchain via `flake.nix`
- **Node.js 24** — pinned by the devshell (`nodejs_24`); npm comes with it

The devshell is the only supported toolchain source. Node is pinned to 24 in
four places that must stay in sync: `flake.nix`, `.github/workflows/ci.yml`,
`.github/workflows/deploy.yml`, `.github/workflows/release.yml`, and
`Dockerfile`.

## Quick Start

### Enter the devshell

```bash
nix develop
```

With [direnv](https://direnv.net/) installed, `direnv allow` once and the shell
loads automatically on `cd` (see `.envrc`).

### Single Command Setup

```bash
npm install
```

### Development Server

```bash
npm run dev
```

Opens at http://localhost:5173

### Production Build

```bash
npm run build
```

Output in `dist/` directory.

### Running commands without entering the shell

```bash
nix develop -c npm run quality
```

## Development Workflow

### Code Quality Checks

```bash
# Type checking
npm run typecheck

# Linting
npm run lint          # Check for issues
npm run lint:fix      # Auto-fix issues

# Formatting
npm run format        # Format all code
npm run format:check  # Check formatting

# Run all quality checks
npm run quality       # typecheck + lint + test
```

### Testing

```bash
# Run tests once
npm run test

# Watch mode (re-run on changes)
npm run test:watch

# Coverage report
npm run test:coverage

# Interactive UI
npm run test:ui
```

**Coverage Thresholds**: 27% lines, 34% functions, 34% branches, 29% statements
— a **ratchet pinned at the current floor**, not a target. Raise it as coverage
improves; the long-term goal is 60/60/50/60.

`vitest.config.ts` sets `coverage.include: ['src/**/*.ts']`. That line is
load-bearing: without it v8 instruments only files a test already imports, so
untested files vanish from the denominator entirely. (This repo previously
reported 61% while the true figure over the whole tree was 22%.) Don't remove
it to make the number look better.

The uncovered remainder is almost entirely `Game.ts`, the two renderers, and
`main.ts` — all of which need a PixiJS stub to reach.

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

public/game.config.json        # External game configuration (copied verbatim to dist/)
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
- **Tap on tile**: Hard drop
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
- There is no soft drop — it was specified but never wired up, and was removed
  rather than left as a dead action. Every tap that isn't a column slide or an
  off-board nudge is a hard drop.
- Pause and restart buttons only visible on touch devices

## Key Technical Details

### Game Configuration

The game supports external configuration via `public/game.config.json`. If the file is missing or invalid, defaults are used.

**File: `public/game.config.json`**

```json
{
  "gridHeight": 12,
  "spawnWeights": {
    "base2": 45,
    "base4": 40,
    "tierMultiplier": 0.5,
    "minWeight": 5
  },
  "tierWindowSize": 6,
  "spawnLag": 1
}
```

| Parameter                     | Description                                         | Default | **Shipped** |
| ----------------------------- | --------------------------------------------------- | ------- | ----------- |
| `gridHeight`                  | Number of visible rows (not including spawn buffer) | 12      | **14**      |
| `spawnWeights.base2`          | Spawn weight for k=1 (value 2) tiles                | 45      | **55**      |
| `spawnWeights.base4`          | Spawn weight for k=2 (value 4) tiles                | 40      | **45**      |
| `spawnWeights.tierMultiplier` | Weight decay for each additional tier               | 0.5     | 0.5         |
| `spawnWeights.minWeight`      | Minimum spawn weight for any tier                   | 5       | **1**       |
| `tierWindowSize`              | Number of tiers to keep in spawn pool               | 6       | **18**      |
| `spawnLag`                    | Top tiers below max that never spawn (built only)   | 1       | **3**       |
| `initialMaxSpawnTier`         | Tiers spawnable from the start of a run             | 2       | **5**       |

> ⚠️ **The shipped `game.config.json` deliberately differs from `DEFAULT_CONFIG`.
> Do not "reconcile" them.** The values in bold are tuned balance, not drift.
>
> In particular `tierWindowSize: 18` is intentional: at the default of 6, low
> tiers were culled fast enough to keep freeing board space, which made the game
> too easy. At 18 the culling path (`Game.removeLowTierTiles`,
> `Spawner.calculateMinTier`) is effectively dormant — it would need a 2^19 tile
> to trigger. That code is kept, not deleted, because the threshold is
> config-driven and the behavior is one config edit away.
>
> `spawnLag: 3` is also intentional (2026-08-13): it slows top-end
> progression (~1.8x more turns to reach 1024, measured by simulation); the
> last `spawnLag` doublings can never spawn and must be hand-built.
> tierMultiplier went 0.5 -> 0.35 -> 0.5 across the same day: 0.35 made the
> stream so base-heavy that the anti-streak cap turned it into alternating
> pairs of 2s and 4s; 0.5 plus the repeat penalty fixed the rhythm.
>
> Note this means the tier-removal path is **not exercised in production**, only
> in `Spawner.test.ts` (which constructs a window of 6 explicitly). Likewise the
> geometry tests assume the default `gridHeight` of 12, not the shipped 14.

**Loading Behavior:**

- Config is loaded asynchronously at startup
- Partial configs are merged with defaults (can override single values)
- A loading screen with "Start" button appears while config/fonts load
- Game only initializes after user clicks Start

> ⚠️ **The config must live in `public/` and be fetched relative to
> `import.meta.env.BASE_URL`** (see `configUrl()` in `src/utils/config.ts`).
> Both halves matter, and both were broken until 2026-08-13:
>
> 1. The file sat in the repo root, so Vite never copied it into `dist/` —
>    it was simply absent from every deployment.
> 2. `loadConfig()` fetched a root-absolute `/game.config.json`, which 404s
>    on GitHub Pages (served from `/exp-drop/`).
>
> Because `loadConfig()` falls back to `DEFAULT_CONFIG` on any failure, the
> production game silently ran defaults — wrong grid height, wrong spawn
> weights, and tier culling **enabled** — while working perfectly in the dev
> server (which serves the repo root). A 404 now logs `console.info` and any
> other failure logs `console.warn`, so a deployment fault is distinguishable
> from an intentionally absent file. Verify sub-path builds by serving `dist/`
> under a nested directory, not just at `/`.

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

- **Base tiles**: k=1 (2) and k=2 (4) with configurable weights, always in the pool
- **Unlock**: Creating a tile of tier k allows tiers up to k − `spawnLag` to
  spawn; the top `spawnLag` tiers must always be built by merging
- **Initial pool**: `initialMaxSpawnTier` floors the spawn cap, so mid tiers
  (shipped: up to 32) appear rarely from the very first drop
- **Scaling**: the base2/base4 weight peak sits at a pool center that
  follows progress (`Spawner.POOL_CENTER_LAG` below the cap, clamped so the
  early game is unchanged); higher tiers decay by tierMultiplier, outgrown
  lower tiers fade by `Spawner.BELOW_CENTER_DECAY` (0.65/step, min
  minWeight). Fixes "still drowning in 2s at 512" without ever removing
  smalls from the pool
- **Anti-streak**: the just-spawned value is down-weighted
  (`Spawner.REPEAT_WEIGHT_PENALTY`, 0.45) and spawns at most twice
  consecutively (`Spawner.MAX_SPAWN_REPEAT`); the third draw excludes it and
  renormalizes. The penalty exists because the hard cap alone produced an
  alternating-pairs rhythm in the base-heavy pool.
  `previewNextExponent()` deliberately uses the non-mutating roll — if a
  peek advanced the run tracking, the NEXT preview would show a different
  tile than the one that spawns
- **Tier Window**: Only the most recent `tierWindowSize` tiers remain in the spawn pool
- **Game over**: any column stacking to the top row ends the game (checked
  after resolution settles, at spawn time)

```
Timing constants in src/utils/constants.ts:
- GRAVITY_INTERVAL_MS = 850      // Base drop speed (k <= 2)
- GRAVITY_RAMP_FACTOR = 0.95     // Interval multiplier per tier created
- GRAVITY_MIN_INTERVAL_MS = 450  // Ramp floor (reached at 32768)
- gravityIntervalMs(k)           // Pure ramp formula - tested in constants.test.ts

The ramp keys off the highest tier CREATED this run (Game.highestK,
monotonic), not the board's current max. Resets on restart.

Spawn weights: see the config table above. DEFAULT_CONFIG lives in
src/utils/config.ts; the shipped overrides live in game.config.json and are
deliberately different.
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

## Design Principle: this is a construction puzzle, not a twitch game

The intended loop is **the board fills up → you merge to reclaim space →
bigger numbers free more space**. Difficulty must come from that spatial
squeeze, not from reaction time.

This has a concrete consequence that is easy to get wrong: **hard drop is the
primary input** (Space / Down / K / most taps), so an engaged player drops as
soon as they have decided. The gravity interval therefore almost never
determines _where_ a tile lands — it only caps how long the player may think.
Speeding it up adds no spatial depth whatsoever; it just puts a shrinking
clock on the same puzzle.

A steep gravity ramp (0.9/tier down to a 250ms floor) was added and then
dialled back for exactly this reason. The current envelope (850ms base,
0.95/tier, 450ms floor) was user-tuned after continuous motion landed:
starting slower and ramping wider-but-gently makes speed serve pacing. A
test enforces the per-tier step stays at most 5%. Before proposing any
"difficulty" change, check which dimension it acts on:

- ✅ **Spatial** — grid height, spawn mix, `spawnLag`, tier culling, garbage
  rows. These change the puzzle.
- ❌ **Temporal** — gravity speed, input windows, animation timing. These
  change how fast you must solve it, and pull the game toward a genre it is
  not trying to be.

## Code Conventions

### TypeScript

- **Strict Mode**: Enabled in `tsconfig.json`
- **Type Safety**: No `any` types, explicit return types required
- **Naming**:
  - Classes/Interfaces: PascalCase (e.g., `BoardRenderer`)
  - Variables/Functions: camelCase (e.g., `canMoveDown`)
  - Constants: UPPER_SNAKE_CASE (e.g., `GRID_WIDTH`)

### Code Quality

These are ESLint `warn`-level rules, but `npm run lint` runs with
`--max-warnings=0`, so **they fail the build**. See `eslint.config.js` for the
authoritative values.

- **Complexity Limit**: Max 15 cyclomatic complexity
- **Function Length**: Max 60 lines (excluding blanks/comments)
- **Max Depth**: 4 levels of nesting

Test files (`*.test.ts`) have `complexity` and `max-lines-per-function` off.

`main` is at **zero warnings** — treat any new one as a regression you
introduced. Prefer extracting a helper over adding an `eslint-disable`.

### Testing

- Test files: `*.test.ts` alongside source files
- Framework: Vitest with jsdom environment
- Coverage: enforced by `npm run test:coverage`, which CI runs as its own step
  (`npm run quality` does **not** include coverage)
- Fully covered today: `Physics`, `Board`, `config`, `SeededRNG`
- Focus areas:
  - Core game logic (Physics, Spawner)
  - Deterministic behavior (SeededRNG)
  - Edge cases (boundaries, collisions)
  - Pure input mapping (`InputHandler.getTouchZoneAction`, `columnActionAt`)
- Assert on behavior, not shape. `expect(Array.isArray(x)).toBe(true)` and
  `expect(x).toBeDefined()` pass against broken implementations — three such
  tests previously hid the fact that `Physics.hardDrop` always returned 0.

## Git Workflow

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new tile animation
fix: correct merge detection for corner tiles
docs: update CLAUDE.md with spawn system
chore: update dependencies
test: add Physics collision tests
```

**Types**: `feat`, `fix`, `docs`, `chore`, `test`, `refactor`, `ci`

### Pull Requests

- All checks must pass (tests, linting, type checking)
- Pre-commit hooks enforce code quality locally
- No force-push to main branch

### CI

`.github/workflows/ci.yml` runs `npm run quality` through the flake
(`nix develop -c ...`) on every PR and push to main. It is the only workflow
that runs tests — `deploy.yml` and `release.yml` build without gating.

Reproduce a CI failure exactly:

```bash
nix develop -c bash -c 'rm -rf node_modules && npm ci && npm run quality'
```

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

## Agent Memory (Hindsight)

This repo's long-term memory lives in Hindsight, not in the repo. The
`hindsight-coding-agents` plugin binds a per-repo bank (`coding-agent::<repo>`)
automatically — there is nothing to configure in this repository. Server and
mode come from `~/.hindsight/coding-agent.json` on the developer's machine.

**Order of operations when you need context:**

1. `hindsight_search_knowledge_pages` / `hindsight_read_knowledge_page` — the
   curated pages (Component map, Conventions and patterns, Core concepts,
   Key decisions and rationale, Initiatives and enhancements). Read these
   before re-deriving architecture from source.
2. `hindsight_reflect` — deep synthesis over raw memory when the pages are too
   shallow and you need the _why_ behind a decision. Slower; use deliberately.
3. `hindsight_capture_initiative` — once, before implementing an approved
   feature. Skip for bug fixes and chores.
4. `hindsight_ingest_document` — external docs, or a `Correction: <topic>` doc
   when you verify a memory is stale. Newer facts supersede older ones.

Credit anything you draw from memory with a blockquote:
`> 🧠 **From Hindsight memory (<page>)** — <facts used>`

Session transcripts are captured automatically at session end — don't retain
conversation content by hand.

**Not used in this repo**: Serena. It was removed along with its `.serena/`
memories; those facts now live in Hindsight or in this file.

## Resources

- **PixiJS Docs**: https://pixijs.com/
- **Vitest Docs**: https://vitest.dev/
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/
- **Nix Flakes**: https://nix.dev/concepts/flakes.html
- **direnv**: https://direnv.net/

## Development Tips for AI Agents

1. **Always run quality checks** before committing: `npm run quality`
2. **Maintain grid alignment**: All tile positions must be multiples of `TILE_SIZE`
3. **Test determinism**: Use fixed seeds in tests to ensure reproducibility
4. **Follow merge rules**: Only equal values merge (`k == k`)
5. **Respect animation sequence**: Don't skip visual updates in the resolution chain
6. **Update config**: Game balance parameters are in `public/game.config.json` (spawn weights, grid height, tier window)
7. **Update constants**: Timing and visual constants are in `src/utils/constants.ts`
8. **Check coverage**: `npm run test:coverage` shows what needs testing
9. **Touch zone updates**: Call `updateTouchZone()` after every tile movement/spawn
10. **Font loading**: Use `display=block` to prevent fallback flash
11. **Responsive layout**: Preview height calculation prevents UI overlap
12. **Config loading**: Config is async - use `loadConfig()` before game starts
13. **Use the devshell**: Run commands via `nix develop -c ...` (or with direnv active) so you get the pinned Node 24, not the host's
14. **Check Hindsight first**: Search the knowledge pages before re-deriving architecture from source
15. **Keep Node pins in sync**: `flake.nix`, `Dockerfile`, and the three workflows all pin 24

## License

MIT - See [LICENSE](LICENSE) file for details.
