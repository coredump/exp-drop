import { Application, Ticker } from 'pixi.js';
import { Board } from './Board';
import { Tile } from './Tile';
import { Physics } from './Physics';
import { Spawner } from './Spawner';
import { InputHandler, InputAction } from './InputHandler';
import { BoardRenderer } from '../renderer/BoardRenderer';
import { UIRenderer } from '../renderer/UIRenderer';
import {
  SPAWN_X,
  SPAWN_Y,
  GRAVITY_INTERVAL_MS,
  SOFT_DROP_INTERVAL_MS,
  GRID_PADDING,
  TILE_SIZE,
  GRID_WIDTH,
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
  private nextK: number = 1;
  private score: number = 0;
  private highestTile: number = 2;
  private state: GameState = 'playing';

  private lastGravityTime: number = 0;
  private gravityInterval: number = GRAVITY_INTERVAL_MS;
  private softDropping: boolean = false;

  private comboCount: number = 0;

  constructor(app: Application, seed?: number) {
    this.app = app;
    this.board = new Board();
    this.physics = new Physics(this.board);
    this.spawner = new Spawner(seed);
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

    const gridX = (screenWidth - gridWidth) / 2;
    const gridY = (screenHeight - gridHeight) / 2;

    this.boardRenderer.setPosition(gridX, gridY);
    this.uiRenderer.setScorePosition(gridX, gridY - 40);
    this.uiRenderer.setNextPreviewPosition(gridX + gridWidth + GRID_PADDING, gridY);
    this.uiRenderer.setOverlayPosition(gridX + gridWidth / 2, gridY + gridHeight / 2);
    this.uiRenderer.setGridCenter(gridX + gridWidth / 2, gridY + gridHeight / 2);
  }

  private setupInput(): void {
    this.inputHandler.setCallback((action: InputAction) => this.handleInput(action));
    this.inputHandler.enable();
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

    while (this.moveActiveTile(0, TILE_SIZE)) {}
    this.lockActiveTile();
  }

  private lockActiveTile(): void {
    if (!this.activeTile) return;

    this.state = 'animating';
    this.board.placeTile(this.activeTile);
    const justPlacedTile = this.activeTile;
    this.activeTile = null;

    this.resolveWithAnimation(justPlacedTile);
  }

  private async resolveWithAnimation(justPlacedTile: Tile): Promise<void> {
    // Process the just-placed tile first - it has priority for merging
    await this.resolveTileChain(justPlacedTile);

    this.updateHighestTile();
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
        const points = this.calculatePoints(mergeResult.basePoints, mergeResult.tilesAbsorbed, this.comboCount);
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

  private async animateSingleMerge(merge: { removedTiles: { tile: Tile; fromX: number; fromY: number }[]; upgradedTile: Tile | null; }): Promise<void> {
    return new Promise(resolve => {
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
    return new Promise(resolve => setTimeout(resolve, ms));
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

  private updateHighestTile(): void {
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
    this.spawner.updateMaxTile(maxK);
  }

  private spawnTile(): void {
    if (!this.board.canPlaceTile(SPAWN_X, SPAWN_Y)) {
      this.gameOver();
      return;
    }

    // Reset combo when new tile spawns
    this.comboCount = 0;

    this.activeTile = new Tile(this.nextK, SPAWN_X, SPAWN_Y);
    this.boardRenderer.addTileSprite(this.activeTile);
    this.boardRenderer.updateTilePosition(this.activeTile);

    this.nextK = this.spawner.getNextExponent();
    this.uiRenderer.updateNextPreview(this.nextK);

    this.lastGravityTime = performance.now();
  }

  private togglePause(): void {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.uiRenderer.showPause();
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.uiRenderer.hidePause();
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
    this.state = 'playing';
    this.lastGravityTime = performance.now();

    this.uiRenderer.hideGameOver();
    this.uiRenderer.hidePause();
    this.uiRenderer.updateScore(0);

    this.spawner.setSeed(Date.now());
    this.spawner.resetUnlocks();  // Reset spawn tiers on restart
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
}
