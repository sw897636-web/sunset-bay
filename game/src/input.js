// Keyboard + mouse input. The camera orbits by dragging the mouse (no pointer
// lock, so it works the same in a real browser and a headless screenshot run).
// Every frame the game reads `state` and consumes `pressed` edge events.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let mouseDown = false;
  let clickX = 0;
  let clickY = 0;
  let clicked = false;
  let lastX = 0;
  let lastY = 0;

  function keyName(event) {
    const k = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    return k;
  }

  window.addEventListener('keydown', (event) => {
    const k = keyName(event);
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) event.preventDefault();
    if (!keys.has(k)) pressed.add(k);
    keys.add(k);
  });
  window.addEventListener('keyup', (event) => keys.delete(keyName(event)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (event) => {
    mouseDown = true;
    lastX = event.clientX;
    lastY = event.clientY;
    clickX = event.clientX;
    clickY = event.clientY;
  });
  window.addEventListener('mouseup', (event) => {
    if (mouseDown && Math.abs(event.clientX - clickX) < 6 && Math.abs(event.clientY - clickY) < 6) {
      clicked = true;
    }
    mouseDown = false;
  });
  window.addEventListener('mousemove', (event) => {
    if (!mouseDown) return;
    mouseDX += event.clientX - lastX;
    mouseDY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });

  return {
    state: {
      get forward() { return keys.has('w') || keys.has('arrowup'); },
      get back() { return keys.has('s') || keys.has('arrowdown'); },
      get left() { return keys.has('a') || keys.has('arrowleft'); },
      get right() { return keys.has('d') || keys.has('arrowright'); },
      get run() { return keys.has('shift'); },
      get brake() { return keys.has(' '); },
    },
    // True once for the frame the key went down; cleared by endFrame().
    wasPressed(key) { return pressed.has(key); },
    // True once for the frame the mouse was clicked without dragging.
    wasClicked() { return clicked; },
    // Accumulated drag since the last frame, in pixels.
    consumeDrag() {
      const d = { x: mouseDX, y: mouseDY };
      mouseDX = 0;
      mouseDY = 0;
      return d;
    },
    // Test / screenshot autopilot hooks: pretend a key is held, or inject a press.
    hold(key) { keys.add(key); },
    release(key) { keys.delete(key); },
    press(key) { pressed.add(key); },
    endFrame() {
      pressed.clear();
      clicked = false;
    },
  };
}
