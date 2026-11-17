// Sunset Bay sound, synthesized live with WebAudio: every effect and the
// music are oscillators and filtered noise, so the game ships no audio
// files and makes no network request. Sound unlocks on the first gesture,
// because browsers insist on it.
export function createSound() {
  let ac = null;
  let bus = null;
  let silent = false;
  let motorOsc = null;
  let motorLevel = null;
  let wailOsc = null;
  let wailLevel = null;
  let padClock = null;
  let bar = 0;
  let wailFlip = 0;

  // A slow dusk progression, one soft pad chord per bar: Dm9, Bb maj7,
  // F maj7, C maj7 — warm, unhurried, a little wistful.
  const PROGRESSION = [
    [146.8, 220.0, 293.7, 349.2],
    [116.5, 174.6, 233.1, 349.2],
    [174.6, 220.0, 261.6, 349.2],
    [130.8, 196.0, 261.6, 329.6],
  ];
  const BAR = 3.6;

  function start() {
    if (ac) {
      if (ac.state === 'suspended') ac.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ac = new AC();
      bus = ac.createGain();
      bus.gain.value = 0.5;
      bus.connect(ac.destination);
      // Motor drone: a low sawtooth whose pitch follows the car.
      motorOsc = ac.createOscillator();
      motorOsc.type = 'sawtooth';
      motorOsc.frequency.value = 48;
      const motorFilter = ac.createBiquadFilter();
      motorFilter.type = 'lowpass';
      motorFilter.frequency.value = 380;
      motorLevel = ac.createGain();
      motorLevel.gain.value = 0;
      motorOsc.connect(motorFilter);
      motorFilter.connect(motorLevel);
      motorLevel.connect(bus);
      motorOsc.start();
      // Cop wail: two alternating tones, silent until there is heat.
      wailOsc = ac.createOscillator();
      wailOsc.type = 'sine';
      wailOsc.frequency.value = 660;
      wailLevel = ac.createGain();
      wailLevel.gain.value = 0;
      wailOsc.connect(wailLevel);
      wailLevel.connect(bus);
      wailOsc.start();
      playPads();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, shape, vol, delay = 0, glide = 0) {
    if (!ac || silent) return;
    const t0 = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = shape;
    osc.frequency.setValueAtTime(freq, t0);
    if (glide > 0) osc.frequency.exponentialRampToValueAtTime(glide, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function hiss(dur, vol, cutoff, delay = 0) {
    if (!ac || silent) return;
    const t0 = ac.currentTime + delay;
    const len = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    src.start(t0);
  }

  function playPads() {
    if (padClock !== null) return;
    padClock = window.setInterval(() => {
      if (silent || !ac) return;
      const chord = PROGRESSION[bar % PROGRESSION.length];
      bar += 1;
      const t0 = ac.currentTime;
      for (const freq of chord) {
        const osc = ac.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const gain = ac.createGain();
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.linearRampToValueAtTime(0.04, t0 + 1.0);
        gain.gain.linearRampToValueAtTime(0.0001, t0 + BAR);
        osc.connect(gain);
        gain.connect(bus);
        osc.start(t0);
        osc.stop(t0 + BAR + 0.1);
      }
      // A low root under each bar, an octave below the chord.
      blip(chord[0] / 2, BAR * 0.9, 'sine', 0.06);
    }, BAR * 1000);
  }

  return {
    unlock() { start(); },
    setMuted(value) {
      silent = value;
      if (bus) bus.gain.value = value ? 0 : 0.5;
    },
    isMuted() { return silent; },
    // Called every frame: speed 0..1 while driving, wanted 0..5.
    update(speed01, wanted) {
      if (!ac) return;
      if (motorLevel) {
        motorLevel.gain.value = speed01 > 0.02 ? 0.05 + speed01 * 0.06 : 0;
        motorOsc.frequency.value = 48 + speed01 * 140;
      }
      if (wailLevel) {
        wailLevel.gain.value = wanted > 0 ? 0.026 : 0;
        wailFlip += 1;
        if (wailFlip % 30 === 0) {
          wailOsc.frequency.value = wailOsc.frequency.value > 640 ? 520 : 830;
        }
      }
    },
    shoot() { hiss(0.16, 0.5, 2400); blip(190, 0.12, 'square', 0.22, 0, 60); },
    punch() { hiss(0.1, 0.4, 500); blip(120, 0.1, 'sine', 0.3, 0, 55); },
    crash() { hiss(0.35, 0.55, 800); },
    pickup() { blip(660, 0.12, 'sine', 0.25); blip(880, 0.18, 'sine', 0.25, 0.1); },
    missionDone() {
      [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.35, 'triangle', 0.28, i * 0.13));
    },
    missionFail() {
      [392, 330, 262].forEach((f, i) => blip(f, 0.4, 'triangle', 0.25, i * 0.16));
    },
    busted() { blip(220, 0.5, 'sawtooth', 0.2, 0, 110); blip(165, 0.7, 'sawtooth', 0.18, 0.35, 82); },
    enterCar() { blip(90, 0.18, 'square', 0.18, 0, 140); hiss(0.08, 0.2, 1200); },
    horn() { blip(370, 0.25, 'square', 0.14); blip(466, 0.25, 'square', 0.12); },
  };
}
