// Dialogue box: typewriter text, choices with hints, friendship hearts, memory badges.
import { G } from './state.js';
import { NPCS } from './data.js';
import { S, giveGift, npcState } from './story.js';
import { releaseLock, input } from './input.js';
import { countItem, CONSUMABLES } from './items.js';
import * as Audio from './audio.js';
import { tip } from './ui.js';

const D = { open: false, npc: null, node: null, full: '', shown: 0, choices: [], handoff: false, onClose: null };
let el;

export function initDialogue() {
  el = {
    root: document.getElementById('dialogue'),
    portrait: document.getElementById('dlg-portrait'),
    name: document.getElementById('dlg-name'),
    title: document.getElementById('dlg-title'),
    hearts: document.getElementById('dlg-hearts'),
    text: document.getElementById('dlg-text'),
    memory: document.getElementById('dlg-memory'),
    choices: document.getElementById('dlg-choices'),
    next: document.getElementById('dlg-next'),
  };
  el.root.addEventListener('click', (e) => { if (!e.target.closest('.choice')) advance(); });
  addEventListener('keydown', (e) => {
    if (!D.open) return;
    if (e.key === ' ' || e.key === 'Enter' || e.key.toLowerCase() === 'e') { e.preventDefault(); advance(); }
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= D.choices.length && D.shown >= D.full.length) { e.preventDefault(); choose(n - 1); }
    if (e.key === 'Escape') { e.preventDefault(); closeDialogue(); }
  });
}

export const dialogueOpen = () => D.open;

function heartsHTML(aff) {
  let h = '';
  for (let i = 0; i < 5; i++) {
    const fill = Math.max(0, Math.min(1, (aff - i * 20) / 20));
    h += `<span class="heart" style="--f:${Math.round(fill * 100)}%"></span>`;
  }
  return h;
}

function setSpeaker(npcId) {
  const def = NPCS[npcId];
  if (npcId === 'fox') {
    el.portrait.src = G.foxPortrait || '';
    el.portrait.style.background = '#6a3a24';
    el.name.textContent = G.save.fox.name;
    el.title.textContent = 'Spirit fox';
    el.hearts.innerHTML = '';
    return;
  }
  el.portrait.src = def.portrait || '';
  el.portrait.style.background = def.portraitBg;
  el.name.textContent = def.name;
  el.title.textContent = def.title;
  el.hearts.innerHTML = heartsHTML(S.aff(npcId));
  el.hearts.title = `Friendship ${S.aff(npcId)} of 100`;
}

export function openDialogue(npcId, nodeId = null) {
  const def = NPCS[npcId];
  D.open = true; D.npc = npcId; D.onClose = null;
  G.inDialogue = true;
  G.talkTarget = def.pos;
  releaseLock();
  el.root.classList.add('open');
  document.body.classList.add('talking');
  setSpeaker(npcId);
  npcState(npcId);
  goTo(nodeId || def.root());
}

function goTo(nodeId) {
  if (!nodeId) { closeDialogue(); return; }
  const def = NPCS[D.npc];
  const node = def.nodes[nodeId];
  if (!node) { closeDialogue(); return; }
  D.node = node;
  S.lastMemory = null;
  const text = typeof node.text === 'function' ? node.text() : node.text;
  if (node.effect) node.effect();
  showText(text, S.lastMemory);
  D.choices = (node.choices || []).filter((c) => !c.cond || c.cond());
  renderChoices(false);
  if (D.open) el.hearts.innerHTML = heartsHTML(S.aff(D.npc));
}

function showText(text, memory) {
  D.full = text; D.shown = 0;
  el.text.textContent = '';
  el.memory.hidden = !memory;
  if (memory) el.memory.textContent = memory;
  el.next.hidden = true;
}

function renderChoices(visible) {
  el.choices.innerHTML = '';
  if (!visible) return;
  if (!D.choices.length) { el.next.hidden = false; return; }
  if (D.choices.some((c) => c.hint && c.hint.includes('♥'))) tip('hearts', 'Answers with a heart change how this person feels about you. People remember what you say, and gossip spreads overnight.');
  D.choices.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'choice';
    const hint = c.hint ? `<span class="hint ${/♥ \+/.test(c.hint) ? 'pos' : /-\d/.test(c.hint) ? 'neg' : ''}">${c.hint.replace('♥', '<span class="mini-heart"></span>')}</span>` : '';
    b.innerHTML = `<span class="key">${i + 1}</span><span class="ctext">${typeof c.text === 'function' ? c.text() : c.text}</span>${hint}`;
    b.addEventListener('click', (e) => { e.stopPropagation(); choose(i); });
    b.addEventListener('mouseenter', () => Audio.sfx('ui'));
    el.choices.appendChild(b);
  });
}

function advance() {
  if (!D.open) return;
  if (D.shown < D.full.length) { D.shown = D.full.length; el.text.textContent = D.full; renderChoices(true); return; }
  if (D.choices.length) return;
  if (D.custom) { const cb = D.custom; D.custom = null; cb(); return; }
  const next = typeof D.node?.next === 'function' ? D.node.next() : D.node?.next;
  goTo(next ?? null);
}

function choose(i) {
  const c = D.choices[i];
  if (!c) return;
  Audio.sfx('ui');
  D.choices = [];
  if (c.effect) c.effect();
  if (!D.open) return;
  if (D.handoff) { D.handoff = false; return; }
  goTo(typeof c.next === 'function' ? c.next() : c.next);
}

export function closeDialogue() {
  if (!D.open) return;
  D.open = false; D.custom = null; G.talkTarget = null;
  input.pressed.clear(); input.keys.clear();
  el.root.classList.remove('open');
  document.body.classList.remove('talking');
  G.inDialogue = false;
  const cb = D.onClose; D.onClose = null;
  if (cb) cb();
  S.save();
}

export function handoff() { D.handoff = true; }

// A single line with no tree, e.g. a friendship milestone or the fox speaking.
export function sayLine(npcId, text, onClose) {
  if (!D.open) {
    D.open = true; G.inDialogue = true; releaseLock();
    el.root.classList.add('open'); document.body.classList.add('talking');
  }
  D.npc = npcId === 'fox' ? D.npc : npcId;
  setSpeaker(npcId);
  D.node = { next: null };
  D.choices = [];
  D.onClose = onClose || null;
  showText(text, null);
}

export function giftChooser(npcId) {
  handoff();
  const gifts = ['cake', 'moonpetal', 'dust'].filter((k) => countItem(k) > 0);
  D.full = 'What would you like to give?'; D.shown = D.full.length;
  el.text.textContent = D.full; el.memory.hidden = true; el.next.hidden = true;
  D.choices = gifts.map((k) => ({
    text: `${CONSUMABLES[k].name} (you have ${countItem(k)})`,
    effect: () => {
      handoff();
      const res = giveGift(npcId, k);
      if (!res) return;
      el.hearts.innerHTML = heartsHTML(S.aff(npcId));
      showText(res.line, res.delta > 0 ? `Friendship +${res.delta}` : res.delta < 0 ? `Friendship ${res.delta}` : null);
      D.node = { next: null };
    },
  }));
  D.choices.push({ text: 'Never mind.', effect: () => { handoff(); goTo(NPCS[npcId].root()); } });
  renderChoices(true);
}

// typewriter, called each frame
export function updateDialogue(dt) {
  if (!D.open || D.shown >= D.full.length) return;
  D.shown = Math.min(D.full.length, D.shown + dt * 70);
  el.text.textContent = D.full.slice(0, Math.floor(D.shown));
  if (D.shown >= D.full.length) renderChoices(true);
}
