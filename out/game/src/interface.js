// Sunset Bay HUD: wanted stars, cash, health, speed, objective, minimap,
// message feed, banners, damage flash and the start / pause / game-over menus.
import { WORLD } from './city.js';

export class HUD {
constructor(callbacks) {
this.cb = callbacks || {};
this.el = (id) => document.getElementById(id);
this.starsEl = this.el('stars');
this.cashEl = this.el('cash');
this.healthFill = this.el('health-fill');
this.speedEl = this.el('speed');
this.speedUnit = this.el('speed-unit');
this.objectiveEl = this.el('objective');
this.objectiveDist = this.el('objective-dist');
this.bannerEl = this.el('banner');
this.bannerTitle = this.el('banner-title');
this.bannerSub = this.el('banner-sub');
this.feedEl = this.el('feed');
this.flashEl = this.el('damage-flash');
this.crosshairEl = this.el('crosshair');
this.minimap = this.el('minimap');
this.mapCtx = this.minimap.getContext('2d');
this.ammoEl = this.el('ammo');
this.bannerTimer = null;
this.bindButtons();
}
bindButtons() {
const startBtn = this.el('start-btn');
if (startBtn) startBtn.addEventListener('click', () => this.cb.onStart && this.cb.onStart());
const continueBtn = this.el('continue-btn');
if (continueBtn) continueBtn.addEventListener('click', () => this.cb.onStart && this.cb.onStart());
const resumeBtn = this.el('resume-btn');
if (resumeBtn) resumeBtn.addEventListener('click', () => this.cb.onResume && this.cb.onResume());
const restartBtn = this.el('restart-btn');
if (restartBtn) restartBtn.addEventListener('click', () => this.cb.onRestart && this.cb.onRestart());
const retryBtn = this.el('retry-btn');
if (retryBtn) retryBtn.addEventListener('click', () => this.cb.onRestart && this.cb.onRestart());
const muteBtn = this.el('mute-btn');
if (muteBtn) muteBtn.addEventListener('click', () => this.cb.onMute && this.cb.onMute());
}
show(screen) {
for (const id of ['start-screen', 'pause-screen', 'over-screen']) {
const n = this.el(id);
if (n) n.classList.toggle('hidden', id !== screen);
}
const hud = this.el('hud');
if (hud) hud.classList.toggle('hidden', screen !== null && screen !== 'none');
if (screen === 'none' && hud) hud.classList.remove('hidden');
}
setSave(hasSave, cash, mission) {
const c = this.el('continue-btn');
if (c) {
c.classList.toggle('hidden', !hasSave);
if (hasSave) c.textContent = 'Continue \u2014 $' + cash + ' \u00b7 Job ' + (mission + 1) + ' of 4';
}
}
setStars(n) {
let s = '';
for (let i = 0; i < 5; i++) s += i < n ? '\u2605' : '\u2606';
this.starsEl.textContent = s;
this.starsEl.classList.toggle('hot', n >= 3);
}
setCash(v) { this.cashEl.textContent = '$' + v; }
setHealth(v) {
this.healthFill.style.width = Math.max(0, Math.min(100, v)) + '%';
this.healthFill.classList.toggle('low', v < 35);
}
setSpeed(v, driving) {
this.speedEl.textContent = driving ? Math.round(Math.abs(v) * 2.4) : '';
this.speedUnit.style.visibility = driving ? 'visible' : 'hidden';
}
setAmmo(a) { if (this.ammoEl) this.ammoEl.textContent = a > 0 ? 'AMMO ' + a : 'RELOAD [R]'; }
setObjective(text, dist) {
this.objectiveEl.textContent = text;
this.objectiveDist.textContent = dist > 0 ? dist + 'm' : '';
}
banner(title, sub) {
this.bannerTitle.textContent = title;
this.bannerSub.textContent = sub || '';
this.bannerEl.classList.remove('hidden');
this.bannerEl.classList.remove('pop');
void this.bannerEl.offsetWidth;
this.bannerEl.classList.add('pop');
clearTimeout(this.bannerTimer);
this.bannerTimer = setTimeout(() => this.bannerEl.classList.add('hidden'), 6000);
}
feed(text) {
const d = document.createElement('div');
d.className = 'feed-line';
d.textContent = text;
this.feedEl.appendChild(d);
while (this.feedEl.children.length > 5) this.feedEl.removeChild(this.feedEl.firstChild);
setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 5000);
}
flash() {
this.flashEl.style.opacity = '0.55';
setTimeout(() => { this.flashEl.style.opacity = '0'; }, 130);
}
setCrosshair(show) { this.crosshairEl.style.display = show ? 'block' : 'none'; }
drawMinimap(city, player, traffic, police, marker, heading) {
const ctx = this.mapCtx;
const S = this.minimap.width;
const scale = S / (WORLD.half * 2 + 120);
const X = (x) => (x + WORLD.half + 60) * scale;
const Z = (z) => (z + WORLD.half + 60) * scale;
ctx.fillStyle = '#14161c';
ctx.fillRect(0, 0, S, S);
ctx.fillStyle = '#2a7ba8';
ctx.fillRect(0, 0, X(-480), S);
ctx.fillStyle = '#d9b380';
ctx.fillRect(X(-480), 0, X(-456) - X(-480), S);
ctx.strokeStyle = '#3a3f47';
ctx.lineWidth = 2.4;
for (const r of WORLD.roads) {
ctx.beginPath(); ctx.moveTo(X(r), 0); ctx.lineTo(X(r), S); ctx.stroke();
ctx.beginPath(); ctx.moveTo(0, Z(r)); ctx.lineTo(S, Z(r)); ctx.stroke();
}
ctx.fillStyle = '#5d7a45';
for (const p of city.parks) ctx.fillRect(X(p.x - 51), Z(p.z - 51), 102 * scale, 102 * scale);
if (marker) {
const pulse = 5 + Math.sin(performance.now() / 280) * 1.6;
ctx.fillStyle = '#ffd24a';
ctx.beginPath();
ctx.moveTo(X(marker.x), Z(marker.z) - pulse);
ctx.lineTo(X(marker.x) + pulse, Z(marker.z));
ctx.lineTo(X(marker.x), Z(marker.z) + pulse);
ctx.lineTo(X(marker.x) - pulse, Z(marker.z));
ctx.fill();
}
ctx.fillStyle = '#9aa0a8';
for (const t of traffic) ctx.fillRect(X(t.mesh.position.x) - 1.5, Z(t.mesh.position.z) - 1.5, 3, 3);
const blink = Math.sin(performance.now() / 130) > 0;
for (const p of police) {
ctx.fillStyle = blink ? '#ff3030' : '#3050ff';
ctx.beginPath();
ctx.arc(X(p.mesh.position.x), Z(p.mesh.position.z), 3.4, 0, Math.PI * 2);
ctx.fill();
}
ctx.save();
ctx.translate(X(player.x), Z(player.z));
ctx.rotate(-heading + Math.PI);
ctx.fillStyle = '#ffffff';
ctx.beginPath();
ctx.moveTo(0, -6);
ctx.lineTo(4.4, 5);
ctx.lineTo(-4.4, 5);
ctx.closePath();
ctx.fill();
ctx.restore();
}
}
