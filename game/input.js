// Keyboard and mouse state.
import { G } from './state.js';

export const input = {
  keys: new Set(),
  pressed: new Set(),   // keys pressed this frame
  mouseDown: false,
  rightDown: false,
  clicked: false,
  dx: 0, dy: 0, wheel: 0,
  locked: false,
};

export function initInput(canvas) {
  addEventListener('keydown', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (['Tab', ' ', 'ArrowUp', 'ArrowDown'].includes(e.key) && G.started && !isTyping(e)) e.preventDefault();
    if (isTyping(e)) return;
    if (G.inDialogue) return; // dialogue keys (Space, 1-4, E) must not also move or attack
    if (!input.keys.has(k)) input.pressed.add(k);
    input.keys.add(k);
  });
  addEventListener('keyup', (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; input.keys.delete(k); });
  addEventListener('blur', () => { input.keys.clear(); input.mouseDown = false; input.rightDown = false; });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { input.mouseDown = true; input.clicked = true; }
    if (e.button === 2) input.rightDown = true;
  });
  addEventListener('mouseup', (e) => { if (e.button === 0) input.mouseDown = false; if (e.button === 2) input.rightDown = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('mousemove', (e) => {
    if (input.locked || input.rightDown) { input.dx += e.movementX || 0; input.dy += e.movementY || 0; }
  });
  canvas.addEventListener('wheel', (e) => { input.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  document.addEventListener('pointerlockchange', () => { input.locked = document.pointerLockElement === canvas; });
}

function isTyping(e) { return e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'); }

export function requestLock(canvas) {
  if (document.pointerLockElement !== canvas && canvas.requestPointerLock) {
    try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (_) { /* not available */ }
  }
}
export function releaseLock() { if (document.pointerLockElement) document.exitPointerLock(); }

export function endFrame() { input.pressed.clear(); input.clicked = false; input.dx = 0; input.dy = 0; input.wheel = 0; }
export const down = (k) => input.keys.has(k);
export const hit = (k) => input.pressed.has(k);
