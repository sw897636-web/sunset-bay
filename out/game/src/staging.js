// Sunset Bay screenshot staging: deterministic scene setups driven by ?shot=.
// Each setup places the player, traffic and police so the shot shows a system
// of the game at its best. The game itself renders everything.
export function applyShot(game, name) {
game.state = 'playing';
game.hud.show('none');
game.sound.setMuted(true);
if (name === 'cover') {
game.setCameraMode('follow');
game.teleport(240, 0, -Math.PI / 2, true, 'sport');
game.playerCar.speed = 12;
game.camPitch = 0.22;
if (game.traffic.length > 1) {
const west = game.traffic[0];
west.axis = 'x'; west.road = 0; west.lane = 4.5; west.coord = 195; west.dir = -1; west.speed = 13;
const east = game.traffic[1];
east.axis = 'x'; east.road = 0; east.lane = -4.5; east.coord = 285; east.dir = 1; east.speed = 14;
}
game.cash = 1250;
game.hud.setCash(1250);
game.startMission(1, { skipIntro: true });
game.hud.banner('SUNSET BAY', 'A city of sun, sin and second chances.');
} else if (name === 'street') {
game.setCameraMode('follow');
game.teleport(8, 8, Math.PI * 0.75, false);
game.cash = 310;
game.hud.setCash(310);
game.startMission(0, { skipIntro: true });
} else if (name === 'chase') {
game.setCameraMode('follow');
game.teleport(0, -220, 0, true, 'sport');
game.playerCar.speed = 30;
game.setWanted(3);
game.spawnPolice(2);
if (game.police.length > 0) {
const lead = game.police[0];
lead.mesh.position.set(18, 0, -182);
lead.heading = Math.PI;
lead.speed = 26;
}
game.cash = 890;
game.hud.setCash(890);
game.startMission(2, { skipIntro: true });
} else if (name === 'mission') {
game.setCameraMode('follow');
game.teleport(468, -348, Math.PI * 0.9, false);
game.cash = 640;
game.hud.setCash(640);
game.startMission(1, { skipIntro: true });
}
game.hud.setStars(game.stars);
}
