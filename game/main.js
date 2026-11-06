// Boot, title screen and the main loop.
import * as THREE from 'three';
import { G, DAY_LENGTH, freshSave } from './state.js';
import { buildWorld, updateWorld, updateWater, isNight, setShadowQuality, groundY } from './world.js';
import { initFX, updateFX, clearProjectiles } from './fx.js';
import { initInput, input, endFrame, hit, requestLock } from './input.js';
import { Player } from './player.js';
import { Fox } from './fox.js';
import { initEnemies, updateEnemies, resetEnemiesNearPlayer } from './enemies.js';
import { updateLoot } from './loot.js';
import { initNPCs, updateNPCs } from './npcs.js';
import { initInteractables, updateInteractables, fastTravel, activeRifts } from './interactables.js';
import { initDialogue, updateDialogue, dialogueOpen } from './dialogue.js';
import * as UI from './ui.js';
import * as Audio from './audio.js';
import { S, updateStory, onDawn, makeBounties, respawnActiveQuestEnemies, checkDeeds } from './story.js';
import { hasSave, loadSave, writeSave, deleteSave, loadSettings, saveSettings } from './save.js';
import { bus } from './util.js';
import { makeGear, makeStack, addItem } from './items.js';

G.THREE = THREE;
loadSettings();

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, G.settings.quality === 'high' ? 2 : 1.25));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
G.renderer = renderer;
G.scene = new THREE.Scene();
G.camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 900);
G.camera.position.set(40, 30, 80);
G.clock = new THREE.Clock();
G.save = freshSave(); // placeholder so the world can draw behind the title screen

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  G.camera.aspect = innerWidth / innerHeight;
  G.camera.updateProjectionMatrix();
});

const loading = document.getElementById('loading');
const titleEl = document.getElementById('title-screen');

// Build the world in the next frame so the loading text paints first.
requestAnimationFrame(() => setTimeout(boot, 30));

function boot() {
  buildWorld();
  initFX();
  initInput(canvas);
  initDialogue();
  UI.initUI();
  UI.setTravel(fastTravel);
  UI.setRiftSource(() => activeRifts());
  UI.setSettingsHandlers({
    change: (k) => { saveSettings(); if (k === 'quality') { setShadowQuality(G.settings.quality); renderer.shadowMap.enabled = G.settings.quality !== 'low'; } },
    quit: () => { writeSave(); location.reload(); },
  });
  setShadowQuality(G.settings.quality);
  renderer.shadowMap.enabled = G.settings.quality !== 'low';
  loading.classList.add('done');
  showTitle();
  requestAnimationFrame(loop);
}

function showTitle() {
  titleEl.classList.add('open');
  const cont = document.getElementById('btn-continue');
  const saved = hasSave();
  cont.hidden = !saved;
  if (saved) {
    const s = loadSave();
    cont.querySelector('small').textContent = s ? `Level ${s.player.level}, day ${s.day}${s.fox.joined ? `, with ${s.fox.name}` : ''}` : '';
  }
  document.getElementById('btn-new').onclick = () => {
    if (saved && !confirm('Start a new journey? Your current progress will be replaced.')) return;
    deleteSave();
    startGame(freshSave(), true);
  };
  cont.onclick = () => { const s = loadSave(); if (s) startGame(s, false); };
}

function startGame(save, isNew) {
  Audio.initAudio();
  G.save = save;
  G.time = save.time; G.day = save.day;
  initInteractables();
  initNPCs();
  G.player = new Player();
  G.fox = new Fox();
  initEnemies();
  titleEl.classList.remove('open');
  document.body.classList.add('playing');
  G.started = true;
  G.camera.position.set(G.player.pos.x, G.player.y + 6, G.player.pos.z + 10);
  if (isNew) {
    // a traveler's kit
    const blade = makeGear('weapon', 1, 0); blade.name = 'Driftwood Blade'; blade.stats = { atk: 5 };
    const coat = makeGear('armor', 1, 0); coat.name = 'Traveler\'s Coat'; coat.stats = { def: 2, hp: 12 };
    G.save.equipped.weapon = blade; G.save.equipped.armor = coat;
    addItem(makeStack('tonic', 2));
    G.player.recompute(); G.player.healFull();
    S.startQuest('m1');
    UI.zoneTitle('Lanternmere', 'Festival week, the third night since Lord Aurel drowned');
    setTimeout(() => UI.toast('Click the game to look around. WASD to move. Talk to Mira, she is waving you over.', 'info'), 2600);
  } else {
    respawnActiveQuestEnemies();
    UI.toast(`Welcome back. Day ${G.day} in Lanternmere.`, 'info');
  }
  if (save.bounties.day !== G.day) makeBounties();
  checkDeeds();
  writeSave();
}

bus.on('save', () => writeSave());
bus.on('respawn', (lost) => {
  resetEnemiesNearPlayer();
  clearProjectiles();
  if (G.fox) { G.fox.pos.x = G.player.pos.x + 1.5; G.fox.pos.z = G.player.pos.z + 1; }
  UI.toast(lost ? `You lost ${lost} gold.` : 'You wake by the shrine.', 'warn');
  writeSave();
});
bus.on('itemsChanged', () => { if (G.player) G.player.recompute(); UI.refreshPanel?.(); });

canvas.addEventListener('click', () => {
  if (!G.started || G.paused || G.inDialogue) return;
  Audio.initAudio();
  requestLock(canvas);
});
document.getElementById('lock-hint').addEventListener('click', () => requestLock(canvas));

let saveTimer = 20, elapsed = 0, titleT = 0;
function loop() {
  requestAnimationFrame(loop);
  let dt = Math.min(G.clock.getDelta(), 0.05);
  elapsed += dt;

  if (!G.started) {
    // title screen: drift slowly over the lake at dusk
    titleT += dt;
    G.time = 0.77 + Math.sin(titleT * 0.03) * 0.02;
    const a = titleT * 0.04;
    G.camera.position.set(70 + Math.cos(a) * 70, 22 + Math.sin(a * 0.7) * 4, 30 + Math.sin(a) * 70);
    G.camera.lookAt(80, 6, 0);
    updateWorld(dt, elapsed);
    updateWater(elapsed);
    renderer.render(G.scene, G.camera);
    return;
  }

  // keyboard shortcuts for menus
  if (!dialogueOpen() && !UI.modalOpen()) {
    if (hit('c') || hit('i') || hit('Tab')) UI.togglePanel('character');
    if (hit('j')) UI.togglePanel('journal');
    if (hit('m')) UI.togglePanel('map');
    if (hit('Escape')) { if (UI.isPanelOpen()) UI.closePanel(); else UI.openPanel('settings'); }
  }

  const simDt = G.paused ? 0 : (G.hitStop > 0 ? dt * 0.08 : dt);
  G.hitStop = Math.max(0, G.hitStop - dt);

  if (!G.paused) {
    G.save.stats.playSeconds += dt;
    const before = G.time;
    G.time += simDt / DAY_LENGTH;
    if (G.time >= 1) { G.time -= 1; G.day++; }
    if (before < 0.25 && G.time >= 0.25) onDawn();
    G.player.update(simDt);
    G.fox.update(simDt);
    updateEnemies(simDt);
    updateLoot(simDt, elapsed);
    updateNPCs(simDt);
    updateStory(simDt);
    updateFX(simDt);
  }
  updateInteractables(dt, elapsed);
  updateDialogue(dt);
  updateWorld(simDt, elapsed);
  updateWater(elapsed);
  Audio.setMood(isNight() ? 'night' : 'day');
  Audio.updateAudio();
  UI.updateHUD(dt);

  saveTimer -= dt;
  if (saveTimer <= 0) { saveTimer = 20; writeSave(); }

  renderer.render(G.scene, G.camera);
  endFrame();
}

addEventListener('beforeunload', () => { if (G.started) writeSave(); });

// handy for testing in the browser console
window.__game = { G, S, writeSave };
