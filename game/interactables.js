// Things to find and use: shrines, chests, memory shards, herbs, vistas, rifts, quest objects.
import * as THREE from 'three';
import { G } from './state.js';
import { SHRINES, PLACES, groundY, mat, ZONES, zoneAt, isNight } from './world.js';
import { CHESTS, SHARDS, VISTAS, HERBS, RIFT_SPOTS } from './data.js';
import { glowTexture, seeded, bus } from './util.js';
import { S, grantXP, giveStack, giveItem, grantBond, checkPassive } from './story.js';
import { randomLoot, makeStack } from './items.js';
import { dropItem, dropCoins, dropStack } from './loot.js';
import { spawnGroup } from './enemies.js';
import { sparks, ring, pillar } from './fx.js';
import { hit } from './input.js';
import * as UI from './ui.js';
import * as Audio from './audio.js';

const objs = {};
let current = null;

function glowSprite(color, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(THREE, color), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity }));
  s.scale.set(size, size, 1);
  return s;
}

function reg(o) { G.interactables.push(o); return o; }

export function initInteractables() {
  const W = G.save.world;
  // ---- lantern shrines: light them to unlock fast travel and a respawn point
  for (const s of SHRINES) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.7, 0.8, 6), mat(0x8a8478)); base.position.y = 0.4; g.add(base);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.6, 0.5), mat(0x7a7468)); post.position.y = 2.1; g.add(post);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.8, 4), mat(0x5a3d28)); roof.position.y = 4.2; roof.rotation.y = Math.PI / 4; g.add(roof);
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x555048, emissive: 0xffa040, emissiveIntensity: 0, flatShading: true });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), lampMat); lamp.position.y = 3.5; g.add(lamp);
    const glow = glowSprite('#ffb050', 7, 0); glow.position.y = 3.5; g.add(glow);
    g.position.set(s.x, groundY(s.x, s.z), s.z);
    g.traverse((o) => { o.castShadow = true; });
    G.scene.add(g);
    G.colliders.addCircle(s.x, s.z, 1.5);
    objs['shrine:' + s.id] = { g, lampMat, glow };
    reg({
      id: 'shrine:' + s.id, x: s.x, z: s.z, r: 3.4,
      label: () => (W.shrines.includes(s.id) ? `Rest at ${s.name}` : `Light ${s.name}`),
      active: () => s.id !== 'old' || G.save.fox.joined,
      action: () => {
        if (!W.shrines.includes(s.id)) {
          W.shrines.push(s.id);
          Audio.sfx('shrine');
          pillar(s.x, s.z, 0xffc070, 20, 1.8);
          ring(s.x, s.z, 0xffc070, 8, 0.8);
          UI.questBanner('Shrine lit', s.name);
          UI.toast('Fast travel unlocked here. Open the map (M) to travel between lit shrines.', 'info');
          grantXP(60 + W.shrines.length * 25);
          grantBond(6);
          checkPassive();
        } else UI.toast('You rest by the warm lantern. Health and spirit restored.', 'info');
        G.save.player.respawn = { x: s.x, z: s.z };
        G.player.healFull();
        bus.emit('interact', 'shrine:' + s.id);
        S.save();
      },
    });
  }

  // ---- chests
  for (const c of CHESTS) {
    const g = new THREE.Group();
    const col = [0x7a5a3a, 0x5a7a4a, 0x3a5a8a, 0x6a3a8a][c.tier];
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.8), mat(col)); box.position.y = 0.35; g.add(box);
    const lid = new THREE.Group(); lid.position.set(0, 0.7, -0.4);
    const lm = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.3, 0.84), mat(col)); lm.position.set(0, 0.15, 0.42); lid.add(lm);
    g.add(lid);
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.12, 0.86), mat(0xc8962e, { metalness: 0.7, roughness: 0.3 })); band.position.y = 0.55; g.add(band);
    const glow = glowSprite(['#ffd28a', '#9fffb0', '#9fd0ff', '#e0b0ff'][c.tier], c.hidden ? 2.5 : 3.5, 0.6); glow.position.y = 1; g.add(glow);
    g.position.set(c.x, groundY(c.x, c.z), c.z);
    g.rotation.y = c.x * 0.37;
    G.scene.add(g);
    const opened = W.chests.includes(c.id);
    if (opened) { lid.rotation.x = -1.9; glow.visible = false; }
    objs['chest:' + c.id] = { g, lid, glow };
    reg({
      id: 'chest:' + c.id, x: c.x, z: c.z, r: 2.6,
      label: () => 'Open chest', active: () => !W.chests.includes(c.id),
      action: () => {
        W.chests.push(c.id); G.save.stats.chests++;
        lid.rotation.x = -1.9; glow.visible = false;
        Audio.sfx('chest');
        sparks(c.x, groundY(c.x, c.z) + 1, c.z, 0xffd28a, 30, 5, 0.9);
        const lvl = Math.max(G.save.player.level, zoneAt(c.x, c.z).lvl[0]);
        dropItem(c.x, c.z, randomLoot(lvl, c.tier + 1, c.tier));
        if (c.tier >= 2) dropItem(c.x, c.z, randomLoot(lvl, c.tier, Math.max(1, c.tier - 1)));
        dropCoins(c.x, c.z, 15 + lvl * 6 * (c.tier + 1));
        if (Math.random() < 0.5) dropStack(c.x, c.z, 'tonic', 1);
        grantXP(20 + c.tier * 30);
        if (c.hidden) UI.toast('A hidden chest! Not many find this one.', 'info');
        S.save();
      },
    });
  }

  // ---- memory shards: the fox's past
  SHARDS.forEach((sh, i) => {
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), new THREE.MeshStandardMaterial({ color: 0xbfe8ff, emissive: 0x7fd0ff, emissiveIntensity: 1.2, flatShading: true, transparent: true, opacity: 0.9 }));
    const glow = glowSprite('#9fe8ff', 4, 0.8);
    crystal.add(glow);
    crystal.position.set(sh.x, groundY(sh.x, sh.z) + 1.4, sh.z);
    crystal.visible = !W.shards.includes(i);
    G.scene.add(crystal);
    objs['shard:' + i] = { crystal };
    reg({
      id: 'shard:' + i, x: sh.x, z: sh.z, r: 2.6,
      label: () => 'Touch the memory shard', active: () => !W.shards.includes(i),
      action: () => {
        if (!G.save.fox.joined) { UI.toast('The shard hums, but nothing happens. As if it is waiting for someone.', 'info'); return; }
        W.shards.push(i); crystal.visible = false;
        Audio.sfx('discover');
        sparks(sh.x, groundY(sh.x, sh.z) + 1.4, sh.z, 0x9fe8ff, 40, 4, 1.4);
        grantBond(25);
        grantXP(80);
        UI.memory(sh.text, W.shards.length);
        checkPassive();
        S.save();
      },
    });
  });

  // ---- moonpetals (respawn each day)
  HERBS.forEach(([x, z], i) => {
    const g = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const petal = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 4), new THREE.MeshStandardMaterial({ color: 0xdff0ff, emissive: 0x9fd0ff, emissiveIntensity: 0.6, flatShading: true }));
      petal.position.set(Math.cos(k * 1.26) * 0.15, 0.35, Math.sin(k * 1.26) * 0.15);
      petal.rotation.z = Math.cos(k * 1.26) * 0.6; petal.rotation.x = Math.sin(k * 1.26) * 0.6;
      g.add(petal);
    }
    const glow = glowSprite('#cfe6ff', 2, 0.5); glow.position.y = 0.4; g.add(glow);
    g.position.set(x, groundY(x, z), z);
    G.scene.add(g);
    objs['herb:' + i] = { g, glow };
    reg({
      id: 'herb:' + i, x, z, r: 2.2,
      label: () => 'Pick moonpetal', active: () => (W.herbs[i] || 0) < G.day,
      action: () => { W.herbs[i] = G.day; giveStack('moonpetal', 1); Audio.sfx('pickup'); grantXP(6); },
    });
  });

  // ---- vistas
  for (const v of VISTAS) {
    reg({ id: 'vista:' + v.id, x: v.x, z: v.z, r: 0, label: () => '', active: () => false, action: () => {} });
  }

  // ---- notice board
  reg({ id: 'board', x: PLACES.board.x, z: PLACES.board.z, r: 3, label: () => 'Read the notice board', active: () => true, action: () => UI.openBoard() });
  // ---- smithy anvil shortcut
  reg({ id: 'anvil', x: PLACES.smithy.x + 2.5, z: PLACES.smithy.z + 2, r: 2.2, label: () => 'Use the forge', active: () => true, action: () => UI.openForge() });

  // ---- quest objects
  reg({
    id: 'foxRescue', x: -45, z: 9, r: 3,
    label: () => 'Help the injured fox', active: () => S.qStep('m1') === 3,
    action: () => UI.nameFox((name) => {
      G.save.fox.name = name; G.save.fox.joined = true;
      sparks(-45, groundY(-45, 9) + 1, 9, 0xffb547, 50, 5, 1.4);
      ring(-45, 9, 0xffb547, 5, 0.8);
      Audio.sfx('bond');
      bus.emit('interact', 'foxRescue');
      UI.foxSays(`${name} limps to its feet and presses its nose into your hand. It will follow you now.`);
      UI.toast(`Press F near ${name} to pet it. Your bond grows as you explore and fight together.`, 'info');
      S.save();
    }),
  });
  PLACES.lanternPieces.forEach((p, i) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0xffb547, emissive: 0xff8a20, emissiveIntensity: 0.8, flatShading: true }));
    m.rotation.z = 1.2; m.position.set(p.x, groundY(p.x, p.z) + 0.3, p.z);
    const gl = glowSprite('#ffb050', 3, 0.8); m.add(gl);
    G.scene.add(m);
    objs['piece:' + i] = { m };
    reg({
      id: 'piece:' + i, x: p.x, z: p.z, r: 2.4,
      label: () => 'Pick up the lantern piece', active: () => S.qStep('m2') === 1 && !(G.save.world.pieces || []).includes(i),
      action: () => { (G.save.world.pieces ||= []).push(i); giveStack('lanternPiece', 1); Audio.sfx('pickup'); },
    });
  });
  const journalChest = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 0.7), mat(0x3a3a50));
  journalChest.position.set(PLACES.journal.x, groundY(PLACES.journal.x, PLACES.journal.z) + 0.3, PLACES.journal.z);
  G.scene.add(journalChest);
  const jg = glowSprite('#ffb050', 3, 0.8); jg.position.y = 0.8; journalChest.add(jg);
  objs.journal = { jg };
  reg({
    id: 'journal', x: PLACES.journal.x, z: PLACES.journal.z, r: 2.6,
    label: () => 'Search the iron box', active: () => S.qStep('m3') === 3,
    action: () => { giveStack('journal', 1); Audio.sfx('chest'); bus.emit('interact', 'journal'); },
  });
  reg({
    id: 'charmSpot', x: PLACES.charm.x, z: PLACES.charm.z, r: 2.4,
    label: () => 'Something glints in the roots', active: () => S.qStep('s2') === 0,
    action: () => { giveStack('charmLost', 1); Audio.sfx('pickup'); bus.emit('interact', 'charmSpot'); },
  });
  const glint = glowSprite('#ffe6a0', 1.5, 0.9);
  glint.position.set(PLACES.charm.x, groundY(PLACES.charm.x, PLACES.charm.z) + 0.3, PLACES.charm.z);
  G.scene.add(glint); objs.charm = { glint };

  initRifts();
}

// ---------------------------------------------------------------- Echo Rifts
const rifts = [];
function initRifts() {
  for (let i = 0; i < RIFT_SPOTS.length; i++) {
    const [x, z] = RIFT_SPOTS[i];
    const g = new THREE.Group();
    const ringM = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.18, 6, 24), new THREE.MeshBasicMaterial({ color: 0xb59cf2 }));
    ringM.position.y = 2.2; g.add(ringM);
    const core = glowSprite('#b59cf2', 5, 0.9); core.position.y = 2.2; g.add(core);
    g.position.set(x, groundY(x, z), z);
    g.visible = false;
    G.scene.add(g);
    const r = { i, x, z, g, ringM, active: false, running: false, wave: 0, enemies: [] };
    rifts.push(r);
    reg({
      id: 'rift:' + i, x, z, r: 3.5,
      label: () => 'Enter the Echo Rift', active: () => r.active && !r.running,
      action: () => startRift(r),
    });
  }
  refreshRifts();
  bus.on('newDay', refreshRifts);
}
export function refreshRifts() {
  const unlocked = S.questDone('m3');
  const rnd = seeded(G.day * 7 + 3);
  const a = Math.floor(rnd() * RIFT_SPOTS.length);
  let b = Math.floor(rnd() * RIFT_SPOTS.length); if (b === a) b = (a + 1) % RIFT_SPOTS.length;
  const cleared = G.save.world.rifts || [];
  for (const r of rifts) {
    r.active = unlocked && (r.i === a || r.i === b) && !cleared.includes(`${G.day}:${r.i}`);
    r.g.visible = r.active;
  }
}
export const activeRifts = () => rifts.filter((r) => r.active);

function startRift(r) {
  r.running = true; r.wave = 0;
  UI.questBanner('Echo Rift', 'Survive three waves');
  Audio.sfx('roar');
  nextWave(r);
}
function nextWave(r) {
  r.wave++;
  const lvl = G.save.player.level + Math.min(G.save.world.riftsCleared, 6);
  const types = ['wisp', 'husk', 'eater'];
  r.enemies = [];
  for (let k = 0; k < 2 + r.wave; k++) r.enemies.push(...spawnGroup({ type: types[(k + r.wave) % 3], n: 1, x: r.x + Math.cos(k * 2.1) * 6, z: r.z + Math.sin(k * 2.1) * 6, lvl, tag: 'rift', aggro: true }));
  if (r.wave === 3) r.enemies.push(...spawnGroup({ type: G.save.player.level >= 8 ? 'brute' : 'husk', n: 1, x: r.x, z: r.z + 4, lvl: lvl + 1, tag: 'rift', aggro: true, elite: 'Rift Champion' }));
  UI.toast(`Wave ${r.wave} of 3`, 'warn');
}

function updateRifts(dt, t) {
  for (const r of rifts) {
    if (!r.g.visible) continue;
    r.ringM.rotation.y += dt * 1.5; r.ringM.rotation.x = Math.sin(t) * 0.3;
    if (!r.running) continue;
    if (Math.hypot(G.player.pos.x - r.x, G.player.pos.z - r.z) > 45 || !G.player.alive) {
      r.running = false; UI.toast('The rift collapses behind you. Try again when you\'re ready.', 'warn');
      for (const e of r.enemies) if (e.alive) { e.alive = false; e.remove(); }
      continue;
    }
    if (r.enemies.every((e) => !e.alive)) {
      if (r.wave < 3) nextWave(r);
      else {
        r.running = false; r.active = false; r.g.visible = false;
        (G.save.world.rifts ||= []).push(`${G.day}:${r.i}`);
        G.save.world.riftsCleared++;
        const lvl = G.save.player.level;
        dropItem(r.x, r.z, randomLoot(lvl + 1, 3, 2));
        dropItem(r.x, r.z, randomLoot(lvl, 2, 1));
        dropCoins(r.x, r.z, 40 + lvl * 12);
        dropStack(r.x, r.z, 'dust', 4);
        grantXP(150 + lvl * 30);
        pillar(r.x, r.z, 0xb59cf2, 24, 2);
        UI.questBanner('Rift cleared', `${G.save.world.riftsCleared} cleared so far`);
        Audio.sfx('complete');
        S.save();
      }
    }
  }
}

// ---------------------------------------------------------------- per-frame
export function updateInteractables(dt, t) {
  const pl = G.player, W = G.save.world;
  // visuals
  for (const s of SHRINES) {
    const o = objs['shrine:' + s.id];
    const lit = W.shrines.includes(s.id);
    o.lampMat.emissiveIntensity = lit ? 1.6 + Math.sin(t * 3) * 0.2 : 0;
    o.glow.material.opacity = lit ? 0.9 : 0;
  }
  SHARDS.forEach((sh, i) => { const c = objs['shard:' + i].crystal; if (c.visible) { c.rotation.y += dt * 1.5; c.position.y = groundY(sh.x, sh.z) + 1.4 + Math.sin(t * 2 + i) * 0.2; } });
  HERBS.forEach((h, i) => { const o = objs['herb:' + i]; o.g.visible = (W.herbs[i] || 0) < G.day; o.glow.material.opacity = isNight() ? 0.9 : 0.35; });
  PLACES.lanternPieces.forEach((p, i) => { objs['piece:' + i].m.visible = S.qStep('m2') === 1 && !(W.pieces || []).includes(i); });
  objs.journal.jg.visible = S.qStep('m3') === 3;
  objs.charm.glint.visible = S.qStep('s2') === 0;
  objs.charm.glint.material.opacity = 0.5 + Math.sin(t * 4) * 0.4;
  updateRifts(dt, t);

  // zone discovery + vistas
  const zone = zoneAt(pl.pos.x, pl.pos.z);
  if (zone.id !== 'wilds' && !W.zones.includes(zone.id)) {
    W.zones.push(zone.id);
    if (zone.id !== 'square') { UI.zoneTitle(zone.name, `Level ${zone.lvl[0]} to ${zone.lvl[1]}`); grantXP(40); Audio.sfx('discover'); }
  }
  for (const v of VISTAS) {
    if (!W.vistas.includes(v.id) && Math.hypot(pl.pos.x - v.x, pl.pos.z - v.z) < 7) {
      W.vistas.push(v.id); UI.zoneTitle(v.name, v.text); grantXP(70); grantBond(8); Audio.sfx('discover');
    }
  }

  // nearest interactable
  if (G.paused || G.inDialogue || !pl.alive) { UI.prompt(null); current = null; return; }
  let best = null, bd = 1e9;
  for (const o of G.interactables) {
    if (!o.r || !o.active()) continue;
    const d = Math.hypot(pl.pos.x - o.x, pl.pos.z - o.z);
    if (d < o.r && d < bd) { bd = d; best = o; }
  }
  current = best;
  UI.prompt(best ? best.label() : null);
  if (best && hit('e')) best.action();
}

export function fastTravel(id) {
  const s = SHRINES.find((x) => x.id === id);
  if (!s || !G.save.world.shrines.includes(id)) return;
  UI.fade(() => {
    G.player.pos.x = s.x + 2.5; G.player.pos.z = s.z + 2.5;
    G.player.y = groundY(G.player.pos.x, G.player.pos.z);
    if (G.fox) { G.fox.pos.x = s.x + 1; G.fox.pos.z = s.z + 3; }
    G.save.player.respawn = { x: s.x, z: s.z };
    G.player.healFull();
  });
}
export { objs, makeStack, giveItem };
