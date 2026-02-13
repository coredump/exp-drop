import { Container, Graphics, Text } from 'pixi.js';
import { CELL_SIZE, TILE_SIZE, TILE_COLORS, DEFAULT_TILE_COLOR } from '../utils/constants';

export class UIRenderer {
  public container: Container;
  private scoreText: Text;
  private multiplierText: Text;
  private nextPreviewContainer: Container;
  private nextPreviewBg: Graphics;
  private nextPreviewTile: Graphics;
  private nextPreviewLabel: Text;
  private keybindingsText: Text;
  private nextK = 1;
  private gameOverContainer: Container;
  private pauseContainer: Container;
  private multiplierTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.container = new Container();

    this.scoreText = new Text({
      text: 'Score: 0',
      style: {
        fontFamily: '"Press Start 2P", cursive',
        fontSize: 14,
        fill: 0x00ffff, // Cyan neon
      },
    });
    this.container.addChild(this.scoreText);

    this.multiplierText = new Text({
      text: '',
      style: {
        fontFamily: '"Press Start 2P", cursive',
        fontSize: 16,
        fill: 0xff00ff, // Hot magenta
        stroke: { color: 0x000000, width: 3 },
        align: 'center',
      },
    });
    this.multiplierText.anchor.set(0.5);
    this.multiplierText.alpha = 0;
    this.container.addChild(this.multiplierText);

    this.nextPreviewContainer = new Container();
    this.nextPreviewBg = new Graphics();
    this.nextPreviewTile = new Graphics();
    this.nextPreviewLabel = new Text({
      text: 'NEXT',
      style: {
        fontFamily: '"Press Start 2P", cursive',
        fontSize: 10,
        fill: 0x39ff14, // Neon green
      },
    });

    // Keybindings hint (hidden on touch devices)
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.keybindingsText = new Text({
      text: '\u2190\u2192 / JL Move\n\u2193 / K Drop\nP Pause\nR Reset',
      style: {
        fontFamily: '"Press Start 2P", cursive',
        fontSize: 7,
        fill: 0x666699,
        lineHeight: 12,
      },
    });
    this.keybindingsText.visible = !isTouchDevice;

    this.nextPreviewContainer.addChild(this.nextPreviewBg);
    this.nextPreviewContainer.addChild(this.nextPreviewLabel);
    this.nextPreviewContainer.addChild(this.nextPreviewTile);
    this.nextPreviewContainer.addChild(this.keybindingsText);
    this.container.addChild(this.nextPreviewContainer);

    this.gameOverContainer = this.createOverlay('GAME OVER', 'Press R to restart');
    this.gameOverContainer.visible = false;
    this.container.addChild(this.gameOverContainer);

    this.pauseContainer = this.createOverlay('PAUSED', 'Press P to resume');
    this.pauseContainer.visible = false;
    this.container.addChild(this.pauseContainer);

    this.drawNextPreview();
  }

  private createOverlay(title: string, subtitle: string): Container {
    const overlay = new Container();

    const bg = new Graphics();
    bg.rect(0, 0, 300, 150);
    bg.fill({ color: 0x0d0221, alpha: 0.95 }); // Deep purple-black
    bg.stroke({ color: 0xff00ff, width: 3 }); // Magenta border
    overlay.addChild(bg);

    const titleText = new Text({
      text: title,
      style: {
        fontFamily: '"Press Start 2P", cursive',
        fontSize: 18,
        fill: 0xff00ff, // Hot magenta
        align: 'center',
      },
    });
    titleText.anchor.set(0.5, 0);
    titleText.x = 150;
    titleText.y = 30;
    overlay.addChild(titleText);

    const subtitleText = new Text({
      text: subtitle,
      style: {
        fontFamily: '"Press Start 2P", cursive',
        fontSize: 10,
        fill: 0x00ffff, // Cyan
        align: 'center',
      },
    });
    subtitleText.anchor.set(0.5, 0);
    subtitleText.x = 150;
    subtitleText.y = 80;
    overlay.addChild(subtitleText);

    return overlay;
  }

  private gridCenterX = 0;
  private gridCenterY = 0;

  setScorePosition(x: number, y: number): void {
    this.scoreText.x = x;
    this.scoreText.y = y;
  }

  setGridCenter(x: number, y: number): void {
    this.gridCenterX = x;
    this.gridCenterY = y;
    this.multiplierText.anchor.set(0.5);
    this.multiplierText.x = x;
    this.multiplierText.y = y;
  }

  setNextPreviewPosition(x: number, y: number): void {
    this.nextPreviewContainer.x = x;
    this.nextPreviewContainer.y = y;
  }

  setOverlayPosition(x: number, y: number): void {
    this.gameOverContainer.x = x - 150;
    this.gameOverContainer.y = y - 75;
    this.pauseContainer.x = x - 150;
    this.pauseContainer.y = y - 75;
  }

  updateScore(score: number): void {
    this.scoreText.text = `Score: ${score.toLocaleString()}`;
  }

  updateNextPreview(k: number): void {
    this.nextK = k;
    this.drawNextPreview();
  }

  private drawNextPreview(): void {
    const tilePixelSize = TILE_SIZE * CELL_SIZE;
    const boxSize = tilePixelSize + 20;
    const tileSize = tilePixelSize - 4;
    const labelHeight = 18;

    // Draw box below the label
    this.nextPreviewBg.clear();
    this.nextPreviewBg.roundRect(0, labelHeight, boxSize, boxSize, 8);
    this.nextPreviewBg.fill(0x120458); // Deep blue-purple
    this.nextPreviewBg.stroke({ color: 0x00ffff, width: 2 }); // Cyan border

    // Position label above the box
    this.nextPreviewLabel.x = boxSize / 2 - this.nextPreviewLabel.width / 2;
    this.nextPreviewLabel.y = 0;

    // Position keybindings below the box
    this.keybindingsText.x = 0;
    this.keybindingsText.y = labelHeight + boxSize + 10;

    const color = TILE_COLORS[this.nextK] ?? DEFAULT_TILE_COLOR;
    const value = Math.pow(2, this.nextK);

    this.nextPreviewTile.clear();
    this.nextPreviewTile.roundRect(
      boxSize / 2 - tileSize / 2,
      labelHeight + boxSize / 2 - tileSize / 2,
      tileSize,
      tileSize,
      12
    );
    this.nextPreviewTile.fill(color);

    const existingLabel = this.nextPreviewTile.children.find((c) => c instanceof Text);
    if (existingLabel) {
      this.nextPreviewTile.removeChild(existingLabel);
    }

    const fontSize = value >= 10000 ? 8 : value >= 1000 ? 10 : value >= 100 ? 12 : 16;
    const label = new Text({
      text: value.toString(),
      style: {
        fontFamily: '"Press Start 2P", cursive',
        fontSize,
        fill: 0x0d0221, // Dark text for neon backgrounds
      },
    });
    label.anchor.set(0.5);
    label.x = boxSize / 2;
    label.y = labelHeight + boxSize / 2;
    this.nextPreviewTile.addChild(label);
  }

  showGameOver(finalScore: number, highestTile: number): void {
    const titleText = this.gameOverContainer.children[1] as Text;
    titleText.text = 'GAME OVER';

    const subtitleText = this.gameOverContainer.children[2] as Text;
    subtitleText.text = `Score: ${finalScore.toLocaleString()}\nHighest: ${highestTile}\nPress R to restart`;

    this.gameOverContainer.visible = true;
  }

  hideGameOver(): void {
    this.gameOverContainer.visible = false;
  }

  showPause(): void {
    this.pauseContainer.visible = true;
  }

  hidePause(): void {
    this.pauseContainer.visible = false;
  }

  showMultiplier(tilesAbsorbed: number, comboCount: number): void {
    const parts: string[] = [];

    if (tilesAbsorbed > 1) {
      parts.push(`${tilesAbsorbed}x MULTI!`);
    }

    if (comboCount > 1) {
      const comboMultiplier = 1 + (comboCount - 1) * 0.5;
      parts.push(`${comboCount} COMBO (${comboMultiplier}x)`);
    }

    if (parts.length === 0) return;

    this.multiplierText.text = parts.join('\n');
    this.multiplierText.x = this.gridCenterX;
    this.multiplierText.y = this.gridCenterY;
    this.multiplierText.alpha = 1;
    this.multiplierText.scale.set(1.5);

    // Clear existing timeout
    if (this.multiplierTimeout) {
      clearTimeout(this.multiplierTimeout);
    }

    // Blinking + scale animation
    const startTime = performance.now();
    const duration = 1000;
    let animationId: number;

    const animate = (): void => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Scale down from 1.5 to 1.0
      const scale = 1.5 - 0.5 * progress;
      this.multiplierText.scale.set(scale);

      // Blink effect (flash between colors)
      const blinkCycle = Math.sin(elapsed * 0.02) * 0.5 + 0.5;
      const color1 = 0xff00ff; // magenta
      const color2 = 0x00ffff; // cyan

      // Interpolate colors
      const r1 = (color1 >> 16) & 0xff,
        g1 = (color1 >> 8) & 0xff,
        b1 = color1 & 0xff;
      const r2 = (color2 >> 16) & 0xff,
        g2 = (color2 >> 8) & 0xff,
        b2 = color2 & 0xff;
      const r = Math.round(r1 + (r2 - r1) * blinkCycle);
      const g = Math.round(g1 + (g2 - g1) * blinkCycle);
      const b = Math.round(b1 + (b2 - b1) * blinkCycle);
      this.multiplierText.style.fill = (r << 16) | (g << 8) | b;

      // Fade out in the last 30%
      if (progress > 0.7) {
        this.multiplierText.alpha = 1 - (progress - 0.7) / 0.3;
      }

      if (progress < 1) {
        animationId = requestAnimationFrame(animate);
      } else {
        this.multiplierText.alpha = 0;
      }
    };

    animationId = requestAnimationFrame(animate);

    // Store timeout to cancel animation if needed
    this.multiplierTimeout = setTimeout(() => {
      cancelAnimationFrame(animationId);
      this.multiplierText.alpha = 0;
    }, duration + 100);
  }
}
