export type InputAction =
  | 'left'
  | 'right'
  | 'down'
  | 'hardDrop'
  | 'softDrop'
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
  private readonly columnWidth = 64; // TILE_SIZE * CELL_SIZE (2 * 32)
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
      this.lastColumnCrossed = Math.floor(touch.clientX / this.columnWidth);
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
    const currentColumn = Math.floor(touch.clientX / this.columnWidth);
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

  private getTouchZoneAction(touchX: number, touchY: number): InputAction | null {
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

    // ON TILE - soft drop
    if (isWithinTileWidth && touchY >= tileScreenY && touchY <= tileScreenY + tileHeight) {
      return 'softDrop';
    }

    // BELOW TILE (same column) on board - hard drop
    if (isWithinTileWidth && touchY > tileScreenY + tileHeight && isWithinBoard) {
      return 'hardDrop';
    }

    // LEFT of tile
    if (touchX < tileScreenX) {
      // Within board bounds = drop to that column
      if (isWithinBoard) {
        const cellSize = boardScreenWidth / 10; // GRID_WIDTH = 10
        const gridX = Math.floor((touchX - boardScreenX) / cellSize);
        const tileGridX = Math.floor(gridX / 2) * 2;
        return { type: 'dropToColumn', column: tileGridX };
      }
      return 'left';
    }

    // RIGHT of tile
    if (touchX > tileScreenX + tileWidth) {
      // Within board bounds = drop to that column
      if (isWithinBoard) {
        const cellSize = boardScreenWidth / 10; // GRID_WIDTH = 10
        const gridX = Math.floor((touchX - boardScreenX) / cellSize);
        const tileGridX = Math.floor(gridX / 2) * 2;
        return { type: 'dropToColumn', column: tileGridX };
      }
      return 'right';
    }

    return null;
  }
}
