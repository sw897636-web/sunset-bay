// Keyboard and mouse for Sunset Bay. The camera orbits by dragging the
// mouse (no pointer lock, so it behaves the same in a real browser and in
// a headless screenshot run). Each frame the game reads `state` and spends
// the one-frame edge events through `wasPressed` / `wasClicked`.
export function createControls(canvas) {
  const held = new Set();
  const fresh = new Set();
  let dragX = 0;
  let dragY = 0;
  let dragging = false;
  let tap = false;
  let downX = 0;
  let downY = 0;
  let prevX = 0;
  let prevY = 0;

  function readKey(event) {
    return event.key.length === 1 ? event.key.toLowerCase() : event.key;
  }

  window.addEventListener('keydown', (event) => {
    const key = readKey(event);
    if (key === ' ' || key.startsWith('arrow')) event.preventDefault();
    if (!held.has(key)) fresh.add(key);
    held.add(key);
  });
  window.addEventListener('keyup', (event) => held.delete(readKey(event)));
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('mousedown', (event) => {
    dragging = true;
    prevX = event.clientX;
    prevY = event.clientY;
    downX = event.clientX;
    downY = event.clientY;
  });
  window.addEventListener('mouseup', (event) => {
    if (dragging && Math.abs(event.clientX - downX) < 6 && Math.abs(event.clientY - downY) < 6) {
      tap = true;
    }
    dragging = false;
  });
  window.addEventListener('mousemove', (event) => {
    if (!dragging) return;
    dragX += event.clientX - prevX;
    dragY += event.clientY - prevY;
    prevX = event.clientX;
    prevY = event.clientY;
  });

  return {
    state: {
      get forward() { return held.has('w') || held.has('arrowup'); },
      get back() { return held.has('s') || held.has('arrowdown'); },
      get left() { return held.has('a') || held.has('arrowleft'); },
      get right() { return held.has('d') || held.has('arrowright'); },
      get run() { return held.has('shift'); },
      get brake() { return held.has(' '); },
    },
    // True once, on the frame the key went down; cleared by endFrame().
    wasPressed(key) { return fresh.has(key); },
    // True while the key is held down right now (for hold-to-work actions).
    isHeld(key) { return held.has(key); },
    // True once, on the frame the mouse was clicked without dragging.
    wasClicked() { return tap; },
    // Mouse drag accumulated since the last frame, in pixels.
    consumeDrag() {
      const out = { x: dragX, y: dragY };
      dragX = 0;
      dragY = 0;
      return out;
    },
    // Hooks for the screenshot autopilot: pretend a key is held, or inject a press.
    hold(key) { held.add(key); },
    release(key) { held.delete(key); },
    press(key) { fresh.add(key); },
    endFrame() {
      fresh.clear();
      tap = false;
    },
  };
}
