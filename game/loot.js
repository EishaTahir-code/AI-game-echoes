// World pickups: coins, item drops with rarity beams, materials.
import * as THREE from 'three';
import { G } from './state.js';
import { groundY } from './world.js';
import { glowTexture, rand } from './util.js';
import { RARITY, makeStack, CONSUMABLES } from './items.js';
import { giveItem, giveStack, grantGold } from './story.js';
import * as Audio from './audio.js';

const pickups = [];
const coinGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.07, 8);
const coinMat = new THREE.MeshStandardMaterial({ color: 0xffc94a, emissive: 0xb07a10, emissiveIntensity: 0.5, metalness: 0.8, roughness: 0.3 });
const boxGeo = new THREE.OctahedronGeometry(0.32, 0);

function spawn(x, z, mesh, data) {
  const a = rand(0, Math.PI * 2), s = rand(2, 5);
  const p = { mesh, x, z, y: groundY(x, z) + 1.2, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: rand(5, 8), age: 0, ...data };
  mesh.position.set(x, p.y, z);
  G.scene.add(mesh);
  pickups.push(p);
  return p;
}

export function dropCoins(x, z, amount) {
  const n = Math.min(8, Math.max(1, Math.round(amount / 6)));
  const per = Math.floor(amount / n), extra = amount - per * n;
  for (let i = 0; i < n; i++) spawn(x, z, new THREE.Mesh(coinGeo, coinMat), { kind: 'gold', amount: per + (i === 0 ? extra : 0) });
}

function beam(color, h) {
  const g = new THREE.Group();
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.3, h, 6, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  col.position.y = h / 2; g.add(col);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(THREE, '#' + new THREE.Color(color).getHexString()), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.scale.set(2.2, 2.2, 1); g.add(glow);
  return g;
}

export function dropItem(x, z, item) {
  const color = new THREE.Color(RARITY[item.rarity].color);
  const mesh = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7, flatShading: true }));
  const b = beam(color, 1.5 + item.rarity * 1.6);
  mesh.add(b);
  b.position.y = -0.9;
  spawn(x, z, mesh, { kind: 'item', item });
}

export function dropStack(x, z, key, qty = 1) {
  const color = new THREE.Color(CONSUMABLES[key].color);
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, flatShading: true }));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(THREE, '#' + color.getHexString()), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.scale.set(1.2, 1.2, 1); mesh.add(glow);
  spawn(x, z, mesh, { kind: 'stack', key, qty });
}

export function updateLoot(dt, elapsed) {
  const pl = G.player;
  const fetchR = G.save.fox.joined && G.save.fox.bondLevel >= 4 ? 12 : 3.2;
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.age += dt;
    const gy = groundY(p.x, p.z) + (p.kind === 'gold' ? 0.15 : 0.7);
    if (p.vy !== 0 || p.y > gy + 0.01) {
      p.vy -= 20 * dt; p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt;
      p.vx *= 0.97; p.vz *= 0.97;
      if (p.y <= gy) { p.y = gy; p.vy = Math.abs(p.vy) > 3 ? -p.vy * 0.35 : 0; if (p.vy === 0) { p.vx = 0; p.vz = 0; } }
    }
    const dx = pl.pos.x - p.x, dz = pl.pos.z - p.z, d = Math.hypot(dx, dz);
    if (p.age > 0.5 && d < fetchR && pl.alive) {
      const sp = Math.max(10, 26 - d);
      p.x += (dx / d) * sp * dt; p.z += (dz / d) * sp * dt; p.y += (pl.y + 1 - p.y) * Math.min(dt * 6, 1); p.vy = 0;
    }
    if (p.age > 0.5 && d < 0.9) {
      let ok = true;
      if (p.kind === 'gold') { grantGold(p.amount); Audio.sfx('coin'); }
      else if (p.kind === 'item') { ok = giveItem(p.item); if (ok) Audio.sfx('pickup'); }
      else { ok = giveStack(p.key, p.qty); if (ok) Audio.sfx('pickup'); }
      if (ok) { G.scene.remove(p.mesh); pickups.splice(i, 1); continue; }
      p.age = -2; // bag full: wait before trying again
    }
    p.mesh.position.set(p.x, p.y + (p.vy === 0 && p.kind !== 'gold' ? Math.sin(elapsed * 3 + i) * 0.15 : 0), p.z);
    p.mesh.rotation.y += dt * 3;
    if (p.age > 300) { G.scene.remove(p.mesh); pickups.splice(i, 1); }
  }
}
export { makeStack };
