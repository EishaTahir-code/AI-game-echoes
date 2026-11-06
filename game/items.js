// Items, rarity, loot rolls, inventory and equipment.
import { G } from './state.js';
import { uid, pick, rand, randInt, clamp } from './util.js';

export const RARITY = [
  { name: 'Common', color: '#c9d3df', mult: 1.0, affixes: 0 },
  { name: 'Uncommon', color: '#7fd38a', mult: 1.25, affixes: 1 },
  { name: 'Rare', color: '#5ba8ff', mult: 1.55, affixes: 2 },
  { name: 'Epic', color: '#c38bff', mult: 1.95, affixes: 3 },
  { name: 'Legendary', color: '#ffb547', mult: 2.5, affixes: 3 },
];

const WEAPONS = ['Driftwood Blade', 'Reedcutter', 'Ferryman\'s Hook', 'Lantern Saber', 'Festival Glaive', 'Pinewood Edge', 'Moonsteel Sword', 'Mistfang'];
const ARMORS = ['Traveler\'s Coat', 'Reedweave Vest', 'Boatman\'s Jacket', 'Lanternguard Mail', 'Mistcloak', 'Pinebark Plate'];
const CHARMS = ['Fox Bell', 'Moon Pendant', 'Ember Charm', 'Lake Pearl', 'Paper Crane', 'Festival Ribbon'];
const PREFIX = ['Glimmering', 'Mistborn', 'Ember-kissed', 'Moonlit', 'Quiet', 'Wandering', 'Lakebound', 'Starlit', 'Hollow-touched', 'Brave'];

export const UNIQUES = {
  aurelsLight: { name: 'Aurel\'s Last Light', slot: 'weapon', stats: { atk: 30, crit: 10 }, special: 'Every third hit sends out a wave of lantern fire.', icon: 'weapon' },
  mirewalker: { name: 'Mirewalker\'s Coat', slot: 'armor', stats: { def: 22, hp: 120 }, special: 'Marsh water no longer slows you.', icon: 'armor' },
  firstBell: { name: 'Bell of the First Lantern', slot: 'charm', stats: { spi: 30, crit: 6 }, special: 'Your fox deals 60% more damage.', icon: 'charm' },
  teodorKnot: { name: 'Teodor\'s Knot', slot: 'charm', rarity: 2, stats: { hp: 40, def: 4 }, special: 'A ferryman\'s knot. It has never come undone.', icon: 'charm' },
  ruelBlade: { name: 'Captain\'s Oath', slot: 'weapon', rarity: 3, stats: { atk: 18, def: 4 }, special: 'Ruel carried it for twenty years.', icon: 'weapon' },
  sorasRibbon: { name: 'Sora\'s Ribbon', slot: 'charm', rarity: 3, stats: { spi: 18, crit: 5 }, special: 'Skills cost 20% less spirit.', icon: 'charm' },
};

export const CONSUMABLES = {
  tonic: { name: 'Lantern Tonic', desc: 'Restores 45% health.', value: 12, icon: 'potion', color: '#e0566b' },
  tea: { name: 'Spirit Tea', desc: 'Restores 60% spirit.', value: 10, icon: 'potion', color: '#4fc3c9' },
  cake: { name: 'Honey Cake', desc: 'A treat. Give it to a friend or your fox.', value: 8, icon: 'gift', color: '#f2c45a', gift: true },
  moonpetal: { name: 'Moonpetal', desc: 'A pale flower that glows at night. Used in tonics and liked by many.', value: 5, icon: 'herb', color: '#cfe6ff', gift: true },
  dust: { name: 'Echo Dust', desc: 'What a hollow leaves behind. The smith can use it.', value: 3, icon: 'dust', color: '#b59cf2' },
  lanternPiece: { name: 'Drowned Lantern Piece', desc: 'Lacquered wood bearing the Aurel crest.', value: 0, icon: 'quest', color: '#ffb547', quest: true },
  journal: { name: 'Aurel\'s Journal', desc: 'Water-stained pages in a careful hand.', value: 0, icon: 'quest', color: '#ffb547', quest: true },
  charmLost: { name: 'Little Knotted Charm', desc: 'A child\'s charm, tied by an old ferryman.', value: 0, icon: 'quest', color: '#ffb547', quest: true },
  strings: { name: 'Silver Lute Strings', desc: 'Still humming faintly.', value: 0, icon: 'quest', color: '#ffb547', quest: true },
};

const STACKABLE = new Set(Object.keys(CONSUMABLES));

export function makeStack(key, qty = 1) {
  const c = CONSUMABLES[key];
  return { id: uid(), key, kind: 'stack', name: c.name, qty, rarity: 0, value: c.value };
}

function rollStats(slot, level, rarity) {
  const r = RARITY[rarity].mult;
  const s = {};
  if (slot === 'weapon') s.atk = Math.round((4 + level * 2.1) * r * rand(0.9, 1.1));
  if (slot === 'armor') { s.def = Math.round((2 + level * 1.1) * r * rand(0.9, 1.1)); s.hp = Math.round((10 + level * 6) * r * rand(0.85, 1.1)); }
  if (slot === 'charm') { s.spi = Math.round((4 + level * 1.4) * r * rand(0.9, 1.1)); }
  const pool = ['atk', 'def', 'hp', 'crit', 'spi', 'spd'].filter((k) => !s[k]);
  for (let i = 0; i < RARITY[rarity].affixes; i++) {
    const k = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    const base = { atk: 1.2 + level * 0.7, def: 1 + level * 0.5, hp: 8 + level * 4, crit: 2 + level * 0.15, spi: 3 + level * 0.8, spd: 3 + level * 0.2 }[k];
    s[k] = Math.max(1, Math.round(base * rand(0.8, 1.2) * (0.8 + rarity * 0.15)));
  }
  if (s.crit) s.crit = Math.min(s.crit, 25);
  if (s.spd) s.spd = Math.min(s.spd, 18);
  return s;
}

export function makeGear(slot, level, rarity) {
  const base = pick(slot === 'weapon' ? WEAPONS : slot === 'armor' ? ARMORS : CHARMS);
  const name = rarity >= 1 ? `${pick(PREFIX)} ${base}` : base;
  const stats = rollStats(slot, level, rarity);
  const value = Math.round((8 + level * 5) * (1 + rarity * rarity * 0.8));
  return { id: uid(), kind: 'gear', slot, name, level, rarity, stats, value, upgrade: 0 };
}

export function makeUnique(key, level) {
  const u = UNIQUES[key];
  const rarity = u.rarity ?? 4;
  const scale = 1 + Math.max(0, level - 8) * 0.08;
  const stats = {};
  for (const [k, v] of Object.entries(u.stats)) stats[k] = Math.round(v * scale);
  return { id: uid(), kind: 'gear', slot: u.slot, name: u.name, level, rarity, stats, value: 200 + level * 20, upgrade: 0, unique: key, special: u.special };
}

// Weighted rarity roll. luck shifts the odds toward better items.
export function rollRarity(luck = 0) {
  const w = [60 - luck * 8, 26, 10 + luck * 3, 3.4 + luck * 2.5, 0.6 + luck * 1.2].map((x) => Math.max(x, 0.1));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; }
  return 0;
}

export function randomLoot(level, luck = 0, minRarity = 0) {
  const rarity = Math.max(minRarity, rollRarity(luck));
  if (rarity === 4 && Math.random() < 0.35) {
    const key = pick(['aurelsLight', 'mirewalker', 'firstBell']);
    return makeUnique(key, level);
  }
  return makeGear(pick(['weapon', 'weapon', 'armor', 'armor', 'charm']), Math.max(1, level + randInt(-1, 1)), rarity);
}

// ---------------------------------------------------------------- inventory
export const INV_SIZE = 36;

export function addItem(item) {
  const inv = G.save.inventory;
  if (item.kind === 'stack') {
    const ex = inv.find((i) => i.kind === 'stack' && i.key === item.key);
    if (ex) { ex.qty += item.qty; return true; }
  }
  if (inv.length >= INV_SIZE) return false;
  inv.push(item);
  return true;
}
export function countItem(key) {
  const s = G.save.inventory.find((i) => i.kind === 'stack' && i.key === key);
  return s ? s.qty : 0;
}
export function removeItem(key, qty = 1) {
  const inv = G.save.inventory;
  const s = inv.find((i) => i.kind === 'stack' && i.key === key);
  if (!s || s.qty < qty) return false;
  s.qty -= qty;
  if (s.qty <= 0) inv.splice(inv.indexOf(s), 1);
  return true;
}
export function removeById(id) {
  const inv = G.save.inventory;
  const i = inv.findIndex((x) => x.id === id);
  if (i >= 0) return inv.splice(i, 1)[0];
  return null;
}

export function itemStats(it) {
  if (!it || it.kind !== 'gear') return {};
  const out = {};
  const up = 1 + (it.upgrade || 0) * 0.12;
  for (const [k, v] of Object.entries(it.stats)) out[k] = k === 'crit' || k === 'spd' ? v : Math.round(v * up);
  return out;
}

export function equip(id) {
  const it = G.save.inventory.find((x) => x.id === id);
  if (!it || it.kind !== 'gear') return;
  removeById(id);
  const cur = G.save.equipped[it.slot];
  G.save.equipped[it.slot] = it;
  if (cur) G.save.inventory.push(cur);
}
export function unequip(slot) {
  const cur = G.save.equipped[slot];
  if (!cur || G.save.inventory.length >= INV_SIZE) return;
  G.save.equipped[slot] = null;
  G.save.inventory.push(cur);
}

export const STAT_NAMES = { atk: 'Attack', def: 'Defense', hp: 'Health', crit: 'Critical chance', spi: 'Spirit', spd: 'Move speed' };
export const statLine = (k, v) => (k === 'crit' || k === 'spd' ? `+${v}% ${STAT_NAMES[k]}` : `+${v} ${STAT_NAMES[k]}`);

export function itemName(it) {
  return it.kind === 'gear' && it.upgrade ? `${it.name} +${it.upgrade}` : it.name;
}

export function tooltipHTML(it, compare = true) {
  if (it.kind === 'stack') {
    const c = CONSUMABLES[it.key];
    return `<div class="tt-name" style="color:${c.color}">${c.name}${it.qty > 1 ? ` <span class="tt-qty">×${it.qty}</span>` : ''}</div><div class="tt-desc">${c.desc}</div>${c.value ? `<div class="tt-val">Sells for ${c.value} gold</div>` : ''}`;
  }
  const r = RARITY[it.rarity];
  const st = itemStats(it);
  const cur = compare ? G.save.equipped[it.slot] : null;
  const cs = cur && cur.id !== it.id ? itemStats(cur) : null;
  const slotName = { weapon: 'Weapon', armor: 'Armor', charm: 'Charm' }[it.slot];
  let lines = Object.entries(st).map(([k, v]) => {
    let diff = '';
    if (cs) { const d = v - (cs[k] || 0); if (d) diff = ` <span class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}</span>`; }
    return `<div class="tt-stat">${statLine(k, v)}${diff}</div>`;
  }).join('');
  if (cs) for (const [k, v] of Object.entries(cs)) if (!(k in st)) lines += `<div class="tt-stat lost">${statLine(k, 0).replace('+0', '0')} <span class="down">-${v}</span></div>`;
  return `<div class="tt-name" style="color:${r.color}">${itemName(it)}</div>
    <div class="tt-meta">${r.name} ${slotName}, level ${it.level}</div>${lines}
    ${it.special ? `<div class="tt-special">${it.special}</div>` : ''}
    <div class="tt-val">Sells for ${it.value} gold</div>`;
}

export const ICONS = {
  weapon: '<svg viewBox="0 0 24 24"><path d="M19 3l2 2-10 10-2-2zM8 14l2 2-3 3-1.5-.5L5 17zM4 19l1 1-1.5 1.5-1-1z" fill="currentColor"/></svg>',
  armor: '<svg viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill="currentColor"/></svg>',
  charm: '<svg viewBox="0 0 24 24"><circle cx="12" cy="14" r="6" fill="currentColor"/><path d="M12 2v6" stroke="currentColor" stroke-width="2"/></svg>',
  potion: '<svg viewBox="0 0 24 24"><path d="M9 2h6v3l-1 1v3l4 5a6 6 0 11-12 0l4-5V6L9 5z" fill="currentColor"/></svg>',
  gift: '<svg viewBox="0 0 24 24"><path d="M3 9h18v4H3zM5 13h14v8H5zM11 9h2v12h-2zM12 9C9 9 7 7 8 5s4 1 4 4c0-3 3-6 4-4s-1 4-4 4z" fill="currentColor"/></svg>',
  herb: '<svg viewBox="0 0 24 24"><path d="M12 22V10M12 10c-4 0-7-3-7-7 4 0 7 3 7 7zm0 0c4 0 7-3 7-7-4 0-7 3-7 7z" stroke="currentColor" stroke-width="2" fill="currentColor"/></svg>',
  dust: '<svg viewBox="0 0 24 24"><path d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="currentColor"/></svg>',
  quest: '<svg viewBox="0 0 24 24"><path d="M6 2h9l3 3v17H6z" fill="currentColor"/><path d="M9 9h6M9 13h6M9 17h4" stroke="#1e2a44" stroke-width="1.6"/></svg>',
};
export function iconFor(it) {
  if (it.kind === 'gear') return ICONS[it.slot];
  return ICONS[CONSUMABLES[it.key].icon] || ICONS.quest;
}
export function colorFor(it) {
  return it.kind === 'gear' ? RARITY[it.rarity].color : CONSUMABLES[it.key].color;
}
export { clamp };
