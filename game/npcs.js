// Townsfolk in the world: models, name labels, quest markers, portraits.
import * as THREE from 'three';
import { G } from './state.js';
import { NPCS, QUESTS } from './data.js';
import { makeHumanoid, animateHumanoid, makeFox } from './models.js';
import { groundY } from './world.js';
import { textSprite, angleDiff } from './util.js';
import { openDialogue } from './dialogue.js';

export function initNPCs() {
  for (const [id, def] of Object.entries(NPCS)) {
    const model = makeHumanoid(def.look);
    const y = groundY(def.pos.x, def.pos.z);
    model.position.set(def.pos.x, y, def.pos.z);
    model.rotation.y = def.face;
    G.scene.add(model);
    const label = textSprite(THREE, def.name, { size: 30 });
    label.position.y = 2.9 * (def.look.scale || 1); model.add(label);
    const markerNew = textSprite(THREE, '!', { size: 72, color: '#ffb547' });
    const markerTurn = textSprite(THREE, '?', { size: 72, color: '#9fe8ff' });
    for (const mk of [markerNew, markerTurn]) { mk.position.y = 3.6; mk.visible = false; model.add(mk); }
    G.colliders.addCircle(def.pos.x, def.pos.z, 0.6);
    G.npcs[id] = { id, def, model, label, markerNew, markerTurn, face: def.face, t: Math.random() * 10 };
    G.interactables.push({
      id: 'npc:' + id, x: def.pos.x, z: def.pos.z, r: 3.2,
      label: () => `Talk to ${def.name}`, active: () => true,
      action: () => openDialogue(id),
    });
  }
  makePortraits();
}

export function npcMarker(id) {
  // '!' when this person has a new quest for you, '?' when you have something to tell them
  for (const [qid, q] of Object.entries(G.save.quests)) {
    if (q.state !== 'active') continue;
    const st = QUESTS[qid].steps[q.step];
    if (st && st.type === 'talk' && st.npc === id) return q.step === 0 ? 'new' : 'turn';
  }
  if (id === 'sora' && G.save.quests.m1?.state === 'done' && !G.save.quests.s3) return 'new';
  if (id === 'hild' && !G.save.quests.s6) return 'new';
  if (id === 'ruel' && G.save.quests.m4?.state === 'done' && !G.save.quests.s4) return 'new';
  if (id === 'mira' && G.save.quests.s1?.state === 'active' && G.save.quests.s1.step === 1) return 'turn';
  if (id === 'sora' && G.save.quests.s3?.state === 'active' && G.save.quests.s3.step === 1) return 'turn';
  if (id === 'hild' && G.save.quests.s6?.state === 'active' && G.save.quests.s6.step === 1) return 'turn';
  return null;
}

export function updateNPCs(dt) {
  const pl = G.player;
  for (const n of Object.values(G.npcs)) {
    n.t += dt;
    const dx = pl.pos.x - n.def.pos.x, dz = pl.pos.z - n.def.pos.z, d = Math.hypot(dx, dz);
    const target = d < 7 ? Math.atan2(dx, dz) : n.def.face;
    n.face += angleDiff(n.face, target) * Math.min(dt * 4, 1);
    n.model.rotation.y = n.face;
    animateHumanoid(n.model, n.t, 0);
    if (n.id === 'sora' && G.save.quests.m6?.state === 'done') n.model.userData.body.rotation.z = Math.sin(n.t * 2) * 0.06;
    const mk = npcMarker(n.id);
    const talking = G.inDialogue && G.talkTarget === n.def.pos;
    n.markerNew.visible = mk === 'new' && !talking;
    n.markerTurn.visible = mk === 'turn' && !talking;
    const bob = Math.sin(n.t * 3) * 0.12;
    n.markerNew.position.y = n.markerTurn.position.y = 3.6 + bob;
    n.label.visible = d < 22 && !talking;
  }
}

// Render each character's head once into an image for the dialogue box.
function makePortraits() {
  let r;
  try {
    r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch (e) { return; }
  r.setSize(256, 256);
  r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6));
  const key = new THREE.DirectionalLight(0xfff0dc, 2.2); key.position.set(2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fd0ff, 1.2); rim.position.set(-3, 2, -2); scene.add(rim);
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  const shoot = (model, y, dist, look) => {
    scene.add(model);
    cam.position.set(0.35, y + 0.1, dist); cam.lookAt(0, look, 0);
    r.render(scene, cam);
    const url = r.domElement.toDataURL('image/png');
    scene.remove(model);
    return url;
  };
  for (const def of Object.values(NPCS)) {
    const m = makeHumanoid({ ...def.look, scale: 1, weapon: def.look.weapon === 'lute' ? 'lute' : null });
    m.rotation.y = -0.25;
    def.portrait = shoot(m, 1.95, 3.2, 1.75);
  }
  const f = makeFox(); f.rotation.y = 0.45;
  G.foxPortrait = shoot(f, 1.15, 2.9, 0.85);
  r.dispose();
  if (r.forceContextLoss) r.forceContextLoss();
}
