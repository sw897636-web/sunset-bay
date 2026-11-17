// Sunset Bay sound: every effect and the music are synthesized live with
// WebAudio, so the game ships no audio files and makes no network request.
// Audio starts on the first user gesture (browsers require it).
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let musicStep = 0;

  // A lazy Am9-ish sunset progression, one soft pad chord per bar.
  const CHORDS = [
    [110.0, 164.8, 220.0, 261.6],
    [87.3, 130.8, 196.0, 246.9],
    [98.0, 146.8, 220.0, 293.7],
    [82.4, 123.5, 196.0, 246.9],
  ];
  const BAR_SECONDS = 3.2;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine hum: a low sawtooth whose pitch follows the car.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Police siren: two alternating tones, quiet until wanted.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      startMusic();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, filterFreq, when = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  function startMusic() {
    if (musicTimer !== null) return;
    musicTimer = window.setInterval(() => {
      if (muted || !ctx) return;
      const chord = CHORDS[musicStep % CHORDS.length];
      musicStep += 1;
      for (const freq of chord) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        const t0 = ctx.currentTime;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.linearRampToValueAtTime(0.045, t0 + 0.9);
        gain.gain.linearRampToValueAtTime(0.0001, t0 + BAR_SECONDS);
        osc.connect(gain);
        gain.connect(master);
        osc.start(t0);
        osc.stop(t0 + BAR_SECONDS + 0.1);
      }
      // A soft bass root under each bar.
      tone(chord[0] / 2, BAR_SECONDS * 0.9, 'sine', 0.07);
    }, BAR_SECONDS * 1000);
  }

  let sirenPhase = 0;
  return {
    unlock() { ensure(); },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = value ? 0 : 0.5;
    },
    isMuted() { return muted; },
    // Called every frame: speed 0..1 while driving, wanted 0..5.
    update(speed01, wanted) {
      if (!ctx) return;
      if (engineGain) {
        engineGain.gain.value = speed01 > 0.02 ? 0.05 + speed01 * 0.06 : 0;
        engineOsc.frequency.value = 55 + speed01 * 130;
      }
      if (sirenGain) {
        sirenGain.gain.value = wanted > 0 ? 0.028 : 0;
        sirenPhase += 1;
        if (sirenPhase % 30 === 0) {
          sirenOsc.frequency.value = sirenOsc.frequency.value > 700 ? 540 : 880;
        }
      }
    },
    shoot() { noise(0.16, 0.5, 2400); tone(190, 0.12, 'square', 0.22, 0, 60); },
    punch() { noise(0.1, 0.4, 500); tone(120, 0.1, 'sine', 0.3, 0, 55); },
    crash() { noise(0.35, 0.55, 800); },
    pickup() { tone(660, 0.12, 'sine', 0.25); tone(880, 0.18, 'sine', 0.25, 0.1); },
    missionDone() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.28, i * 0.13));
    },
    missionFail() {
      [392, 330, 262].forEach((f, i) => tone(f, 0.4, 'triangle', 0.25, i * 0.16));
    },
    busted() { tone(220, 0.5, 'sawtooth', 0.2, 0, 110); tone(165, 0.7, 'sawtooth', 0.18, 0.35, 82); },
    enterCar() { tone(90, 0.18, 'square', 0.18, 0, 140); noise(0.08, 0.2, 1200); },
    horn() { tone(370, 0.25, 'square', 0.14); tone(466, 0.25, 'square', 0.12); },
  };
}
