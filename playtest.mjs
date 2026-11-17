// Sunset Bay playtest: serves game/, opens it in headless Chromium over
// the DevTools protocol, waits for each staged shot to be ready, and
// saves real 1280x720 JPEG screenshots into screenshots/. Exits non-zero
// when the game reports errors or a shot never becomes ready.
//
// Usage: node playtest.mjs [--port 8931] [--shots shots.json]
// Requires the Chromium from Playwright's cache (or CHROME_BIN).

import { spawn, execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const portIdx = args.indexOf('--port');
const port = portIdx === -1 ? 8931 : Number(args[portIdx + 1]);
const shotsIdx = args.indexOf('--shots');
const shotsFile = shotsIdx === -1 ? join(here, 'shots.json') : args[shotsIdx + 1];
const shots = JSON.parse(readFileSync(shotsFile, 'utf8'));
const chromeBin = process.env.CHROME_BIN || (process.env.HOME + '/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome');
const width = 1280;
const height = 720;

function sleep(ms) {
return new Promise((r) => setTimeout(r, ms));
}

async function waitForHttp(url, timeoutMs) {
const start = Date.now();
while (Date.now() - start < timeoutMs) {
try {
const res = await fetch(url);
if (res.ok || res.status === 404) return true;
} catch {}
await sleep(200);
}
return false;
}

class Cdp {
constructor(wsUrl) {
this.ws = new WebSocket(wsUrl);
this.nextId = 1;
this.pending = new Map();
this.handlers = [];
this.ready = new Promise((resolve, reject) => {
this.ws.onopen = resolve;
this.ws.onerror = reject;
});
this.ws.onmessage = (ev) => {
let msg;
try { msg = JSON.parse(ev.data); } catch { return; }
if (msg.id && this.pending.has(msg.id)) {
const { resolve, reject } = this.pending.get(msg.id);
this.pending.delete(msg.id);
if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
else resolve(msg.result);
} else if (msg.method) {
for (const h of this.handlers) h(msg);
}
};
}
onEvent(fn) {
this.handlers.push(fn);
}
send(method, params, sessionId) {
const id = this.nextId++;
const payload = { id, method, params: params || {} };
if (sessionId) payload.sessionId = sessionId;
this.ws.send(JSON.stringify(payload));
return new Promise((resolve, reject) => {
this.pending.set(id, { resolve, reject });
setTimeout(() => {
if (this.pending.has(id)) {
this.pending.delete(id);
reject(new Error('CDP timeout: ' + method));
}
}, 60000);
});
}
close() {
try { this.ws.close(); } catch {}
}
}

async function main() {
mkdirSync(join(here, 'screenshots'), { recursive: true });
const server = spawn(process.execPath, ['serve.ts', '--port', String(port)], { cwd: here, stdio: ['ignore', 'pipe', 'pipe'] });
server.stdout.on('data', (d) => process.stdout.write('[serve] ' + d));
server.stderr.on('data', (d) => process.stdout.write('[serve:err] ' + d));
let exitCode = 0;
try {
const up = await waitForHttp('http://127.0.0.1:' + port + '/index.html', 10000);
if (!up) throw new Error('game server did not start on port ' + port);
const profile = '/tmp/sunsetbay-chrome-profile';
execSync('rm -rf ' + profile);
const chrome = spawn(chromeBin, [
'--headless=new',
'--no-sandbox',
'--disable-dev-shm-usage',
'--enable-unsafe-swiftshader',
'--use-gl=angle',
'--use-angle=swiftshader',
'--remote-debugging-port=9222',
'--user-data-dir=' + profile,
'--window-size=' + width + ',' + height,
'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] });
chrome.stderr.on('data', (d) => {
const s = String(d);
if (/ERROR|FATAL/.test(s)) process.stdout.write('[chrome] ' + s);
});
const debugUp = await waitForHttp('http://127.0.0.1:9222/json/version', 20000);
if (!debugUp) throw new Error('chromium devtools did not start');
const version = await (await fetch('http://127.0.0.1:9222/json/version')).json();
const cdp = new Cdp(version.webSocketDebuggerUrl);
await cdp.ready;
const errors = [];
cdp.onEvent((msg) => {
if (msg.method === 'Runtime.exceptionThrown') {
errors.push('exception: ' + JSON.stringify(msg.params.exceptionDetails).slice(0, 500));
}
if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
errors.push('console.error: ' + msg.params.args.map((a) => a.value || a.description || '').join(' ').slice(0, 500));
}
if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
errors.push('log: ' + (msg.params.entry.text || '') + ' ' + (msg.params.entry.url || ''));
}
});
for (const shot of shots) {
const url = 'http://127.0.0.1:' + port + '/index.html' + shot.query;
const target = await cdp.send('Target.createTarget', { url: 'about:blank' });
const targetId = target.targetId;
const attached = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
const sessionId = attached.sessionId;
await cdp.send('Page.enable', {}, sessionId);
await cdp.send('Runtime.enable', {}, sessionId);
await cdp.send('Log.enable', {}, sessionId);
await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
await cdp.send('Page.navigate', { url }, sessionId);
let ready = false;
const start = Date.now();
while (Date.now() - start < 90000) {
await sleep(500);
try {
const r = await cdp.send('Runtime.evaluate', { expression: 'window.__shotReady === true', returnByValue: true }, sessionId);
if (r && r.result && r.result.value === true) { ready = true; break; }
} catch {}
}
if (!ready) {
console.log('SHOT NOT READY: ' + shot.name + ' (' + url + ')');
try {
const r = await cdp.send('Runtime.evaluate', { expression: 'JSON.stringify({ready: window.__gameReady, errors: window.__errors, state: window.__shotReady})', returnByValue: true }, sessionId);
console.log('  state: ' + (r && r.result ? r.result.value : 'n/a'));
} catch {}
exitCode = 1;
} else {
const shot2 = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 82 }, sessionId);
const outPath = join(here, 'screenshots', shot.name);
writeFileSync(outPath, Buffer.from(shot2.data, 'base64'));
console.log('SHOT OK: ' + shot.name + ' (' + Math.round(Buffer.from(shot2.data, 'base64').length / 1024) + ' KiB)');
}
await cdp.send('Target.closeTarget', { targetId });
}
const gameErrors = errors.filter((e) => !/favicon/i.test(e));
if (gameErrors.length > 0) {
console.log('PAGE ERRORS (' + gameErrors.length + '):');
for (const e of gameErrors.slice(0, 10)) console.log('  ' + e);
exitCode = 1;
} else {
console.log('NO PAGE ERRORS');
}
cdp.close();
chrome.kill('SIGKILL');
} finally {
server.kill('SIGKILL');
}
console.log(exitCode === 0 ? 'PLAYTEST PASSED' : 'PLAYTEST FAILED');
process.exit(exitCode);
}

main().catch((e) => {
console.error('PLAYTEST CRASH: ' + (e && e.stack ? e.stack : String(e)));
process.exit(1);
});
