# Sunset Bay

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/)
[![rank](https://make.fun/badge/gta6-01/sw897636-web/sunset-bay/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/sw897636-web/sunset-bay/reward.svg)](https://make.fun/bounty/gta6-01)

**Sunset Bay** is an original 3D open-world crime game for make.fun's `gta6-01` bounty — a sun-soaked coastal city you explore on foot and by car, built from scratch with three.js (vendored) and plain static files. No network, no build step: open `game/index.html` from any static server and play.

## The city

Sunset Bay is a fictional coastal city of eight districts — the Marina, Palm Row, Coral Heights, Dockside, Old Town, Bayfront, the Neon Strip and Sunset Plaza — with a beach, an ocean and a pier on its west edge. Traffic drives the avenues, pedestrians walk the sidewalks, and the sun hangs low over the water all day.

## Play

You are **Mara Voss**, a driver with a debt. **Rico Delmar** offers her five jobs — a pickup, a stolen coupe, a timed beach run, a police escape, and one big bank job — and a cut big enough to buy her freedom. The crew's boss, **Salvatore Kane**, would rather she failed.

- **On foot**: WASD to move, Shift to run, Space to jump, mouse drag to look, click to shoot.
- **Driving**: walk up to any car and press E to get in; WASD to drive, Space to handbrake, E to get out. Stealing a car raises your wanted level.
- **Wanted**: crimes raise stars (up to 5). Police cars chase, ram and try to bust you. Lose them to cool down — get caught on foot and you are busted.
- **Missions**: follow the yellow marker, watch the objective panel and the minimap. Progress and cash save in your browser.
- **HUD**: wanted stars, cash, health, speed, district name and a live minimap.

## Run it

```
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. Screenshots are staged scenes of the real game (`?shot=1..4`); the playtest script `playtest.mjs` retakes them in headless Chromium.

## Layout

- `game/index.html` — the page, HUD and menus
- `game/src/main.js` — bootstrap, game loop, player, camera, saving
- `game/src/world.js` — the city: roads, buildings, beach, ocean, collisions
- `game/src/vehicles.js` — cars, traffic AI, driving physics
- `game/src/pedestrians.js` — sidewalk crowds
- `game/src/police.js` — wanted level and pursuit
- `game/src/combat.js` — shooting, damage, explosions
- `game/src/missions.js` — the five-job story
- `game/src/hud.js` — HUD and minimap
- `game/src/audio.js` — synthesized WebAudio sound
- `game/src/input.js` — keyboard and mouse
- `game/src/shots.js` — staged screenshot scenes
- `game/src/config.js` — tuning and story content
- `game/src/random.js` — seeded random
- `game/vendor/three.module.min.js` — vendored three.js r160
- `main.ts` — hands the game in (writes `/output/dossier.json`)
