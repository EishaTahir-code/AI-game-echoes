// Save and load through localStorage.
import { G, freshSave } from './state.js';

const KEY = 'lanternmere-save-v1';
const SKEY = 'lanternmere-settings-v1';

function merge(base, data) {
  for (const k of Object.keys(base)) {
    if (!(k in data)) data[k] = base[k];
    else if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && data[k] && typeof data[k] === 'object') merge(base[k], data[k]);
  }
  return data;
}

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch (_) { return false; }
}
export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return merge(freshSave(), JSON.parse(raw));
  } catch (_) { return null; }
}
export function writeSave() {
  if (!G.save || !G.player) return false;
  G.player.saveState();
  G.save.time = G.time; G.save.day = G.day;
  try { localStorage.setItem(KEY, JSON.stringify(G.save)); return true; } catch (_) { return false; }
}
export function deleteSave() { try { localStorage.removeItem(KEY); } catch (_) { /* ignore */ } }

export function loadSettings() {
  try { const s = JSON.parse(localStorage.getItem(SKEY) || 'null'); if (s) Object.assign(G.settings, s); } catch (_) { /* ignore */ }
}
export function saveSettings() { try { localStorage.setItem(SKEY, JSON.stringify(G.settings)); } catch (_) { /* ignore */ } }
