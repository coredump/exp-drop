import { Container, Graphics, Text } from 'pixi.js';
import { CELL_SIZE, TILE_SIZE, TILE_COLORS, DEFAULT_TILE_COLOR } from '../utils/constants';

export class Tile {
  public k: number;
  public x: number;
  public y: number;
  public sprite: Container;
  private background: Graphics;
  private label: Text;

  constructor(k: number, x: number, y: number) {
    this.k = k;
    this.x = x;
    this.y = y;
    this.sprite = new Container();
    this.background = new Graphics();
    this.label = new Text({
      text: this.displayValue.toString(),
      style: {
        fontFamily: '"Press Start 2P", cursive',
        fontSize: 16,
        fill: 0x0d0221, // Dark text for neon backgrounds
        align: 'center',
      },
    });
    this.label.anchor.set(0.5);
    this.sprite.addChild(this.background);
    this.sprite.addChild(this.label);
    this.render();
  }

  get displayValue(): number {
    return Math.pow(2, this.k);
  }

  get color(): number {
    return TILE_COLORS[this.k] ?? DEFAULT_TILE_COLOR;
  }

  updateExponent(newK: number): void {
    this.k = newK;
    this.render();
  }

  setExponentWithoutRender(newK: number): void {
    this.k = newK;
  }

  updateVisual(): void {
    this.render();
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  updateSpritePosition(offsetX: number, offsetY: number): void {
    const pixelSize = TILE_SIZE * CELL_SIZE;
    this.sprite.x = offsetX + this.x * CELL_SIZE + pixelSize / 2;
    this.sprite.y = offsetY + this.y * CELL_SIZE + pixelSize / 2;
  }

  render(): void {
    const pixelSize = TILE_SIZE * CELL_SIZE - 4;
    const half = pixelSize / 2;
    this.background.clear();
    this.background.roundRect(-half, -half, pixelSize, pixelSize, 6);
    this.background.fill(this.color);

    this.label.text = this.displayValue.toString();
    const fontSize =
      this.displayValue >= 10000
        ? 8
        : this.displayValue >= 1000
          ? 10
          : this.displayValue >= 100
            ? 12
            : 16;
    this.label.style.fontSize = fontSize;
  }

  playMergeAnimation(onComplete: () => void): void {
    const duration = 180;
    const startTime = performance.now();
    const originalScale = this.sprite.scale.x;

    const animate = (): void => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Elastic pop effect - fast expand, bouncy settle
      const elastic = (t: number): number => {
        const c4 = (2 * Math.PI) / 3;
        return t === 0
          ? 0
          : t === 1
            ? 1
            : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
      };

      const elasticProgress = elastic(progress);
      const scale = originalScale + 0.5 * elasticProgress * (1 - progress * 0.8);
      this.sprite.scale.set(Math.max(originalScale, scale));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.sprite.scale.set(originalScale);
        onComplete();
      }
    };
    requestAnimationFrame(animate);
  }

  playRemoveAnimation(targetX: number, targetY: number, onComplete: () => void): void {
    const duration = 150;
    const startTime = performance.now();
    const startX = this.sprite.x;
    const startY = this.sprite.y;
    const startScale = this.sprite.scale.x;

    const animate = (): void => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Fast ease-in (accelerate into target)
      const easeIn = progress * progress * progress;

      // Quick scale up at start, then shrink rapidly
      let scale: number;
      if (progress < 0.15) {
        scale = startScale + 0.2 * (progress / 0.15);
      } else {
        const shrinkProgress = (progress - 0.15) / 0.85;
        scale = (startScale + 0.2) * (1 - shrinkProgress);
      }

      // Move towards target with acceleration
      this.sprite.x = startX + (targetX - startX) * easeIn;
      this.sprite.y = startY + (targetY - startY) * easeIn;

      this.sprite.scale.set(Math.max(0, scale));
      this.sprite.alpha = 1 - progress;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        onComplete();
      }
    };
    requestAnimationFrame(animate);
  }

  destroy(): void {
    this.sprite.destroy({ children: true });
  }
}
