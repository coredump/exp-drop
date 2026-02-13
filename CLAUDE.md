# exp^drop - Project Memory

> Vibecoded from zero using [Factory Droid](https://factory.ai/) and Claude.

## Project Overview

Retro 80s neon puzzle game built with PixiJS 8.x and TypeScript. Tiles with power-of-two values fall into a grid; matching adjacent tiles merge.

**Repo**: https://github.com/coredump/exp-drop

## Tech Stack

- **Renderer**: PixiJS 8.x (WebGL/WebGPU)
- **Build**: Vite 7.x + TypeScript 5.x
- **Styling**: 80s Neon aesthetic, Press Start 2P font
- **License**: MIT

## Architecture

```
src/
├── main.ts                    # Entry point - PixiJS app init
├── game/
│   ├── Game.ts               # Main controller, state machine, game loop
│   ├── Board.ts              # 10x12 grid (5x6 tiles, each 2x2 cells)
│   ├── Tile.ts               # Tile class with merge/remove animations
│   ├── Physics.ts            # Gravity, collision, merge logic
│   ├── Spawner.ts            # Weighted tile spawning (45% 2s, 40% 4s)
│   └── InputHandler.ts       # Keyboard + touch controls
├── renderer/
│   ├── BoardRenderer.ts      # Grid and tile rendering
│   └── UIRenderer.ts         # Score, next preview, overlays, keybindings
└── utils/
    ├── constants.ts          # Grid size, colors, timings
    └── SeededRNG.ts          # Deterministic RNG
```

## Key Constants (src/utils/constants.ts)

- Grid: 10 cols × 12 rows (GRID_WIDTH, GRID_HEIGHT)
- Tile size: 2×2 cells (TILE_SIZE)
- Cell size: 32px (CELL_SIZE)
- Gravity: 700ms (GRAVITY_INTERVAL_MS)
- Spawn buffer: 2 rows above visible area

## Controls

- **←→ / JL**: Move left/right
- **↓ / K / Space**: Hard drop
- **P / Escape**: Pause
- **R**: Restart
- **Touch**: Swipe to move/drop, tap to pause

## Merge Rules

- Tiles merge only when orthogonally adjacent AND same value
- Absorbs ALL matching neighbors simultaneously
- New exponent = original + number absorbed
- Example: 8 absorbs two 8s → 32 (k=3 + 2 = 5)

## Scoring

```
points = floor(basePoints × multiMergeMultiplier × comboMultiplier)
```
- Base points = 2^(new exponent)
- Multi-merge: 1x, 2x, 3x, 4x (per tiles absorbed)
- Combo: 1x, 1.5x, 2x, 2.5x... (chain merges)

## Spawn Weights (src/game/Spawner.ts)

- 2 (k=1): 45%
- 4 (k=2): 40%
- Higher tiers: 0.5× previous weight (min 5%)
- Unlock: Create a tile to unlock spawning one tier below

## CI/CD Workflows (.github/workflows/)

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| security.yml | push, PR, weekly | CodeQL, OSV-Scanner, gitleaks |
| dependency-review.yml | PR | Block high-severity vulnerabilities |
| deploy.yml | push to main | GitHub Pages deployment |
| release.yml | tags (v*) | Create zip/tar.gz releases |
| docker.yml | push, PR, tags | Build & push to ghcr.io |

## Deployment Options

1. **GitHub Pages**: Auto-deployed on push to main
2. **Release**: Download from releases, serve static files
3. **Docker**: `docker run -p 8080:80 ghcr.io/coredump/exp-drop:latest`
4. **Docker Compose**: `docker compose up`

## Commands

```bash
npm run dev      # Development server
npm run build    # Production build
npm run preview  # Preview production build
```

## Conventions

- Conventional commits (feat, fix, chore, docs, ci)
- No co-author lines in commits
- TypeScript strict mode enabled
- PixiJS 8.x async init pattern: `await app.init({})`
