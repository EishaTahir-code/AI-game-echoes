// Low-poly character builders: humanoids, the spirit fox and the hollows.
import * as THREE from 'three';
import { mat } from './world.js';
import { glowTexture } from './util.js';

function m(geo, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

// opts: skin, hair, hairStyle('short'|'bob'|'long'|'bald'|'spiky'|'bun'), coat, coat2, legs, hat, beard, scale, weapon
export function makeHumanoid(o = {}) {
  const g = new THREE.Group();
  const skin = mat(o.skin ?? 0xf1c9a5), hair = mat(o.hair ?? 0x4a3020), coat = mat(o.coat ?? 0x3a4a7a), coat2 = mat(o.coat2 ?? 0xe0a040), legsM = mat(o.legs ?? 0x2e2a30);
  const body = new THREE.Group(); g.add(body);
  // legs
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-0.2, 0.75, 0); legR.position.set(0.2, 0.75, 0);
  legL.add(m(new THREE.CylinderGeometry(0.13, 0.11, 0.75, 5), legsM, 0, -0.37, 0));
  legR.add(m(new THREE.CylinderGeometry(0.13, 0.11, 0.75, 5), legsM, 0, -0.37, 0));
  body.add(legL, legR);
  // torso (coat flares)
  const torso = m(new THREE.CylinderGeometry(0.32, 0.5, 0.95, 6), coat, 0, 1.18, 0);
  body.add(torso);
  const belt = m(new THREE.CylinderGeometry(0.42, 0.44, 0.1, 6), mat(0x3a2a1c), 0, 1.0, 0); body.add(belt);
  const scarf = m(new THREE.TorusGeometry(0.26, 0.09, 4, 8), coat2, 0, 1.62, 0); scarf.rotation.x = Math.PI / 2; body.add(scarf);
  // arms
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(-0.42, 1.55, 0); armR.position.set(0.42, 1.55, 0);
  armL.add(m(new THREE.CylinderGeometry(0.1, 0.09, 0.7, 5), coat, 0, -0.33, 0));
  armR.add(m(new THREE.CylinderGeometry(0.1, 0.09, 0.7, 5), coat, 0, -0.33, 0));
  armL.add(m(new THREE.SphereGeometry(0.1, 5, 4), skin, 0, -0.7, 0));
  armR.add(m(new THREE.SphereGeometry(0.1, 5, 4), skin, 0, -0.7, 0));
  body.add(armL, armR);
  // head
  const head = new THREE.Group(); head.position.y = 2.05; body.add(head);
  head.add(m(new THREE.IcosahedronGeometry(0.4, 1), skin));
  const eyeM = mat(0x1d1a24, { roughness: 0.3 });
  head.add(m(new THREE.SphereGeometry(0.055, 5, 4), eyeM, -0.14, 0.02, 0.36));
  head.add(m(new THREE.SphereGeometry(0.055, 5, 4), eyeM, 0.14, 0.02, 0.36));
  const style = o.hairStyle ?? 'short';
  if (style !== 'bald') {
    const cap = m(new THREE.SphereGeometry(0.44, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 0.04, -0.02);
    head.add(cap);
    if (style === 'bob' || style === 'long') {
      const back = m(new THREE.CylinderGeometry(0.42, style === 'long' ? 0.36 : 0.44, style === 'long' ? 0.9 : 0.5, 7, 1, true), hair, 0, style === 'long' ? -0.3 : -0.12, -0.06);
      back.material = hair; head.add(back);
      const fr = m(new THREE.BoxGeometry(0.7, 0.14, 0.12), hair, 0, 0.26, 0.33); head.add(fr);
    }
    if (style === 'spiky') for (let i = 0; i < 6; i++) { const sp = m(new THREE.ConeGeometry(0.12, 0.35, 4), hair, Math.cos(i) * 0.25, 0.35, Math.sin(i) * 0.25 - 0.05); sp.rotation.z = -Math.cos(i) * 0.6; sp.rotation.x = Math.sin(i) * 0.6; head.add(sp); }
    if (style === 'bun') head.add(m(new THREE.SphereGeometry(0.18, 6, 5), hair, 0, 0.32, -0.32));
  }
  if (o.beard) head.add(m(new THREE.ConeGeometry(0.28, 0.45, 6), hair, 0, -0.32, 0.18));
  if (o.hat === 'wide') { const brim = m(new THREE.CylinderGeometry(0.75, 0.75, 0.06, 10), mat(o.hatColor ?? 0x6a5038), 0, 0.3, 0); head.add(brim); head.add(m(new THREE.CylinderGeometry(0.34, 0.4, 0.35, 8), mat(o.hatColor ?? 0x6a5038), 0, 0.5, 0)); }
  if (o.hat === 'helm') { head.add(m(new THREE.SphereGeometry(0.47, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(0x9aa0a8, { metalness: 0.7, roughness: 0.35 }), 0, 0.05, 0)); head.add(m(new THREE.ConeGeometry(0.06, 0.4, 4), mat(0xb03030), 0, 0.55, 0)); }
  if (o.hat === 'veil') head.add(m(new THREE.ConeGeometry(0.55, 0.9, 8, 1, true), mat(0x2a2030, { side: THREE.DoubleSide }), 0, 0.15, -0.05));
  if (o.apron) body.add(m(new THREE.BoxGeometry(0.62, 0.8, 0.06), mat(o.apron), 0, 1.05, 0.38));
  // weapon / prop in right hand
  let weapon = null;
  if (o.weapon === 'sword') {
    weapon = new THREE.Group();
    weapon.add(m(new THREE.BoxGeometry(0.09, 1.2, 0.03), mat(0xd8e0ea, { metalness: 0.8, roughness: 0.25 }), 0, 0.75, 0));
    weapon.add(m(new THREE.BoxGeometry(0.36, 0.07, 0.1), mat(0xc8962e, { metalness: 0.6 }), 0, 0.15, 0));
    weapon.add(m(new THREE.CylinderGeometry(0.04, 0.04, 0.28, 5), mat(0x3a2a1c), 0, 0, 0));
    weapon.position.set(0, -0.7, 0.05);
    weapon.rotation.x = Math.PI / 2;
    armR.add(weapon);
  } else if (o.weapon === 'lute') {
    const lute = new THREE.Group();
    lute.add(m(new THREE.SphereGeometry(0.28, 7, 5), mat(0xb5793a), 0, 0, 0));
    lute.add(m(new THREE.BoxGeometry(0.08, 0.6, 0.05), mat(0x5a3d28), 0, 0.4, 0));
    lute.position.set(0.05, 1.15, 0.38); lute.rotation.z = 0.8; body.add(lute);
  } else if (o.weapon === 'hammer') {
    const hm = new THREE.Group();
    hm.add(m(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 5), mat(0x5a3d28), 0, 0.2, 0));
    hm.add(m(new THREE.BoxGeometry(0.3, 0.18, 0.18), mat(0x5a5a60, { metalness: 0.7 }), 0, 0.55, 0));
    hm.position.set(0, -0.7, 0); armR.add(hm);
  } else if (o.weapon === 'pole') {
    const pole = m(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 5), mat(0x6a5038), 0, -0.4, 0.3);
    pole.rotation.x = 0.3; armR.add(pole);
  } else if (o.weapon === 'spear') {
    const sp = new THREE.Group();
    sp.add(m(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 5), mat(0x6a5038), 0, 0.4, 0));
    sp.add(m(new THREE.ConeGeometry(0.08, 0.35, 4), mat(0xc0c8d0, { metalness: 0.7 }), 0, 1.85, 0));
    sp.position.set(0, -0.7, 0); armR.add(sp);
  }
  g.scale.setScalar(o.scale ?? 1);
  g.userData = { body, legL, legR, armL, armR, head, torso, weapon };
  return g;
}

// Walk / idle animation shared by humanoids.
export function animateHumanoid(g, t, speed, extra = {}) {
  const u = g.userData;
  const s = Math.min(speed / 6, 1.4);
  const sw = Math.sin(t * 9) * 0.7 * s;
  u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
  if (!extra.attacking) { u.armL.rotation.x = -sw * 0.8; u.armR.rotation.x = sw * 0.8; u.armR.rotation.z = 0; }
  u.body.position.y = Math.abs(Math.sin(t * 9)) * 0.08 * s + Math.sin(t * 2) * 0.015;
  u.head.rotation.y = extra.look ?? 0;
}

export function makeFox() {
  const g = new THREE.Group();
  const fur = mat(0xf08a3c), cream = mat(0xfbe6c8), dark = mat(0x3a2a24);
  const body = new THREE.Group(); g.add(body);
  const torso = m(new THREE.SphereGeometry(0.42, 8, 6), fur, 0, 0.62, 0); torso.scale.set(0.9, 0.8, 1.35); body.add(torso);
  const chest = m(new THREE.SphereGeometry(0.28, 6, 5), cream, 0, 0.62, 0.42); body.add(chest);
  const head = new THREE.Group(); head.position.set(0, 1.0, 0.55); body.add(head);
  head.add(m(new THREE.IcosahedronGeometry(0.3, 1), fur));
  const snout = m(new THREE.ConeGeometry(0.15, 0.36, 6), cream, 0, -0.06, 0.32); snout.rotation.x = Math.PI / 2; head.add(snout);
  head.add(m(new THREE.SphereGeometry(0.05, 5, 4), dark, 0, -0.04, 0.5));
  for (const sx of [-0.15, 0.15]) {
    const ear = m(new THREE.ConeGeometry(0.11, 0.3, 4), fur, sx, 0.3, -0.02); ear.rotation.z = -sx * 1.2; head.add(ear);
    head.add(m(new THREE.SphereGeometry(0.045, 5, 4), mat(0x1d1a24), sx * 0.85, 0.06, 0.25));
  }
  const legs = [];
  for (const [sx, sz] of [[-0.2, 0.32], [0.2, 0.32], [-0.2, -0.32], [0.2, -0.32]]) {
    const leg = new THREE.Group(); leg.position.set(sx, 0.45, sz);
    leg.add(m(new THREE.CylinderGeometry(0.07, 0.06, 0.45, 5), fur, 0, -0.22, 0));
    leg.add(m(new THREE.SphereGeometry(0.07, 5, 4), dark, 0, -0.44, 0));
    body.add(leg); legs.push(leg);
  }
  // tail: three segments with a spirit-fire tip
  const tail = new THREE.Group(); tail.position.set(0, 0.75, -0.55); body.add(tail);
  const t1 = m(new THREE.ConeGeometry(0.22, 0.7, 6), fur, 0, 0, -0.3); t1.rotation.x = -Math.PI / 2 - 0.5; tail.add(t1);
  const tipMat = new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffa040, emissiveIntensity: 1.4, flatShading: true });
  const tip = m(new THREE.SphereGeometry(0.2, 6, 5), tipMat, 0, 0.35, -0.62); tail.add(tip);
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(THREE, '#ffb050'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
  aura.scale.set(1.4, 1.4, 1); aura.position.copy(tip.position); tail.add(aura);
  g.userData = { body, head, legs, tail, tip, tipMat, aura };
  return g;
}

export function makeEnemy(type) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const eyeCol = { wisp: 0x9ff5ff, husk: 0xff7a4a, eater: 0xffd36a, brute: 0xff4a6a, knight: 0x7fffd4, warden: 0xff5a3a }[type];
  const eyeMat = new THREE.MeshBasicMaterial({ color: eyeCol });
  const skin = new THREE.MeshStandardMaterial({ color: type === 'knight' ? 0x2a4a4a : 0x2a2238, emissive: 0x000000, flatShading: true, roughness: 0.6 });
  let height = 1.5, radius = 0.6;
  const eyes = (y, z, sp = 0.18, r = 0.08) => { body.add(m(new THREE.SphereGeometry(r, 5, 4), eyeMat, -sp, y, z)); body.add(m(new THREE.SphereGeometry(r, 5, 4), eyeMat, sp, y, z)); };
  if (type === 'wisp') {
    const b = m(new THREE.IcosahedronGeometry(0.55, 0), skin, 0, 1.3, 0); body.add(b);
    const tail = m(new THREE.ConeGeometry(0.4, 1.0, 5), skin, 0, 0.6, -0.1); tail.rotation.x = Math.PI; body.add(tail);
    eyes(1.38, 0.45, 0.18, 0.09); height = 1.8; radius = 0.6;
  } else if (type === 'husk' || type === 'brute') {
    const s = type === 'brute' ? 1.5 : 1;
    const b = m(new THREE.DodecahedronGeometry(0.8 * s, 0), skin, 0, 1.0 * s, 0); b.scale.set(1, 1.1, 0.9); body.add(b);
    const h = m(new THREE.IcosahedronGeometry(0.42 * s, 0), skin, 0, 1.95 * s, 0.25 * s); body.add(h);
    for (const sx of [-1, 1]) { const arm = m(new THREE.BoxGeometry(0.3 * s, 1.2 * s, 0.3 * s), skin, sx * 0.85 * s, 0.75 * s, 0.1); arm.rotation.z = sx * 0.2; body.add(arm); }
    eyes(2.0 * s, 0.6 * s, 0.15 * s, 0.07 * s); height = 2.4 * s; radius = 0.85 * s;
    if (type === 'brute') for (let i = 0; i < 4; i++) { const sp = m(new THREE.ConeGeometry(0.15, 0.7, 4), skin, -0.6 + i * 0.4, 2.3, -0.4); sp.rotation.x = -0.5; body.add(sp); }
  } else if (type === 'eater') {
    const b = m(new THREE.SphereGeometry(0.7, 7, 5), skin, 0, 1.8, 0); body.add(b);
    const lantern = m(new THREE.SphereGeometry(0.3, 6, 5), new THREE.MeshStandardMaterial({ color: 0xffc060, emissive: 0xff9030, emissiveIntensity: 1.5 }), 0, 1.65, 0.45); body.add(lantern);
    for (let i = 0; i < 5; i++) { const tn = m(new THREE.ConeGeometry(0.12, 1.1, 4), skin, Math.cos(i * 1.26) * 0.4, 0.9, Math.sin(i * 1.26) * 0.4); tn.rotation.x = Math.PI; body.add(tn); }
    eyes(2.05, 0.55, 0.22, 0.08); height = 2.5; radius = 0.7;
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(THREE, '#ffb050'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 }));
    gl.position.set(0, 1.65, 0.5); gl.scale.set(1.6, 1.6, 1); body.add(gl);
  } else if (type === 'knight') {
    const k = makeHumanoid({ skin: 0x2a4a4a, coat: 0x2f4f5a, coat2: 0x1a2a2a, legs: 0x1a2a30, hairStyle: 'bald', hat: 'helm', weapon: 'sword', scale: 1.7 });
    body.add(k); g.userData.humanoid = k;
    eyes(3.55, 0.62, 0.22, 0.09); height = 4; radius = 1.0;
  } else if (type === 'warden') {
    const s = 3.2;
    const b = m(new THREE.DodecahedronGeometry(0.85 * s, 0), skin, 0, 1.1 * s, 0); b.scale.set(1.1, 1.0, 0.9); body.add(b);
    const h = m(new THREE.IcosahedronGeometry(0.45 * s, 0), skin, 0, 2.05 * s, 0.35 * s); body.add(h);
    for (const sx of [-1, 1]) {
      const arm = m(new THREE.BoxGeometry(0.4 * s, 1.5 * s, 0.4 * s), skin, sx * 1.0 * s, 0.8 * s, 0.2 * s); arm.rotation.z = sx * 0.25; body.add(arm);
      for (let i = 0; i < 3; i++) { const br = m(new THREE.CylinderGeometry(0.05 * s, 0.09 * s, 1.2 * s, 4), mat(0x3a3328), sx * (0.3 + i * 0.2) * s, 2.6 * s, -0.1 * s); br.rotation.z = sx * (0.5 + i * 0.3); body.add(br); }
    }
    const cage = m(new THREE.OctahedronGeometry(0.5 * s, 0), new THREE.MeshStandardMaterial({ color: 0xffc060, emissive: 0xff7a20, emissiveIntensity: 1.6, flatShading: true }), 0, 1.6 * s, -0.75 * s);
    body.add(cage);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(THREE, '#ff9a40'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
    gl.position.copy(cage.position); gl.scale.set(6, 6, 1); body.add(gl);
    eyes(2.1 * s, 0.75 * s, 0.17 * s, 0.07 * s); height = 8; radius = 2.6;
  }
  // soft dark shadow blob so floaters read as grounded
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.9, 12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.05; g.add(shadow);
  g.userData.body = body; g.userData.skin = skin; g.userData.height = height; g.userData.radius = radius;
  return g;
}

export function makeTelegraph(radius, color = 0xff4a3a) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.92, radius, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  const fill = new THREE.Mesh(new THREE.CircleGeometry(radius, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
  fill.rotation.x = -Math.PI / 2;
  const g = new THREE.Group(); g.add(ring, fill);
  g.userData.fill = fill;
  return g;
}
