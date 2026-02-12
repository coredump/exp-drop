import { Container, Graphics } from 'pixi.js';
import { Board } from '../game/Board';
import { Tile } from '../game/Tile';
import { GRID_WIDTH, GRID_HEIGHT, CELL_SIZE } from '../utils/constants';

export class BoardRenderer {
  public container: Container;
  private gridGraphics: Graphics;
  private tilesContainer: Container;
  private board: Board;

  constructor(board: Board) {
    this.board = board;
    this.container = new Container();
    this.gridGraphics = new Graphics();
    this.tilesContainer = new Container();

    this.container.addChild(this.gridGraphics);
    this.container.addChild(this.tilesContainer);

    this.drawGrid();
  }

  setPosition(x: number, y: number): void {
    this.container.x = x;
    this.container.y = y;
  }

  getGridPixelWidth(): number {
    return GRID_WIDTH * CELL_SIZE;
  }

  getGridPixelHeight(): number {
    return GRID_HEIGHT * CELL_SIZE;
  }

  private drawGrid(): void {
    this.gridGraphics.clear();

    // Dark background with neon border
    this.gridGraphics.rect(0, 0, GRID_WIDTH * CELL_SIZE, GRID_HEIGHT * CELL_SIZE);
    this.gridGraphics.fill(0x120458);  // Deep blue-purple
    this.gridGraphics.stroke({ color: 0xff00ff, width: 3 });  // Hot magenta border

    // Neon grid lines
    this.gridGraphics.setStrokeStyle({ color: 0x2d1b69, width: 1 });
    for (let x = 1; x < GRID_WIDTH; x++) {
      this.gridGraphics.moveTo(x * CELL_SIZE, 0);
      this.gridGraphics.lineTo(x * CELL_SIZE, GRID_HEIGHT * CELL_SIZE);
    }
    for (let y = 1; y < GRID_HEIGHT; y++) {
      this.gridGraphics.moveTo(0, y * CELL_SIZE);
      this.gridGraphics.lineTo(GRID_WIDTH * CELL_SIZE, y * CELL_SIZE);
    }
    this.gridGraphics.stroke();
  }

  addTileSprite(tile: Tile): void {
    this.tilesContainer.addChild(tile.sprite);
    this.updateTilePosition(tile);
  }

  removeTileSprite(tile: Tile): void {
    if (tile.sprite.parent === this.tilesContainer) {
      this.tilesContainer.removeChild(tile.sprite);
    }
  }

  updateTilePosition(tile: Tile): void {
    tile.updateSpritePosition(0, 0);
  }

  updateAllTiles(): void {
    const tiles = this.board.getAllTiles();
    for (const tile of tiles) {
      this.updateTilePosition(tile);
    }
  }

  clear(): void {
    this.tilesContainer.removeChildren();
  }
}
