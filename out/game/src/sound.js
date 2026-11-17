// Sunset Bay sound: fully synthesized WebAudio, no audio files.
// Engine hum, police siren, gunshots, pickups, jingles, crashes.
export class SoundEngine {
constructor() {
this.ctx = null;
this.master = null;
this.muted = false;
this.engineOsc = null;
this.engineGain = null;
this.sirenOsc = null;
this.sirenLfo = null;
this.sirenGain = null;
this.padOsc = null;
this.padGain = null;
}
unlock() {
try {
if (!this.ctx) {
const AC = window.AudioContext || window.webkitAudioContext;
this.ctx = new AC();
this.master = this.ctx.createGain();
this.master.gain.value = 0.5;
this.master.connect(this.ctx.destination);
this.startEngineLoop();
this.startPad();
}
if (this.ctx.state === 'suspended') this.ctx.resume();
} catch (e) { /* audio unavailable */ }
}
startEngineLoop() {
try {
this.engineOsc = this.ctx.createOscillator();
this.engineOsc.type = 'sawtooth';
this.engineOsc.frequency.value = 55;
this.engineGain = this.ctx.createGain();
this.engineGain.gain.value = 0;
const filter = this.ctx.createBiquadFilter();
filter.type = 'lowpass';
filter.frequency.value = 420;
this.engineOsc.connect(filter);
filter.connect(this.engineGain);
this.engineGain.connect(this.master);
this.engineOsc.start();
} catch (e) { /* ignore */ }
}
startPad() {
try {
this.padOsc = this.ctx.createOscillator();
this.padOsc.type = 'triangle';
this.padOsc.frequency.value = 110;
this.padGain = this.ctx.createGain();
this.padGain.gain.value = 0.035;
const detune = this.ctx.createOscillator();
detune.type = 'sine';
detune.frequency.value = 165.4;
const detuneGain = this.ctx.createGain();
detuneGain.gain.value = 0.02;
this.padOsc.connect(this.padGain);
detune.connect(detuneGain);
detuneGain.connect(this.master);
this.padGain.connect(this.master);
this.padOsc.start();
detune.start();
} catch (e) { /* ignore */ }
}
setEngine(speed01, driving) {
if (!this.ctx || !this.engineOsc) return;
try {
this.engineOsc.frequency.value = 52 + speed01 * 130;
this.engineGain.gain.value = driving ? 0.045 + speed01 * 0.05 : 0.012;
} catch (e) { /* ignore */ }
}
setSiren(on) {
if (!this.ctx) return;
try {
if (on && !this.sirenOsc) {
this.sirenOsc = this.ctx.createOscillator();
this.sirenOsc.type = 'square';
this.sirenOsc.frequency.value = 820;
this.sirenLfo = this.ctx.createOscillator();
this.sirenLfo.type = 'square';
this.sirenLfo.frequency.value = 1.6;
const lfoGain = this.ctx.createGain();
lfoGain.gain.value = 180;
this.sirenLfo.connect(lfoGain);
lfoGain.connect(this.sirenOsc.frequency);
this.sirenGain = this.ctx.createGain();
this.sirenGain.gain.value = 0.028;
this.sirenOsc.connect(this.sirenGain);
this.sirenGain.connect(this.master);
this.sirenOsc.start();
this.sirenLfo.start();
} else if (!on && this.sirenOsc) {
this.sirenOsc.stop();
this.sirenLfo.stop();
this.sirenOsc = null;
this.sirenLfo = null;
}
} catch (e) { /* ignore */ }
}
blip(freq) {
if (!this.ctx) return;
try {
const o = this.ctx.createOscillator();
o.type = 'sine';
o.frequency.value = freq || 880;
const g = this.ctx.createGain();
g.gain.setValueAtTime(0.16, this.ctx.currentTime);
g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);
o.connect(g);
g.connect(this.master);
o.start();
o.stop(this.ctx.currentTime + 0.2);
} catch (e) { /* ignore */ }
}
shot() {
if (!this.ctx) return;
try {
const dur = 0.16;
const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
const data = buf.getChannelData(0);
for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
const src = this.ctx.createBufferSource();
src.buffer = buf;
const filter = this.ctx.createBiquadFilter();
filter.type = 'lowpass';
filter.frequency.value = 1800;
const g = this.ctx.createGain();
g.gain.value = 0.5;
src.connect(filter);
filter.connect(g);
g.connect(this.master);
src.start();
} catch (e) { /* ignore */ }
}
crash() {
if (!this.ctx) return;
try {
const dur = 0.3;
const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
const data = buf.getChannelData(0);
for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) * 0.8;
const src = this.ctx.createBufferSource();
src.buffer = buf;
const filter = this.ctx.createBiquadFilter();
filter.type = 'lowpass';
filter.frequency.value = 420;
const g = this.ctx.createGain();
g.gain.value = 0.5;
src.connect(filter);
filter.connect(g);
g.connect(this.master);
src.start();
} catch (e) { /* ignore */ }
}
jingle() {
if (!this.ctx) return;
try {
const notes = [523, 659, 784, 1046];
notes.forEach((f, i) => {
const o = this.ctx.createOscillator();
o.type = 'sine';
o.frequency.value = f;
const g = this.ctx.createGain();
const t = this.ctx.currentTime + i * 0.11;
g.gain.setValueAtTime(0.0001, t);
g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
o.connect(g);
g.connect(this.master);
o.start(t);
o.stop(t + 0.45);
});
} catch (e) { /* ignore */ }
}
setMuted(m) {
this.muted = m;
if (this.master) this.master.gain.value = m ? 0 : 0.5;
}
}
