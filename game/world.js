// The world: terrain, lake, sky, town, forest, landmarks and the day/night cycle.
import * as THREE from 'three';
import { G } from './state.js';
import { clamp, lerp, smoothstep, fbm, noise2, seeded, glowTexture } from './util.js';

// ---------------------------------------------------------------- layout
export const LAKE = { x: 95, z: 0, rx: 58, rz: 64 };
export const MARSH = { x: 70, z: 100, r: 42 };
export const HILL = { x: -90, z: 80, r: 24, h: 15 };

export const PLACES = {
  start: { x: -2, z: 8, name: 'Festival Square' },
  inn: { x: -16, z: -15 }, stage: { x: 12, z: -17 }, smithy: { x: -24, z: 14 },
  board: { x: 7, z: 5 }, greatLantern: { x: 0, z: -3 }, gate: { x: 0, z: -40 },
  docks: { x: 34, z: 8 }, boathouse: { x: 28, z: 34 },
  manor: { x: -108, z: -104 }, journal: { x: -113, z: -107 },
  watchtower: { x: -94, z: 76 }, bossArena: { x: 86, z: 116 },
  charm: { x: -84, z: -18 },
  lanternPieces: [{ x: 36, z: -28 }, { x: 31, z: 44 }, { x: 58, z: 60 }],
};

export const SHRINES = [
  { id: 'old', x: -48, z: 4, name: 'Old Lantern Shrine' },
  { id: 'pines', x: -72, z: -52, name: 'Pinewood Shrine' },
  { id: 'manor', x: -92, z: -84, name: 'Manor Gate Shrine' },
  { id: 'tower', x: -84, z: 88, name: 'Watchtower Shrine' },
  { id: 'shore', x: 96, z: -80, name: 'Moonlit Shore Shrine' },
  { id: 'marsh', x: 52, z: 88, name: 'Mirefen Shrine' },
];

export const ZONES = [
  { id: 'square', name: 'Festival Square', x: 0, z: 0, r: 40, lvl: [1, 2] },
  { id: 'docks', name: 'Lantern Lake Docks', x: 36, z: 12, r: 26, lvl: [2, 4] },
  { id: 'meadow', name: 'Old Shrine Meadow', x: -52, z: 10, r: 30, lvl: [1, 3] },
  { id: 'manor', name: 'Aurel Manor Ruins', x: -108, z: -104, r: 26, lvl: [5, 7] },
  { id: 'pines', name: 'Whispering Pines', x: -85, z: -60, r: 60, lvl: [3, 6] },
  { id: 'tower', name: 'Watchtower Hill', x: -90, z: 80, r: 40, lvl: [6, 8] },
  { id: 'shore', name: 'Moonlit Shore', x: 70, z: -90, r: 50, lvl: [7, 9] },
  { id: 'marsh', name: 'Mirefen Marsh', x: 72, z: 102, r: 48, lvl: [9, 12] },
  { id: 'fields', name: 'Southern Fields', x: 0, z: 85, r: 60, lvl: [2, 5] },
  { id: 'north', name: 'North Meadow', x: 10, z: -85, r: 50, lvl: [4, 6] },
  { id: 'wilds', name: 'The Wilds', x: 0, z: 0, r: 999, lvl: [4, 8] },
];

const PATHS = [
  [[0, 0], [0, -40], [8, -80], [50, -100], [96, -80]],
  [[0, 6], [34, 8]],
  [[0, 4], [-48, 4]],
  [[-48, 4], [-68, 40], [-84, 88]],
  [[-6, -6], [-34, -26], [-72, -52], [-94, -86], [-108, -104]],
  [[4, 10], [8, 50], [36, 80], [52, 88], [86, 116]],
  [[20, 30], [28, 34]],
];

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
export function pathDist(x, z) {
  let d = 1e9;
  for (const p of PATHS) for (let i = 0; i < p.length - 1; i++) d = Math.min(d, segDist(x, z, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]));
  return d;
}
export const lakeE = (x, z) => ((x - LAKE.x) / LAKE.rx) ** 2 + ((z - LAKE.z) / LAKE.rz) ** 2;

// ---------------------------------------------------------------- height
export function heightAt(x, z) {
  const r = Math.hypot(x, z);
  let h = 1.5 + fbm(x * 0.011 + 10, z * 0.011 - 4) * 12 - 3;
  // forest is bumpier
  const fw = smoothstep(70, 30, Math.hypot(x + 90, z + 70));
  h += fw * (fbm(x * 0.04, z * 0.04) * 4 - 1.5);
  // paths soften
  const pd = pathDist(x, z);
  const pw = smoothstep(6, 1.5, pd);
  h = lerp(h, 1.5 + fbm(x * 0.006, z * 0.006) * 6, pw * 0.5);
  // town plateau
  const tw = smoothstep(48, 32, r);
  h = lerp(h, 3, tw);
  // watchtower hill
  const dh = Math.hypot(x - HILL.x, z - HILL.z);
  h += HILL.h * Math.exp(-(dh * dh) / (2 * HILL.r * HILL.r));
  // lake bowl
  const e = lakeE(x, z);
  h = lerp(h, -5 - (1 - Math.min(e, 1)) * 2, smoothstep(1.32, 0.86, e));
  // marsh: low and lumpy, pools below 0
  const dm = Math.hypot(x - MARSH.x, z - MARSH.z);
  const mw = smoothstep(MARSH.r + 10, MARSH.r - 12, dm);
  h = lerp(h, 0.35 + (noise2(x * 0.09, z * 0.09) - 0.5) * 2.2, mw);
  // boss arena flattened
  const da = Math.hypot(x - PLACES.bossArena.x, z - PLACES.bossArena.z);
  h = lerp(h, 0.6, smoothstep(16, 10, da));
  // mountains ring
  if (r > 150) h += Math.pow(r - 150, 1.45) * 0.55 + fbm(x * 0.03, z * 0.03) * (r - 150) * 0.35;
  return h;
}
export const groundY = (x, z) => Math.max(heightAt(x, z), -0.35);
export const isDeepWater = (x, z) => heightAt(x, z) < -0.9;
export const MAP_R = 168;

export function zoneAt(x, z) {
  for (const zn of ZONES) if (Math.hypot(x - zn.x, z - zn.z) < zn.r) return zn;
  return ZONES[ZONES.length - 1];
}

// ---------------------------------------------------------------- colliders
class Colliders {
  constructor(cell = 8) { this.cell = cell; this.map = new Map(); }
  _cells(x, z, ext, fn) {
    const c = this.cell;
    for (let i = Math.floor((x - ext) / c); i <= Math.floor((x + ext) / c); i++)
      for (let j = Math.floor((z - ext) / c); j <= Math.floor((z + ext) / c); j++) fn(i * 100003 + j);
  }
  addCircle(x, z, r) { const o = { t: 'c', x, z, r }; this._cells(x, z, r, (k) => { if (!this.map.has(k)) this.map.set(k, []); this.map.get(k).push(o); }); return o; }
  addBox(x, z, hw, hd) { const o = { t: 'b', x, z, hw, hd }; this._cells(x, z, Math.max(hw, hd), (k) => { if (!this.map.has(k)) this.map.set(k, []); this.map.get(k).push(o); }); return o; }
  // true when a point is inside a building footprint (used by the camera)
  insideBox(x, z, pad = 0.4) {
    const list = this.map.get(Math.floor(x / this.cell) * 100003 + Math.floor(z / this.cell));
    if (!list) return false;
    for (const o of list) if (o.t === 'b' && Math.abs(x - o.x) < o.hw + pad && Math.abs(z - o.z) < o.hd + pad) return true;
    return false;
  }
  resolve(p, r) {
    const seen = new Set();
    this._cells(p.x, p.z, r + 1, (k) => {
      const list = this.map.get(k);
      if (!list) return;
      for (const o of list) {
        if (seen.has(o)) continue; seen.add(o);
        if (o.t === 'c') {
          const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), m = o.r + r;
          if (d < m && d > 1e-5) { p.x = o.x + (dx / d) * m; p.z = o.z + (dz / d) * m; }
        } else {
          const cx = clamp(p.x, o.x - o.hw, o.x + o.hw), cz = clamp(p.z, o.z - o.hd, o.z + o.hd);
          const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
          if (d < r) {
            if (d > 1e-5) { p.x = cx + (dx / d) * r; p.z = cz + (dz / d) * r; }
            else { // inside box: push out the nearest side
              const ox = o.hw - Math.abs(p.x - o.x), oz = o.hd - Math.abs(p.z - o.z);
              if (ox < oz) p.x = o.x + Math.sign(p.x - o.x || 1) * (o.hw + r);
              else p.z = o.z + Math.sign(p.z - o.z || 1) * (o.hd + r);
            }
          }
        }
      }
    });
  }
}

// ---------------------------------------------------------------- materials
const matCache = {};
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache[key]) matCache[key] = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...opts });
  return matCache[key];
}

const W = {}; // world-internal refs
export const worldRefs = W;

// ---------------------------------------------------------------- build
export function buildWorld() {
  const scene = G.scene;
  G.colliders = new Colliders();
  W.glows = []; // {mesh, base} sprites that brighten at night
  W.windows = [];
  W.animated = [];

  buildLights(scene);
  buildSky(scene);
  buildTerrain(scene);
  buildWater(scene);
  buildTown(scene);
  buildVegetation(scene);
  buildLandmarks(scene);
  buildSkyLanterns(scene);
  buildFireflies(scene);
}

function buildLights(scene) {
  W.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a4a2a, 0.8);
  scene.add(W.hemi);
  W.sun = new THREE.DirectionalLight(0xffffff, 1.6);
  W.sun.castShadow = G.settings.quality !== 'low';
  W.sun.shadow.mapSize.set(2048, 2048);
  const s = 45;
  Object.assign(W.sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 200 });
  W.sun.shadow.bias = -0.0006;
  W.sun.shadow.normalBias = 0.6;
  scene.add(W.sun, W.sun.target);
  // the town's warm heart
  W.townLight = new THREE.PointLight(0xffb45a, 0, 60, 1.6);
  W.townLight.position.set(0, 9, -3);
  scene.add(W.townLight);
  // lantern the player carries at night
  W.playerLight = new THREE.PointLight(0xffc27a, 0, 22, 1.8);
  scene.add(W.playerLight);
}

function buildSky(scene) {
  const geo = new THREE.SphereGeometry(450, 24, 16);
  W.skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vP;
      void main(){ float h = clamp(vP.y*1.6+0.1,0.0,1.0); vec3 c = mix(horizon, top, pow(h,0.7));
      float s = max(dot(vP, normalize(sunDir)),0.0); c += sunCol * (pow(s,64.0)*1.2 + pow(s,6.0)*0.25);
      gl_FragColor = vec4(c,1.0); }`,
  });
  W.sky = new THREE.Mesh(geo, W.skyMat);
  W.sky.renderOrder = -10;
  scene.add(W.sky);
  // stars
  const rnd = seeded(7);
  const pos = [];
  for (let i = 0; i < 900; i++) {
    const th = rnd() * Math.PI * 2, ph = Math.acos(rnd() * 0.9 + 0.1);
    pos.push(Math.sin(ph) * Math.cos(th) * 420, Math.cos(ph) * 420, Math.sin(ph) * Math.sin(th) * 420);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  W.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  W.stars = new THREE.Points(sg, W.starMat);
  scene.add(W.stars);
  // moon
  W.moon = new THREE.Mesh(new THREE.IcosahedronGeometry(9, 1), new THREE.MeshBasicMaterial({ color: 0xf3f0e0, fog: false, transparent: true }));
  scene.add(W.moon);
  scene.fog = new THREE.Fog(0x9a6a70, 60, 260);
}

function terrainColor(x, z, h, slope, rnd) {
  const c = new THREE.Color();
  const n = noise2(x * 0.08, z * 0.08);
  const forest = smoothstep(70, 35, Math.hypot(x + 90, z + 70));
  const marsh = smoothstep(MARSH.r + 6, MARSH.r - 10, Math.hypot(x - MARSH.x, z - MARSH.z));
  c.setHSL(0.25 + n * 0.04 - forest * 0.03, 0.42 - forest * 0.08, 0.38 + n * 0.08 - forest * 0.1);
  if (marsh > 0) c.lerp(new THREE.Color(n > 0.5 ? 0x5a6638 : 0x4c4a32), marsh * 0.85);
  if (h < 1.1 && marsh < 0.5) c.lerp(new THREE.Color(0xd8c690), smoothstep(1.1, 0.2, h));
  if (h < -0.3) c.lerp(new THREE.Color(0x6b6a4e), 0.6);
  const pd = pathDist(x, z);
  if (pd < 3.2) c.lerp(new THREE.Color(0xb39462), smoothstep(3.2, 1.2, pd) * 0.9);
  const r = Math.hypot(x, z);
  if (r < 34) c.lerp(new THREE.Color(n > 0.5 ? 0xa89878 : 0x9c8e70), smoothstep(34, 26, r) * 0.55);
  if (slope > 0.55 || h > 22) c.lerp(new THREE.Color(0x868a8c), clamp((slope - 0.5) * 2 + (h - 22) * 0.05, 0, 1));
  if (h > 46) c.lerp(new THREE.Color(0xeef3f6), smoothstep(46, 54, h));
  c.offsetHSL(0, 0, (rnd() - 0.5) * 0.03);
  return c;
}

function buildTerrain(scene) {
  const SIZE = 360, SEG = 150;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
  const g2 = geo.toNonIndexed();
  g2.computeVertexNormals();
  const pos = g2.attributes.position, nrm = g2.attributes.normal;
  const cols = new Float32Array(pos.count * 3);
  const rnd = seeded(3);
  for (let i = 0; i < pos.count; i += 3) {
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const ch = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const slope = 1 - nrm.getY(i);
    const c = terrainColor(cx, cz, ch, slope, rnd);
    for (let k = 0; k < 3; k++) { cols[(i + k) * 3] = c.r; cols[(i + k) * 3 + 1] = c.g; cols[(i + k) * 3 + 2] = c.b; }
  }
  g2.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const m = new THREE.Mesh(g2, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
  m.receiveShadow = true;
  scene.add(m);
  W.terrain = m;
}

function buildWater(scene) {
  const mk = (w, d, sx, sz, x, z, y, color) => {
    const g = new THREE.PlaneGeometry(w, d, sx, sz);
    g.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, flatShading: true, transparent: true, opacity: 0.82, roughness: 0.18, metalness: 0.15 }));
    mesh.position.set(x, y, z);
    mesh.userData.base = Float32Array.from(g.attributes.position.array);
    scene.add(mesh);
    return mesh;
  };
  W.lake = mk(150, 160, 50, 54, LAKE.x, LAKE.z, 0, 0x2f6f8f);
  W.marshWater = mk(110, 100, 34, 30, MARSH.x + 6, MARSH.z + 6, 0.02, 0x3d5a46);
}

export function updateWater(t) {
  for (const w of [W.lake, W.marshWater]) {
    const p = w.geometry.attributes.position, b = w.userData.base;
    const amp = w === W.lake ? 0.22 : 0.06;
    for (let i = 0; i < p.count; i++) {
      const x = b[i * 3], z = b[i * 3 + 2];
      p.array[i * 3 + 1] = Math.sin(x * 0.35 + t * 1.3) * amp + Math.cos(z * 0.42 + t * 1.1) * amp * 0.8;
    }
    p.needsUpdate = true;
    w.geometry.computeVertexNormals();
  }
}

// ---------------------------------------------------------------- town
function addGlow(scene, x, y, z, size = 3, color = '#ffc070', base = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(THREE, color), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  s.position.set(x, y, z);
  s.scale.set(size, size, 1);
  scene.add(s);
  W.glows.push({ s, base });
  return s;
}

function house(scene, x, z, w, d, h, rotY, wall, roof, opts = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(wall));
  body.position.y = h / 2;
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  // timber trim
  const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.35, d + 0.2), mat(0x5a3d28));
  trim.position.y = h * 0.55; g.add(trim);
  const roofH = opts.roofH || Math.max(w, d) * 0.45;
  const rg = new THREE.ConeGeometry(Math.max(w, d) * 0.78, roofH, 4, 1);
  rg.rotateY(Math.PI / 4);
  const r = new THREE.Mesh(rg, mat(roof));
  r.scale.set(w / Math.max(w, d) * 1.05, 1, d / Math.max(w, d) * 1.05);
  r.position.y = h + roofH / 2;
  r.castShadow = true;
  g.add(r);
  // door + windows (windows glow at night)
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2, 0.2), mat(0x4a2f1c));
  door.position.set(0, 1, d / 2 + 0.05); g.add(door);
  const winMat = new THREE.MeshStandardMaterial({ color: 0x3a3020, emissive: 0xffb050, emissiveIntensity: 0, flatShading: true });
  W.windows.push(winMat);
  for (const sx of [-w * 0.3, w * 0.3]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.15), winMat);
    win.position.set(sx, h * 0.6 + 0.4, d / 2 + 0.06); g.add(win);
  }
  if (opts.chimney) {
    const ch = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2, 0.8), mat(0x7a6a60));
    ch.position.set(w * 0.25, h + roofH * 0.6, -d * 0.2); g.add(ch);
  }
  g.position.set(x, heightAt(x, z) - 0.1, z);
  g.rotation.y = rotY;
  scene.add(g);
  const rot = Math.abs(Math.sin(rotY)) > 0.5;
  G.colliders.addBox(x, z, (rot ? d : w) / 2 + 0.1, (rot ? w : d) / 2 + 0.1);
  // a lantern by the door
  const lx = x + Math.sin(rotY) * (d / 2 + 0.6) + Math.cos(rotY) * (w * 0.5 - 0.6);
  const lz = z + Math.cos(rotY) * (d / 2 + 0.6) - Math.sin(rotY) * (w * 0.5 - 0.6);
  addGlow(scene, lx, heightAt(lx, lz) + 2.6, lz, 2.6, '#ffb860', 0.9);
  return g;
}

function lanternMesh(color = 0xff9a3c) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.55, 6), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4, flatShading: true }));
  W.windows.push(m.material);
  return m;
}

function buildTown(scene) {
  const roofs = [0x8a3b3b, 0x3f5d7a, 0x5b6e3a, 0x7a4f2a, 0x6a4a6e];
  const walls = [0xe8dcc4, 0xd9c7a8, 0xcfd6d2, 0xe2cfb5];
  // Driftwood Inn (Mira) - big
  house(scene, PLACES.inn.x, PLACES.inn.z, 10, 7, 5, 0, 0xd9c7a8, 0x8a3b3b, { chimney: true });
  // smithy (open front) + anvil
  house(scene, PLACES.smithy.x - 2, PLACES.smithy.z, 6, 5, 3.6, Math.PI / 2, 0x9a8a7a, 0x4a4a52, { chimney: true });
  const anvil = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.7), mat(0x3a3a40, { metalness: 0.6, roughness: 0.4 }));
  anvil.position.set(PLACES.smithy.x + 2.5, heightAt(PLACES.smithy.x + 2.5, PLACES.smithy.z + 2) + 0.4, PLACES.smithy.z + 2);
  scene.add(anvil);
  G.colliders.addCircle(anvil.position.x, anvil.position.z, 0.8);
  addGlow(scene, anvil.position.x - 1.5, anvil.position.y + 0.6, anvil.position.z, 3, '#ff7a30', 1);
  // houses around the square
  const spots = [[24, -22, -0.8], [30, -6, -1.57], [22, 22, -2.4], [-26, 26, 2.4], [-32, -2, 1.57], [-28, -26, 0.8], [-6, 28, 3.14], [10, 30, 3.14], [26, -34, -0.4], [-10, -32, 0.2]];
  spots.forEach(([x, z, r], i) => house(scene, x, z, 6 + (i % 3), 5 + (i % 2), 3.4 + (i % 3) * 0.5, r, walls[i % walls.length], roofs[i % roofs.length], { chimney: i % 2 === 0 }));

  // stage for Sora
  const st = new THREE.Mesh(new THREE.BoxGeometry(9, 0.8, 5), mat(0x7a5a3a));
  st.position.set(PLACES.stage.x, 3.4, PLACES.stage.z);
  st.receiveShadow = true; scene.add(st);
  G.colliders.addBox(PLACES.stage.x, PLACES.stage.z - 1.5, 4.5, 1.2);
  for (const sx of [-4, 4]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 4, 6), mat(0x5a3d28));
    post.position.set(PLACES.stage.x + sx, 5.2, PLACES.stage.z - 2); scene.add(post);
  }
  const awn = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.2, 3), mat(0x3f5d7a));
  awn.position.set(PLACES.stage.x, 7.2, PLACES.stage.z - 1); awn.rotation.x = 0.25; scene.add(awn);

  // notice board
  const nb = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 0.2), mat(0x8a6a44));
  board.position.y = 2; nb.add(board);
  for (const sx of [-1.1, 1.1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.4, 0.2), mat(0x5a3d28)); leg.position.set(sx, 1.2, 0); nb.add(leg); }
  for (let i = 0; i < 4; i++) { const paper = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.05), mat(0xf2ead6)); paper.position.set(-0.8 + i * 0.55, 2 + (i % 2) * 0.2, 0.12); paper.rotation.z = (i - 1.5) * 0.1; nb.add(paper); }
  nb.position.set(PLACES.board.x, 3, PLACES.board.z); nb.rotation.y = -0.4;
  scene.add(nb);
  G.colliders.addCircle(PLACES.board.x, PLACES.board.z, 1.2);

  // the Great Lantern: centerpiece
  const gl = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 1.2, 8), mat(0x8a8478));
  base.position.y = 0.6; gl.add(base);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 7, 6), mat(0x5a3d28));
  pole.position.y = 4.5; gl.add(pole);
  W.greatLanternMat = new THREE.MeshStandardMaterial({ color: 0xffa040, emissive: 0xff8a20, emissiveIntensity: 0.15, flatShading: true });
  const big = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2.2, 8), W.greatLanternMat);
  big.position.y = 8.6; gl.add(big);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.8, 8), mat(0x3a2a20));
  cap.position.y = 10.1; gl.add(cap);
  gl.position.set(PLACES.greatLantern.x, 3, PLACES.greatLantern.z);
  scene.add(gl);
  G.colliders.addCircle(PLACES.greatLantern.x, PLACES.greatLantern.z, 2.8);
  W.greatGlow = addGlow(scene, 0, 11.6, -3, 9, '#ffb050', 0.5);

  // lantern strings radiating from the Great Lantern
  const lanternCols = [0xff7a3c, 0xffb340, 0xff5a6a, 0xffd36a, 0x8ad0ff];
  const poleSpots = [];
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2; poleSpots.push([Math.cos(a) * 18, Math.sin(a) * 18 - 3]); }
  const lpos = [], lcol = [];
  for (const [px, pz] of poleSpots) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 6, 5), mat(0x5a3d28));
    p.position.set(px, 6, pz); scene.add(p);
    G.colliders.addCircle(px, pz, 0.35);
    for (let k = 1; k < 9; k++) {
      const t = k / 9;
      const x = lerp(0, px, t), z = lerp(-3, pz, t);
      const y = lerp(10.4, 8.6, t) - Math.sin(t * Math.PI) * 1.4;
      lpos.push([x, y, z]); lcol.push(lanternCols[(k + Math.round(px)) % lanternCols.length]);
    }
  }
  const lgeo = new THREE.SphereGeometry(0.3, 6, 4);
  const lmat = new THREE.MeshBasicMaterial({ color: 0xffffff }); // unlit so each lantern keeps its own color
  W.stringMat = lmat;
  const inst = new THREE.InstancedMesh(lgeo, lmat, lpos.length);
  const m4 = new THREE.Matrix4();
  lpos.forEach((p, i) => { m4.makeTranslation(p[0], p[1], p[2]); inst.setMatrixAt(i, m4); inst.setColorAt(i, new THREE.Color(lcol[i])); });
  scene.add(inst);
  const gpos = new Float32Array(lpos.flat());
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(gpos, 3));
  W.stringGlow = new THREE.Points(gg, new THREE.PointsMaterial({ map: glowTexture(THREE, '#ffb860'), size: 2.6, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  scene.add(W.stringGlow);

  // festival stalls, benches, crates and barrels so the square feels lived in
  const awnings = [0xc8484a, 0x3f7aa8, 0xe0a040, 0x5b8a4a, 0x8a5aa8];
  const stall = (x, z, rot, ci) => {
    const g = new THREE.Group();
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 1.2), mat(0x8a6a44)); counter.position.y = 0.5; g.add(counter);
    for (const [sx, sz] of [[-1.4, -0.5], [1.4, -0.5], [-1.4, 0.6], [1.4, 0.6]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.12), mat(0x5a3d28)); p.position.set(sx, 1.3, sz); g.add(p); }
    const aw = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 1.8), mat(awnings[ci % awnings.length])); aw.position.set(0, 2.65, 0.15); aw.rotation.x = 0.22; g.add(aw);
    const goodsCols = [0xf2c45a, 0xe0566b, 0x9fd06a, 0xf28a3c];
    for (let i = 0; i < 4; i++) { const gd = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), mat(goodsCols[(i + ci) % 4])); gd.position.set(-1 + i * 0.65, 1.15, 0); g.add(gd); }
    g.position.set(x, heightAt(x, z), z); g.rotation.y = rot;
    g.traverse((o) => { o.castShadow = true; });
    scene.add(g);
    G.colliders.addCircle(x, z, 1.6);
  };
  [[-10, 14, 2.6], [16, 14, -2.4], [19, -5, -1.6], [-22, -4, 1.4], [-6, -20, 0.2], [24, 8, -1.9]].forEach(([x, z, r], i) => stall(x, z, r, i));
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2, x = Math.cos(a) * 7.5, z = Math.sin(a) * 7.5 - 3;
    const b = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.15, 0.6), mat(0x7a5a3a)); seat.position.y = 0.55; b.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.1), mat(0x7a5a3a)); back.position.set(0, 0.9, -0.28); b.add(back);
    for (const sx of [-0.9, 0.9]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.5), mat(0x4a3424)); l.position.set(sx, 0.27, 0); b.add(l); }
    b.position.set(x, heightAt(x, z), z); b.rotation.y = -a - Math.PI / 2; scene.add(b);
  }
  const rndT = seeded(5);
  for (let i = 0; i < 26; i++) {
    const a = rndT() * Math.PI * 2, r = 20 + rndT() * 13, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (pathDist(x, z) < 4.5) continue;
    const barrel = rndT() < 0.5;
    const m = barrel ? new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.4, 1.1, 8), mat(0x7a5232)) : new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), mat(0x9a7a4a));
    m.position.set(x, heightAt(x, z) + (barrel ? 0.55 : 0.45), z); m.rotation.y = rndT() * 3; m.castShadow = true; scene.add(m);
    G.colliders.addCircle(x, z, 0.55);
  }

  // north gate with Ruel's post
  for (const sx of [-4, 4]) {
    const gp = new THREE.Mesh(new THREE.BoxGeometry(1, 6, 1), mat(0x6a5038));
    gp.position.set(sx, heightAt(sx, -40) + 3, -40); scene.add(gp);
    G.colliders.addBox(sx, -40, 0.6, 0.6);
    addGlow(scene, sx, heightAt(sx, -40) + 6.6, -40, 3, '#ffb860', 1);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.8, 1), mat(0x6a5038));
  beam.position.set(0, heightAt(0, -40) + 6, -40); scene.add(beam);
  // fence segments around town edge (decorative, gaps for roads)
  const fm = mat(0x7a5a3a);
  for (let a = 0; a < Math.PI * 2; a += 0.08) {
    const x = Math.cos(a) * 41, z = Math.sin(a) * 41;
    if (pathDist(x, z) < 5) continue;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.2, 0.25), fm);
    post.position.set(x, heightAt(x, z) + 0.6, z); scene.add(post);
  }

  // docks: pier + boathouse
  const pier = new THREE.Mesh(new THREE.BoxGeometry(16, 0.4, 3.2), mat(0x8a6a44));
  pier.position.set(PLACES.docks.x + 7, 0.6, PLACES.docks.z); pier.receiveShadow = true; scene.add(pier);
  W.pier = { x0: PLACES.docks.x - 1, x1: PLACES.docks.x + 15, z0: PLACES.docks.z - 1.6, z1: PLACES.docks.z + 1.6, y: 0.8 };
  for (let i = 0; i < 6; i++) {
    for (const sz of [-1.4, 1.4]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 5), mat(0x5a3d28)); leg.position.set(PLACES.docks.x + i * 3, -0.8, PLACES.docks.z + sz); scene.add(leg); }
  }
  const lp = lanternMesh(); lp.position.set(PLACES.docks.x + 14.5, 2.2, PLACES.docks.z + 1.4); scene.add(lp);
  addGlow(scene, lp.position.x, lp.position.y, lp.position.z, 4, '#ffb860', 1);
  // boats
  for (const [bx, bz, r] of [[52, 3, 0.3], [47, 15, -0.5]]) {
    const boat = new THREE.Mesh(new THREE.BoxGeometry(4, 0.8, 1.6), mat(0x6a4a30));
    boat.position.set(bx, 0.25, bz); boat.rotation.y = r; scene.add(boat);
    W.animated.push({ obj: boat, kind: 'bob', ph: bx });
  }
  house(scene, PLACES.boathouse.x, PLACES.boathouse.z, 8, 6, 4, -1.2, 0x8a7a64, 0x3f5d7a);
}

// ---------------------------------------------------------------- vegetation
function buildVegetation(scene) {
  const rnd = seeded(11);
  const pines = [], rounds = [], rocks = [], dead = [], grass = [], flowers = [];
  const ok = (x, z, pad = 0) => {
    const h = heightAt(x, z);
    if (h < 0.4 + pad * 0.1) return false;
    if (Math.hypot(x, z) < 44) return false;
    if (pathDist(x, z) < 4) return false;
    if (Math.hypot(x, z) > 175) return false;
    for (const s of SHRINES) if (Math.hypot(x - s.x, z - s.z) < 7) return false;
    if (Math.hypot(x - PLACES.bossArena.x, z - PLACES.bossArena.z) < 17) return false;
    if (Math.hypot(x - PLACES.manor.x, z - PLACES.manor.z) < 16) return false;
    if (Math.hypot(x - PLACES.watchtower.x, z - PLACES.watchtower.z) < 9) return false;
    if (Math.hypot(x - PLACES.boathouse.x, z - PLACES.boathouse.z) < 8) return false;
    return true;
  };
  for (let i = 0; i < 9000 && pines.length + rounds.length < 2100; i++) {
    const x = (rnd() - 0.5) * 350, z = (rnd() - 0.5) * 350;
    if (!ok(x, z)) continue;
    const forest = smoothstep(75, 30, Math.hypot(x + 90, z + 70));
    const marsh = smoothstep(MARSH.r + 4, MARSH.r - 8, Math.hypot(x - MARSH.x, z - MARSH.z));
    const mount = smoothstep(150, 165, Math.hypot(x, z));
    const density = 0.06 + forest * 0.85 + mount * 0.5 - marsh;
    if (rnd() > density) continue;
    if (marsh > 0.3) { if (rnd() < 0.3) dead.push([x, z, 0.8 + rnd() * 0.8]); continue; }
    const s = 0.8 + rnd() * 0.9;
    if (forest > 0.3 || mount > 0.3 || rnd() < 0.4) pines.push([x, z, s]); else rounds.push([x, z, s]);
  }
  for (let i = 0; i < 520; i++) {
    const x = (rnd() - 0.5) * 340, z = (rnd() - 0.5) * 340;
    if (!ok(x, z)) continue;
    rocks.push([x, z, 0.5 + rnd() * 1.6]);
  }
  for (let i = 0; i < 5000 && grass.length < 2200; i++) {
    const x = (rnd() - 0.5) * 330, z = (rnd() - 0.5) * 330;
    const h = heightAt(x, z);
    if (h < 0.6 || pathDist(x, z) < 2.5 || Math.hypot(x, z) < 34 || Math.hypot(x, z) > 160) continue;
    if (rnd() < 0.15) flowers.push([x, z, rnd()]); else grass.push([x, z, 0.6 + rnd() * 0.7]);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const place = (inst, i, x, y, z, s, sy = s, rot = rnd() * 6.28) => {
    q.setFromAxisAngle(up, rot); sv.set(s, sy, s); pv.set(x, y, z);
    m4.compose(pv, q, sv); inst.setMatrixAt(i, m4);
  };
  // pines: trunk + 2 cones
  const trunkG = new THREE.CylinderGeometry(0.22, 0.32, 2, 5); trunkG.translate(0, 1, 0);
  const cone1 = new THREE.ConeGeometry(1.7, 3.2, 6); cone1.translate(0, 3.2, 0);
  const cone2 = new THREE.ConeGeometry(1.2, 2.6, 6); cone2.translate(0, 4.8, 0);
  const trunks = new THREE.InstancedMesh(trunkG, mat(0x5a3d28), pines.length + rounds.length);
  const c1 = new THREE.InstancedMesh(cone1, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), pines.length);
  const c2 = new THREE.InstancedMesh(cone2, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), pines.length);
  const col = new THREE.Color();
  pines.forEach(([x, z, s], i) => {
    const y = heightAt(x, z) - 0.2, r = rnd() * 6.28;
    place(trunks, i, x, y, z, s, s, r); place(c1, i, x, y, z, s, s * (0.9 + rnd() * 0.3), r); place(c2, i, x, y, z, s, s, r);
    col.setHSL(0.33 + rnd() * 0.06, 0.38, 0.22 + rnd() * 0.08); c1.setColorAt(i, col);
    col.offsetHSL(0, 0, 0.05); c2.setColorAt(i, col);
    G.colliders.addCircle(x, z, 0.5 * s);
  });
  // round trees
  const ballG = new THREE.IcosahedronGeometry(1.8, 0); ballG.translate(0, 3.4, 0);
  const balls = new THREE.InstancedMesh(ballG, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), rounds.length);
  rounds.forEach(([x, z, s], i) => {
    const y = heightAt(x, z) - 0.2;
    place(trunks, pines.length + i, x, y, z, s);
    place(balls, i, x, y, z, s, s * (0.9 + rnd() * 0.3));
    const autumn = rnd() < 0.25;
    col.setHSL(autumn ? 0.07 + rnd() * 0.05 : 0.24 + rnd() * 0.06, autumn ? 0.6 : 0.45, autumn ? 0.45 : 0.32 + rnd() * 0.08); balls.setColorAt(i, col);
    G.colliders.addCircle(x, z, 0.5 * s);
  });
  for (const m of [trunks, c1, c2, balls]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }
  // dead marsh trees
  const deadG = new THREE.CylinderGeometry(0.12, 0.35, 5, 4); deadG.translate(0, 2.5, 0);
  const deadI = new THREE.InstancedMesh(deadG, mat(0x3a3328), dead.length);
  dead.forEach(([x, z, s], i) => { place(deadI, i, x, heightAt(x, z), z, s); G.colliders.addCircle(x, z, 0.35 * s); });
  deadI.castShadow = true; scene.add(deadI);
  // rocks
  const rockG = new THREE.DodecahedronGeometry(1, 0);
  const rockI = new THREE.InstancedMesh(rockG, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 }), rocks.length);
  rocks.forEach(([x, z, s], i) => {
    place(rockI, i, x, heightAt(x, z) + s * 0.2, z, s, s * 0.7);
    col.setHSL(0.1, 0.05, 0.42 + rnd() * 0.15); rockI.setColorAt(i, col);
    if (s > 1) G.colliders.addCircle(x, z, s * 0.8);
  });
  rockI.castShadow = rockI.receiveShadow = true; scene.add(rockI);
  // grass tufts + flowers
  const grassG = new THREE.ConeGeometry(0.25, 0.9, 3); grassG.translate(0, 0.4, 0);
  const grassI = new THREE.InstancedMesh(grassG, new THREE.MeshStandardMaterial({ flatShading: true }), grass.length);
  grass.forEach(([x, z, s], i) => { place(grassI, i, x, heightAt(x, z), z, s); col.setHSL(0.23 + rnd() * 0.06, 0.5, 0.35 + rnd() * 0.1); grassI.setColorAt(i, col); });
  scene.add(grassI);
  const flG = new THREE.OctahedronGeometry(0.22, 0); flG.translate(0, 0.45, 0);
  const flI = new THREE.InstancedMesh(flG, new THREE.MeshStandardMaterial({ flatShading: true }), flowers.length);
  const flCols = [0xf2d16b, 0xf28fb0, 0xffffff, 0xb59cf2, 0xf2865a];
  flowers.forEach(([x, z, t], i) => { place(flI, i, x, heightAt(x, z), z, 1); flI.setColorAt(i, new THREE.Color(flCols[Math.floor(t * flCols.length)])); });
  scene.add(flI);
}

// ---------------------------------------------------------------- landmarks
function buildLandmarks(scene) {
  // Aurel Manor ruins: broken walls around a courtyard
  const m = PLACES.manor;
  const wallMat = mat(0x8c8a80);
  const segs = [[-10, -8, 8, 1.2, 0], [4, -9, 10, 1.2, 0], [-12, 2, 1.2, 12, 0], [12, 0, 1.2, 14, 0], [-6, 10, 8, 1.2, 0], [8, 10, 6, 1.2, 0]];
  for (const [dx, dz, w, d] of segs) {
    const hgt = 2 + Math.random() * 3;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), wallMat);
    wall.position.set(m.x + dx, heightAt(m.x + dx, m.z + dz) + hgt / 2 - 0.3, m.z + dz);
    wall.castShadow = wall.receiveShadow = true; scene.add(wall);
    G.colliders.addBox(m.x + dx, m.z + dz, w / 2, d / 2);
  }
  for (const [dx, dz] of [[-12, -8], [12, -9], [-12, 10], [12, 10]]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 6, 6), wallMat);
    col.position.set(m.x + dx, heightAt(m.x + dx, m.z + dz) + 3, m.z + dz); col.castShadow = true; scene.add(col);
    G.colliders.addCircle(m.x + dx, m.z + dz, 0.8);
  }
  addGlow(scene, m.x, heightAt(m.x, m.z) + 3, m.z, 10, '#7fd0ff', 0.25);

  // watchtower
  const wt = PLACES.watchtower;
  const tg = new THREE.Group();
  for (const [sx, sz] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 10, 5), mat(0x6a5038));
    leg.position.set(sx, 5, sz); tg.add(leg);
  }
  const plat = new THREE.Mesh(new THREE.BoxGeometry(5, 0.5, 5), mat(0x7a5a3a)); plat.position.y = 10; tg.add(plat);
  const troof = new THREE.Mesh(new THREE.ConeGeometry(3.8, 2.5, 4), mat(0x8a3b3b)); troof.rotation.y = Math.PI / 4; troof.position.y = 13.5; tg.add(troof);
  tg.position.set(wt.x, heightAt(wt.x, wt.z), wt.z); tg.traverse((o) => { o.castShadow = true; }); scene.add(tg);
  G.colliders.addBox(wt.x, wt.z, 2.2, 2.2);
  addGlow(scene, wt.x, heightAt(wt.x, wt.z) + 11.5, wt.z, 5, '#ffb860', 1);

  // marsh boss arena: ring of standing stones
  const ba = PLACES.bossArena;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const x = ba.x + Math.cos(a) * 14, z = ba.z + Math.sin(a) * 14;
    const st = new THREE.Mesh(new THREE.BoxGeometry(1.4, 4 + (i % 3), 1), mat(0x5a5e58));
    st.position.set(x, heightAt(x, z) + 2, z); st.rotation.y = -a; st.castShadow = true; scene.add(st);
    G.colliders.addCircle(x, z, 0.9);
  }
}

// shrines, chests, shards, herbs, vistas are built by interactables.js (they need gameplay hooks)

function buildSkyLanterns(scene) {
  const n = 46;
  const rnd = seeded(21);
  W.skyLanterns = [];
  const geo = new THREE.CylinderGeometry(0.35, 0.28, 0.7, 6);
  const inst = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xffb060, emissive: 0xff9a40, emissiveIntensity: 1, flatShading: true }), n);
  const gpos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    W.skyLanterns.push({ x: LAKE.x + (rnd() - 0.5) * 90, z: LAKE.z + (rnd() - 0.5) * 100, y: rnd() * 60, sp: 0.6 + rnd() * 0.8, ph: rnd() * 6 });
  }
  scene.add(inst);
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(gpos, 3));
  const pts = new THREE.Points(gg, new THREE.PointsMaterial({ map: glowTexture(THREE, '#ffb860'), size: 4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  scene.add(pts);
  W.skyLanternInst = inst; W.skyLanternPts = pts;
}

function buildFireflies(scene) {
  const n = 260, rnd = seeded(31);
  W.flies = [];
  for (let i = 0; i < n; i++) {
    const zone = rnd();
    let cx, cz, rr;
    if (zone < 0.45) { cx = -85; cz = -65; rr = 55; } else if (zone < 0.8) { cx = MARSH.x; cz = MARSH.z; rr = 40; } else { cx = -20; cz = 60; rr = 50; }
    const a = rnd() * 6.28, d = Math.sqrt(rnd()) * rr;
    W.flies.push({ x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d, ph: rnd() * 10 });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  W.flyPts = new THREE.Points(g, new THREE.PointsMaterial({ map: glowTexture(THREE, '#d8ff8a'), size: 1.3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  scene.add(W.flyPts);
}

// ---------------------------------------------------------------- day / night
const SKY_KEYS = [
  [0.0, 0x0a1230, 0x1c2648, 0x1a2242, 0.0, 0.32],
  [0.22, 0x1a2a55, 0x3a3e66, 0x33385c, 0.0, 0.3],
  [0.27, 0x4a6fa5, 0xf2a679, 0xc79a8a, 0.6, 0.15],
  [0.36, 0x5b9bd8, 0xcfe3f0, 0xb9d3e3, 1.4, 0.0],
  [0.5, 0x4f94d4, 0xc4e2f5, 0xbcd8ea, 1.7, 0.0],
  [0.66, 0x5f8fcf, 0xf0d6a8, 0xd8c6a8, 1.4, 0.0],
  [0.74, 0x3d4c86, 0xf08a5d, 0xa87070, 0.7, 0.1],
  [0.8, 0x1a2350, 0x4a3a66, 0x3a3558, 0.1, 0.3],
  [1.0, 0x0a1230, 0x1c2648, 0x1a2242, 0.0, 0.32],
];
const cA = new THREE.Color(), cB = new THREE.Color();
function sampleKeys(t, idx) {
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    const a = SKY_KEYS[i], b = SKY_KEYS[i + 1];
    if (t >= a[0] && t <= b[0]) {
      const k = (t - a[0]) / (b[0] - a[0]);
      if (idx <= 3) return cA.setHex(a[idx]).lerp(cB.setHex(b[idx]), k).clone();
      return lerp(a[idx], b[idx], k);
    }
  }
  return idx <= 3 ? new THREE.Color(SKY_KEYS[0][idx]) : SKY_KEYS[0][idx];
}
export const nightFactor = (t) => {
  if (t > 0.74 || t < 0.26) return t > 0.74 ? smoothstep(0.74, 0.8, t) : smoothstep(0.26, 0.21, t);
  return 0;
};
export const isNight = () => nightFactor(G.time) > 0.6;

export function updateWorld(dt, elapsed) {
  const t = G.time;
  const night = nightFactor(t);
  const top = sampleKeys(t, 1), hor = sampleKeys(t, 2), fog = sampleKeys(t, 3);
  const sunI = sampleKeys(t, 4), moonI = sampleKeys(t, 5);
  W.skyMat.uniforms.top.value.copy(top);
  W.skyMat.uniforms.horizon.value.copy(hor);
  G.scene.fog.color.copy(fog);
  // sun path: rises east (+x), sets west
  const ang = (t - 0.25) * Math.PI * 2;
  const sunDir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0.35).normalize();
  W.skyMat.uniforms.sunDir.value.copy(sunDir);
  W.skyMat.uniforms.sunCol.value.setRGB(1, 0.75, 0.45).multiplyScalar(Math.max(sunI, 0) * 0.6);
  const p = G.player ? G.player.pos : { x: 0, z: 0 };
  const lightDir = sunDir.y > 0.05 ? sunDir : new THREE.Vector3(-Math.cos(ang), -Math.sin(ang), 0.35).normalize();
  W.sun.position.set(p.x + lightDir.x * 80, Math.max(lightDir.y, 0.25) * 80, p.z + lightDir.z * 80);
  W.sun.target.position.set(p.x, 0, p.z);
  W.sun.intensity = Math.max(sunI, moonI * 1.2);
  W.sun.color.setHex(sunI > moonI ? 0xfff0dc : 0x9fb6ff);
  W.hemi.intensity = 0.45 + sunI * 0.35 + night * 0.4;
  W.hemi.color.copy(hor).lerp(new THREE.Color(0xbfd8ff), 0.5);
  W.hemi.groundColor.setHex(night > 0.5 ? 0x1a2030 : 0x3a4a2a);
  G.scene.fog.near = 50 + (1 - night) * 30; G.scene.fog.far = 220 + (1 - night) * 80;
  W.sky.position.set(G.camera.position.x, 0, G.camera.position.z);
  W.stars.position.copy(W.sky.position);
  W.starMat.opacity = night * 0.9;
  const md = new THREE.Vector3(-Math.cos(ang), -Math.sin(ang), -0.3).normalize();
  W.moon.position.set(G.camera.position.x + md.x * 380, md.y * 380, G.camera.position.z + md.z * 380);
  W.moon.material.opacity = clamp(md.y * 3, 0, 1);
  // night lights
  const glowK = clamp(night * 1.1 + 0.15, 0, 1);
  for (const g of W.glows) g.s.material.opacity = glowK * g.base * (0.85 + Math.sin(elapsed * 3 + g.s.position.x) * 0.15);
  for (const wm of W.windows) wm.emissiveIntensity = 0.2 + night * 1.6;
  W.stringMat.color.setScalar(0.75 + night * 0.25);
  W.stringGlow.material.opacity = 0.15 + night * 0.85;
  W.townLight.intensity = night * 60;
  W.playerLight.intensity = night * 40;
  if (G.player) W.playerLight.position.set(G.player.pos.x, G.player.y + 3, G.player.pos.z);

  // sky lanterns drift upward over the lake
  const m4 = new THREE.Matrix4();
  const gp = W.skyLanternPts.geometry.attributes.position;
  W.skyLanterns.forEach((l, i) => {
    l.y += l.sp * dt;
    if (l.y > 70) l.y = 2;
    const x = l.x + Math.sin(elapsed * 0.2 + l.ph) * 3, z = l.z + Math.cos(elapsed * 0.17 + l.ph) * 3;
    m4.makeTranslation(x, l.y, z); W.skyLanternInst.setMatrixAt(i, m4);
    gp.setXYZ(i, x, l.y, z);
  });
  W.skyLanternInst.instanceMatrix.needsUpdate = true; gp.needsUpdate = true;
  W.skyLanternInst.visible = night > 0.05;
  W.skyLanternPts.material.opacity = night;
  // fireflies
  const fp = W.flyPts.geometry.attributes.position;
  W.flies.forEach((f, i) => {
    const x = f.x + Math.sin(elapsed * 0.5 + f.ph) * 2, z = f.z + Math.cos(elapsed * 0.4 + f.ph * 1.3) * 2;
    fp.setXYZ(i, x, heightAt(x, z) + 1 + Math.sin(elapsed + f.ph) * 0.6, z);
  });
  fp.needsUpdate = true;
  W.flyPts.material.opacity = night * (0.7 + Math.sin(elapsed * 2) * 0.3);
  for (const a of W.animated) if (a.kind === 'bob') { a.obj.position.y = 0.2 + Math.sin(elapsed * 1.2 + a.ph) * 0.12; a.obj.rotation.z = Math.sin(elapsed + a.ph) * 0.05; }
  if (G.save && G.save.world.bossDefeated) { W.greatLanternMat.emissiveIntensity = 1.6; W.greatGlow.material.opacity = 0.9 + Math.sin(elapsed * 2) * 0.1; }
  else W.greatLanternMat.emissiveIntensity = 0.15 + (G.save ? G.save.world.shrines.length * 0.2 : 0);
}

export function setShadowQuality(q) {
  W.sun.castShadow = q !== 'low';
  W.sun.shadow.mapSize.set(q === 'high' ? 2048 : 1024, q === 'high' ? 2048 : 1024);
  if (W.sun.shadow.map) { W.sun.shadow.map.dispose(); W.sun.shadow.map = null; }
}
