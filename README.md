# exp^drop

A retro 80s-styled browser puzzle game where tiles with power-of-two values fall into a grid. Match equal tiles to merge them and climb to higher values!

> Vibecoded from zero using [Factory Droid](https://factory.ai/) and Claude.

## Gameplay

- **Board**: 5 tiles wide x 6 tiles tall
- **Tiles**: Each tile occupies a 2x2 cell area, displaying powers of two (2, 4, 8, 16...)
- **Movement**: Tiles move in 2-cell increments to stay grid-aligned

### Merge Rules

Tiles merge **only when touching tiles of equal value** (orthogonally adjacent):

- The newly placed tile absorbs ALL matching neighbors simultaneously
- Each absorbed tile increases the value by one level
- Example: An 8 touching two other 8s becomes 32 (8 -> 16 -> 32)

### Merge Animation Sequence

1. Matching tiles get pulled/sucked into the new tile
2. The tile's value updates to show the new number
3. Pop animation on the upgraded tile
4. Gravity pulls the tile down
5. Chain continues if new matches are found

### Dynamic Spawning

- Start with only 2s and 4s spawning
- Higher values unlock as you create them on the board
- Higher values spawn less frequently (sliding scale)

### Scoring

- Base points = resulting tile value
- **Multi-merge bonus**: Absorbing multiple tiles multiplies points (2x, 3x, 4x...)
- **Combo bonus**: Chain merges increase multiplier (1x, 1.5x, 2x, 2.5x...)

## Controls

**Keyboard:**

- Arrow Left / J: Move left
- Arrow Right / L: Move right
- Arrow Down / K / Space: Hard drop
- P / Escape: Pause
- R: Restart

**Mobile Touch:**

- **Tap on board (left/right of tile)**: Tile slides to that column with animation, then drops
- **Tap on tile**: Soft drop (faster falling)
- **Tap below tile**: Hard drop
- **Drag left/right**: Move tile by columns (grid-aligned)
- **Pause button**: Tap "PAUSE"/"CONTINUE" button in top-right corner
- **Restart button**: Tap "RESTART" on game over screen

> Note: Touch-to-drop uses a smooth 120ms slide animation. Tiles move in discrete column steps during drag.

## Running the Game

### Option 1: Download Release

Download the latest release from [Releases](https://github.com/coredump/exp-drop/releases), extract, and open `index.html` in your browser or serve with any static file server:

```bash
# Using Python
python -m http.server 8080

# Using Node.js
npx serve .
```

### Option 2: Docker

```bash
# Using pre-built image
docker run -p 8080:80 ghcr.io/coredump/exp-drop:latest

# Or using Docker Compose
docker compose up

# Or build locally
docker build -t exp-drop .
docker run -p 8080:80 exp-drop
```

Then open http://localhost:8080

### Option 3: From Source

```bash
npm install
npm run dev      # Development server
npm run build    # Production build
npm run preview  # Preview production build
```

## Configuration

Customize game parameters by editing `game.config.json` in the project root:

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

| Parameter                     | Description                            |
| ----------------------------- | -------------------------------------- |
| `gridHeight`                  | Number of visible rows (default: 12)   |
| `spawnWeights.base2`          | Spawn weight for 2-tiles (default: 45) |
| `spawnWeights.base4`          | Spawn weight for 4-tiles (default: 40) |
| `spawnWeights.tierMultiplier` | Weight decay per tier (default: 0.5)   |
| `spawnWeights.minWeight`      | Minimum spawn weight (default: 5)      |
| `tierWindowSize`              | Tiers kept in spawn pool (default: 6)  |

Delete the file to use defaults. Partial configs are supported (unspecified values use defaults).

## Tech Stack

- **Renderer**: PixiJS 8.x (WebGL/WebGPU)
- **Build**: Vite + TypeScript
- **Font**: Press Start 2P (Google Fonts)
- **Style**: 80s Neon aesthetic

## Project Structure

```
game.config.json            # Game configuration (optional)
src/
  main.ts                   # Entry point, loading screen
  game/
    Game.ts                 # Main game controller
    Board.ts                # Grid state management
    Tile.ts                 # Tile class with animations
    Physics.ts              # Gravity and merge resolution
    Spawner.ts              # Dynamic weighted tile spawning
    InputHandler.ts         # Keyboard and touch input
  renderer/
    BoardRenderer.ts        # Grid and tile rendering
    UIRenderer.ts           # Score, preview, overlays
  utils/
    constants.ts            # Grid size, colors, timings
    config.ts               # Configuration loader
    SeededRNG.ts            # Deterministic random numbers
```

## License

[MIT](LICENSE) - see [LICENSE](LICENSE) for details.
