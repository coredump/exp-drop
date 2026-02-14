import { Application } from 'pixi.js';
import { Game } from './game/Game';
import { loadConfig, GameConfig } from './utils/config';
import { setGridHeight } from './utils/constants';

function createLoadingOverlay(): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.id = 'loading-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: #0d0221;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    font-family: 'Press Start 2P', monospace;
  `;

  const text = document.createElement('div');
  text.id = 'loading-text';
  text.textContent = 'Loading...';
  text.style.cssText = `
    color: #ff00ff;
    font-size: 24px;
    text-shadow: 0 0 10px #ff00ff, 0 0 20px #ff00ff;
  `;

  overlay.appendChild(text);
  document.body.appendChild(overlay);

  return overlay;
}

function showStartButton(overlay: HTMLDivElement, onStart: () => void): void {
  const text = overlay.querySelector<HTMLDivElement>('#loading-text');
  if (text) {
    text.style.display = 'none';
  }

  const button = document.createElement('button');
  button.textContent = 'Start';
  button.style.cssText = `
    font-family: 'Press Start 2P', monospace;
    font-size: 24px;
    color: #00ffff;
    background: transparent;
    border: 3px solid #00ffff;
    padding: 16px 48px;
    cursor: pointer;
    text-shadow: 0 0 10px #00ffff, 0 0 20px #00ffff;
    box-shadow: 0 0 10px #00ffff, 0 0 20px #00ffff;
    transition: all 0.2s ease;
  `;

  button.addEventListener('mouseenter', () => {
    button.style.color = '#ff00ff';
    button.style.borderColor = '#ff00ff';
    button.style.textShadow = '0 0 10px #ff00ff, 0 0 20px #ff00ff';
    button.style.boxShadow = '0 0 10px #ff00ff, 0 0 20px #ff00ff';
  });

  button.addEventListener('mouseleave', () => {
    button.style.color = '#00ffff';
    button.style.borderColor = '#00ffff';
    button.style.textShadow = '0 0 10px #00ffff, 0 0 20px #00ffff';
    button.style.boxShadow = '0 0 10px #00ffff, 0 0 20px #00ffff';
  });

  const startGame = (): void => {
    window.removeEventListener('keydown', handleKeyDown);
    overlay.remove();
    onStart();
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Enter' || event.code === 'Space') {
      event.preventDefault();
      startGame();
    }
  };

  button.addEventListener('click', startGame);
  window.addEventListener('keydown', handleKeyDown);

  overlay.appendChild(button);

  // Add keyboard hint for non-touch devices
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  if (!isTouchDevice) {
    const hint = document.createElement('div');
    hint.textContent = 'Press Enter or Space to start';
    hint.style.cssText = `
      color: #888;
      font-size: 10px;
      margin-top: 16px;
    `;
    overlay.appendChild(hint);
  }
}

async function main(): Promise<void> {
  const overlay = createLoadingOverlay();

  // Load config and fonts in parallel
  const [config] = await Promise.all([loadConfig(), document.fonts.load('16px "Press Start 2P"')]);

  // Apply config to constants
  setGridHeight(config.gridHeight);

  // Show start button once everything is loaded
  showStartButton(overlay, () => {
    void startGame(config);
  });
}

async function startGame(config: GameConfig): Promise<void> {
  const app = new Application();

  await app.init({
    background: 0x0d0221, // Deep purple-black for 80s neon
    resizeTo: window,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  document.body.appendChild(app.canvas);

  const game = new Game(app, undefined, {
    spawnWeights: config.spawnWeights,
    tierWindowSize: config.tierWindowSize,
  });
  game.start();

  window.addEventListener('resize', () => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
    game.relayout();
  });
}

main().catch(console.error);
