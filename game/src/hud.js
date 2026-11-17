// Sunset Bay: the HUD — stars, cash, health, objective, messages, and
// the live minimap drawn on a 2D canvas.

import { CONFIG, districtAt } from './config.js';

export class Hud {
constructor() {
this.starsEl = document.getElementById('stars');
this.cashEl = document.getElementById('cash');
this.healthFill = document.getElementById('health-fill');
this.healthText = document.getElementById('health-text');
this.objectiveEl = document.getElementById('objective');
this.objectiveDist = document.getElementById('objective-dist');
this.messageEl = document.getElementById('message');
this.speedEl = document.getElementById('speed');
this.districtEl = document.getElementById('district');
this.crosshair = document.getElementById('crosshair');
this.minimap = document.getElementById('minimap');
this.mapCtx = this.minimap.getContext('2d');
this.lastMessage = '';
this.messageTimer = 0;
}
setStars(n) {
let s = '';
for (let i = 0; i < 5; i++) s += i < n ? '★' : '☆';
this.starsEl.textContent = s;
this.starsEl.classList.toggle('hot', n >= 3);
}
setCash(cash) {
this.cashEl.textContent = '$' + cash.toLocaleString('en-US');
}
setHealth(h) {
const pct = Math.max(0, Math.min(100, h));
this.healthFill.style.width = pct + '%';
this.healthText.textContent = Math.ceil(pct);
this.healthFill.classList.toggle('low', pct < 30);
}
setObjective(text, dist) {
this.objectiveEl.textContent = text;
this.objectiveDist.textContent = dist === null || dist === undefined ? '' : dist + 'm';
}
showMessage(text, seconds) {
this.messageEl.textContent = text;
this.messageEl.classList.add('show');
this.lastMessage = text;
this.messageTimer = seconds || 4;
}
setSpeed(kmh, inCar) {
if (!inCar) {
this.speedEl.textContent = '';
return;
}
this.speedEl.textContent = Math.round(kmh) + ' km/h';
}
setDistrict(x, z) {
this.districtEl.textContent = districtAt(x, z);
}
setCrosshairVisible(v) {
this.crosshair.style.display = v ? 'block' : 'none';
}
update(dt, game) {
if (this.messageTimer > 0) {
this.messageTimer -= dt;
if (this.messageTimer <= 0) this.messageEl.classList.remove('show');
}
this.drawMinimap(game);
}
drawMinimap(game) {
const ctx = this.mapCtx;
const size = CONFIG.minimapSize;
const half = CONFIG.cityHalf + 60;
const scale = size / (half * 2);
const toMap = (x, z) => [(x + half) * scale, (z + half) * scale];
ctx.clearRect(0, 0, size, size);
ctx.fillStyle = 'rgba(20, 28, 40, 0.85)';
ctx.fillRect(0, 0, size, size);
ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
ctx.lineWidth = 1;
ctx.fillStyle = '#2c4a6b';
const oceanEdge = toMap(CONFIG.beachX - 35, 0)[0];
ctx.fillRect(0, 0, Math.max(0, oceanEdge), size);
ctx.fillStyle = '#c9a86a';
ctx.fillRect(toMap(CONFIG.beachX - 40, -half)[0], 0, 14, size);
ctx.fillStyle = '#3a3f45';
const step = CONFIG.blockSize + CONFIG.roadWidth;
for (let i = 0; i <= CONFIG.gridCount; i++) {
const v = -CONFIG.cityHalf + i * step;
const ax = toMap(v, 0)[0];
const az = toMap(0, v)[1];
ctx.fillRect(ax - (CONFIG.roadWidth / 2) * scale, 0, CONFIG.roadWidth * scale, size);
ctx.fillRect(0, az - (CONFIG.roadWidth / 2) * scale, size, CONFIG.roadWidth * scale);
}
const dot = (x, z, r, color) => {
const p = toMap(x, z);
ctx.fillStyle = color;
ctx.beginPath();
ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
ctx.fill();
};
if (game.missions && game.missions.currentTarget) {
const t = game.missions.currentTarget;
const p = toMap(t.x, t.z);
const pulse = 6 + Math.sin(performance.now() * 0.006) * 2;
ctx.strokeStyle = '#ffd23e';
ctx.lineWidth = 2;
ctx.beginPath();
ctx.arc(p[0], p[1], pulse, 0, Math.PI * 2);
ctx.stroke();
dot(t.x, t.z, 4, '#ffd23e');
}
if (game.traffic) {
for (const car of game.traffic.cars) {
if (!car.dead) dot(car.x, car.z, 2, '#bbbbbb');
}
}
if (game.police) {
for (const car of game.police.cars) dot(car.x, car.z, 3, '#ff4444');
}
if (game.player) {
const p = toMap(game.player.x, game.player.z);
ctx.save();
ctx.translate(p[0], p[1]);
ctx.rotate(Math.atan2(Math.sin(game.player.heading), Math.cos(game.player.heading)) + Math.PI);
ctx.fillStyle = '#ffffff';
ctx.beginPath();
ctx.moveTo(0, -7);
ctx.lineTo(5, 6);
ctx.lineTo(-5, 6);
ctx.closePath();
ctx.fill();
ctx.restore();
}
}
}
