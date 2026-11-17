# Sunset Bay

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/sw897636-web/sunset-bay/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/sw897636-web/sunset-bay/reward.svg)](https://make.fun/bounty/gta6-01)

An original 3D open-world crime game for make.fun's gta6-01 bounty, built with three.js. No Rockstar content: the city, characters, vehicles, story, art and sounds are all original.

## The game

You are **Jax Marlowe**, getaway driver, back in Sunset Bay with $250 and a debt to fixer **Mama Lou**. Explore a sun-soaked coastal city on foot and by car, steal vehicles, run four story jobs, dodge the Bay PD's wanted system, and build your cash.

- **Open world**: procedural grid city with a beach, ocean, parks, parking lots, palm trees and a downtown skyline at sunset.
- **On foot and driving**: third-person camera, sprint, arcade car physics, handbrake, enter/exit any parked or stopped car.
- **Traffic and pedestrians**: cars drive the grid and turn at intersections; walkers use the sidewalks and flee from danger.
- **Wanted system**: crimes raise heat (0–5 stars); police cars chase, ram and try to bust you on foot. Lose them to cool down.
- **Missions and story**: four chained jobs — First Wheels, Dockside Pickup, Heat Wave, The Big Score — with markers, timers, rewards and fail/retry.
- **Combat**: pistol with raycast shooting, muzzle flash, tracers, ammo and reload.
- **HUD**: minimap with live blips, wanted stars, cash, health, speed, objective tracker, message feed.
- **Sound**: fully synthesized WebAudio — engine hum, police sirens, gunshots, pickups, jingles.
- **Save**: cash and job progress persist in localStorage.

## Play

```bash
node serve.ts
```

Open http://localhost:8080 in desktop Chrome.

- **WASD** move / drive · **Mouse** look (click to lock) · **E** enter/exit car · **Click** shoot · **R** reload · **Shift** sprint · **Space** handbrake · **M** mute · **Esc** pause.

## Layout

- `game/` — the playable game (static files, no network requests)
  - `index.html`, `style.css` — page and HUD styling
  - `src/boot.js` — startup and screenshot staging hook
  - `src/engine.js` — game state, player, driving, wanted, combat, camera
  - `src/city.js` — procedural city, beach, ocean, sunset sky
  - `src/cars.js` — car meshes and traffic AI
  - `src/people.js` — pedestrians
  - `src/cops.js` — police pursuit
  - `src/story.js` — four story missions
  - `src/sound.js` — synthesized audio
  - `src/interface.js` — HUD and minimap
  - `src/controls.js` — keyboard and mouse input
  - `src/staging.js` — deterministic screenshot setups (`?shot=cover|street|chase|mission`)
  - `vendor/three.module.min.js` — vendored three.js
- `screenshots/` — four real renders of the game (cover first)
- `main.ts` — entry program, copies game/ and screenshots/ to /output and writes dossier.json
- `shots.json` — screenshot list for the playtest

## License

MIT — see LICENSE.
