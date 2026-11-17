// Sunset Bay input: keyboard state, pointer-lock mouse look, click to shoot.
export class Input {
constructor(canvas) {
this.canvas = canvas;
this.keys = new Set();
this.lookDX = 0;
this.lookDY = 0;
this.locked = false;
this.dragging = false;
this.onShoot = null;
this.onAction = null;
this.onPause = null;
window.addEventListener('keydown', (e) => {
if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
if (e.repeat) return;
this.keys.add(e.code);
if (e.code === 'Escape' && this.onPause) this.onPause();
if (e.code === 'KeyE' && this.onAction) this.onAction();
if (e.code === 'KeyR' && this.onAction) this.onAction('reload');
if (e.code === 'KeyM' && this.onAction) this.onAction('mute');
});
window.addEventListener('keyup', (e) => this.keys.delete(e.code));
window.addEventListener('blur', () => this.keys.clear());
document.addEventListener('pointerlockchange', () => {
this.locked = document.pointerLockElement === canvas;
});
canvas.addEventListener('click', () => {
if (!this.locked && this.canvas.requestPointerLock) {
try { this.canvas.requestPointerLock(); } catch (e) { /* ignore */ }
}
if (this.locked && this.onShoot) this.onShoot();
});
canvas.addEventListener('mousedown', (e) => {
this.dragging = true;
this.lastX = e.clientX;
this.lastY = e.clientY;
});
window.addEventListener('mouseup', () => { this.dragging = false; });
window.addEventListener('mousemove', (e) => {
if (this.locked) {
this.lookDX += e.movementX || 0;
this.lookDY += e.movementY || 0;
} else if (this.dragging) {
this.lookDX += (e.clientX - this.lastX) * 1.4;
this.lookDY += (e.clientY - this.lastY) * 1.4;
this.lastX = e.clientX;
this.lastY = e.clientY;
}
});
}
isDown(code) { return this.keys.has(code); }
consumeLook() {
const d = { dx: this.lookDX, dy: this.lookDY };
this.lookDX = 0;
this.lookDY = 0;
return d;
}
clear() { this.keys.clear(); this.lookDX = 0; this.lookDY = 0; }
}
