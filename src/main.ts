import { Application } from 'pixi.js';
import { Game } from './game/Game';

async function main(): Promise<void> {
  const app = new Application();

  await app.init({
    background: 0x0d0221,  // Deep purple-black for 80s neon
    resizeTo: window,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  document.body.appendChild(app.canvas);

  const game = new Game(app);
  game.start();

  window.addEventListener('resize', () => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
  });
}

main().catch(console.error);
