// Sunset Bay: all sound is synthesized with WebAudio — no audio files.
// Engine hum, sirens, gunshots, chimes and a little sunset synth loop.

export class AudioSys {
constructor() {
this.ctx = null;
this.muted = false;
this.master = null;
this.engineOsc = null;
this.engineOsc2 = null;
this.engineGain = null;
this.sirenOsc = null;
this.sirenGain = null;
this.sirenHigh = false;
this.sirenTimer = 0;
this.musicTimer = 0;
this.musicStep = 0;
}
ensure() {
if (this.ctx) {
if (this.ctx.state === 'suspended') this.ctx.resume();
return;
}
const AC = window.AudioContext || window.webkitAudioContext;
if (!AC) return;
this.ctx = new AC();
this.master = this.ctx.createGain();
this.master.gain.value = 0.5;
this.master.connect(this.ctx.destination);
this.engineOsc = this.ctx.createOscillator();
this.engineOsc.type = 'sawtooth';
this.engineOsc.frequency.value = 55;
this.engineOsc2 = this.ctx.createOscillator();
this.engineOsc2.type = 'square';
this.engineOsc2.frequency.value = 82;
this.engineGain = this.ctx.createGain();
this.engineGain.gain.value = 0;
const engineFilter = this.ctx.createBiquadFilter();
engineFilter.type = 'lowpass';
engineFilter.frequency.value = 700;
this.engineOsc.connect(engineFilter);
this.engineOsc2.connect(engineFilter);
engineFilter.connect(this.engineGain);
this.engineGain.connect(this.master);
this.engineOsc.start();
this.engineOsc2.start();
this.sirenOsc = this.ctx.createOscillator();
this.sirenOsc.type = 'square';
this.sirenOsc.frequency.value = 720;
this.sirenGain = this.ctx.createGain();
this.sirenGain.gain.value = 0;
this.sirenOsc.connect(this.sirenGain);
this.sirenGain.connect(this.master);
this.sirenOsc.start();
}
setMuted(m) {
this.muted = m;
if (this.master) this.master.gain.value = m ? 0 : 0.5;
}
setEngine(speedNorm, on) {
if (!this.ctx || !this.engineGain) return;
const target = on ? 0.05 + speedNorm * 0.12 : 0;
this.engineGain.gain.setTargetAtTime(this.muted ? 0 : target, this.ctx.currentTime, 0.1);
this.engineOsc.frequency.setTargetAtTime(55 + speedNorm * 140, this.ctx.currentTime, 0.1);
this.engineOsc2.frequency.setTargetAtTime(82 + speedNorm * 200, this.ctx.currentTime, 0.1);
}
setSiren(on, dt) {
if (!this.ctx || !this.sirenGain) return;
if (!on) {
this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
return;
}
this.sirenTimer += dt;
if (this.sirenTimer > 0.42) {
this.sirenTimer = 0;
this.sirenHigh = !this.sirenHigh;
this.sirenOsc.frequency.setTargetAtTime(this.sirenHigh ? 950 : 700, this.ctx.currentTime, 0.05);
}
this.sirenGain.gain.setTargetAtTime(this.muted ? 0 : 0.035, this.ctx.currentTime, 0.2);
}
blip(freq, dur, type, vol) {
if (!this.ctx || this.muted) return;
const o = this.ctx.createOscillator();
o.type = type || 'sine';
o.frequency.value = freq;
const g = this.ctx.createGain();
g.gain.setValueAtTime(vol || 0.2, this.ctx.currentTime);
g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
o.connect(g);
g.connect(this.master);
o.start();
o.stop(this.ctx.currentTime + dur);
}
shot() {
if (!this.ctx || this.muted) return;
const len = Math.floor(this.ctx.sampleRate * 0.14);
const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
const data = buffer.getChannelData(0);
for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
const src = this.ctx.createBufferSource();
src.buffer = buffer;
const filter = this.ctx.createBiquadFilter();
filter.type = 'lowpass';
filter.frequency.value = 1800;
const g = this.ctx.createGain();
g.gain.value = 0.5;
src.connect(filter);
filter.connect(g);
g.connect(this.master);
src.start();
this.blip(120, 0.1, 'square', 0.25);
}
chime() {
this.blip(880, 0.18, 'sine', 0.25);
setTimeout(() => this.blip(1318, 0.3, 'sine', 0.25), 110);
}
jingle() {
const notes = [523, 659, 784, 1046];
notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.35, 'triangle', 0.28), i * 140));
}
crash() {
if (!this.ctx || this.muted) return;
const len = Math.floor(this.ctx.sampleRate * 0.25);
const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
const data = buffer.getChannelData(0);
for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.8;
const src = this.ctx.createBufferSource();
src.buffer = buffer;
const filter = this.ctx.createBiquadFilter();
filter.type = 'lowpass';
filter.frequency.value = 500;
const g = this.ctx.createGain();
g.gain.value = 0.5;
src.connect(filter);
filter.connect(g);
g.connect(this.master);
src.start();
}
update(dt, game) {
if (!this.ctx) return;
const speedNorm = game.player && game.player.inCar ? Math.abs(game.player.car.speed) / 42 : 0;
this.setEngine(speedNorm, !!(game.player && game.player.inCar));
const policeNear = game.police && game.police.cars.length > 0;
this.setSiren(policeNear, dt);
this.musicTimer += dt;
if (this.musicTimer > 0.42) {
this.musicTimer = 0;
this.musicStep = (this.musicStep + 1) % 16;
const bass = [110, 110, 130.8, 98, 110, 110, 146.8, 130.8];
if (game.state === 'playing' && !this.muted) {
if (this.musicStep % 4 === 0) this.blip(bass[this.musicStep / 4], 0.4, 'triangle', 0.05);
if (this.musicStep === 0 || this.musicStep === 8) this.blip(440, 0.3, 'sine', 0.03);
}
}
}
}
