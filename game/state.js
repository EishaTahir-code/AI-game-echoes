// Shared game state. Every module reads and writes through G.

export const DAY_LENGTH = 480; // real seconds per in-game day

export const G = {
  THREE: null,
  scene: null,
  camera: null,
  renderer: null,
  clock: null,

  started: false,
  paused: false,      // menus open
  inDialogue: false,
  timeScale: 1,
  hitStop: 0,
  shake: 0,

  time: 0.72,         // 0..1 day fraction (0.72 = dusk)
  day: 1,

  player: null,
  fox: null,
  enemies: [],
  projectiles: [],
  pickups: [],
  npcs: {},
  interactables: [],  // {id, x, z, r, label, action, active()}
  colliders: null,

  settings: { volume: 0.6, music: 0.5, sensitivity: 1, quality: 'high', controls: 'steer', seenControls: false },

  // Persistent progress (saved)
  save: null,
};

export function freshSave() {
  return {
    version: 1,
    created: Date.now(),
    player: {
      name: 'Wanderer', level: 1, xp: 0, gold: 25, statPoints: 0,
      str: 2, vit: 2, spi: 2,
      hp: 100, sp: 50,
      x: -2, z: 6, yaw: 0,
      respawn: { x: -2, z: 6 },
    },
    inventory: [],
    equipped: { weapon: null, armor: null, charm: null },
    fox: { name: 'Ember', joined: false, bond: 0, bondLevel: 1, lastPet: 0, revivedDay: 0 },
    quests: {},          // id -> {state:'active'|'done', step, progress}
    tracked: null,
    npc: {},             // id -> {aff, flags:[]}
    gossip: [],          // pending flags that spread at dawn
    world: {
      chests: [], shrines: [], shards: [], vistas: [], zones: [], herbs: {},
      bossDefeated: false, knightDefeated: false, riftsCleared: 0, rifts: [],
    },
    bounties: { day: 0, list: [] },
    deeds: {},
    tips: [],
    stats: { kills: 0, chests: 0, deaths: 0, playSeconds: 0, legendaries: 0, gifts: 0 },
    time: 0.72, day: 1,
    shopDay: 0, shop: [],
  };
}
