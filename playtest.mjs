// Sunset Bay playtest (Node 22+, standard library only).
// Serves game/, drives headless Chromium over CDP, loads each ?shot= scene,
// captures screenshots to screenshots/, and runs a keyboard gameplay smoke test.
// Usage: node playtest.mjs [--port 8137] [--shots-only]
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.HOME + '/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const PORT = 8137;
const shotsOnly = process.argv.includes('--shots-only');
const shots = [
{ name: '1-cover.jpg', query: '?shot=cover&seed=1' },
{ name: '2-street.jpg', query: '?shot=street&seed=1' },
{ name: '3-chase.jpg', query: '?shot=chase&seed=1' },
{ name: '4-mission.jpg', query: '?shot=mission&seed=1' },
];
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startServer() {
return new Promise((resolve, reject) => {
const child = spawn(process.execPath, ['serve.ts', '--port', String(PORT)], { cwd: here, stdio: ['ignore', 'pipe', 'pipe'] });
let out = '';
child.stdout.on('data', (d) => { out += d; });
child.stderr.on('data', (d) => { out += d; });
const timer = setTimeout(() => {
if (out.includes('http://localhost:' + PORT)) resolve(child);
else reject(new Error('server did not start: ' + out));
}, 4000);
child.stdout.on('data', () => {
if (out.includes('http://localhost:' + PORT)) { clearTimeout(timer); resolve(child); }
});
});
}

function startChrome() {
return new Promise((resolve, reject) => {
const child = spawn(CHROME, [
'--headless=new', '--no-sandbox', '--disable-gpu-sandbox', '--use-angle=swiftshader',
'--enable-unsafe-swiftshader', '--remote-debugging-port=9223', '--window-size=1280,720',
'--hide-scrollbars', 'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] });
setTimeout(() => resolve(child), 2500);
child.on('error', reject);
});
}

async function getPageTarget() {
for (let i = 0; i < 20; i++) {
try {
const res = await fetch('http://127.0.0.1:9223/json/list');
const targets = await res.json();
const page = targets.find((t) => t.type === 'page');
if (page) return page;
} catch { /* retry */ }
await sleep(500);
}
throw new Error('no page target from Chrome');
}

let msgId = 0;
const pending = new Map();
function cdpSend(ws, method, params) {
return new Promise((resolve, reject) => {
const id = ++msgId;
pending.set(id, { resolve, reject });
ws.send(JSON.stringify({ id, method, params: params || {} }));
});
}
function attachWs(url) {
return new Promise((resolve, reject) => {
const ws = new WebSocket(url);
ws.onopen = () => resolve(ws);
ws.onerror = reject;
ws.onmessage = (ev) => {
const msg = JSON.parse(ev.data);
if (msg.id && pending.has(msg.id)) {
const { resolve, reject } = pending.get(msg.id);
pending.delete(msg.id);
if (msg.error) reject(new Error(msg.error.message));
else resolve(msg.result);
} else if (msg.method === 'Runtime.exceptionThrown') {
const d = msg.params.exceptionDetails;
errors.push('page exception: ' + (d.exception?.description || d.text || 'unknown'));
} else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
errors.push('console.error: ' + msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
}
};
});
}
async function evalJs(ws, expr) {
const r = await cdpSend(ws, 'Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
if (r.exceptionDetails) throw new Error('evaluate failed: ' + JSON.stringify(r.exceptionDetails));
return r.result ? r.result.value : undefined;
}
async function waitReady(ws, timeoutMs) {
const start = Date.now();
while (Date.now() - start < timeoutMs) {
try {
if (await evalJs(ws, 'window.__ready === true')) return true;
} catch { /* page still loading */ }
await sleep(400);
}
return false;
}
async function keyEvent(ws, type, code, key) {
await cdpSend(ws, 'Input.dispatchKeyEvent', { type, code, key, windowsVirtualKeyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0 });
}
async function holdKey(ws, code, key, ms) {
await keyEvent(ws, 'keyDown', code, key);
await sleep(ms);
await keyEvent(ws, 'keyUp', code, key);
}

const server = await startServer();
console.log('server up on', PORT);
const chrome = await startChrome();
console.log('chrome up, pid', chrome.pid);
let exitCode = 0;
try {
const target = await getPageTarget();
const ws = await attachWs(target.webSocketDebuggerUrl);
await cdpSend(ws, 'Page.enable');
await cdpSend(ws, 'Runtime.enable');
await cdpSend(ws, 'Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
mkdirSync(join(here, 'screenshots'), { recursive: true });
for (const shot of shots) {
const url = 'http://localhost:' + PORT + '/index.html' + shot.query;
await cdpSend(ws, 'Page.navigate', { url });
const ok = await waitReady(ws, 25000);
if (!ok) { errors.push(shot.name + ': __ready never fired'); continue; }
await sleep(2500);
const state = await evalJs(ws, 'window.__game ? window.__game.getState() : null');
const errs = await evalJs(ws, 'window.__errors || []');
for (const e of errs) errors.push(shot.name + ': ' + e);
const shot2 = await cdpSend(ws, 'Page.captureScreenshot', { format: 'jpeg', quality: 82 });
const outPath = join(here, 'screenshots', shot.name);
writeFileSync(outPath, Buffer.from(shot2.data, 'base64'));
const size = statSync(outPath).size;
console.log(shot.name, size + ' bytes', 'state:', JSON.stringify(state));
if (size > 262144) errors.push(shot.name + ': over 256 KiB (' + size + ')');
if (size < 12000) errors.push(shot.name + ': suspiciously small (' + size + '), maybe black');
}
if (!shotsOnly) {
await cdpSend(ws, 'Page.navigate', { url: 'http://localhost:' + PORT + '/index.html' });
await sleep(2500);
await evalJs(ws, 'document.getElementById("start-btn").click()');
await sleep(1200);
const before = await evalJs(ws, 'window.__game.getState()');
await keyEvent(ws, 'keyDown', 'KeyW', 'w');
let after = before;
const smokeStart = Date.now();
while (Date.now() - smokeStart < 90000) {
await sleep(500);
after = await evalJs(ws, 'window.__game.getState()');
if (after.frames - before.frames >= 30) break;
}
await keyEvent(ws, 'keyUp', 'KeyW', 'w');
console.log('smoke before:', JSON.stringify(before));
console.log('smoke after W (' + (after.frames - before.frames) + ' frames):', JSON.stringify(after));
const moved = Math.abs(after.x - before.x) + Math.abs(after.z - before.z);
if (after.state !== 'playing') errors.push('smoke: game did not reach playing state');
if (moved < 3) errors.push('smoke: player did not move (moved ' + moved + ')');
if (after.frames - before.frames < 30) errors.push('smoke: too few frames rendered in 90s');
const errs = await evalJs(ws, 'window.__errors || []');
for (const e of errs) errors.push('smoke: ' + e);
}
ws.close();
} catch (e) {
errors.push('playtest harness: ' + (e.message || e));
exitCode = 1;
} finally {
try { process.kill(chrome.pid, 'SIGTERM'); } catch { /* already gone */ }
try { process.kill(server.pid, 'SIGTERM'); } catch { /* already gone */ }
}
if (errors.length) {
console.log('PLAYTEST FAILURES:');
for (const e of errors) console.log(' - ' + e);
process.exit(1);
}
console.log('PLAYTEST OK');
