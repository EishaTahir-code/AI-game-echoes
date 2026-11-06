// Small math, noise and helper utilities shared by every module.

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const angleDiff = (a, b) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};
export const uid = (() => {
  let n = Date.now() % 100000;
  return () => 'i' + (n++).toString(36);
})();

// Deterministic seeded random (mulberry32) so the world is the same every load.
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Value noise + fbm.
function hash(x, z) {
  let h = x * 374761393 + z * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function noise2(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm(x, z, oct = 4) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += amp * noise2(x * f, z * f); f *= 2.03; amp *= 0.5; }
  return s;
}

// Minimal event bus.
const listeners = {};
export const bus = {
  on(evt, fn) { (listeners[evt] ||= []).push(fn); },
  emit(evt, ...args) { (listeners[evt] || []).forEach((fn) => fn(...args)); },
};

export function fmtTime(t) {
  const hours = Math.floor(t * 24);
  const mins = Math.floor((t * 24 - hours) * 60);
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// Radial glow texture (used for lantern halos, fireflies, loot beams).
const glowCache = {};
export function glowTexture(THREE, color = '#ffd28a') {
  if (glowCache[color]) return glowCache[color];
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, color);
  grd.addColorStop(0.25, color + 'aa');
  grd.addColorStop(1, color + '00');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  glowCache[color] = tex;
  return tex;
}

// Text sprite texture (NPC names, quest markers).
export function textSprite(THREE, text, { color = '#fff6e0', size = 48, font = 'Fraunces', weight = 600, stroke = '#1b2440' } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = `${weight} ${size}px "${font}", Georgia, serif`;
  const w = Math.ceil(g.measureText(text).width) + 24;
  c.width = w; c.height = size + 24;
  g.font = `${weight} ${size}px "${font}", Georgia, serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 8; g.strokeStyle = stroke; g.lineJoin = 'round';
  g.strokeText(text, w / 2, c.height / 2);
  g.fillStyle = color;
  g.fillText(text, w / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true });
  const s = new THREE.Sprite(mat);
  s.scale.set(w / 100, c.height / 100, 1);
  return s;
}
