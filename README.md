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

**Mobile:**
- Swipe left/right: Move
- Swipe down: Hard drop
- Tap: Pause

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

## Tech Stack

- **Renderer**: PixiJS 8.x (WebGL/WebGPU)
- **Build**: Vite + TypeScript
- **Font**: Press Start 2P (Google Fonts)
- **Style**: 80s Neon aesthetic

## Project Structure

```
src/
  main.ts                 # Entry point
  game/
    Game.ts               # Main game controller
    Board.ts              # Grid state management
    Tile.ts               # Tile class with animations
    Physics.ts            # Gravity and merge resolution
    Spawner.ts            # Dynamic weighted tile spawning
    InputHandler.ts       # Keyboard and touch input
  renderer/
    BoardRenderer.ts      # Grid and tile rendering
    UIRenderer.ts         # Score, preview, overlays
  utils/
    constants.ts          # Game configuration
    SeededRNG.ts          # Deterministic random numbers
```

## License

[MIT](LICENSE) - see [LICENSE](LICENSE) for details.
