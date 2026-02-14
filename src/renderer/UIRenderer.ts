import { Container, Graphics, Text } from 'pixi.js';
import {
  CELL_SIZE,
  TILE_SIZE,
  TILE_COLORS,
  DEFAULT_TILE_COLOR,
  formatTileValue,
} from '../utils/constants';

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
  private pauseButton!: Container;
  private pauseButtonText!: Text;
  private pauseButtonCallback: (() => void) | null = null;
  private restartButton: Container;
  private restartButtonCallback: (() => void) | null = null;
  private isTouchDevice: boolean;

  constructor() {
    this.container = new Container();

    this.scoreText = new Text({
      text: 'Score\n0',
      style: {
        fontFamily: '"Press Start 2P", cursive',
        fontSize: 12,
        fill: 0x00ffff,
        align: 'center',
        lineHeight: 14,
      },
    });
    this.scoreText.anchor.set(0.5, 0);
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
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.keybindingsText = new Text({
      text: '\u2190\u2192 / JL Move\n\u2193 / K Drop\nP Pause\nR Reset',
      style: {
        fontFamily: '"Press Start 2P", cursive',
        fontSize: 7,
        fill: 0x666699,
        lineHeight: 12,
      },
    });
    this.keybindingsText.visible = !this.isTouchDevice;

    this.nextPreviewContainer.addChild(this.nextPreviewBg);
    this.nextPreviewContainer.addChild(this.nextPreviewLabel);
    this.nextPreviewContainer.addChild(this.nextPreviewTile);
    this.container.addChild(this.nextPreviewContainer);
    this.container.addChild(this.keybindingsText);

    const gameOverSubtitle = this.isTouchDevice ? 'Tap to restart' : 'Press R to restart';
    this.gameOverContainer = this.createOverlay('GAME OVER', gameOverSubtitle);
    this.gameOverContainer.visible = false;
    this.container.addChild(this.gameOverContainer);

    const pauseSubtitle = this.isTouchDevice ? 'Tap to resume' : 'Press P to resume';
    this.pauseContainer = this.createOverlay('PAUSED', pauseSubtitle);
    this.pauseContainer.visible = false;
    this.container.addChild(this.pauseContainer);

    this.pauseButton = this.createPauseButton();
    this.container.addChild(this.pauseButton);
    this.pauseButton.visible = this.isTouchDevice;

    this.restartButton = this.createRestartButton();
    this.container.addChild(this.restartButton);
    this.restartButton.visible = false;

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
    this.scoreText.text = `Score\n${score.toLocaleString()}`;
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

    const formatted = formatTileValue(value);
    const fontSize = formatted.length >= 4 ? 10 : formatted.length >= 3 ? 12 : 16;
    const label = new Text({
      text: formatted,
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
    const restartHint = this.isTouchDevice ? 'Tap to restart' : 'Press R to restart';
    subtitleText.text = `Score: ${finalScore.toLocaleString()}\nHighest: ${highestTile}\n${restartHint}`;

    this.gameOverContainer.visible = true;
    this.pauseButton.visible = false;
    if (this.isTouchDevice) {
      this.restartButton.visible = true;
      this.restartButton.x = this.gameOverContainer.x + 50;
      this.restartButton.y = this.gameOverContainer.y + 120;
    }
  }

  hideGameOver(): void {
    this.gameOverContainer.visible = false;
    this.restartButton.visible = false;
    this.pauseButton.visible = this.isTouchDevice;
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

  setPauseButtonPosition(x: number, y: number): void {
    this.pauseButton.x = x;
    this.pauseButton.y = y;
  }

  setKeybindingsPosition(x: number, y: number): void {
    this.keybindingsText.x = x;
    this.keybindingsText.y = y;
  }

  setPauseButtonCallback(callback: () => void): void {
    this.pauseButtonCallback = callback;
  }

  setRestartButtonCallback(callback: () => void): void {
    this.restartButtonCallback = callback;
  }

  updatePauseButtonState(isPaused: boolean): void {
    this.pauseButtonText.text = isPaused ? 'CONTINUE' : 'PAUSE';
    this.pauseButtonText.style.fill = isPaused ? 0x39ff14 : 0x00ffff;
  }

  private createPauseButton(): Container {
    const button = new Container();
    button.eventMode = 'static';
    button.cursor = 'pointer';

    const bg = new Graphics();
    bg.rect(0, 0, 80, 30);
    bg.fill(0x120458);
    bg.stroke({ color: 0x00ffff, width: 2 });
    button.addChild(bg);

    this.pauseButtonText = new Text({
      text: 'PAUSE',
      style: {
        fontFamily: '"Press Start 2P", cursive',
        fontSize: 8,
        fill: 0x00ffff,
        align: 'center',
      },
    });
    this.pauseButtonText.anchor.set(0.5);
    this.pauseButtonText.x = 40;
    this.pauseButtonText.y = 15;
    button.addChild(this.pauseButtonText);

    button.on('pointerdown', (event) => {
      event.stopPropagation();
      if (this.pauseButtonCallback) {
        this.pauseButtonCallback();
      }
    });

    return button;
  }

  private createRestartButton(): Container {
    const button = new Container();
    button.eventMode = 'static';
    button.cursor = 'pointer';

    const bg = new Graphics();
    bg.rect(0, 0, 100, 35);
    bg.fill(0x120458);
    bg.stroke({ color: 0x39ff14, width: 2 });
    button.addChild(bg);

    const text = new Text({
      text: 'RESTART',
      style: {
        fontFamily: '"Press Start 2P", cursive',
        fontSize: 10,
        fill: 0x39ff14,
        align: 'center',
      },
    });
    text.anchor.set(0.5);
    text.x = 50;
    text.y = 17.5;
    button.addChild(text);

    button.on('pointerdown', (event) => {
      event.stopPropagation();
      if (this.restartButtonCallback) {
        this.restartButtonCallback();
      }
    });

    return button;
  }
}
