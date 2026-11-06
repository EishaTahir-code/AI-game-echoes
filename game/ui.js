// HUD, menus, notifications, map, shop, forge, board.
import * as THREE from 'three';
import { G } from './state.js';
import { QUESTS, NPCS, DEEDS, SHARDS, BOND_PERKS, VISTAS, HERBS } from './data.js';
import { SHRINES, PLACES, ZONES, heightAt, pathDist, LAKE, MARSH, lakeE, isNight } from './world.js';
import { RARITY, CONSUMABLES, INV_SIZE, tooltipHTML, iconFor, colorFor, itemName, equip, unequip, removeById, makeStack, addItem, countItem, removeItem, makeGear, randomLoot, itemStats, statLine } from './items.js';
import { S, xpToNext, bondNeed, claimBounty, grantBond, npcState } from './story.js';
import { SKILLS } from './player.js';
import { sayLine, giftChooser, closeDialogue, handoff } from './dialogue.js';
import { releaseLock } from './input.js';
import { fmtTime, clamp, bus } from './util.js';
import * as Audio from './audio.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let E = {};

export function initUI() {
  E = {
    hp: $('hp-fill'), hpT: $('hp-text'), sp: $('sp-fill'), st: $('st-fill'), lvl: $('lvl-badge'),
    xp: $('xp-fill'), xpT: $('xp-text'), gold: $('gold'), clock: $('clock'),
    foxBox: $('fox-status'), foxName: $('fox-name'), foxBond: $('fox-bond-fill'), foxLvl: $('fox-lvl'),
    trackerTitle: $('tracker-title'), trackerStep: $('tracker-step'), goals: $('goals'),
    skills: $('skills'), prompt: $('prompt'), toasts: $('toasts'), feed: $('lootfeed'),
    banner: $('banner'), zone: $('zone-title'), boss: $('boss-bar'), foxSays: $('fox-says'),
    dmg: $('dmg-layer'), hurt: $('hurt'), lockHint: $('lock-hint'), waypoint: $('waypoint'),
    panel: $('panel'), panelBody: $('panel-body'), tabs: $('panel-tabs'), tooltip: $('tooltip'),
    modal: $('modal'), fade: $('fade'), death: $('death'), statPts: $('stat-pts'),
  };
  // skill bar
  E.skills.innerHTML = SKILLS.map((s, i) => `<div class="skill" data-i="${i}"><span class="skey">${s.key}</span><span class="sname">${s.name}</span><div class="cd"></div><div class="lock"></div></div>`).join('')
    + `<div class="skill tonic"><span class="skey">Q</span><span class="sname">Tonic</span><span class="count" id="tonic-count">0</span></div>`;
  E.skillEls = [...E.skills.querySelectorAll('.skill[data-i]')];
  E.skillEls.forEach((el, i) => { el.title = `${SKILLS[i].name}: ${SKILLS[i].desc} Costs ${SKILLS[i].cost} spirit.`; });
  E.tonic = $('tonic-count');
  document.addEventListener('mousemove', (e) => {
    if (E.tooltip.hidden) return;
    const x = Math.min(e.clientX + 16, innerWidth - E.tooltip.offsetWidth - 8), y = Math.min(e.clientY + 12, innerHeight - E.tooltip.offsetHeight - 8);
    E.tooltip.style.transform = `translate(${x}px, ${y}px)`;
  });
  E.tabs.addEventListener('click', (e) => { const t = e.target.closest('[data-tab]'); if (t) { Audio.sfx('ui'); showTab(t.dataset.tab); } });
  $('panel-close').addEventListener('click', closePanel);
  initMapImage();
  bus.on('questsChanged', () => { trackerDirty = true; });
}

// ---------------------------------------------------------------- notifications
export function toast(text, kind = 'info') {
  if (!E.toasts) return;
  const d = document.createElement('div');
  d.className = `toast ${kind}`;
  d.textContent = text;
  E.toasts.appendChild(d);
  while (E.toasts.children.length > 4) E.toasts.firstChild.remove();
  setTimeout(() => d.classList.add('out'), 4200);
  setTimeout(() => d.remove(), 4800);
}
let bannerQ = [], bannerBusy = false;
export function questBanner(kicker, title) {
  bannerQ.push([kicker, title]);
  if (!bannerBusy) nextBanner();
}
function nextBanner() {
  const b = bannerQ.shift();
  if (!b) { bannerBusy = false; return; }
  bannerBusy = true;
  E.banner.innerHTML = `<div class="kicker">${esc(b[0])}</div><div class="btitle">${esc(b[1])}</div>`;
  E.banner.classList.remove('show'); void E.banner.offsetWidth; E.banner.classList.add('show');
  setTimeout(() => { E.banner.classList.remove('show'); setTimeout(nextBanner, 350); }, 2600);
}
export function zoneTitle(name, sub) {
  E.zone.innerHTML = `<div class="zname">${esc(name)}</div><div class="zsub">${esc(sub)}</div>`;
  E.zone.classList.remove('show'); void E.zone.offsetWidth; E.zone.classList.add('show');
}
export function lootFeed(it) {
  const d = document.createElement('div');
  d.className = 'feed-item' + (it.rarity >= 3 ? ' rare' : '');
  d.style.setProperty('--c', colorFor(it));
  d.innerHTML = `<span class="ficon">${iconFor(it)}</span><span>${esc(itemName(it))}${it.qty > 1 ? ` ×${it.qty}` : ''}</span>`;
  E.feed.appendChild(d);
  while (E.feed.children.length > 6) E.feed.firstChild.remove();
  setTimeout(() => d.classList.add('out'), 3800);
  setTimeout(() => d.remove(), 4400);
}
let goldAcc = 0, goldTimer = null;
export function goldGain(n) {
  goldAcc += n;
  clearTimeout(goldTimer);
  goldTimer = setTimeout(() => {
    const d = document.createElement('div'); d.className = 'feed-item gold'; d.innerHTML = `<span class="coin"></span><span>+${goldAcc} gold</span>`;
    E.feed.appendChild(d); goldAcc = 0;
    setTimeout(() => d.classList.add('out'), 2600); setTimeout(() => d.remove(), 3200);
  }, 250);
}
export function xpGain(n) {
  const d = document.createElement('div'); d.className = 'xp-pop'; d.textContent = `+${n} XP`;
  $('xpbar').appendChild(d); setTimeout(() => d.remove(), 1400);
}
export function levelUp(level, skills) {
  questBanner('Level up', `You reached level ${level}`);
  toast(`+3 stat points. Press C to spend them.`, 'quest');
  for (const s of skills) toast(`New skill: ${SKILLS[s - 1].name}. Press ${SKILLS[s - 1].key} to use it.`, 'quest');
  E.lvl.classList.remove('pulse'); void E.lvl.offsetWidth; E.lvl.classList.add('pulse');
}
export function bondUp(level) {
  const perk = BOND_PERKS.find((p) => p.lvl === level);
  questBanner(`Bond with ${G.save.fox.name}`, `Bond level ${level}`);
  if (perk) toast(`${G.save.fox.name} ${perk.text}.`, 'quest');
  if (G.fox) G.fox.applyBondLook();
}
export function bondPulse(reason) { if (reason) foxSays(reason); E.foxBox.classList.remove('pulse'); void E.foxBox.offsetWidth; E.foxBox.classList.add('pulse'); }
export function deed(d) { toast(`Deed complete: ${d.name}. +${d.gold} gold`, 'quest'); }
export function affinityPulse(npc, delta) {
  if (G.inDialogue || !delta) return;
  toast(`${NPCS[npc].name}: friendship ${delta > 0 ? '+' : ''}${delta}`, delta > 0 ? 'info' : 'warn');
}
export function milestone(npc, text, reward) {
  sayLine(npc, text, () => { reward(); S.save(); });
}
let foxTimer = null;
export function foxSays(text) {
  if (!E.foxSays) return;
  E.foxSays.innerHTML = `<img src="${G.foxPortrait || ''}" alt=""><span>${esc(text)}</span>`;
  E.foxSays.classList.add('show');
  clearTimeout(foxTimer);
  foxTimer = setTimeout(() => E.foxSays.classList.remove('show'), 5200);
}
export function memory(text, count) {
  openModal(`<div class="memory"><img src="${G.foxPortrait || ''}" alt=""><div class="kicker">Memory ${count} of ${SHARDS.length}</div><p class="mtext">${esc(text)}</p><p class="msub">${esc(G.save.fox.name)} remembers. Your bond deepens.</p><button class="btn primary" data-close>Continue</button></div>`);
}
export function prompt(label) {
  if (!label) { E.prompt.classList.remove('show'); return; }
  E.prompt.innerHTML = `<kbd>E</kbd>${esc(label)}`;
  E.prompt.classList.add('show');
}
export function hurtFlash() { E.hurt.classList.remove('on'); void E.hurt.offsetWidth; E.hurt.classList.add('on'); }
export function bossBar(e) {
  if (!e || !e.alive) { E.boss.classList.remove('show'); return; }
  E.boss.classList.add('show');
  E.boss.innerHTML = `<div class="bname">${esc(e.b.name)}<span>Level ${e.level}</span></div><div class="btrack"><div class="bfill" style="width:${Math.max(0, (e.hp / e.maxHp) * 100)}%"></div></div>`;
}

// damage numbers
const dmgPool = [];
const projV = new THREE.Vector3();
export function damageNumber(x, y, z, n, kind) {
  const d = document.createElement('div');
  d.className = `dmg ${kind}`; d.textContent = n;
  E.dmg.appendChild(d);
  dmgPool.push({ d, x: x + (Math.random() - 0.5), y, z: z + (Math.random() - 0.5), t: 0 });
}
function updateDamageNumbers(dt) {
  for (let i = dmgPool.length - 1; i >= 0; i--) {
    const p = dmgPool[i];
    p.t += dt; p.y += dt * 1.6;
    projV.set(p.x, p.y, p.z).project(G.camera);
    if (p.t > 0.9 || projV.z > 1) { p.d.remove(); dmgPool.splice(i, 1); continue; }
    const sx = (projV.x * 0.5 + 0.5) * innerWidth, sy = (-projV.y * 0.5 + 0.5) * innerHeight;
    p.d.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%) scale(${p.t < 0.1 ? 1.4 - p.t * 4 : 1})`;
    p.d.style.opacity = p.t > 0.6 ? 1 - (p.t - 0.6) / 0.3 : 1;
  }
}

export function fade(cb) {
  E.fade.classList.add('on');
  setTimeout(() => { cb(); setTimeout(() => E.fade.classList.remove('on'), 150); }, 500);
}
export function deathScreen(cb) {
  E.death.innerHTML = `<div class="dtitle">The dark takes you</div><p>${esc(G.save.fox.joined ? `${G.save.fox.name} drags you back to the last shrine you rested at.` : 'You wake by the last shrine you rested at.')}</p><p class="dsub">You dropped some of your gold in the fall.</p>`;
  E.death.classList.add('show');
  releaseLock();
  setTimeout(() => { E.death.classList.remove('show'); fade(cb); }, 3200);
}

// ---------------------------------------------------------------- modal
function openModal(html, onClose) {
  E.modal.innerHTML = `<div class="modal-card">${html}</div>`;
  E.modal.classList.add('open');
  G.paused = true; releaseLock();
  const close = () => { E.modal.classList.remove('open'); G.paused = isPanelOpen(); if (onClose) onClose(); };
  E.modal.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close, { once: true }));
  return close;
}
export function nameFox(cb) {
  const close = openModal(`<div class="namefox"><img src="${G.foxPortrait || ''}" alt=""><h2>A small spirit fox</h2>
    <p>Its tail flickers like a lantern about to go out. It looks up at you, unafraid, as if it has been waiting.</p>
    <label for="fox-input">What will you call it?</label>
    <input id="fox-input" maxlength="14" value="Ember" autocomplete="off">
    <button class="btn primary" id="fox-ok">Name your fox</button></div>`);
  const inp = $('fox-input');
  setTimeout(() => { inp.focus(); inp.select(); }, 50);
  const ok = () => { const v = inp.value.trim().replace(/[<>]/g, '') || 'Ember'; close(); cb(v); };
  $('fox-ok').addEventListener('click', ok);
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); e.stopPropagation(); });
}
export const modalOpen = () => E.modal.classList.contains('open');

// ---------------------------------------------------------------- panels
let panelTab = null;
export const isPanelOpen = () => E.panel?.classList.contains('open');
export function openPanel(tab) {
  if (G.inDialogue) closeDialogue();
  E.panel.classList.add('open');
  G.paused = true; releaseLock();
  showTab(tab);
}
export function closePanel() {
  E.panel.classList.remove('open');
  E.tooltip.hidden = true;
  G.paused = modalOpen();
  panelTab = null;
  S.save();
}
export function togglePanel(tab) { if (isPanelOpen() && panelTab === tab) closePanel(); else openPanel(tab); }

function showTab(tab) {
  panelTab = tab;
  const contextual = { shop: 'Driftwood Inn', forge: 'Hild\'s forge', board: 'Notice board' };
  const tabs = [['character', 'Character'], ['journal', 'Journal'], ['map', 'Map'], ['settings', 'Settings']];
  if (contextual[tab]) tabs.unshift([tab, contextual[tab]]);
  E.tabs.innerHTML = tabs.map(([id, n]) => `<button data-tab="${id}" class="${id === tab ? 'on' : ''}">${n}</button>`).join('');
  E.tooltip.hidden = true;
  ({ character: renderCharacter, journal: renderJournal, map: renderMap, shop: renderShop, forge: renderForge, board: renderBoard, settings: renderSettings })[tab]();
}
export function refreshPanel() { if (isPanelOpen() && panelTab) showTab(panelTab); }

function bindTooltips(root, lookup) {
  root.querySelectorAll('[data-item]').forEach((el) => {
    el.addEventListener('mouseenter', () => { const it = lookup(el.dataset.item); if (!it) return; E.tooltip.innerHTML = tooltipHTML(it); E.tooltip.hidden = false; });
    el.addEventListener('mouseleave', () => { E.tooltip.hidden = true; });
  });
}
function slotHTML(it, extra = '') {
  if (!it) return `<div class="slot empty" ${extra}></div>`;
  return `<div class="slot r${it.rarity}" data-item="${it.id}" style="--c:${colorFor(it)}" ${extra}><span class="sicon">${iconFor(it)}</span>${it.qty > 1 ? `<span class="qty">${it.qty}</span>` : ''}${it.upgrade ? `<span class="up">+${it.upgrade}</span>` : ''}</div>`;
}
const findItem = (id) => G.save.inventory.find((i) => i.id === id) || Object.values(G.save.equipped).find((i) => i && i.id === id);

let selected = null;
function renderCharacter() {
  const p = G.save.player, st = G.player.stats, eq = G.save.equipped;
  const inv = G.save.inventory;
  const cells = [];
  for (let i = 0; i < INV_SIZE; i++) cells.push(slotHTML(inv[i], inv[i] ? `data-sel="${inv[i].id}"` : ''));
  const sel = selected && findItem(selected);
  let actions = '<p class="muted">Select an item to see what you can do with it.</p>';
  if (sel) {
    const isEq = Object.values(eq).some((x) => x && x.id === sel.id);
    const btns = [];
    if (sel.kind === 'gear') btns.push(isEq ? `<button class="btn" data-act="unequip">Unequip</button>` : `<button class="btn primary" data-act="equip">Equip</button>`);
    if (sel.kind === 'gear' && !isEq) btns.push(`<button class="btn" data-act="salvage">Break down for echo dust</button>`);
    if (sel.kind === 'stack' && (sel.key === 'tonic' || sel.key === 'tea')) btns.push(`<button class="btn primary" data-act="use">Use</button>`);
    if (sel.kind === 'stack' && sel.key === 'cake' && G.save.fox.joined) btns.push(`<button class="btn primary" data-act="feed">Feed ${esc(G.save.fox.name)}</button>`);
    actions = `<div class="sel-tt">${tooltipHTML(sel)}</div><div class="btnrow">${btns.join('')}</div>`;
  }
  const statRow = (k, label, desc) => `<div class="alloc"><div><b>${label}</b> ${p[k]}<small>${desc}</small></div><button class="btn plus" data-stat="${k}" ${p.statPoints ? '' : 'disabled'} aria-label="Add a point to ${label}">+</button></div>`;
  E.panelBody.innerHTML = `<div class="char">
    <section class="col">
      <h3>${esc(p.name)}, level ${p.level}</h3>
      <div class="xpline">${p.xp} of ${xpToNext(p.level)} XP to level ${p.level + 1}</div>
      <div class="equip">
        <div><span class="lbl">Weapon</span>${slotHTML(eq.weapon, eq.weapon ? `data-sel="${eq.weapon.id}"` : '')}</div>
        <div><span class="lbl">Armor</span>${slotHTML(eq.armor, eq.armor ? `data-sel="${eq.armor.id}"` : '')}</div>
        <div><span class="lbl">Charm</span>${slotHTML(eq.charm, eq.charm ? `data-sel="${eq.charm.id}"` : '')}</div>
      </div>
      <dl class="stats">
        <dt>Health</dt><dd>${st.maxHp}</dd><dt>Attack</dt><dd>${st.atk}</dd><dt>Defense</dt><dd>${st.def}</dd>
        <dt>Critical chance</dt><dd>${st.crit.toFixed(0)}%</dd><dt>Spirit</dt><dd>${st.maxSp}</dd><dt>Move speed</dt><dd>${(st.speed / 7.2 * 100).toFixed(0)}%</dd>
      </dl>
      <h4>${p.statPoints ? `${p.statPoints} points to spend` : 'Attributes'}</h4>
      ${statRow('str', 'Strength', 'attack and critical hits')}${statRow('vit', 'Vitality', 'health and defense')}${statRow('spi', 'Spirit', 'skills and regeneration')}
    </section>
    <section class="col wide">
      <h3>Bag <span class="muted">${inv.length} of ${INV_SIZE}</span><span class="goldtag"><span class="coin"></span>${p.gold}</span></h3>
      <div class="grid">${cells.join('')}</div>
      <div class="actions">${actions}</div>
    </section></div>`;
  bindTooltips(E.panelBody, findItem);
  E.panelBody.querySelectorAll('[data-sel]').forEach((el) => el.addEventListener('click', () => { selected = el.dataset.sel; Audio.sfx('ui'); renderCharacter(); }));
  E.panelBody.querySelectorAll('[data-sel]').forEach((el) => el.addEventListener('dblclick', () => { const it = findItem(el.dataset.sel); if (it?.kind === 'gear') { equip(it.id); after(); } }));
  E.panelBody.querySelectorAll('[data-stat]').forEach((b) => b.addEventListener('click', () => { if (p.statPoints > 0) { p[b.dataset.stat]++; p.statPoints--; G.player.recompute(); Audio.sfx('tick'); renderCharacter(); } }));
  E.panelBody.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
    const act = b.dataset.act;
    if (act === 'equip') equip(sel.id);
    if (act === 'unequip') { const slot = Object.keys(eq).find((k) => eq[k]?.id === sel.id); unequip(slot); }
    if (act === 'salvage') { removeById(sel.id); const n = [1, 2, 4, 7, 12][sel.rarity] + (sel.upgrade || 0); addItem(makeStack('dust', n)); toast(`Broke down ${sel.name} into ${n} echo dust.`, 'info'); selected = null; }
    if (act === 'use') { if (sel.key === 'tonic') G.player.drink(); else { if (removeItem('tea', 1)) G.player.sp = G.player.stats.maxSp; } }
    if (act === 'feed') { if (removeItem('cake', 1)) { G.fox.pet(); grantBond(12, `${G.save.fox.name} gobbles the honey cake and looks at you adoringly.`); } }
    Audio.sfx('ui');
    after();
  }));
  function after() { G.player.recompute(); bus.emit('itemsChanged'); renderCharacter(); }
}

let journalSub = 'quests';
function renderJournal() {
  const subs = [['quests', 'Quests'], ['deeds', 'Deeds'], ['bonds', 'Bonds'], ['memories', 'Memories']];
  let body = '';
  if (journalSub === 'quests') {
    const entries = Object.entries(G.save.quests);
    const active = entries.filter(([, q]) => q.state === 'active');
    const done = entries.filter(([, q]) => q.state === 'done');
    const qhtml = ([id, q]) => {
      const def = QUESTS[id];
      const steps = def.steps.map((st, i) => {
        const cls = q.state === 'done' || i < q.step ? 'done' : i === q.step ? 'now' : 'later';
        if (cls === 'later') return '';
        const prog = cls === 'now' && st.count > 1 ? ` (${q.progress} of ${st.count})` : '';
        return `<li class="${cls}">${esc(st.text)}${prog}</li>`;
      }).join('');
      return `<article class="quest ${def.type} ${G.save.tracked === id ? 'tracked' : ''}" data-q="${id}">
        <header><span class="qtype">${def.type === 'main' ? `Chapter ${def.chapter}` : 'Side quest'}</span><h4>${esc(def.title)}</h4>
        ${q.state === 'active' ? `<button class="btn small" data-track="${id}">${G.save.tracked === id ? 'Tracking' : 'Track'}</button>` : ''}</header>
        <ol>${steps}</ol></article>`;
    };
    body = `<div class="quests">${active.length ? active.map(qhtml).join('') : '<p class="muted">No active quests. Talk to people in town; they always need something.</p>'}
      ${done.length ? `<h4 class="sect">Completed</h4>${done.map(qhtml).join('')}` : ''}</div>`;
  } else if (journalSub === 'deeds') {
    const s = G.save;
    body = `<div class="deeds">${DEEDS.map((d) => {
      const got = !!s.deeds[d.id];
      const pr = d.prog && !got ? d.prog(s) : null;
      return `<div class="deed ${got ? 'got' : ''}"><div><b>${esc(d.name)}</b><small>${esc(d.desc)}</small></div>
        ${pr ? `<div class="mini"><div style="width:${Math.min(100, (pr[0] / pr[1]) * 100)}%"></div></div><span class="muted">${Math.min(pr[0], pr[1])} of ${pr[1]}</span>` : `<span class="reward">${got ? 'Done' : `${d.gold} gold`}</span>`}</div>`;
    }).join('')}</div>`;
  } else if (journalSub === 'bonds') {
    const f = G.save.fox;
    const fox = f.joined ? `<div class="bond-card fox"><img src="${G.foxPortrait || ''}" alt=""><div><b>${esc(f.name)}</b><small>Bond level ${f.bondLevel}${f.bondLevel < 10 ? `, ${f.bond} of ${bondNeed(f.bondLevel)} to the next` : ', true form'}</small>
      <div class="mini"><div style="width:${f.bondLevel >= 10 ? 100 : (f.bond / bondNeed(f.bondLevel)) * 100}%"></div></div>
      <ul class="perks">${BOND_PERKS.map((p) => `<li class="${f.bondLevel >= p.lvl ? 'on' : ''}">Bond ${p.lvl}: ${esc(p.text)}</li>`).join('')}</ul>
      <small class="muted">Pet ${esc(f.name)} with F, feed it honey cakes, fight together and find its memories.</small></div></div>` : '<p class="muted">Someone is waiting for you at the Old Lantern Shrine.</p>';
    const people = Object.entries(NPCS).map(([id, def]) => {
      const st = npcState(id);
      const hearts = Array.from({ length: 5 }, (_, i) => `<span class="heart" style="--f:${Math.round(clamp((st.aff - i * 20) / 20, 0, 1) * 100)}%"></span>`).join('');
      const likes = def.likes.filter((k) => st.flags.includes('gift:' + k)).map((k) => CONSUMABLES[k].name);
      return `<div class="bond-card"><img src="${def.portrait || ''}" style="background:${def.portraitBg}" alt=""><div><b>${esc(def.name)}</b><small>${esc(def.title)}</small>
        <div class="hearts">${hearts}</div><small class="muted">${likes.length ? `Likes ${likes.join(' and ')}.` : 'Find out what they like by giving gifts.'} A gift at 60 friendship.</small></div></div>`;
    }).join('');
    body = `<div class="bonds">${fox}${people}</div>`;
  } else {
    const got = G.save.world.shards;
    body = `<div class="memories">${SHARDS.map((sh, i) => `<div class="mem ${got.includes(i) ? '' : 'locked'}"><span class="mnum">${i + 1}</span><p>${got.includes(i) ? esc(sh.text) : 'A memory not yet found. Look for pale blue crystals.'}</p></div>`).join('')}</div>`;
  }
  E.panelBody.innerHTML = `<nav class="subtabs">${subs.map(([id, n]) => `<button data-sub="${id}" class="${id === journalSub ? 'on' : ''}">${n}</button>`).join('')}</nav>${body}`;
  E.panelBody.querySelectorAll('[data-sub]').forEach((b) => b.addEventListener('click', () => { journalSub = b.dataset.sub; Audio.sfx('ui'); renderJournal(); }));
  E.panelBody.querySelectorAll('[data-track]').forEach((b) => b.addEventListener('click', () => { G.save.tracked = b.dataset.track; trackerDirty = true; Audio.sfx('tick'); renderJournal(); }));
}

// ---------------------------------------------------------------- map
const MAP_PX = 240, WORLD = 360;
let mapImg = null;
const FOG_N = 48;
function initMapImage() {
  const c = document.createElement('canvas'); c.width = c.height = MAP_PX;
  const g = c.getContext('2d'), img = g.createImageData(MAP_PX, MAP_PX);
  const k = WORLD / MAP_PX;
  for (let j = 0; j < MAP_PX; j++) for (let i = 0; i < MAP_PX; i++) {
    const x = -180 + i * k, z = -180 + j * k;
    const h = heightAt(x, z), hx = heightAt(x + k, z), hz = heightAt(x, z + k);
    const shade = clamp(1 + ((h - hx) + (h - hz)) * 0.18, 0.6, 1.35);
    let r, gg, b;
    if (h < -0.4) { const dpt = clamp(-h / 6, 0, 1); r = 40 - dpt * 15; gg = 95 - dpt * 30; b = 125 - dpt * 25; }
    else if (h < 0.9) { r = 200; gg = 186; b = 140; }
    else {
      const forest = clamp(1 - Math.hypot(x + 90, z + 70) / 70, 0, 1);
      const marsh = Math.hypot(x - MARSH.x, z - MARSH.z) < MARSH.r;
      r = 110 - forest * 40; gg = 140 - forest * 30; b = 80 - forest * 20;
      if (marsh) { r = 92; gg = 100; b = 64; }
      if (h > 22) { r = 135; gg = 135; b = 135; }
      if (h > 46) { r = 230; gg = 235; b = 238; }
      if (pathDist(x, z) < 2.4) { r = 186; gg = 160; b = 112; }
      if (Math.hypot(x, z) < 32) { r = 170; gg = 155; b = 125; }
    }
    const o = (j * MAP_PX + i) * 4;
    img.data[o] = r * shade; img.data[o + 1] = gg * shade; img.data[o + 2] = b * shade; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  mapImg = c;
}
function fogArr() {
  const w = G.save.world;
  if (!w.fog || w.fog.length !== FOG_N * FOG_N) w.fog = '0'.repeat(FOG_N * FOG_N);
  return w.fog;
}
let fogTimer = 0;
function revealFog() {
  const p = G.player.pos, cell = WORLD / FOG_N;
  let f = fogArr().split('');
  let changed = false;
  const ci = Math.floor((p.x + 180) / cell), cj = Math.floor((p.z + 180) / cell);
  for (let j = cj - 4; j <= cj + 4; j++) for (let i = ci - 4; i <= ci + 4; i++) {
    if (i < 0 || j < 0 || i >= FOG_N || j >= FOG_N) continue;
    const cx = -180 + (i + 0.5) * cell, cz = -180 + (j + 0.5) * cell;
    if (Math.hypot(cx - p.x, cz - p.z) < 34 && f[j * FOG_N + i] === '0') { f[j * FOG_N + i] = '1'; changed = true; }
  }
  if (changed) G.save.world.fog = f.join('');
}
const w2m = (x, size) => ((x + 180) / WORLD) * size;

function drawMarkers(g, size, opts = {}) {
  const s = (x) => w2m(x, size);
  const dot = (x, z, r, fill, stroke = '#1e2a44') => { g.beginPath(); g.arc(s(x), s(z), r, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); g.lineWidth = 1.5; g.strokeStyle = stroke; g.stroke(); };
  const diamond = (x, z, r, fill) => { g.beginPath(); g.moveTo(s(x), s(z) - r); g.lineTo(s(x) + r, s(z)); g.lineTo(s(x), s(z) + r); g.lineTo(s(x) - r, s(z)); g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = '#1e2a44'; g.lineWidth = 1.5; g.stroke(); };
  const sc = opts.scale || 1;
  for (const sh of SHRINES) {
    const lit = G.save.world.shrines.includes(sh.id);
    const seen = lit || fogAt(sh.x, sh.z);
    if (!seen) continue;
    g.beginPath(); g.rect(s(sh.x) - 4 * sc, s(sh.z) - 4 * sc, 8 * sc, 8 * sc);
    g.fillStyle = lit ? '#ffb547' : '#6b7790'; g.fill(); g.strokeStyle = '#1e2a44'; g.lineWidth = 1.5; g.stroke();
  }
  for (const n of Object.values(NPCS)) dot(n.pos.x, n.pos.z, 3 * sc, '#f6ebd3');
  for (const r of (opts.rifts || [])) dot(r.x, r.z, 4 * sc, '#b59cf2');
  if (opts.enemies) for (const e of G.enemies) if (e.alive && Math.hypot(e.pos.x - G.player.pos.x, e.pos.z - G.player.pos.z) < 45) dot(e.pos.x, e.pos.z, (e.boss ? 4 : 2) * sc, e.boss || e.elite ? '#ffb547' : '#e0566b', 'transparent');
  const qt = questTarget();
  if (qt) diamond(qt.x, qt.z, 6 * sc, '#ffb547');
  if (G.fox && G.save.fox.joined) dot(G.fox.pos.x, G.fox.pos.z, 2.5 * sc, '#f08a3c');
  // player arrow
  const p = G.player;
  g.save(); g.translate(s(p.pos.x), s(p.pos.z)); g.rotate(-p.facing + Math.PI);
  g.beginPath(); g.moveTo(0, -8 * sc); g.lineTo(5.5 * sc, 6 * sc); g.lineTo(0, 3 * sc); g.lineTo(-5.5 * sc, 6 * sc); g.closePath();
  g.fillStyle = '#ffffff'; g.fill(); g.strokeStyle = '#1e2a44'; g.lineWidth = 2; g.stroke(); g.restore();
}
function fogAt(x, z) { const cell = WORLD / FOG_N; const i = Math.floor((x + 180) / cell), j = Math.floor((z + 180) / cell); return fogArr()[j * FOG_N + i] === '1'; }
let fogCanvas = null, fogKey = '';
function drawFog(g, size) {
  const f = fogArr();
  if (!fogCanvas) { fogCanvas = document.createElement('canvas'); fogCanvas.width = fogCanvas.height = FOG_N; }
  if (fogKey !== f) {
    fogKey = f;
    const fg = fogCanvas.getContext('2d'), img = fg.createImageData(FOG_N, FOG_N);
    for (let i = 0; i < FOG_N * FOG_N; i++) { img.data[i * 4] = 22; img.data[i * 4 + 1] = 30; img.data[i * 4 + 2] = 52; img.data[i * 4 + 3] = f[i] === '0' ? 222 : 0; }
    fg.putImageData(img, 0, 0);
  }
  g.imageSmoothingEnabled = true;
  g.drawImage(fogCanvas, 0, 0, size, size);
}

let mapRiftsFn = () => [];
export function setRiftSource(fn) { mapRiftsFn = fn; }
let travelFn = null;
export function setTravel(fn) { travelFn = fn; }

function renderMap() {
  E.panelBody.innerHTML = `<div class="mapwrap"><canvas id="bigmap" width="720" height="720" aria-label="Map of the valley"></canvas>
    <aside class="legend"><h3>The valley</h3><p class="muted">Lit shrines glow amber. Click one to travel there. Dark areas are still unexplored.</p>
    <ul><li><i class="lg sh"></i>Lantern shrine</li><li><i class="lg q"></i>Quest goal</li><li><i class="lg npc"></i>Townsfolk</li><li><i class="lg rift"></i>Echo Rift</li></ul>
    <div id="map-hover" class="muted"></div></aside></div>`;
  const cv = $('bigmap'), g = cv.getContext('2d');
  const draw = () => {
    g.imageSmoothingEnabled = true;
    g.drawImage(mapImg, 0, 0, 720, 720);
    drawFog(g, 720);
    g.font = 'italic 600 15px Fraunces, Georgia, serif'; g.textAlign = 'center';
    for (const zn of ZONES) {
      if (zn.id === 'wilds' || !G.save.world.zones.includes(zn.id)) continue;
      g.fillStyle = 'rgba(246,235,211,0.9)'; g.strokeStyle = 'rgba(30,42,68,0.8)'; g.lineWidth = 3;
      g.strokeText(zn.name, w2m(zn.x, 720), w2m(zn.z, 720) - 14); g.fillText(zn.name, w2m(zn.x, 720), w2m(zn.z, 720) - 14);
    }
    drawMarkers(g, 720, { scale: 1.6, rifts: mapRiftsFn() });
  };
  draw();
  const pick = (e) => {
    const r = cv.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * WORLD - 180, z = ((e.clientY - r.top) / r.height) * WORLD - 180;
    return SHRINES.find((s) => Math.hypot(s.x - x, s.z - z) < 7 && G.save.world.shrines.includes(s.id));
  };
  cv.addEventListener('mousemove', (e) => { const s = pick(e); cv.style.cursor = s ? 'pointer' : 'default'; $('map-hover').textContent = s ? `Travel to ${s.name}` : ''; });
  cv.addEventListener('click', (e) => { const s = pick(e); if (s && travelFn) { closePanel(); travelFn(s.id); } });
}

// ---------------------------------------------------------------- shop, forge, board
const PRICES = { tonic: 25, tea: 20, cake: 15 };
export function openShop() { handoff(); closeDialogue(); openPanel('shop'); }
function ensureShopStock() {
  const s = G.save;
  if (s.shopDay === G.day && s.shop.length) return;
  s.shopDay = G.day;
  const lvl = s.player.level;
  s.shop = [makeGear('weapon', lvl, Math.random() < 0.4 ? 2 : 1), makeGear('armor', lvl, Math.random() < 0.4 ? 2 : 1), makeGear('charm', lvl, 1), randomLoot(lvl + 1, 2, 2)];
  s.shop.forEach((it) => { it.value = Math.round(it.value * 3.2); });
}
function renderShop() {
  ensureShopStock();
  const s = G.save;
  const buyStacks = Object.entries(PRICES).map(([k, p]) => `<div class="shoprow"><span class="sicon" style="color:${CONSUMABLES[k].color}">${iconFor({ kind: 'stack', key: k })}</span><div><b>${CONSUMABLES[k].name}</b><small>${CONSUMABLES[k].desc}</small></div><button class="btn" data-buy="${k}" ${s.player.gold < p ? 'disabled' : ''}>Buy for ${p}</button></div>`).join('');
  const buyGear = s.shop.map((it) => `<div class="shoprow" data-item="${it.id}"><span class="sicon" style="color:${colorFor(it)}">${iconFor(it)}</span><div><b style="color:${colorFor(it)}">${esc(it.name)}</b><small>${RARITY[it.rarity].name}, level ${it.level}</small></div><button class="btn" data-buyg="${it.id}" ${s.player.gold < it.value ? 'disabled' : ''}>Buy for ${it.value}</button></div>`).join('') || '<p class="muted">Sold out until tomorrow.</p>';
  const sellable = s.inventory.filter((i) => !(i.kind === 'stack' && CONSUMABLES[i.key].quest));
  const sell = sellable.map((it) => `<div class="shoprow" data-item="${it.id}"><span class="sicon" style="color:${colorFor(it)}">${iconFor(it)}</span><div><b style="color:${colorFor(it)}">${esc(itemName(it))}${it.qty > 1 ? ` ×${it.qty}` : ''}</b></div><button class="btn" data-sell="${it.id}">Sell for ${it.value}</button></div>`).join('') || '<p class="muted">Nothing to sell.</p>';
  E.panelBody.innerHTML = `<div class="shop"><section><h3>Mira's shelves <span class="goldtag"><span class="coin"></span>${s.player.gold}</span></h3>${buyStacks}<h4 class="sect">Today's finds</h4><p class="muted small">New gear arrives every morning.</p>${buyGear}</section><section><h3>Sell</h3>${sell}</section></div>`;
  const lookup = (id) => s.shop.find((i) => i.id === id) || findItem(id);
  bindTooltips(E.panelBody, lookup);
  E.panelBody.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.buy; if (s.player.gold >= PRICES[k] && addItem(makeStack(k, 1))) { s.player.gold -= PRICES[k]; Audio.sfx('coin'); bus.emit('itemsChanged'); renderShop(); } }));
  E.panelBody.querySelectorAll('[data-buyg]').forEach((b) => b.addEventListener('click', () => { const it = s.shop.find((i) => i.id === b.dataset.buyg); if (it && s.player.gold >= it.value && addItem({ ...it, value: Math.round(it.value / 3.2) })) { s.player.gold -= it.value; s.shop = s.shop.filter((x) => x !== it); Audio.sfx('coin'); renderShop(); } }));
  E.panelBody.querySelectorAll('[data-sell]').forEach((b) => b.addEventListener('click', () => {
    const it = s.inventory.find((i) => i.id === b.dataset.sell); if (!it) return;
    if (it.kind === 'stack') { s.player.gold += it.value; it.qty--; if (it.qty <= 0) removeById(it.id); } else { s.player.gold += it.value; removeById(it.id); }
    Audio.sfx('coin'); E.tooltip.hidden = true; bus.emit('itemsChanged'); renderShop();
  }));
}
export function openForge() { if (G.inDialogue) { handoff(); closeDialogue(); } openPanel('forge'); }
const upCost = (it) => ({ gold: Math.round(20 * (it.upgrade + 1) * (1 + it.rarity * 0.6) * (1 + it.level * 0.08)), dust: 2 + it.upgrade * 2 });
let forgeSel = null;
function renderForge() {
  const s = G.save;
  const gear = [...Object.values(s.equipped).filter(Boolean), ...s.inventory.filter((i) => i.kind === 'gear')];
  if (!forgeSel || !gear.find((g) => g.id === forgeSel)) forgeSel = gear[0]?.id || null;
  const sel = gear.find((g) => g.id === forgeSel);
  let detail = '<p class="muted">You have no gear to improve.</p>';
  if (sel) {
    const c = upCost(sel), dust = countItem('dust');
    const max = sel.upgrade >= 10;
    const next = { ...sel, upgrade: sel.upgrade + 1 };
    const cur = itemStats(sel), nxt = itemStats(next);
    detail = `<div class="sel-tt">${tooltipHTML(sel, false)}</div>
      ${max ? '<p>This piece is as good as Hild can make it.</p>' : `<h4>Improve to +${sel.upgrade + 1}</h4><ul class="upg">${Object.keys(cur).map((k) => `<li>${statLine(k, cur[k])} <span class="up">to ${nxt[k]}</span></li>`).join('')}</ul>
      <p>Costs <b>${c.gold} gold</b> and <b>${c.dust} echo dust</b>. You have ${s.player.gold} gold and ${dust} dust.</p>
      <button class="btn primary" id="do-up" ${s.player.gold >= c.gold && dust >= c.dust ? '' : 'disabled'}>Improve</button>`}`;
  }
  E.panelBody.innerHTML = `<div class="forge"><section><h3>Your gear</h3><div class="grid small">${gear.map((g) => slotHTML(g, `data-f="${g.id}" class-sel="${g.id === forgeSel}"`)).join('')}</div><p class="muted small">Break down gear you don't need in your bag (C) to get echo dust. Hollows drop it too.</p></section><section>${detail}</section></div>`;
  E.panelBody.querySelectorAll('[data-f]').forEach((el) => { if (el.dataset.f === forgeSel) el.classList.add('picked'); el.addEventListener('click', () => { forgeSel = el.dataset.f; Audio.sfx('ui'); renderForge(); }); });
  bindTooltips(E.panelBody, (id) => gear.find((g) => g.id === id));
  const b = $('do-up');
  if (b) b.addEventListener('click', () => {
    const c = upCost(sel);
    if (s.player.gold < c.gold || !removeItem('dust', c.dust)) return;
    s.player.gold -= c.gold; sel.upgrade++; sel.value = Math.round(sel.value * 1.15);
    Audio.sfx('chest'); toast(`${sel.name} is now +${sel.upgrade}.`, 'quest');
    G.player.recompute(); renderForge();
  });
}
export function openBoard() { openPanel('board'); }
function renderBoard() {
  const list = G.save.bounties.list;
  E.panelBody.innerHTML = `<div class="board"><h3>Bounties</h3><p class="muted">Posted by the watch. New ones go up every morning.</p>
    ${list.map((b) => `<div class="bounty ${b.claimed ? 'claimed' : b.done ? 'ready' : ''}"><div><b>${esc(b.text)}</b><small>${b.reward.gold} gold, ${b.reward.xp} XP and ${RARITY[b.reward.rarity].name.toLowerCase()} gear</small>
      <div class="mini"><div style="width:${Math.min(100, (b.progress / b.count) * 100)}%"></div></div></div>
      ${b.claimed ? '<span class="muted">Claimed</span>' : b.done ? `<button class="btn primary" data-claim="${b.id}">Claim</button>` : `<span class="muted">${b.progress} of ${b.count}</span>`}</div>`).join('')}</div>`;
  E.panelBody.querySelectorAll('[data-claim]').forEach((btn) => btn.addEventListener('click', () => { claimBounty(list.find((b) => b.id === btn.dataset.claim)); renderBoard(); }));
}
export function openGift(npc) { giftChooser(npc); }

let settingsHandlers = {};
export function setSettingsHandlers(h) { settingsHandlers = h; }
function renderSettings() {
  const s = G.settings;
  E.panelBody.innerHTML = `<div class="settings"><section><h3>Settings</h3>
    <label>Sound volume <input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-set="volume"></label>
    <label>Music volume <input type="range" min="0" max="1" step="0.05" value="${s.music}" data-set="music"></label>
    <label>Mouse sensitivity <input type="range" min="0.3" max="2.5" step="0.1" value="${s.sensitivity}" data-set="sensitivity"></label>
    <label>Graphics <select data-set="quality"><option value="high" ${s.quality === 'high' ? 'selected' : ''}>High</option><option value="medium" ${s.quality === 'medium' ? 'selected' : ''}>Medium</option><option value="low" ${s.quality === 'low' ? 'selected' : ''}>Low (no shadows)</option></select></label>
    <div class="btnrow"><button class="btn" id="save-now">Save now</button><button class="btn" id="to-title">Save and quit to title</button></div>
    <p class="muted small">Your game saves itself every 20 seconds and whenever something important happens.</p></section>
    <section><h3>Controls</h3><dl class="keys">
    <dt>W A S D</dt><dd>Move</dd><dt>Shift</dt><dd>Sprint</dd><dt>Mouse</dt><dd>Look around (click the game first)</dd>
    <dt>Left click</dt><dd>Attack, click again to combo</dd><dt>Space</dt><dd>Dodge roll</dd><dt>1 2 3 4</dt><dd>Skills</dd>
    <dt>Q</dt><dd>Drink a Lantern Tonic</dd><dt>E</dt><dd>Talk, open, pick up</dd><dt>F</dt><dd>Pet your fox</dd>
    <dt>C</dt><dd>Character and bag</dd><dt>J</dt><dd>Journal</dd><dt>M</dt><dd>Map</dd><dt>Esc</dt><dd>Close menus</dd></dl></section></div>`;
  E.panelBody.querySelectorAll('[data-set]').forEach((el) => el.addEventListener('input', () => {
    const k = el.dataset.set; s[k] = k === 'quality' ? el.value : parseFloat(el.value);
    Audio.applyVolume(); settingsHandlers.change?.(k);
  }));
  $('save-now').addEventListener('click', () => { S.save(); toast('Game saved.', 'info'); });
  $('to-title').addEventListener('click', () => { closePanel(); settingsHandlers.quit?.(); });
}

// ---------------------------------------------------------------- quest target + tracker
export function questTarget() {
  const id = G.save.tracked;
  const q = id && G.save.quests[id];
  if (!q || q.state !== 'active') return null;
  const st = QUESTS[id].steps[q.step];
  if (!st) return null;
  const p = G.player.pos;
  const nearest = (pts) => pts.reduce((b, c) => (!b || Math.hypot(c.x - p.x, c.z - p.z) < Math.hypot(b.x - p.x, b.z - p.z) ? c : b), null);
  if (st.type === 'talk') return NPCS[st.npc].pos;
  if (st.hideMarker) return { x: st.x + 9, z: st.z - 7, area: true };
  if (st.x !== undefined) return { x: st.x, z: st.z };
  if (st.spawn && st.spawn.x !== undefined) return { x: st.spawn.x, z: st.spawn.z };
  if (st.type === 'collect' && st.item === 'lanternPiece') return nearest(PLACES.lanternPieces.filter((_, i) => !(G.save.world.pieces || []).includes(i)));
  if (st.type === 'collect' && st.item === 'moonpetal') return nearest(HERBS.map(([x, z], i) => ({ x, z, i })).filter((h) => (G.save.world.herbs[h.i] || 0) < G.day));
  if (st.type === 'shrines') return nearest(SHRINES.filter((s) => !G.save.world.shrines.includes(s.id)));
  if (st.type === 'shards') return nearest(SHARDS.filter((_, i) => !G.save.world.shards.includes(i)));
  return null;
}

let trackerDirty = true, trackTimer = 0;
function updateTracker() {
  const id = G.save.tracked;
  const q = id && G.save.quests[id];
  if (!q || q.state !== 'active') {
    const any = Object.entries(G.save.quests).find(([, x]) => x.state === 'active');
    if (any) { G.save.tracked = any[0]; return updateTracker(); }
    E.trackerTitle.textContent = 'Free roam';
    E.trackerStep.textContent = G.save.world.bossDefeated ? 'Clear Echo Rifts, hunt bounties and find every memory.' : 'Explore the valley.';
  } else {
    const def = QUESTS[id], st = def.steps[q.step];
    E.trackerTitle.textContent = def.title;
    E.trackerStep.innerHTML = `${esc(st.text)}${st.count > 1 ? ` <b>${q.progress} of ${st.count}</b>` : ''}`;
  }
  // a few short goals that are always within reach
  const goals = [];
  const p = G.save.player, f = G.save.fox;
  if (p.statPoints) goals.push(`Spend ${p.statPoints} stat points (C)`);
  goals.push(`Level ${p.level + 1} in ${xpToNext(p.level) - p.xp} XP`);
  if (f.joined && f.bondLevel < 10) { const perk = BOND_PERKS.find((x) => x.lvl > f.bondLevel); goals.push(`Bond ${f.bondLevel + 1} with ${f.name} in ${bondNeed(f.bondLevel) - f.bond}${perk && perk.lvl === f.bondLevel + 1 ? `: ${perk.text}` : ''}`); }
  const ready = G.save.bounties.list.filter((b) => b.done && !b.claimed).length;
  if (ready) goals.push(`${ready} bounty reward${ready > 1 ? 's' : ''} at the notice board`);
  else if (G.save.world.shrines.length < 6 && f.joined) goals.push(`Shrines lit: ${G.save.world.shrines.length} of 6`);
  E.goals.innerHTML = goals.slice(0, 3).map((g) => `<li>${esc(g)}</li>`).join('');
}

const wpV = new THREE.Vector3();
function updateWaypoint() {
  const t = questTarget();
  if (!t || G.paused) { E.waypoint.hidden = true; return; }
  const p = G.player.pos;
  const d = Math.hypot(t.x - p.x, t.z - p.z);
  if (d < 4) { E.waypoint.hidden = true; return; }
  E.waypoint.hidden = false;
  wpV.set(t.x, heightAt(t.x, t.z) + 3.5, t.z).project(G.camera);
  let sx = (wpV.x * 0.5 + 0.5) * innerWidth, sy = (-wpV.y * 0.5 + 0.5) * innerHeight;
  const behind = wpV.z > 1;
  if (behind) { sx = innerWidth - sx; sy = innerHeight - 60; }
  const m = 48;
  const off = behind || sx < m || sx > innerWidth - m || sy < m || sy > innerHeight - m;
  sx = clamp(sx, m, innerWidth - m); sy = clamp(sy, m + 40, innerHeight - m - 90);
  E.waypoint.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%)`;
  E.waypoint.classList.toggle('edge', off);
  E.waypoint.querySelector('span').textContent = t.area ? `Search nearby, ${Math.round(d)} m` : `${Math.round(d)} m`;
}

// minimap
let miniCtx = null;
function drawMinimap() {
  if (!miniCtx) { const c = $('minimap'); miniCtx = c.getContext('2d'); }
  const g = miniCtx, S2 = 180, p = G.player.pos;
  const view = 110; // world units across
  const scale = S2 / view;
  g.save();
  g.clearRect(0, 0, S2, S2);
  g.beginPath(); g.arc(S2 / 2, S2 / 2, S2 / 2, 0, Math.PI * 2); g.clip();
  g.fillStyle = '#16203a'; g.fillRect(0, 0, S2, S2);
  const big = WORLD * scale;
  g.translate(S2 / 2 - w2m(p.x, big), S2 / 2 - w2m(p.z, big));
  g.drawImage(mapImg, 0, 0, big, big);
  drawFog(g, big);
  drawMarkers(g, big, { scale: 1, enemies: true, rifts: mapRiftsFn() });
  g.restore();
}

export function updateHUD(dt) {
  const pl = G.player, p = G.save.player;
  if (!pl) return;
  const st = pl.stats;
  E.hp.style.width = `${(pl.hp / st.maxHp) * 100}%`;
  E.hpT.textContent = `${Math.ceil(pl.hp)} / ${st.maxHp}`;
  E.sp.style.width = `${(pl.sp / st.maxSp) * 100}%`;
  E.st.style.width = `${pl.stamina}%`;
  E.st.parentElement.classList.toggle('low', pl.stamina < 22);
  E.lvl.textContent = p.level;
  const need = xpToNext(p.level);
  E.xp.style.width = `${(p.xp / need) * 100}%`;
  E.xpT.textContent = `Level ${p.level}, ${p.xp} of ${need} XP`;
  E.gold.innerHTML = `<span class="coin"></span>${p.gold}`;
  E.clock.textContent = `Day ${G.day}, ${fmtTime(G.time)}${isNight() ? ', night' : ''}`;
  const f = G.save.fox;
  E.foxBox.hidden = !f.joined;
  if (f.joined) { E.foxName.textContent = f.name; E.foxLvl.textContent = `Bond ${f.bondLevel}`; E.foxBond.style.width = `${f.bondLevel >= 10 ? 100 : (f.bond / bondNeed(f.bondLevel)) * 100}%`; }
  E.statPts.hidden = !p.statPoints;
  E.statPts.textContent = `${p.statPoints} points (C)`;
  for (let i = 0; i < 4; i++) {
    const el = E.skillEls[i];
    const unlocked = pl.skillUnlocked(i);
    el.classList.toggle('locked', !unlocked);
    el.classList.toggle('nosp', unlocked && pl.sp < SKILLS[i].cost);
    const cd = pl.cds[i] / SKILLS[i].cd;
    el.querySelector('.cd').style.setProperty('--p', `${cd * 100}%`);
    el.classList.toggle('cooling', cd > 0);
  }
  E.tonic.textContent = countItem('tonic');
  E.lockHint.hidden = G.paused || G.inDialogue || document.pointerLockElement != null || !pl.alive;
  trackTimer -= dt;
  if (trackerDirty || trackTimer <= 0) { trackerDirty = false; trackTimer = 0.5; updateTracker(); }
  fogTimer -= dt; if (fogTimer <= 0) { fogTimer = 0.4; revealFog(); }
  drawMinimap();
  updateWaypoint();
  updateDamageNumbers(dt);
}
