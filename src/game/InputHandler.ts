import { GRID_WIDTH, TILE_SIZE, CELL_SIZE } from '../utils/constants';

export type InputAction =
  | 'left'
  | 'right'
  | 'hardDrop'
  | 'pause'
  | 'restart'
  | { type: 'dropToColumn'; column: number };

export interface TouchZone {
  tileScreenX: number;
  tileScreenY: number;
  tileWidth: number;
  tileHeight: number;
  boardScreenX: number;
  boardScreenY: number;
  boardScreenWidth: number;
  boardScreenHeight: number;
}

export type InputCallback = (action: InputAction) => void;

/**
 * Map a screen X inside the board to a TILE_SIZE-aligned drop column.
 * Exported for testing - it is pure and carries most of the tap-zone logic.
 */
export function columnActionAt(
  touchX: number,
  boardScreenX: number,
  boardScreenWidth: number
): InputAction {
  const cellSize = boardScreenWidth / GRID_WIDTH;
  const gridX = Math.floor((touchX - boardScreenX) / cellSize);
  const tileGridX = Math.floor(gridX / TILE_SIZE) * TILE_SIZE;
  return { type: 'dropToColumn', column: tileGridX };
}

export class InputHandler {
  private callback: InputCallback | null = null;
  private keyMap = new Map<string, InputAction>([
    ['ArrowLeft', 'left'],
    ['ArrowRight', 'right'],
    ['ArrowDown', 'hardDrop'],
    ['KeyJ', 'left'],
    ['KeyK', 'hardDrop'],
    ['KeyL', 'right'],
    ['Space', 'hardDrop'],
    ['KeyP', 'pause'],
    ['Escape', 'pause'],
    ['KeyR', 'restart'],
  ]);

  // Touch state
  private touchZone: TouchZone | null = null;
  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartTime = 0;
  private isDragging = false;
  private lastColumnCrossed = 0;

  // Touch thresholds
  private readonly dragThreshold = 10;
  private readonly columnWidth = TILE_SIZE * CELL_SIZE;
  private readonly tapThreshold = 200;

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
  }

  setCallback(callback: InputCallback): void {
    this.callback = callback;
  }

  setTouchZone(zone: TouchZone | null): void {
    this.touchZone = zone;
  }

  enable(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    window.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    window.addEventListener('touchend', this.handleTouchEnd, { passive: false });
  }

  disable(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('touchstart', this.handleTouchStart);
    window.removeEventListener('touchmove', this.handleTouchMove);
    window.removeEventListener('touchend', this.handleTouchEnd);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const action = this.keyMap.get(event.code);
    if (action && this.callback) {
      event.preventDefault();
      this.callback(action);
    }
  }

  private handleTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
      this.touchStartTime = performance.now();
      this.isDragging = false;
      this.lastColumnCrossed = this.columnIndexAt(touch.clientX);
    }
  }

  private handleTouchMove(event: TouchEvent): void {
    if (event.touches.length !== 1 || !this.callback) return;

    const touch = event.touches[0];
    const dx = touch.clientX - this.touchStartX;
    const dy = touch.clientY - this.touchStartY;

    // Determine if this is a drag (moved beyond threshold)
    if (
      !this.isDragging &&
      (Math.abs(dx) > this.dragThreshold || Math.abs(dy) > this.dragThreshold)
    ) {
      this.isDragging = true;
      event.preventDefault();
    }

    if (!this.isDragging) return;

    // HORIZONTAL DRAG: Move by columns
    const currentColumn = this.columnIndexAt(touch.clientX);
    const columnDiff = currentColumn - this.lastColumnCrossed;

    if (columnDiff > 0) {
      // Moved right - fire 'right' action for each column crossed
      for (let i = 0; i < columnDiff; i++) {
        this.callback('right');
      }
      this.lastColumnCrossed = currentColumn;
    } else if (columnDiff < 0) {
      // Moved left - fire 'left' action for each column crossed
      for (let i = 0; i < Math.abs(columnDiff); i++) {
        this.callback('left');
      }
      this.lastColumnCrossed = currentColumn;
    }
  }

  private handleTouchEnd(event: TouchEvent): void {
    if (event.changedTouches.length !== 1 || !this.callback) return;

    const touch = event.changedTouches[0];
    const dt = performance.now() - this.touchStartTime;

    // If was dragging, just clean up
    if (this.isDragging) {
      this.isDragging = false;
      return;
    }

    // Check if this was a quick tap
    if (dt < this.tapThreshold) {
      // Zone-based tap action
      const zoneAction = this.getTouchZoneAction(touch.clientX, touch.clientY);
      if (zoneAction) {
        event.preventDefault();
        this.callback(zoneAction);
      }
    }
  }

  /**
   * Column index of a screen X, measured from the board's left edge so drag
   * boundaries line up with the visible columns. Falls back to raw screen
   * coordinates only when no tile is active (nothing to move anyway).
   */
  private columnIndexAt(clientX: number): number {
    const originX = this.touchZone?.boardScreenX ?? 0;
    return Math.floor((clientX - originX) / this.columnWidth);
  }

  /** Public for testing - pure function of (x, y) and the current touch zone. */
  getTouchZoneAction(touchX: number, touchY: number): InputAction | null {
    if (!this.touchZone) return null;

    const {
      tileScreenX,
      tileScreenY,
      tileWidth,
      tileHeight,
      boardScreenX,
      boardScreenY,
      boardScreenWidth,
      boardScreenHeight,
    } = this.touchZone;

    const isWithinBoard =
      touchX >= boardScreenX &&
      touchX < boardScreenX + boardScreenWidth &&
      touchY >= boardScreenY &&
      touchY < boardScreenY + boardScreenHeight;

    const isWithinTileWidth = touchX >= tileScreenX && touchX <= tileScreenX + tileWidth;
    const isBelowTile = touchY > tileScreenY + tileHeight;
    const isOnTile = touchY >= tileScreenY && !isBelowTile;

    // ON TILE, or BELOW TILE within the board (same column) - hard drop
    if (isWithinTileWidth && (isOnTile || (isBelowTile && isWithinBoard))) {
      return 'hardDrop';
    }

    // LEFT of tile
    if (touchX < tileScreenX) {
      return isWithinBoard ? columnActionAt(touchX, boardScreenX, boardScreenWidth) : 'left';
    }

    // RIGHT of tile
    if (touchX > tileScreenX + tileWidth) {
      return isWithinBoard ? columnActionAt(touchX, boardScreenX, boardScreenWidth) : 'right';
    }

    return null;
  }
}
