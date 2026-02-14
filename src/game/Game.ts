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
  SOFT_DROP_INTERVAL_MS,
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
  private state: GameState = 'playing';

  private lastGravityTime = 0;
  private gravityInterval: number = GRAVITY_INTERVAL_MS;
  private softDropping = false;

  private comboCount = 0;
  private lastDropX: number = SPAWN_X;

  // Input cooldown to prevent touch events from UI buttons affecting gameplay
  private inputCooldownUntil = 0;
  private readonly INPUT_COOLDOWN_MS = 100;

  constructor(app: Application, seed?: number, spawnerConfig?: SpawnerConfig) {
    this.app = app;
    this.board = new Board();
    this.physics = new Physics(this.board);
    this.spawner = new Spawner(seed, spawnerConfig);
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

    this.uiRenderer.setPauseButtonCallback(() => {
      this.togglePause();
    });

    this.uiRenderer.setRestartButtonCallback(() => {
      this.restart();
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
      case 'down':
        this.softDrop();
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

    // Check if can move (for vertical, move by TILE_SIZE increments)
    if (dy > 0) {
      for (let i = 0; i < dy; i++) {
        if (!this.physics.canMoveDown(this.activeTile)) return false;
      }
    }
    if (dx < 0 && !this.physics.canMoveLeft(this.activeTile)) return false;
    if (dx > 0 && !this.physics.canMoveRight(this.activeTile)) return false;

    this.activeTile.setPosition(newX, newY);
    this.boardRenderer.updateTilePosition(this.activeTile);
    this.updateTouchZone();
    return true;
  }

  private softDrop(): void {
    if (this.moveActiveTile(0, TILE_SIZE)) {
      this.lastGravityTime = performance.now();
    } else {
      this.lockActiveTile();
    }
  }

  private hardDrop(): void {
    if (!this.activeTile) return;

    while (this.moveActiveTile(0, TILE_SIZE)) {
      // Keep moving down until blocked
    }
    this.lockActiveTile();
  }

  private dropToColumn(targetX: number): void {
    if (!this.activeTile) return;

    // Clamp target to valid range
    if (targetX < 0 || targetX + TILE_SIZE > GRID_WIDTH) return;

    // If already at target column, just hard drop
    if (this.activeTile.x === targetX) {
      this.hardDrop();
      return;
    }

    // Check if horizontal path is clear at current Y position
    const currentX = this.activeTile.x;
    const direction = targetX > currentX ? 1 : -1;
    const canMove =
      direction > 0
        ? () => this.physics.canMoveRight(this.activeTile!)
        : () => this.physics.canMoveLeft(this.activeTile!);

    // Simulate moving step by step to check path
    const originalX = this.activeTile.x;
    let pathClear = true;

    // Move in TILE_SIZE increments
    for (let x = currentX; x !== targetX; x += direction * TILE_SIZE) {
      if (!canMove()) {
        pathClear = false;
        break;
      }
      // Temporarily move tile to check next position
      this.activeTile.setPosition(this.activeTile.x + direction * TILE_SIZE, this.activeTile.y);
    }

    // Restore original position
    this.activeTile.setPosition(originalX, this.activeTile.y);

    if (!pathClear) {
      // Path is blocked, do nothing
      return;
    }

    // Animate the horizontal movement
    this.state = 'animating';
    this.activeTile.playHorizontalMoveAnimation(targetX, () => {
      this.boardRenderer.updateTilePosition(this.activeTile!);
      this.updateTouchZone();
      this.state = 'playing';
      this.hardDrop();
    });
  }

  private lockActiveTile(): void {
    if (!this.activeTile) return;

    this.state = 'animating';
    this.lastDropX = this.activeTile.x;
    this.board.placeTile(this.activeTile);
    const justPlacedTile = this.activeTile;
    this.activeTile = null;

    void this.resolveWithAnimation(justPlacedTile);
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
        await this.delay(30);
        this.boardRenderer.updateAllTiles();

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
      const mergeResult = this.physics.tryMergeForTile(tile);

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
      if (this.physics.canTileFall(tile)) {
        tileActive = true;
        this.board.removeTileFromGrid(tile);
        tile.setPosition(tile.x, tile.y + TILE_SIZE);
        this.board.placeTile(tile);

        await this.delay(30);
        this.boardRenderer.updateAllTiles();
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

  private async updateHighestTile(): Promise<boolean> {
    const tiles = this.board.getAllTiles();
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
    // Update spawner with current max tile to unlock new spawn tiers
    const tierChanged = this.spawner.updateMaxTile(maxK);

    // If tier threshold changed, remove lower tier tiles from the board
    if (tierChanged) {
      await this.removeLowTierTiles(this.spawner.getMinTierK());
      return true;
    }
    return false;
  }

  /**
   * Remove tiles below the minimum tier threshold from the board.
   * Excludes the active tile (it can still fall and merge).
   * After removal, applies gravity and triggers merge logic.
   */
  private async removeLowTierTiles(minK: number): Promise<void> {
    const tiles = this.board.getAllTiles();
    const tilesToRemove: Tile[] = [];

    // Deduplicate tiles (each tile occupies multiple grid cells)
    const uniqueTiles = [...new Set(tiles)];

    // Find tiles below threshold (excluding active tile)
    for (const tile of uniqueTiles) {
      if (tile.k < minK && tile !== this.activeTile) {
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
    if (!this.board.canPlaceTile(this.lastDropX, SPAWN_Y)) {
      this.gameOver();
      return;
    }

    // Reset combo when new tile spawns
    this.comboCount = 0;

    this.activeTile = new Tile(this.nextK, this.lastDropX, SPAWN_Y);
    this.boardRenderer.addTileSprite(this.activeTile);
    this.boardRenderer.updateTilePosition(this.activeTile);

    this.nextK = this.spawner.getNextExponent();
    this.uiRenderer.updateNextPreview(this.nextK);

    this.lastGravityTime = performance.now();
    this.updateTouchZone();
  }

  private togglePause(): void {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.uiRenderer.showPause();
      this.uiRenderer.updatePauseButtonState(true);
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.uiRenderer.hidePause();
      this.uiRenderer.updatePauseButtonState(false);
      this.lastGravityTime = performance.now();
    }
  }

  private gameOver(): void {
    this.state = 'gameOver';
    this.uiRenderer.showGameOver(this.score, this.highestTile);
  }

  private restart(): void {
    this.board.clear();
    this.boardRenderer.clear();

    this.activeTile = null;
    this.score = 0;
    this.highestTile = 2;
    this.comboCount = 0;
    this.lastDropX = SPAWN_X;
    this.state = 'playing';
    this.lastGravityTime = performance.now();

    // Set input cooldown to prevent touch event from restart button affecting new game
    this.inputCooldownUntil = performance.now() + this.INPUT_COOLDOWN_MS;

    this.uiRenderer.hideGameOver();
    this.uiRenderer.hidePause();
    this.uiRenderer.updateScore(0);

    this.spawner.setSeed(Date.now());
    this.spawner.resetUnlocks(); // Reset spawn tiers on restart
    this.nextK = this.spawner.getNextExponent();
    this.uiRenderer.updateNextPreview(this.nextK);

    this.spawnTile();
  }

  update(_ticker: Ticker): void {
    if (this.state !== 'playing' || !this.activeTile) return;

    const now = performance.now();
    const interval = this.softDropping ? SOFT_DROP_INTERVAL_MS : this.gravityInterval;

    if (now - this.lastGravityTime >= interval) {
      if (!this.moveActiveTile(0, TILE_SIZE)) {
        this.lockActiveTile();
      }
      this.lastGravityTime = now;
    }
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
