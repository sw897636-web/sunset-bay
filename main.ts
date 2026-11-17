// Sunset Bay entry program (Node 22, standard library only).
// Hands the game in: copies game/ and screenshots/ from this repository into
// /output and writes /output/dossier.json with the vendored make.fun library.
// Run it outside the grader with MAKEFUN_OUTPUT_DIR standing in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The gate's caps, mirrored from the kit's reference data: more than four
// screenshots, one over 256 KiB, or a game/ over its file and byte caps would
// be refused by the scorer, so refuse them here first.
writeFileSync(
join(outDir, 'dossier.json'),
buildDossier(outDir, {
text_max_bytes: 163840,
screenshots: { max: 4, max_bytes: 262144 },
game_max_files: 993,
game_max_bytes: 50331648,
game_path_max_bytes: 1000,
}),
);
