// Sound effects via Web Audio API — no audio files needed

let _ctx = null;

function ctx() {
  if (!_ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (C) _ctx = new C();
  }
  return _ctx;
}

function boot() {
  const c = ctx();
  if (!c) return null;
  if (c.state === "suspended") c.resume();
  return c;
}

// ── PRIMITIVES ────────────────────────────────────────────────────────────────

function noiseBurst(c, freq, q, durationSec, volume, startTime = 0) {
  const len = Math.floor(c.sampleRate * durationSec);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    // exponential decay envelope
    d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.35));
  }
  const src = c.createBufferSource();
  src.buffer = buf;

  const filt = c.createBiquadFilter();
  filt.type = "bandpass";
  filt.frequency.value = freq;
  filt.Q.value = q;

  const gain = c.createGain();
  gain.gain.value = volume;

  src.connect(filt);
  filt.connect(gain);
  gain.connect(c.destination);
  src.start(c.currentTime + startTime);
  return src;
}

function tone(c, freq, type, durationSec, volume, startTime = 0) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, c.currentTime + startTime);
  gain.gain.linearRampToValueAtTime(volume, c.currentTime + startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + startTime + durationSec);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(c.currentTime + startTime);
  osc.stop(c.currentTime + startTime + durationSec + 0.01);
}

// ── SLOT MACHINE SPIN ─────────────────────────────────────────────────────────

/**
 * Starts the slot reel spinning sound (rapid mechanical clicks).
 * Returns a stop() function — call it when the last reel stops.
 */
export function startSlotSpin() {
  const c = boot();
  if (!c) return () => {};

  let active = true;
  let intervalMs = 55; // ms between ticks — fast to simulate reel spinning

  function tick() {
    if (!active) return;
    noiseBurst(c, 280 + Math.random() * 120, 2, 0.025, 0.12);
    setTimeout(tick, intervalMs);
  }

  tick();

  return () => {
    active = false;
  };
}

/**
 * Heavy clunk sound when a single reel stops.
 */
export function playReelStop() {
  const c = boot();
  if (!c) return;
  noiseBurst(c, 120, 1.5, 0.09, 0.45);
  tone(c, 80, "sine", 0.12, 0.25);
}

// ── DICE ROLL ─────────────────────────────────────────────────────────────────

/**
 * Starts the dice rattling sound.
 * Returns a stop() function — call it when the roll animation ends.
 */
export function startDiceRoll() {
  const c = boot();
  if (!c) return () => {};

  let active = true;
  let delayMs = 65;

  function rattle() {
    if (!active) return;
    const freq = 700 + Math.random() * 600;
    noiseBurst(c, freq, 2.5, 0.028, 0.2);
    // very slight speedup over time — feels natural
    delayMs = Math.max(45, delayMs * 0.985);
    setTimeout(rattle, delayMs);
  }

  rattle();

  return () => {
    active = false;
  };
}

/**
 * Short thud when dice land.
 */
export function playDiceLand() {
  const c = boot();
  if (!c) return;
  noiseBurst(c, 180, 1, 0.07, 0.5);
  tone(c, 100, "sine", 0.1, 0.2);
}

// ── WIN / LOSE ────────────────────────────────────────────────────────────────

/**
 * Ascending chime for wins.
 * @param {boolean} big - true for jackpot fanfare
 */
export function playWin(big = false) {
  const c = boot();
  if (!c) return;

  const notes = big
    ? [523, 659, 784, 1047, 1319, 1568]
    : [523, 659, 784, 1047];

  notes.forEach((freq, i) => {
    tone(c, freq, "sine", 0.28, 0.18, i * 0.1);
  });
}

export function playLose() {
  const c = boot();
  if (!c) return;
  tone(c, 220, "sawtooth", 0.18, 0.1);
  tone(c, 180, "sawtooth", 0.22, 0.08, 0.1);
}
