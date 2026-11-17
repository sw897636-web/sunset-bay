// Sunset Bay: keyboard and mouse input — one shared state object the
// game loop reads every frame. Also handles pointer lock on click.

export class Input {
constructor(canvas) {
this.keys = {};
this.mouseDX = 0;
this.mouseDY = 0;
this.mouseDown = false;
this.clicked = false;
this.dragging = false;
this.lastX = 0;
this.lastY = 0;
this.autopilot = false;
this.autoSteer = 0;
this.canvas = canvas;
window.addEventListener('keydown', (e) => {
if (e.repeat) return;
this.keys[e.code] = true;
if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => {
this.keys[e.code] = false;
});
canvas.addEventListener('mousedown', (e) => {
this.mouseDown = true;
this.clicked = true;
this.dragging = true;
this.lastX = e.clientX;
this.lastY = e.clientY;
});
window.addEventListener('mouseup', () => {
this.mouseDown = false;
this.dragging = false;
});
window.addEventListener('mousemove', (e) => {
if (!this.dragging) return;
this.mouseDX += e.clientX - this.lastX;
this.mouseDY += e.clientY - this.lastY;
this.lastX = e.clientX;
this.lastY = e.clientY;
});
document.addEventListener('pointerlockchange', () => {
this.locked = document.pointerLockElement === canvas;
});
window.addEventListener('mousemove', (e) => {
if (this.locked) {
this.mouseDX += e.movementX || 0;
this.mouseDY += e.movementY || 0;
}
});
}
consumeMouse() {
const dx = this.mouseDX;
const dy = this.mouseDY;
this.mouseDX = 0;
this.mouseDY = 0;
return { dx, dy };
}
consumeClick() {
const c = this.clicked;
this.clicked = false;
return c;
}
pressed(code) {
const v = !!this.keys[code];
if (v) this.keys[code] = false;
return v;
}
read() {
if (this.autopilot) {
return {
forward: true,
back: false,
left: this.autoSteer > 0.15,
right: this.autoSteer < -0.15,
run: false,
jump: false,
handbrake: false,
enter: false,
shoot: false,
};
}
return {
forward: !!(this.keys.KeyW || this.keys.ArrowUp),
back: !!(this.keys.KeyS || this.keys.ArrowDown),
left: !!(this.keys.KeyA || this.keys.ArrowLeft),
right: !!(this.keys.KeyD || this.keys.ArrowRight),
run: !!this.keys.ShiftLeft || !!this.keys.ShiftRight,
jump: !!this.keys.Space,
handbrake: !!this.keys.Space,
enter: this.pressed('KeyE'),
shoot: this.mouseDown,
};
}
}
