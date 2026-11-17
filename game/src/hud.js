// The HUD: health, cash, wanted stars, the job panel, toasts, prompts and
// the live minimap — a top-down sketch of the city with the hero, cars,
// cops and the job marker drawn on it.
import { WORLD } from './config.js';

export function createHud() {
  const byId = (id) => document.getElementById(id);
  const healthBar = byId('healthBar');
  const cashLine = byId('cashLine');
  const cashSub = byId('cashSub');
  const ammoLine = byId('ammoLine');
  const starsEl = byId('stars');
  const jobTitle = byId('missionTitle');
  const jobText = byId('missionText');
  const jobTimer = byId('missionTimer');
  const toastEl = byId('toast');
  const promptEl = byId('prompt');
  const speedo = byId('speedo');
  const crosshair = byId('crosshair');
  const damage = byId('damage');
  const minimap = byId('minimap');
  const mm = minimap.getContext('2d');

  let toastLeft = 0;

  function paintMinimap(world) {
    const size = 180;
    const span = WORLD.edge * 2 + 120; // world units across the map
    const scale = size / span;
    const toMap = (x, z) => [size / 2 + x * scale, size / 2 + z * scale];
    mm.clearRect(0, 0, size, size);
    // Sea and sand along the bottom.
    mm.fillStyle = '#2a6f8f';
    mm.fillRect(0, size / 2 + WORLD.edge * scale, size, size);
    mm.fillStyle = '#e8cf9a';
    mm.fillRect(0, size / 2 + (WORLD.edge - 2) * scale, size, 6);
    // Streets.
    mm.strokeStyle = '#55555f';
    mm.lineWidth = 5;
    for (let i = 0; i <= WORLD.blocksPerSide; i += 1) {
      const c = -WORLD.edge + WORLD.street / 2 + i * WORLD.step;
      const [x0, y0] = toMap(c, -WORLD.edge);
      const [x1, y1] = toMap(c, WORLD.edge);
      mm.beginPath(); mm.moveTo(x0, y0); mm.lineTo(x1, y1); mm.stroke();
      const [hx0, hy0] = toMap(-WORLD.edge, c);
      const [hx1, hy1] = toMap(WORLD.edge, c);
      mm.beginPath(); mm.moveTo(hx0, hy0); mm.lineTo(hx1, hy1); mm.stroke();
    }
    // Job marker, pulsing.
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
    // Cars: traffic grey, police flashing red and blue.
    for (const car of world.cars) {
      const [cx, cy] = toMap(car.x, car.z);
      if (car.police) {
        mm.fillStyle = Math.floor(world.time * 4) % 2 === 0 ? '#ff3333' : '#3388ff';
        mm.beginPath(); mm.arc(cx, cy, 4, 0, Math.PI * 2); mm.fill();
      } else if (car !== world.playerCar) {
        mm.fillStyle = '#bbbbbb';
        mm.fillRect(cx - 2, cy - 2, 4, 4);
      }
    }
    // Hero arrow, rotated to face the heading.
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
      const hero = world.player;
      healthBar.style.width = `${Math.max(0, hero.health)}%`;
      healthBar.style.background = hero.health > 50
        ? 'linear-gradient(90deg,#ff5a3c,#ffb03c)'
        : 'linear-gradient(90deg,#d81e1e,#ff5a3c)';
      cashLine.firstChild.textContent = `$${hero.cash.toLocaleString('en-US')} `;
      const jobNo = world.missions.active
        ? world.missions.index + 1
        : Math.min(world.completedMissions + 1, world.missions.totalMissions);
      cashSub.textContent = `· Job ${jobNo} of ${world.missions.totalMissions}`;
      ammoLine.textContent = hero.hasPistol
        ? (world.combat.reloading ? 'Reloading…' : `Pistol ${hero.ammo} / 12 — Q holster, R reload`)
        : 'No pistol — earn one in Job 2';
      const heat = world.police.wanted;
      let stars = '';
      for (let i = 0; i < 5; i += 1) stars += `<span class="${i < heat ? '' : 'dim'}">★</span>`;
      starsEl.innerHTML = stars;
      if (world.playerCar) {
        speedo.classList.remove('hidden');
        const mph = Math.round(Math.abs(world.playerCar.speed) * 2.237);
        speedo.firstChild.textContent = `${mph}`;
      } else {
        speedo.classList.add('hidden');
      }
      crosshair.classList.toggle('hidden', !(hero.hasPistol && hero.weaponOut));
      damage.style.opacity = hero.health < 35 ? String(0.35 + (0.35 - hero.health / 100)) : '0';
      if (toastLeft > 0) {
        toastLeft -= dt;
        if (toastLeft <= 0) toastEl.textContent = '';
      }
      paintMinimap(world);
    },
    toast(text) {
      toastEl.textContent = text;
      toastLeft = 4;
    },
    setMission(title, text, timer) {
      jobTitle.textContent = title;
      jobText.textContent = text;
      jobTimer.textContent = timer;
    },
    setPrompt(text) {
      if (text) {
        promptEl.textContent = text;
        promptEl.classList.remove('hidden');
      } else {
        promptEl.classList.add('hidden');
      }
    },
    show() { byId('hud').classList.remove('hidden'); },
    hide() { byId('hud').classList.add('hidden'); },
  };
}
