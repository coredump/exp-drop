import { Application, Ticker } from 'pixi.js';
import { Board } from './Board';
import { Tile } from './Tile';
import { Physics } from './Physics';
import { Spawner, SpawnerConfig } from './Spawner';
import { InputHandler, InputAction } from './InputHandler';
import { BoardRenderer } from '../renderer/BoardRenderer';
import { UIRenderer } from '../renderer/UIRenderer';
import {
  SPAWN_X,
  SPAWN_Y,
  GRAVITY_INTERVAL_MS,
  gravityIntervalMs,
  TILE_SIZE,
  CELL_SIZE,
  GRID_WIDTH,
  GRID_HEIGHT,
} from '../utils/constants';

type GameState = 'playing' | 'paused' | 'gameOver' | 'animating';

export class Game {
  private app: Application;
  private board: Board;
  private physics: Physics;
  private spawner: Spawner;
  private inputHandler: InputHandler;
  private boardRenderer: BoardRenderer;
  private uiRenderer: UIRenderer;

  private activeTile: Tile | null = null;
  private nextK = 1;
  private score = 0;
  private highestTile = 2;
  // Highest tier created this run (monotonic). Drives the gravity ramp.
  private highestK = 2;
  private state: GameState = 'playing';

  private lastGravityTime = 0;
  private gravityInterval: number = GRAVITY_INTERVAL_MS;

  private comboCount = 0;

  // Seed lineage: each restart advances deterministically from the base seed
  // rather than jumping to wall-clock time, so a run is reproducible from
  // (seed, runIndex) alone.
  private readonly baseSeed: number;
  private runIndex = 0;

  // Input cooldown to prevent touch events from UI buttons affecting gameplay
  private inputCooldownUntil = 0;
  private readonly INPUT_COOLDOWN_MS = 100;

  // Visual x of the active tile in pixels (eases toward the logical column)
  private activeVisualX = 0;
  // Frozen fall progress while paused, so resuming doesn't rewind the tile
  private pausedElapsed = 0;

  constructor(app: Application, seed?: number, spawnerConfig?: SpawnerConfig) {
    this.app = app;
    this.baseSeed = seed ?? Date.now();
    this.board = new Board();
    this.physics = new Physics(this.board);
    this.spawner = new Spawner(this.baseSeed, spawnerConfig);
    this.inputHandler = new InputHandler();
    this.boardRenderer = new BoardRenderer(this.board);
    this.uiRenderer = new UIRenderer();

    this.setupLayout();
    this.setupInput();
    this.app.stage.addChild(this.boardRenderer.container);
    this.app.stage.addChild(this.uiRenderer.container);
  }

  private setupLayout(): void {
    const gridWidth = this.boardRenderer.getGridPixelWidth();
    const gridHeight = this.boardRenderer.getGridPixelHeight();
    const screenWidth = this.app.screen.width;
    const screenHeight = this.app.screen.height;

    const nextPreviewSize = TILE_SIZE * CELL_SIZE + 20;
    const previewTotalHeight = 18 + nextPreviewSize;
    const minTopSpace = previewTotalHeight + 20; // Minimum space for UI above grid

    const gridX = (screenWidth - gridWidth) / 2;
    // Ensure grid starts below the top UI elements
    const gridY = Math.max(minTopSpace, (screenHeight - gridHeight) / 2);

    const topBarY = Math.max(10, gridY - previewTotalHeight - 10);
    const pauseButtonWidth = 80;

    this.boardRenderer.setPosition(gridX, gridY);
    this.uiRenderer.setScorePosition(gridX + 40, topBarY);
    this.uiRenderer.setNextPreviewPosition(gridX + (gridWidth - nextPreviewSize) / 2, topBarY);
    this.uiRenderer.setPauseButtonPosition(gridX + gridWidth - pauseButtonWidth, topBarY);
    this.uiRenderer.setOverlayPosition(gridX + gridWidth / 2, gridY + gridHeight / 2);
    this.uiRenderer.setGridCenter(gridX + gridWidth / 2, gridY + gridHeight / 2);

    // Position keybindings to the right of the grid, vertically centered with grid
    const keybindingsX = gridX + gridWidth + 20;
    const keybindingsY = gridY + gridHeight / 2 - 30;
    this.uiRenderer.setKeybindingsPosition(keybindingsX, keybindingsY);
  }

  private setupInput(): void {
    this.inputHandler.setCallback((action: InputAction) => {
      this.handleInput(action);
    });
    this.inputHandler.enable();

    // Same 'animating' guard the keyboard path uses - without it a tap during
    // a cascade reaches togglePause(), matches no branch, and silently does
    // nothing.
    this.uiRenderer.setPauseButtonCallback(() => {
      if (this.state !== 'animating') this.togglePause();
    });

    this.uiRenderer.setRestartButtonCallback(() => {
      if (this.state !== 'animating') this.restart();
    });
  }

  private handleInput(action: InputAction): void {
    if (action === 'restart' && this.state !== 'animating') {
      this.restart();
      return;
    }

    if (action === 'pause' && this.state !== 'animating') {
      this.togglePause();
      return;
    }

    if (this.state !== 'playing' || !this.activeTile) return;

    // Check input cooldown (prevents touch events from UI buttons affecting gameplay)
    if (performance.now() < this.inputCooldownUntil) return;

    // Handle dropToColumn action (object type with column property)
    if (typeof action === 'object') {
      this.dropToColumn(action.column);
      return;
    }

    switch (action) {
      case 'left':
        this.moveActiveTile(-TILE_SIZE, 0);
        break;
      case 'right':
        this.moveActiveTile(TILE_SIZE, 0);
        break;
      case 'hardDrop':
        this.hardDrop();
        break;
    }
  }

  private moveActiveTile(dx: number, dy: number): boolean {
    if (!this.activeTile) return false;

    const newX = this.activeTile.x + dx;
    const newY = this.activeTile.y + dy;

    // Check bounds
    if (newX < 0 || newX + TILE_SIZE > GRID_WIDTH) return false;

    // canMoveDown() already validates a full TILE_SIZE step, so one check
    // covers the whole move. (This used to loop `dy` times, conflating a
    // distance with an iteration count.)
    if (dy > 0 && !this.physics.canMoveDown(this.activeTile)) return false;
    if (dx < 0 && !this.physics.canMoveLeft(this.activeTile)) return false;
    if (dx > 0 && !this.physics.canMoveRight(this.activeTile)) return false;

    this.activeTile.setPosition(newX, newY);
    // No sprite update here: the active tile's visual position is driven
    // every frame by the continuous-motion block in update(). Lateral moves
    // ease toward the new column; vertical progress is interpolated across
    // the gravity interval.
    this.updateTouchZone();
    return true;
  }

  private hardDrop(): void {
    if (!this.activeTile) return;

    while (this.moveActiveTile(0, TILE_SIZE)) {
      // Keep moving down until blocked
    }
    this.lockActiveTile();
  }

  private dropToColumn(targetX: number): void {
    const tile = this.activeTile;
    if (!tile) return;

    // Clamp target to valid range, and snap to the TILE_SIZE grid. Without the
    // snap an odd target makes the stride-2 walk below skip past it forever.
    const snappedX = Math.floor(targetX / TILE_SIZE) * TILE_SIZE;
    if (snappedX < 0 || snappedX + TILE_SIZE > GRID_WIDTH) return;

    // If already at target column, just hard drop
    if (tile.x === snappedX) {
      this.hardDrop();
      return;
    }

    // Check if horizontal path is clear at current Y position
    const direction = snappedX > tile.x ? 1 : -1;
    const canMove = (): boolean =>
      direction > 0 ? this.physics.canMoveRight(tile) : this.physics.canMoveLeft(tile);

    // Simulate moving step by step to check path
    const originalX = tile.x;
    let pathClear = true;

    // Move in TILE_SIZE increments
    for (let x = originalX; x !== snappedX; x += direction * TILE_SIZE) {
      if (!canMove()) {
        pathClear = false;
        break;
      }
      // Temporarily move tile to check next position
      tile.setPosition(tile.x + direction * TILE_SIZE, tile.y);
    }

    // Restore original position
    tile.setPosition(originalX, tile.y);

    if (!pathClear) {
      // Path is blocked, do nothing
      return;
    }

    // Animate the horizontal movement
    this.state = 'animating';
    tile.playHorizontalMoveAnimation(snappedX, () => {
      this.boardRenderer.updateTilePosition(tile);
      this.updateTouchZone();
      this.state = 'playing';
      this.hardDrop();
    });
  }

  private lockActiveTile(): void {
    if (!this.activeTile) return;

    this.state = 'animating';
    // Snap to the exact grid position - the continuous-motion presentation
    // may have the sprite mid-ease, and merge animations target exact cells.
    this.boardRenderer.updateTilePosition(this.activeTile);
    if (!this.board.placeTile(this.activeTile)) {
      // Should be unreachable: movement is validated before every step. If it
      // ever happens, the sprite would linger as a ghost with no grid entry,
      // so fail loudly rather than silently corrupting the board.
      console.error('placeTile rejected a locked tile at', this.activeTile.x, this.activeTile.y);
    }
    const justPlacedTile = this.activeTile;
    this.activeTile = null;

    // The resolve chain spans several awaits while state is 'animating'. An
    // unhandled rejection here would strand the game in that state forever
    // with all input inert, so recover explicitly.
    void this.resolveWithAnimation(justPlacedTile).catch((error: unknown) => {
      console.error('Board resolution failed; recovering:', error);
      this.state = 'playing';
      this.spawnTile();
    });
  }

  private async resolveWithAnimation(justPlacedTile: Tile): Promise<void> {
    // Process the just-placed tile first - it has priority for merging
    await this.resolveTileChain(justPlacedTile);

    await this.updateHighestTile();

    // Validate nextK in case the threshold changed and it became invalid
    this.nextK = this.spawner.validateExponent(this.nextK);
    this.uiRenderer.updateNextPreview(this.nextK);

    this.state = 'playing';
    this.spawnTile();
  }

  private async resolveTileChain(priorityTile: Tile | null): Promise<void> {
    // First, resolve the priority tile (just placed) completely
    if (priorityTile && this.board.getTile(priorityTile.x, priorityTile.y) === priorityTile) {
      await this.resolveOneTile(priorityTile);
    }

    // Then handle any cascading effects from other tiles
    let stable = false;
    while (!stable) {
      stable = true;

      // Apply gravity to all floating tiles
      const movedTiles = this.physics.applyGravity();

      if (movedTiles.length > 0) {
        stable = false;
        // Glide the movers to their settled positions (applyGravity already
        // settled them fully, so multi-row falls become one smooth motion).
        // A snap-all here would cancel the glides mid-flight.
        for (const movedTile of movedTiles) {
          movedTile.glideToGridPosition();
        }
        await this.delay(30);

        // Each moved tile might trigger new merges
        for (const movedTile of movedTiles) {
          if (this.board.getTile(movedTile.x, movedTile.y) === movedTile) {
            await this.resolveOneTile(movedTile);
          }
        }
      }
    }
  }

  private async resolveOneTile(tile: Tile): Promise<void> {
    // Keep merging and falling until this tile is stable
    let tileActive = true;

    while (tileActive) {
      tileActive = false;

      // Check if tile still exists
      if (this.board.getTile(tile.x, tile.y) !== tile) break;

      // Try to merge with ALL matching neighbors at once
      const mergeResult = this.physics.tryMerge(tile);

      if (mergeResult.merged) {
        tileActive = true;
        this.comboCount++;

        // Calculate points with multipliers
        const points = this.calculatePoints(
          mergeResult.basePoints,
          mergeResult.tilesAbsorbed,
          this.comboCount
        );
        this.score += points;
        this.uiRenderer.updateScore(this.score);

        // Show multiplier feedback
        const multiMerge = mergeResult.tilesAbsorbed > 1;
        const combo = this.comboCount > 1;
        if (multiMerge || combo) {
          this.uiRenderer.showMultiplier(mergeResult.tilesAbsorbed, this.comboCount);
        }

        // Quick pause before sucking animation
        await this.delay(80);

        // Animate this merge
        await this.animateSingleMerge(mergeResult);

        // Update tile positions after merge
        this.boardRenderer.updateAllTiles();
      }

      // Check if tile still exists after merge
      if (this.board.getTile(tile.x, tile.y) !== tile) break;

      // Try to fall
      if (this.physics.canMoveDown(tile)) {
        tileActive = true;
        this.board.removeTileFromGrid(tile);
        tile.setPosition(tile.x, tile.y + TILE_SIZE);
        this.board.placeTile(tile);

        // Consecutive step-glides retarget from the current visual position,
        // so a tile falling several rows reads as one continuous slide.
        tile.glideToGridPosition();
        await this.delay(30);
      }
    }
  }

  private async animateSingleMerge(merge: {
    removedTiles: { tile: Tile; fromX: number; fromY: number }[];
    upgradedTile: Tile | null;
  }): Promise<void> {
    return new Promise((resolve) => {
      if (!merge.upgradedTile || merge.removedTiles.length === 0) {
        resolve();
        return;
      }

      const upgraded = merge.upgradedTile;
      this.boardRenderer.updateTilePosition(upgraded);
      const targetX = upgraded.sprite.x;
      const targetY = upgraded.sprite.y;

      let animationsRemaining = merge.removedTiles.length;

      for (const info of merge.removedTiles) {
        info.tile.setPosition(info.fromX, info.fromY);
        this.boardRenderer.updateTilePosition(info.tile);

        info.tile.playRemoveAnimation(targetX, targetY, () => {
          this.boardRenderer.removeTileSprite(info.tile);
          info.tile.destroy();
          animationsRemaining--;

          if (animationsRemaining === 0) {
            // All tiles sucked in - NOW update the visual to show new value
            upgraded.updateVisual();

            // Then pop animation
            upgraded.playMergeAnimation(() => {
              resolve();
            });
          }
        });
      }
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private calculatePoints(basePoints: number, tilesAbsorbed: number, comboCount: number): number {
    // Multi-merge multiplier: absorbing multiple tiles at once
    // 1 tile = 1x, 2 tiles = 2x, 3 tiles = 3x, 4 tiles = 4x
    const multiMergeMultiplier = tilesAbsorbed;

    // Combo multiplier: chain merges
    // 1st merge = 1x, 2nd = 1.5x, 3rd = 2x, 4th = 2.5x, etc.
    const comboMultiplier = 1 + (comboCount - 1) * 0.5;

    const totalMultiplier = multiMergeMultiplier * comboMultiplier;
    return Math.floor(basePoints * totalMultiplier);
  }

  private async updateHighestTile(): Promise<void> {
    const tiles = new Set(this.board.getAllTiles());
    let maxK = 1;
    for (const tile of tiles) {
      if (tile.k > maxK) {
        maxK = tile.k;
      }
      const value = Math.pow(2, tile.k);
      if (value > this.highestTile) {
        this.highestTile = value;
      }
    }
    // Gravity ramp: every new best tier speeds up the fall permanently
    // (for this run). maxK can drop when tiles merge away, so gate on the
    // monotonic highestK rather than the board's current maximum.
    if (maxK > this.highestK) {
      this.highestK = maxK;
      this.gravityInterval = gravityIntervalMs(maxK);
    }

    // Update spawner with current max tile to unlock new spawn tiers
    const tierChanged = this.spawner.updateMaxTile(maxK);

    // If tier threshold changed, remove lower tier tiles from the board
    if (tierChanged) {
      await this.removeLowTierTiles(this.spawner.getMinTierK());
    }
  }

  /**
   * Remove tiles below the minimum tier threshold from the board.
   * After removal, applies gravity and triggers merge logic.
   *
   * Dormant with the shipped config (tierWindowSize is deliberately high, see
   * game.config.json) - kept because the threshold is config-driven.
   */
  private async removeLowTierTiles(minK: number): Promise<void> {
    const tilesToRemove: Tile[] = [];

    // Deduplicate tiles (each tile occupies multiple grid cells)
    for (const tile of new Set(this.board.getAllTiles())) {
      if (tile.k < minK) {
        tilesToRemove.push(tile);
      }
    }

    if (tilesToRemove.length === 0) {
      return;
    }

    // Remove from grid and animate disappearance
    const animationPromises: Promise<void>[] = [];

    for (const tile of tilesToRemove) {
      // Remove from grid immediately
      this.board.removeTileFromGrid(tile);

      // Animate the disappearance
      animationPromises.push(
        new Promise<void>((resolve) => {
          tile.playDisappearAnimation(() => {
            this.boardRenderer.removeTileSprite(tile);
            tile.destroy();
            resolve();
          });
        })
      );
    }

    // Wait for all animations to complete
    await Promise.all(animationPromises);

    // Apply gravity and check for merges (tiles falling into new positions)
    await this.resolveTileChain(null);
  }

  private spawnTile(): void {
    // Game over when ANY column has stacked to the top row (SPEC 2.1). Runs
    // after resolution has settled, so a tile that briefly touched the top
    // mid-cascade and merged away does not end the game. Tiles are 2x2 at even
    // y, so "top row occupied" is exactly "some settled tile rests at y = 0" -
    // which also covers the spawn cells being blocked.
    if (this.isTopRowOccupied()) {
      this.gameOver();
      return;
    }

    // Reset combo when new tile spawns
    this.comboCount = 0;

    this.activeTile = new Tile(this.nextK, SPAWN_X, SPAWN_Y);
    this.activeVisualX = SPAWN_X * CELL_SIZE;
    this.boardRenderer.addTileSprite(this.activeTile);
    this.boardRenderer.updateTilePosition(this.activeTile);

    this.nextK = this.spawner.getNextExponent();
    this.uiRenderer.updateNextPreview(this.nextK);

    this.lastGravityTime = performance.now();
    this.updateTouchZone();
  }

  private isTopRowOccupied(): boolean {
    for (let x = 0; x < GRID_WIDTH; x++) {
      if (this.board.getTile(x, SPAWN_Y) !== null) return true;
    }
    return false;
  }

  private togglePause(): void {
    if (this.state === 'playing') {
      this.state = 'paused';
      // Freeze fall progress so resuming doesn't visually rewind the tile
      this.pausedElapsed = performance.now() - this.lastGravityTime;
      this.uiRenderer.showPause();
      this.uiRenderer.updatePauseButtonState(true);
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.uiRenderer.hidePause();
      this.uiRenderer.updatePauseButtonState(false);
      this.lastGravityTime = performance.now() - this.pausedElapsed;
    }
  }

  private gameOver(): void {
    this.state = 'gameOver';
    this.uiRenderer.showGameOver(this.score, this.highestTile);
  }

  private restart(): void {
    // The active tile is never in the grid, so board.clear() cannot reach it.
    // Without this it leaks its Graphics + Text on every restart.
    if (this.activeTile) {
      this.boardRenderer.removeTileSprite(this.activeTile);
      this.activeTile.destroy();
    }

    this.board.clear();
    this.boardRenderer.clear();

    this.activeTile = null;
    this.score = 0;
    this.highestTile = 2;
    this.highestK = 2;
    this.gravityInterval = GRAVITY_INTERVAL_MS;
    this.comboCount = 0;
    this.state = 'playing';
    this.lastGravityTime = performance.now();

    // Set input cooldown to prevent touch event from restart button affecting new game
    this.inputCooldownUntil = performance.now() + this.INPUT_COOLDOWN_MS;

    this.uiRenderer.hideGameOver();
    this.uiRenderer.hidePause();
    this.uiRenderer.updateScore(0);

    // Advance the seed deterministically instead of reseeding from wall-clock
    // time, so (baseSeed, runIndex) still reproduces any run exactly.
    this.runIndex++;
    this.spawner.setSeed(this.baseSeed + this.runIndex);
    this.spawner.resetUnlocks(); // Reset spawn tiers on restart
    this.nextK = this.spawner.getNextExponent();
    this.uiRenderer.updateNextPreview(this.nextK);

    this.spawnTile();
  }

  update(ticker: Ticker): void {
    if (this.state !== 'playing' || !this.activeTile) return;

    const now = performance.now();

    if (now - this.lastGravityTime >= this.gravityInterval) {
      if (!this.moveActiveTile(0, TILE_SIZE)) {
        this.lockActiveTile();
        return; // tile is locked and gone; presentation resumes on next spawn
      }
      this.lastGravityTime = now;
    }

    // Continuous-motion presentation: the active tile is always visibly in
    // motion instead of hopping row to row. Vertical position interpolates
    // linearly across the gravity interval (only while it can actually
    // fall); horizontal eases exponentially toward the logical column.
    // Logic stays fully grid-locked - this is presentation only.
    const fallFraction = this.physics.canMoveDown(this.activeTile)
      ? Math.min((performance.now() - this.lastGravityTime) / this.gravityInterval, 1)
      : 0;
    const targetX = this.activeTile.x * CELL_SIZE;
    // ~40ms time constant: fast enough to feel immediate, no teleport
    const alpha = 1 - Math.exp(-ticker.deltaMS / 40);
    this.activeVisualX += (targetX - this.activeVisualX) * alpha;
    if (Math.abs(targetX - this.activeVisualX) < 0.5) this.activeVisualX = targetX;

    const visualY = (this.activeTile.y + fallFraction * TILE_SIZE) * CELL_SIZE;
    this.activeTile.setVisualPosition(this.activeVisualX, visualY);
  }

  start(): void {
    this.nextK = this.spawner.getNextExponent();
    this.uiRenderer.updateNextPreview(this.nextK);
    this.spawnTile();
    this.app.ticker.add(this.update, this);
  }

  destroy(): void {
    this.inputHandler.disable();
    this.app.ticker.remove(this.update, this);
  }

  public relayout(): void {
    this.setupLayout();
  }

  private updateTouchZone(): void {
    if (!this.activeTile) {
      this.inputHandler.setTouchZone(null);
      return;
    }

    const boardX = this.boardRenderer.container.x;
    const boardY = this.boardRenderer.container.y;

    const tileScreenX = boardX + this.activeTile.x * CELL_SIZE;
    const tileScreenY = boardY + this.activeTile.y * CELL_SIZE;
    const tileWidth = TILE_SIZE * CELL_SIZE;
    const tileHeight = TILE_SIZE * CELL_SIZE;

    this.inputHandler.setTouchZone({
      tileScreenX,
      tileScreenY,
      tileWidth,
      tileHeight,
      boardScreenX: boardX,
      boardScreenY: boardY,
      boardScreenWidth: GRID_WIDTH * CELL_SIZE,
      boardScreenHeight: GRID_HEIGHT * CELL_SIZE,
    });
  }
}
