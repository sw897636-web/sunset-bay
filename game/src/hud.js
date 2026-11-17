// The HUD: health, cash, wanted stars, mission panel, toasts, prompts and
// the live minimap — a top-down drawing of the city with the player, cars,
// cops and the mission marker on it.
import { CITY } from './config.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const healthBar = el('healthBar');
  const cashLine = el('cashLine');
  const cashSub = el('cashSub');
  const ammoLine = el('ammoLine');
  const starsEl = el('stars');
  const missionTitle = el('missionTitle');
  const missionText = el('missionText');
  const missionTimer = el('missionTimer');
  const toastEl = el('toast');
  const promptEl = el('prompt');
  const speedo = el('speedo');
  const crosshair = el('crosshair');
  const damage = el('damage');
  const minimap = el('minimap');
  const mm = minimap.getContext('2d');

  let toastTimer = 0;

  function drawMinimap(world) {
    const size = 180;
    const span = CITY.half * 2 + 120; // world units across the map
    const scale = size / span;
    const toMap = (x, z) => [size / 2 + x * scale, size / 2 + z * scale];
    mm.clearRect(0, 0, size, size);
    // Ocean + beach.
    mm.fillStyle = '#2a6f8f';
    mm.fillRect(0, size / 2 + CITY.half * scale, size, size);
    mm.fillStyle = '#e8cf9a';
    mm.fillRect(0, size / 2 + (CITY.half - 2) * scale, size, 6);
    // Roads.
    mm.strokeStyle = '#55555f';
    mm.lineWidth = 5;
    for (let i = 0; i <= CITY.blocks; i += 1) {
      const c = -CITY.half + CITY.roadWidth / 2 + i * CITY.pitch;
      const [x0, y0] = toMap(c, -CITY.half);
      const [x1, y1] = toMap(c, CITY.half);
      mm.beginPath(); mm.moveTo(x0, y0); mm.lineTo(x1, y1); mm.stroke();
      const [hx0, hy0] = toMap(-CITY.half, c);
      const [hx1, hy1] = toMap(CITY.half, c);
      mm.beginPath(); mm.moveTo(hx0, hy0); mm.lineTo(hx1, hy1); mm.stroke();
    }
    // Mission marker.
    const marker = world.missions.marker();
    if (marker) {
      const [mx, my] = toMap(marker.x, marker.z);
      const pulse = 5 + Math.sin(world.time * 4) * 2;
      mm.fillStyle = '#ffd23c';
      mm.beginPath();
      mm.moveTo(mx, my - pulse);
      mm.lineTo(mx + pulse, my);
      mm.lineTo(mx, my + pulse);
      mm.lineTo(mx - pulse, my);
      mm.closePath();
      mm.fill();
    }
    // Cars: traffic grey, police flashing blue/red.
    for (const car of world.cars) {
      const [cx, cy] = toMap(car.x, car.z);
      if (car.isPolice) {
        mm.fillStyle = Math.floor(world.time * 4) % 2 === 0 ? '#ff3333' : '#3388ff';
        mm.beginPath(); mm.arc(cx, cy, 4, 0, Math.PI * 2); mm.fill();
      } else if (car !== world.playerCar) {
        mm.fillStyle = '#bbbbbb';
        mm.fillRect(cx - 2, cy - 2, 4, 4);
      }
    }
    // Player arrow, rotated to face the heading.
    const [px, py] = toMap(world.player.x, world.player.z);
    mm.save();
    mm.translate(px, py);
    mm.rotate(world.player.heading);
    mm.fillStyle = '#ffffff';
    mm.strokeStyle = '#000000';
    mm.beginPath();
    mm.moveTo(0, -7);
    mm.lineTo(5, 6);
    mm.lineTo(0, 3);
    mm.lineTo(-5, 6);
    mm.closePath();
    mm.fill();
    mm.stroke();
    mm.restore();
  }

  return {
    update(world, dt) {
      const p = world.player;
      healthBar.style.width = `${Math.max(0, p.health)}%`;
      healthBar.style.background = p.health > 50
        ? 'linear-gradient(90deg,#ff5a3c,#ffb03c)'
        : 'linear-gradient(90deg,#d81e1e,#ff5a3c)';
      cashLine.firstChild.textContent = `$${p.cash.toLocaleString('en-US')} `;
      const jobNo = world.missions.active
        ? world.missions.index + 1
        : Math.min(world.completedMissions + 1, world.missions.totalMissions);
      cashSub.textContent = `· Job ${jobNo} of ${world.missions.totalMissions}`;
      ammoLine.textContent = p.hasPistol
        ? (world.combat.reloading ? 'Reloading…' : `Pistol ${p.ammo} / 12 — Q holster, R reload`)
        : 'No pistol — earn one in Job 2';
      const w = world.police.wanted;
      let stars = '';
      for (let i = 0; i < 5; i += 1) stars += `<span class="${i < w ? '' : 'dim'}">★</span>`;
      starsEl.innerHTML = stars;
      if (world.playerCar) {
        speedo.classList.remove('hidden');
        const mph = Math.round(Math.abs(world.playerCar.speed) * 2.237);
        speedo.firstChild.textContent = `${mph}`;
      } else {
        speedo.classList.add('hidden');
      }
      crosshair.classList.toggle('hidden', !(p.hasPistol && p.weaponOut));
      damage.style.opacity = p.health < 35 ? String(0.35 + (0.35 - p.health / 100)) : '0';
      if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0) toastEl.textContent = '';
      }
      drawMinimap(world);
    },
    toast(text) {
      toastEl.textContent = text;
      toastTimer = 4;
    },
    setMission(title, text, timer) {
      missionTitle.textContent = title;
      missionText.textContent = text;
      missionTimer.textContent = timer;
    },
    setPrompt(text) {
      if (text) {
        promptEl.textContent = text;
        promptEl.classList.remove('hidden');
      } else {
        promptEl.classList.add('hidden');
      }
    },
    show() { el('hud').classList.remove('hidden'); },
    hide() { el('hud').classList.add('hidden'); },
  };
}
