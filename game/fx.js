// Visual effects: rings, sparks, slashes and projectiles.
import * as THREE from 'three';
import { G } from './state.js';
import { glowTexture } from './util.js';
import { groundY } from './world.js';

const effects = [];
const projectiles = [];
let sparkPts, sparkData = [], SPARKS = 400;

export function initFX() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
  sparkPts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.5, map: glowTexture(THREE, '#ffffff'), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sparkPts.frustumCulled = false;
  G.scene.add(sparkPts);
  for (let i = 0; i < SPARKS; i++) sparkData.push({ life: 0 });
}

let sparkIdx = 0;
export function sparks(x, y, z, color = 0xffc070, n = 12, speed = 6, life = 0.6) {
  const c = new THREE.Color(color);
  for (let i = 0; i < n; i++) {
    const s = sparkData[sparkIdx]; sparkIdx = (sparkIdx + 1) % SPARKS;
    const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1;
    const r = Math.sqrt(1 - u * u);
    s.x = x; s.y = y; s.z = z;
    s.vx = Math.cos(a) * r * speed * (0.4 + Math.random() * 0.6);
    s.vy = Math.abs(u) * speed * 0.8 + 1;
    s.vz = Math.sin(a) * r * speed * (0.4 + Math.random() * 0.6);
    s.life = s.max = life * (0.6 + Math.random() * 0.6);
    s.c = c;
  }
}

export function ring(x, z, color = 0xffc070, maxR = 5, dur = 0.45, y = null) {
  const geo = new THREE.RingGeometry(0.8, 1, 40);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, (y ?? groundY(x, z)) + 0.15, z);
  G.scene.add(m);
  effects.push({ m, t: 0, dur, update(e, k) { const s = 0.2 + k * maxR; e.m.scale.set(s, s, s); e.m.material.opacity = 0.9 * (1 - k); } });
}

export function pillar(x, z, color = 0xffd080, h = 14, dur = 1.2) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, h, 12, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.position.set(x, groundY(x, z) + h / 2, z);
  G.scene.add(m);
  effects.push({ m, t: 0, dur, update(e, k) { e.m.material.opacity = 0.6 * (1 - k); e.m.scale.x = e.m.scale.z = 1 + k * 0.5; } });
}

// slash arc in front of an entity
export function slash(x, y, z, yaw, color = 0xfff2d0, big = false) {
  const geo = new THREE.RingGeometry(1.4, big ? 3.4 : 2.7, 16, 1, -Math.PI * 0.42, Math.PI * 0.84);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.rotation.order = 'YXZ';
  m.rotation.set(-Math.PI / 2, yaw + Math.PI / 2, 0);
  m.position.set(x, y + 1.1, z);
  G.scene.add(m);
  effects.push({ m, t: 0, dur: 0.18, update(e, k) { e.m.material.opacity = 0.75 * (1 - k); e.m.rotation.z = -k * 0.8; } });
}

// projectile: owner 'enemy' hits player, 'player' hits enemies
export function projectile({ x, y, z, dx, dz, speed = 14, dmg = 10, owner = 'enemy', color = 0x9a6aff, radius = 0.5, life = 2.5, onHit, homing = null, size = 0.35 }) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 0), new THREE.MeshBasicMaterial({ color }));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(THREE, '#' + new THREE.Color(color).getHexString()), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.scale.set(size * 6, size * 6, 1); m.add(glow);
  m.position.set(x, y, z);
  G.scene.add(m);
  const len = Math.hypot(dx, dz) || 1;
  projectiles.push({ m, vx: (dx / len) * speed, vz: (dz / len) * speed, speed, dmg, owner, radius, life, onHit, homing, color });
}

export function updateFX(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.t += dt;
    const k = Math.min(e.t / e.dur, 1);
    e.update(e, k);
    if (k >= 1) { G.scene.remove(e.m); e.m.geometry.dispose(); e.m.material.dispose(); effects.splice(i, 1); }
  }
  const pos = sparkPts.geometry.attributes.position, col = sparkPts.geometry.attributes.color;
  for (let i = 0; i < SPARKS; i++) {
    const s = sparkData[i];
    if (s.life > 0) {
      s.life -= dt; s.vy -= 9 * dt;
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      const k = Math.max(s.life / s.max, 0);
      pos.setXYZ(i, s.x, s.y, s.z); col.setXYZ(i, s.c.r * k, s.c.g * k, s.c.b * k);
    } else { pos.setXYZ(i, 0, -999, 0); }
  }
  pos.needsUpdate = true; col.needsUpdate = true;
  // projectiles
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.life -= dt;
    if (p.homing && p.homing.alive) {
      const tx = p.homing.pos.x - p.m.position.x, tz = p.homing.pos.z - p.m.position.z, d = Math.hypot(tx, tz) || 1;
      p.vx += (tx / d * p.speed - p.vx) * Math.min(dt * 6, 1); p.vz += (tz / d * p.speed - p.vz) * Math.min(dt * 6, 1);
      p.m.position.y += ((p.homing.y + 1.2) - p.m.position.y) * Math.min(dt * 4, 1);
    }
    p.m.position.x += p.vx * dt; p.m.position.z += p.vz * dt;
    p.m.rotation.x += dt * 5; p.m.rotation.y += dt * 7;
    let hitSomething = false;
    if (p.owner === 'enemy') {
      const pl = G.player;
      if (pl && pl.alive && Math.hypot(pl.pos.x - p.m.position.x, pl.pos.z - p.m.position.z) < p.radius + 0.5 && Math.abs(pl.y + 1 - p.m.position.y) < 2) {
        pl.takeDamage(p.dmg, p.m.position); hitSomething = true;
      }
    } else {
      for (const e of G.enemies) {
        if (!e.alive) continue;
        if (Math.hypot(e.pos.x - p.m.position.x, e.pos.z - p.m.position.z) < p.radius + e.radius) {
          if (p.onHit) p.onHit(e); hitSomething = true; break;
        }
      }
    }
    if (p.m.position.y < groundY(p.m.position.x, p.m.position.z)) hitSomething = true;
    if (hitSomething || p.life <= 0) {
      sparks(p.m.position.x, p.m.position.y, p.m.position.z, p.color, 10, 5, 0.4);
      G.scene.remove(p.m); p.m.geometry.dispose(); projectiles.splice(i, 1);
    }
  }
}

export function clearProjectiles() {
  for (const p of projectiles) G.scene.remove(p.m);
  projectiles.length = 0;
}
