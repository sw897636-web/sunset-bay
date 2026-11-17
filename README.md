# Sunset Bay — an open-world crime game

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/sw897636-web/sunset-bay/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/sw897636-web/sunset-bay/reward.svg)](https://make.fun/bounty/gta6-01)

**Sunset Bay** is a complete open-world crime game that runs in desktop Chrome
from static files — no build step, no network requests at runtime. Roam a
sun-soaked procedural coastal city on foot and by car, steal cars, run jobs
for Mara the fixer, and stay one step ahead of the Bay City Police.

[Play it on make.fun](https://make.fun/bounty/gta6-01)

## The game

You are **Rico Vega**, fresh off the night bus with empty pockets and a name
to make. Mara runs the Bay from a garage on Coral Row, and she has five jobs
for you:

1. **First Wheels** — steal any car and bring it to Mara's Garage.
2. **The Sunset Run** — grab a package at the end of the pier and deliver it
   to Sunset Tower before the buyer walks (timed). Earns you a pistol.
3. **The Pickup** — collect Dana at the marina and get her to the garage with
   the cops already on you.
4. **The Corner Job** — empty the till at the Coral Corner Store, then lose a
   two-star wanted level.
5. **The Gold Sedan** — steal the gold sedan at the marina, lose three stars
   of heat, and put it on Mara's boat. Finish the story and the Bay is yours.

Between jobs the city is yours to roam: traffic cruises the streets,
pedestrians stroll the sidewalks (and scatter when trouble starts), and every
crime raises your wanted level — up to five stars, with cop cars that ram you
and foot cops that run you down. Get busted or wasted and you can retry the
job or free-roam instead.

## Features

- Procedural 3D city (three.js): 7×7 blocks of pastel buildings with lit
  windows, roads with markings, palms, lamps, a beach, ocean and a pier.
- Driving with arcade handling, handbrake, collisions and traffic that brakes
  for the car ahead.
- On-foot movement, sprinting, melee punches and a pistol (hitscan with
  tracers, reload, ammo).
- Wanted system (0–5 stars) with police cars that chase and ram, foot cops,
  bust timer and heat that fades when you stay quiet.
- Five story missions with beacons, timers, objectives and cash rewards.
- HUD: health, cash, wanted stars, mission panel, speedometer and a live
  circular minimap (player, traffic, police, mission marker).
- Title, pause, busted/wasted and story-complete screens; save/load via
  localStorage (auto-save after every mission, `T` to quick-save).
- Synthesized sound: engine hum, police sirens, gunshots, impacts, mission
  jingles and a slow sunset chord progression — all WebAudio, no audio files.

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Move / drive |
| Mouse drag | Look around (camera) |
| E | Enter / steal car, exit car; hold E to work a job |
| Shift | Sprint |
| F | Punch |
| Q | Draw / holster pistol |
| Click | Shoot (pistol drawn) |
| R | Reload |
| Space | Handbrake |
| P / Esc | Pause |
| M | Mute |
| T | Quick save |

## How to run

```sh
node serve.ts
```

Then open <http://localhost:8080> in desktop Chrome. No build step and no
network access needed — every script is a file under `game/`, including the
vendored three.js build (`game/vendor/three.module.min.js`).

## Layout

- `game/index.html` — page, HUD and menus.
- `game/src/main.js` — boot, game loop, screens, camera, hero, save/load.
- `game/src/city.js` — procedural city, road graph, collisions.
- `game/src/vehicles.js` — driving physics and traffic AI.
- `game/src/pedestrians.js` — pedestrians.
- `game/src/police.js` — wanted level and police AI.
- `game/src/missions.js` — the five story jobs.
- `game/src/combat.js` — punches and shooting.
- `game/src/hud.js` — HUD and live minimap.
- `game/src/audio.js` — synthesized WebAudio effects and music.
- `game/src/input.js`, `game/src/config.js`, `game/src/random.js` — input,
  tuning and the seeded RNG.
- `game/src/shots.js` — screenshot staging (`?shot=start|drive|chase|mission`).
- `screenshots/` — four real renders of the game, taken in headless Chrome.

Everything in the game — the city, the characters, the cars, the story, the
sounds — is original. No assets, names or music from any commercial game.

## License

MIT — see [LICENSE](LICENSE).
