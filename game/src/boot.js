// Sunset Bay boot: create the game, wire the loop, handle ?shot= staging.
import { Game } from './engine.js';
import { applyShot } from './staging.js';

const canvas = document.getElementById('game-canvas');
const game = new Game(canvas);
window.__game = game;
window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
game.state = 'playing';
game.hud.show('none');
game.sound.setMuted(true);
applyShot(game, shot);
setTimeout(() => { window.__ready = true; }, 1200);
} else {
game.camMode = 'follow';
}

let last = performance.now();
function frame(now) {
const rawDt = (now - last) / 1000;
last = now;
const dt = rawDt > 0 ? Math.min(rawDt, 0.05) : 0;
try {
game.update(dt);
} catch (e) {
window.__errors.push(String(e.message || e));
}
requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
