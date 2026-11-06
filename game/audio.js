// Generated music and sound effects with the Web Audio API (no audio files).
import { G } from './state.js';

let ctx = null, master = null, musicBus = null, sfxBus = null, combatGain = null;
let nextNoteTime = 0, step = 0, mood = 'dusk', combat = 0, songUntil = 0;

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
// gentle progressions; night leans minor
const PROG = {
  day: [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 66]],
  night: [[57, 60, 64, 67], [53, 57, 60, 65], [50, 53, 57, 60], [52, 55, 59, 62]],
};
const SCALE = [69, 71, 72, 74, 76, 79, 81, 83, 84, 86];

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.connect(master);
  combatGain = ctx.createGain(); combatGain.gain.value = 0; combatGain.connect(musicBus);
  // soft reverb from a generated impulse
  const conv = ctx.createConvolver();
  const len = ctx.sampleRate * 2.4, imp = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = imp.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
  conv.buffer = imp;
  const wet = ctx.createGain(); wet.gain.value = 0.35;
  musicBus.connect(conv); conv.connect(wet); wet.connect(master);
  applyVolume();
  nextNoteTime = ctx.currentTime + 0.1;
}

export function applyVolume() {
  if (!master) return;
  master.gain.value = G.settings.volume;
  musicBus.gain.value = G.settings.music * 0.55;
  sfxBus.gain.value = 0.9;
}

function tone(freq, t, dur, { type = 'sine', vol = 0.1, attack = 0.02, out = musicBus, filter = 0, detune = 0 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq; o.detune.value = detune;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o;
  if (filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; o.connect(f); node = f; }
  node.connect(g); g.connect(out);
  o.start(t); o.stop(t + dur + 0.05);
}

function noise(t, dur, { vol = 0.2, freq = 1200, q = 1, type = 'bandpass', out = sfxBus } = {}) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(out);
  src.start(t);
}

export function setMood(m) { mood = m; }
export function setCombat(c) { combat = c; }
export function playSong() { songUntil = ctx ? ctx.currentTime + 40 : 0; }

// Called every frame: schedules music slightly ahead of time.
export function updateAudio() {
  if (!ctx || ctx.state !== 'running') return;
  combatGain.gain.setTargetAtTime(combat ? 0.9 : 0, ctx.currentTime, 0.8);
  const bpm = combat ? 112 : 76;
  const beat = 60 / bpm / 2; // eighth notes
  while (nextNoteTime < ctx.currentTime + 0.25) {
    const t = nextNoteTime;
    const prog = PROG[mood === 'night' ? 'night' : 'day'];
    const bar = Math.floor(step / 16) % prog.length;
    const chord = prog[bar];
    const inBar = step % 16;
    if (inBar === 0) {
      // pad chord
      chord.forEach((n, i) => tone(midi(n), t, beat * 16, { type: 'triangle', vol: 0.035, attack: 1.2, filter: 1400, detune: i * 3 }));
      tone(midi(chord[0] - 12), t, beat * 16, { type: 'sine', vol: 0.06, attack: 0.8 });
    }
    const songMode = ctx.currentTime < songUntil;
    // plucked melody, sparse and wandering
    if ((inBar % 2 === 0 && Math.random() < (songMode ? 0.85 : 0.38)) || (songMode && Math.random() < 0.3)) {
      const pool = SCALE.filter((n) => chord.some((c) => (n - c) % 12 === 0) || Math.random() < 0.3);
      const n = pool[Math.floor(Math.random() * pool.length)] - (mood === 'night' ? 12 : 0);
      tone(midi(n), t, beat * 5, { type: 'sine', vol: songMode ? 0.08 : 0.05, attack: 0.005 });
      tone(midi(n + 12), t, beat * 2, { type: 'triangle', vol: 0.012, attack: 0.005 });
    }
    // combat percussion layer
    if (combat) {
      if (inBar % 4 === 0) kick(t);
      if (inBar % 8 === 4) noise(t, 0.12, { vol: 0.12, freq: 1800, out: combatGain });
      if (inBar % 2 === 1) noise(t, 0.04, { vol: 0.04, freq: 6000, type: 'highpass', out: combatGain });
      if (inBar % 4 === 2) tone(midi(chord[0] - 24), t, beat * 1.5, { type: 'sawtooth', vol: 0.05, filter: 300, out: combatGain });
    }
    nextNoteTime += beat;
    step++;
  }
}

function kick(t) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
  g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  o.connect(g); g.connect(combatGain); o.start(t); o.stop(t + 0.25);
}

export function sfx(name) {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const o = { out: sfxBus };
  switch (name) {
    case 'swing': noise(t, 0.16, { vol: 0.25, freq: 900, q: 0.8 }); break;
    case 'hit': noise(t, 0.08, { vol: 0.4, freq: 400, q: 1 }); tone(140, t, 0.12, { ...o, type: 'square', vol: 0.06 }); break;
    case 'crit': noise(t, 0.1, { vol: 0.5, freq: 600 }); tone(880, t, 0.25, { ...o, type: 'triangle', vol: 0.08 }); break;
    case 'hurt': tone(220, t, 0.25, { ...o, type: 'sawtooth', vol: 0.08, filter: 800 }); noise(t, 0.1, { vol: 0.3, freq: 300 }); break;
    case 'dodge': noise(t, 0.2, { vol: 0.15, freq: 2400, q: 0.5 }); break;
    case 'skill': [523, 659, 784].forEach((f, i) => tone(f, t + i * 0.04, 0.4, { ...o, type: 'triangle', vol: 0.08 })); noise(t, 0.35, { vol: 0.2, freq: 1600, q: 0.6 }); break;
    case 'boom': noise(t, 0.5, { vol: 0.5, freq: 200, q: 0.7, type: 'lowpass' }); tone(70, t, 0.5, { ...o, vol: 0.2 }); break;
    case 'coin': tone(1318, t, 0.12, { ...o, type: 'square', vol: 0.04 }); tone(1760, t + 0.06, 0.18, { ...o, type: 'square', vol: 0.04 }); break;
    case 'pickup': tone(880, t, 0.15, { ...o, vol: 0.08 }); tone(1320, t + 0.07, 0.2, { ...o, vol: 0.08 }); break;
    case 'legendary': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.09, 0.8, { ...o, type: 'triangle', vol: 0.09 })); break;
    case 'levelup': [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.08, 0.9, { ...o, type: 'triangle', vol: 0.1 })); break;
    case 'quest': [587, 784, 988].forEach((f, i) => tone(f, t + i * 0.12, 0.7, { ...o, type: 'sine', vol: 0.1 })); break;
    case 'complete': [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.1, 1.0, { ...o, type: 'triangle', vol: 0.1 })); break;
    case 'tick': tone(1046, t, 0.15, { ...o, vol: 0.07 }); break;
    case 'deed': [784, 988, 1175].forEach((f, i) => tone(f, t + i * 0.07, 0.6, { ...o, type: 'sine', vol: 0.08 })); break;
    case 'bond': [659, 880, 1109, 1319].forEach((f, i) => tone(f, t + i * 0.1, 1.1, { ...o, type: 'sine', vol: 0.09 })); break;
    case 'chest': noise(t, 0.3, { vol: 0.2, freq: 500 }); [523, 784, 1047].forEach((f, i) => tone(f, t + 0.15 + i * 0.07, 0.6, { ...o, type: 'triangle', vol: 0.08 })); break;
    case 'shrine': [392, 587, 784, 1175].forEach((f, i) => tone(f, t + i * 0.15, 1.6, { ...o, type: 'sine', vol: 0.1 })); break;
    case 'ui': tone(660, t, 0.06, { ...o, type: 'triangle', vol: 0.05 }); break;
    case 'yip': tone(900, t, 0.08, { ...o, type: 'triangle', vol: 0.06 }); tone(1200, t + 0.05, 0.1, { ...o, type: 'triangle', vol: 0.05 }); break;
    case 'shoot': tone(300, t, 0.3, { ...o, type: 'sawtooth', vol: 0.04, filter: 900 }); break;
    case 'die': tone(330, t, 0.6, { ...o, type: 'sine', vol: 0.1 }); tone(247, t + 0.2, 0.8, { ...o, type: 'sine', vol: 0.1 }); break;
    case 'roar': noise(t, 1.0, { vol: 0.4, freq: 150, q: 0.5, type: 'lowpass' }); tone(55, t, 1.0, { ...o, type: 'sawtooth', vol: 0.12, filter: 200 }); break;
    case 'discover': [440, 554, 659, 880].forEach((f, i) => tone(f, t + i * 0.18, 1.6, { ...o, type: 'sine', vol: 0.08 })); break;
    default: break;
  }
}
