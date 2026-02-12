export type InputAction = 'left' | 'right' | 'down' | 'hardDrop' | 'pause' | 'restart';

export interface InputCallback {
  (action: InputAction): void;
}

export class InputHandler {
  private callback: InputCallback | null = null;
  private keyMap: Map<string, InputAction> = new Map([
    ['ArrowLeft', 'left'],
    ['ArrowRight', 'right'],
    ['ArrowDown', 'down'],
    ['KeyJ', 'left'],
    ['KeyK', 'down'],
    ['KeyL', 'right'],
    ['Space', 'hardDrop'],
    ['KeyP', 'pause'],
    ['Escape', 'pause'],
    ['KeyR', 'restart'],
  ]);

  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartTime = 0;
  private readonly SWIPE_THRESHOLD = 30;
  private readonly TAP_THRESHOLD = 200;

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
  }

  setCallback(callback: InputCallback): void {
    this.callback = callback;
  }

  enable(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    window.addEventListener('touchend', this.handleTouchEnd, { passive: false });
  }

  disable(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('touchstart', this.handleTouchStart);
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
    }
  }

  private handleTouchEnd(event: TouchEvent): void {
    if (event.changedTouches.length === 1 && this.callback) {
      const touch = event.changedTouches[0];
      const dx = touch.clientX - this.touchStartX;
      const dy = touch.clientY - this.touchStartY;
      const dt = performance.now() - this.touchStartTime;

      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (absDx < this.SWIPE_THRESHOLD && absDy < this.SWIPE_THRESHOLD && dt < this.TAP_THRESHOLD) {
        this.callback('pause');
      } else if (absDy > absDx && dy > this.SWIPE_THRESHOLD) {
        this.callback('hardDrop');
      } else if (absDx > absDy) {
        if (dx > this.SWIPE_THRESHOLD) {
          this.callback('right');
        } else if (dx < -this.SWIPE_THRESHOLD) {
          this.callback('left');
        }
      }
    }
  }
}
