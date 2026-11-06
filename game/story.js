// Story engine: quests, memory flags, gossip, friendship, XP, bounties, deeds.
import { G } from './state.js';
import { QUESTS, NPCS, DEEDS, GIFT_LINES, SHARDS } from './data.js';
import { addItem, countItem, removeItem, makeStack, makeGear, makeUnique, randomLoot, RARITY } from './items.js';
import { pick, randInt, bus } from './util.js';
import { isNight, SHRINES, zoneAt } from './world.js';
import * as UI from './ui.js';
import * as Audio from './audio.js';

export const xpToNext = (l) => Math.round(60 * Math.pow(l, 1.6));
export const SKILL_UNLOCKS = { 1: 3, 3: 7, 4: 10 }; // skill slot -> level (slot 2 unlocks with fox bond 3)

function npcState(id) {
  const s = G.save.npc;
  if (!s[id]) s[id] = { aff: NPCS[id]?.startAff ?? 20, flags: [], giftDay: 0, milestone: false };
  return s[id];
}

export const S = {
  foxName: () => G.save.fox.name,
  isNight: () => isNight(),
  // --- quests
  qStep(id) { const q = G.save.quests[id]; if (!q) return -1; return q.state === 'done' ? 99 : q.step; },
  questDone: (id) => G.save.quests[id]?.state === 'done',
  questStarted: (id) => !!G.save.quests[id],
  startQuest(id) {
    if (G.save.quests[id]) return;
    G.save.quests[id] = { state: 'active', step: 0, progress: 0 };
    const q = QUESTS[id];
    if (q.type === 'main' || !G.save.tracked || QUESTS[G.save.tracked]?.type !== 'main') G.save.tracked = id;
    UI.questBanner(q.type === 'main' ? `Chapter ${q.chapter}` : 'New side quest', q.title);
    Audio.sfx('quest');
    enterStep(id);
  },
  advance(id) {
    const q = G.save.quests[id];
    if (!q || q.state === 'done') return;
    q.step++; q.progress = 0;
    const def = QUESTS[id];
    if (q.step >= def.steps.length) { S.complete(id); return; }
    UI.toast(def.steps[q.step].text, 'quest');
    Audio.sfx('tick');
    enterStep(id);
  },
  complete(id) {
    const q = G.save.quests[id];
    if (!q || q.state === 'done') return;
    q.state = 'done';
    const def = QUESTS[id];
    const r = def.rewards || {};
    UI.questBanner('Quest complete', def.title);
    Audio.sfx('complete');
    if (r.gold) grantGold(r.gold);
    if (r.items) for (const [k, n] of r.items) giveStack(k, n);
    if (r.gear) S.giveGear(null, r.gear);
    if (r.gearSlot) S.giveGear(r.gearSlot[0], r.gearSlot[1]);
    if (r.unique) S.giveUnique(r.unique);
    if (r.aff) S.addAff(r.aff[0], r.aff[1]);
    if (r.xp) grantXP(r.xp);
    if (def.giver && NPCS[def.giver]) S.addAff(def.giver, 4);
    for (const u of def.unlocks || []) {
      if (u === 'm2' || u === 'm3' || u === 'm4' || u === 'm5') G.save.quests[u] || unlockMain(u);
      else S.startQuest(u);
    }
    if (id === 'm6') { G.save.world.bossDefeated = true; }
    if (id === 'm3') UI.toast('Echo Rifts now open across the valley each day. Find them on your map.', 'info');
    if (G.save.tracked === id) G.save.tracked = nextTracked();
    bus.emit('questsChanged');
    S.save();
  },
  // --- memory and friendship
  flag: (npc, f) => npcState(npc).flags.includes(f),
  setFlag(npc, f, gossip = false) { const s = npcState(npc); if (!s.flags.includes(f)) s.flags.push(f); if (gossip) S.gossip(f); },
  gossip(f) { if (!G.save.gossip.includes(f)) G.save.gossip.push(f); },
  heard: (f) => (G.save.heard || []).includes(f),
  aff: (npc) => npcState(npc).aff,
  addAff(npc, n) {
    const s = npcState(npc);
    const before = s.aff;
    s.aff = Math.max(0, Math.min(100, s.aff + n));
    if (n !== 0) UI.affinityPulse(npc, s.aff - before);
    const ms = NPCS[npc]?.milestone;
    if (ms && !s.milestone && s.aff >= ms.aff) {
      s.milestone = true;
      setTimeout(() => UI.milestone(npc, typeof ms.text === 'function' ? ms.text() : ms.text, ms.reward), 600);
    }
  },
  lastMemory: null,
  // list of [condition, line, memory note]; the note shows as a "remembers" badge
  pickLine(list) { for (const [cond, line, note] of list) if (cond) { S.lastMemory = note || null; return line; } return '...'; },
  // --- items
  has: (key, n = 1) => countItem(key) >= n,
  take: (key, n = 1) => removeItem(key, n),
  hasGift: () => ['cake', 'moonpetal', 'dust'].some((k) => countItem(k) > 0),
  weapon: () => G.save.equipped.weapon,
  giveGear(slot, rarity) {
    const lvl = G.save.player.level;
    const it = slot ? makeGear(slot, lvl, rarity) : randomLoot(lvl, 1, rarity);
    giveItem(it);
    return it;
  },
  giveUnique(key) { const it = makeUnique(key, Math.max(G.save.player.level, 6)); giveItem(it); return it; },
  // --- town services
  openShop: () => UI.openShop(),
  openForge: () => UI.openForge(),
  openGift: (npc) => UI.openGift(npc),
  rest(when) {
    UI.fade(() => {
      const t = G.time;
      // the day counter turns at midnight; gossip and bounties refresh at dawn
      if (when === 'night') { if (t >= 0.8) advanceDay(); else if (t < 0.25) onDawn(); G.time = 0.81; }
      else { if (t < 0.25) onDawn(); else advanceDay(); G.time = 0.3; }
      G.player.healFull();
      UI.toast(when === 'night' ? 'You wake as the lanterns come alive.' : 'You wake rested. A new day in Lanternmere.', 'info');
      S.save();
    });
  },
  music: (name) => Audio.playSong(name),
  save: () => bus.emit('save'),
};

function unlockMain(id) { S.startQuest(id); }
function nextTracked() {
  const active = Object.entries(G.save.quests).filter(([, q]) => q.state === 'active').map(([id]) => id);
  return active.find((id) => QUESTS[id]?.type === 'main') || active[0] || null;
}

function enterStep(id) {
  const q = G.save.quests[id];
  const st = QUESTS[id].steps[q.step];
  if (!st) return;
  if (st.spawn) bus.emit('spawnQuest', id, st.spawn);
  // steps that may already be satisfied
  checkPassive();
  bus.emit('questsChanged');
}

export function respawnActiveQuestEnemies() {
  for (const [id, q] of Object.entries(G.save.quests)) {
    if (q.state !== 'active') continue;
    const st = QUESTS[id].steps[q.step];
    if (st && st.spawn) bus.emit('spawnQuest', id, st.spawn);
  }
}

// ---------------------------------------------------------------- rewards
export function grantXP(n) {
  const p = G.save.player;
  if (p.level >= 30) return;
  p.xp += Math.round(n);
  UI.xpGain(Math.round(n));
  while (p.xp >= xpToNext(p.level) && p.level < 30) {
    p.xp -= xpToNext(p.level);
    p.level++;
    p.statPoints += 3;
    G.player.healFull();
    const unlocked = Object.entries(SKILL_UNLOCKS).filter(([, l]) => l === p.level).map(([s]) => +s);
    UI.levelUp(p.level, unlocked);
    Audio.sfx('levelup');
    bus.emit('levelUp', p.level);
  }
}
export function grantGold(n) { G.save.player.gold += n; UI.goldGain(n); }
export function giveStack(key, n = 1) {
  if (!addItem(makeStack(key, n))) { UI.toast('Your bag is full.', 'warn'); return false; }
  UI.lootFeed(makeStack(key, n));
  bus.emit('itemsChanged', key);
  return true;
}
export function giveItem(it) {
  if (!addItem(it)) { UI.toast('Your bag is full. Sell or drop something.', 'warn'); return false; }
  if (it.rarity >= 4) { G.save.stats.legendaries++; Audio.sfx('legendary'); }
  UI.lootFeed(it);
  bus.emit('itemsChanged');
  return true;
}

export function grantBond(n, reason) {
  const f = G.save.fox;
  if (!f.joined) return;
  f.bond += n;
  const need = (l) => 40 + l * 30;
  while (f.bondLevel < 10 && f.bond >= need(f.bondLevel)) {
    f.bond -= need(f.bondLevel);
    f.bondLevel++;
    UI.bondUp(f.bondLevel);
    Audio.sfx('bond');
  }
  if (f.bondLevel >= 10) f.bond = Math.min(f.bond, need(10));
  if (reason) UI.bondPulse(reason);
}
export const bondNeed = (l) => 40 + l * 30;

// ---------------------------------------------------------------- events
bus.on('kill', (enemy) => {
  const s = G.save;
  s.stats.kills++;
  const night = isNight();
  const zone = zoneAt(enemy.pos.x, enemy.pos.z).id;
  for (const [id, q] of Object.entries(s.quests)) {
    if (q.state !== 'active') continue;
    const st = QUESTS[id].steps[q.step];
    if (!st || st.type !== 'kill') continue;
    if (st.enemy !== 'any' && st.enemy !== enemy.type) continue;
    if (st.zone && st.zone !== zone && !(st.spawn && enemy.tag === st.spawn.tag)) continue;
    if (st.night && !night) continue;
    q.progress++;
    if (q.progress >= st.count) S.advance(id);
    else bus.emit('questsChanged');
  }
  // bounties
  for (const b of s.bounties.list) {
    if (b.done || b.type !== 'kill') continue;
    if (b.enemy !== 'any' && b.enemy !== enemy.type) continue;
    if (b.zone && b.zone !== zone) continue;
    b.progress++;
    if (b.progress >= b.count) { b.done = true; UI.toast(`Bounty ready: ${b.text}. Claim it at the notice board.`, 'quest'); Audio.sfx('tick'); }
  }
  grantBond(2);
});

bus.on('itemsChanged', () => checkPassive());

bus.on('interact', (id) => {
  for (const [qid, q] of Object.entries(G.save.quests)) {
    if (q.state !== 'active') continue;
    const st = QUESTS[qid].steps[q.step];
    if (st && st.type === 'interact' && st.id === id) S.advance(qid);
  }
  checkPassive();
});

export function checkPassive() {
  const s = G.save;
  for (const [id, q] of Object.entries(s.quests)) {
    if (q.state !== 'active') continue;
    const st = QUESTS[id].steps[q.step];
    if (!st) continue;
    if (st.type === 'collect') {
      q.progress = Math.min(countItem(st.item), st.count);
      if (q.progress >= st.count) S.advance(id);
    } else if (st.type === 'shrines') {
      q.progress = s.world.shrines.length;
      if (q.progress >= st.count) S.advance(id);
    } else if (st.type === 'shards') {
      q.progress = s.world.shards.length;
      if (q.progress >= st.count) S.advance(id);
    } else if (st.type === 'interact' && st.id.startsWith('shrine:') && s.world.shrines.includes(st.id.slice(7))) {
      S.advance(id);
    }
  }
}

// reach steps are checked every frame from main
export function updateStory(dt) {
  const s = G.save, p = G.player.pos;
  for (const [id, q] of Object.entries(s.quests)) {
    if (q.state !== 'active') continue;
    const st = QUESTS[id].steps[q.step];
    if (st && st.type === 'reach' && Math.hypot(p.x - st.x, p.z - st.z) < st.r) {
      if (st.night && !isNight()) { if (!q._warned) { UI.toast('The stone ring is silent. Come back after nightfall, or rest at the inn until night.', 'info'); q._warned = true; } continue; }
      S.advance(id);
    }
  }
  // deeds
  deedTimer -= dt;
  if (deedTimer <= 0) { deedTimer = 1.5; checkDeeds(); }
}
let deedTimer = 2;

export function checkDeeds() {
  const s = G.save;
  for (const d of DEEDS) {
    if (s.deeds[d.id]) continue;
    if (d.test(s)) { s.deeds[d.id] = Date.now(); grantGold(d.gold); UI.deed(d); Audio.sfx('deed'); }
  }
}

// ---------------------------------------------------------------- days, gossip, bounties
export function advanceDay() {
  G.day++;
  onDawn();
}
export function onDawn() {
  const s = G.save;
  s.heard ||= [];
  for (const f of s.gossip) if (!s.heard.includes(f)) s.heard.push(f);
  if (s.gossip.length) UI.toast('Word travels fast in Lanternmere. People have been talking about you.', 'info');
  s.gossip = [];
  makeBounties();
  bus.emit('newDay');
}

const BOUNTY_TEMPLATES = [
  (l) => ({ type: 'kill', enemy: 'wisp', count: randInt(3, 6), text: 'Disperse wisps' }),
  (l) => ({ type: 'kill', enemy: 'husk', count: randInt(2, 4), text: 'Break husks' }),
  (l) => ({ type: 'kill', enemy: 'eater', count: randInt(2, 4), text: 'Silence lantern-eaters' }),
  (l) => ({ type: 'kill', enemy: 'any', zone: 'pines', count: randInt(4, 6), text: 'Clear the Whispering Pines' }),
  (l) => ({ type: 'kill', enemy: 'any', zone: 'fields', count: randInt(3, 5), text: 'Patrol the Southern Fields' }),
  (l) => ({ type: 'kill', enemy: 'any', zone: 'north', count: randInt(3, 5), text: 'Sweep the North Meadow' }),
  (l) => ({ type: 'kill', enemy: 'brute', count: randInt(1, 3), text: 'Topple marsh brutes', minLevel: 8 }),
];
export function makeBounties() {
  const s = G.save;
  if (s.bounties.day === G.day) return;
  const lvl = s.player.level;
  const pool = BOUNTY_TEMPLATES.map((f) => f(lvl)).filter((b) => !b.minLevel || lvl >= b.minLevel);
  const list = [];
  while (list.length < 3 && pool.length) {
    const b = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    b.text = `${b.text} (${b.count})`;
    b.id = 'b' + G.day + list.length;
    b.progress = 0; b.done = false; b.claimed = false;
    b.reward = { gold: 25 + lvl * 8 + b.count * 3, xp: 40 + lvl * 14 + b.count * 6, rarity: Math.random() < 0.3 ? 2 : 1 };
    list.push(b);
  }
  s.bounties = { day: G.day, list };
}
export function claimBounty(b) {
  if (!b.done || b.claimed) return;
  b.claimed = true;
  G.save.stats.bounties = (G.save.stats.bounties || 0) + 1;
  grantGold(b.reward.gold);
  S.giveGear(null, b.reward.rarity);
  grantXP(b.reward.xp);
  Audio.sfx('complete');
  S.save();
}

// ---------------------------------------------------------------- gifts
export function giveGift(npc, key) {
  const st = npcState(npc);
  if (st.giftDay === G.day) return { line: 'You\'ve already given me something today. Save it for tomorrow.', delta: 0 };
  if (!removeItem(key, 1)) return null;
  st.giftDay = G.day;
  G.save.stats.gifts++;
  const def = NPCS[npc];
  let delta = 3, kind = 'neutral';
  if (def.likes.includes(key)) { delta = 9; kind = 'like'; }
  else if (def.dislikes.includes(key)) { delta = -2; kind = 'dislike'; }
  S.addAff(npc, delta);
  S.setFlag(npc, 'gift:' + key);
  return { line: pick(GIFT_LINES[kind]), delta };
}

export function shardText(i) { return SHARDS[i].text; }
export function shrineName(id) { return SHRINES.find((s) => s.id === id)?.name; }
export { RARITY, npcState };
