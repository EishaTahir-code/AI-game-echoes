// The player: movement, camera, combat, skills, damage and death.
import * as THREE from 'three';
import { G } from './state.js';
import { input, down, hit } from './input.js';
import { makeHumanoid, animateHumanoid } from './models.js';
import { groundY, isDeepWater, heightAt, worldRefs, MAP_R, MARSH } from './world.js';
import { clamp, angleDiff, lerp, rand, bus } from './util.js';
import { itemStats, countItem, removeItem } from './items.js';
import { slash, ring, sparks, projectile } from './fx.js';
import * as Audio from './audio.js';
import * as UI from './ui.js';
import { SKILL_UNLOCKS } from './story.js';

const tmpLook = new THREE.Vector3();

export const SKILLS = [
  { key: '1', name: 'Lantern Burst', desc: 'A ring of lantern fire around you.', cost: 25, cd: 6, color: 0xffb547 },
  { key: '2', name: 'Fox Flame', desc: 'Your fox hurls spirit fire at the nearest hollow.', cost: 20, cd: 7, color: 0xff7a30 },
  { key: '3', name: 'Gale Dash', desc: 'Dash forward, cutting through everything in your path.', cost: 20, cd: 5, color: 0x9fe8ff },
  { key: '4', name: 'Moonfall', desc: 'Call down the moon on everything nearby.', cost: 50, cd: 18, color: 0xcfd8ff },
];

export class Player {
  constructor() {
    this.model = makeHumanoid({ skin: 0xf1c9a5, hair: 0x3a2a24, hairStyle: 'spiky', coat: 0x2f3f6a, coat2: 0xffb547, legs: 0x2a2630, weapon: 'sword' });
    G.scene.add(this.model);
    const sp = G.save.player;
    this.pos = { x: sp.x, z: sp.z };
    this.y = groundY(sp.x, sp.z);
    this.facing = sp.yaw || 0;
    this.camYaw = (sp.yaw || 0) + Math.PI;
    this.camPitch = 0.38;
    this.camDist = 9.5;
    this.camOffset = 0; // extra look-around from dragging the mouse (steering mode)
    this.cruise = 0;    // builds up while travelling, for a faster jog
    this.snap = true;   // put the camera straight behind the hero (after teleports)
    this.vel = { x: 0, z: 0 };
    this.state = 'idle';
    this.t = 0;
    this.alive = true;
    this.stamina = 100;
    this.staminaDelay = 0;
    this.combo = 0; this.attackT = 0; this.hitDone = false; this.queued = false; this.comboReset = 0;
    this.dodgeT = 0; this.dodgeDir = { x: 0, z: 1 };
    this.dashT = 0; this.dashHit = new Set();
    this.iframes = 0;
    this.cds = [0, 0, 0, 0];
    this.hitCount = 0;
    this.combatTimer = 0;
    this.moonfallT = 0;
    this.recompute();
    this.hp = Math.min(sp.hp || this.stats.maxHp, this.stats.maxHp);
    this.sp = Math.min(sp.sp ?? this.stats.maxSp, this.stats.maxSp);
    this.speedNow = 0;
  }

  recompute() {
    const p = G.save.player, eq = G.save.equipped;
    const g = { atk: 0, def: 0, hp: 0, crit: 0, spi: 0, spd: 0 };
    for (const slot of ['weapon', 'armor', 'charm']) for (const [k, v] of Object.entries(itemStats(eq[slot]))) g[k] += v;
    this.stats = {
      maxHp: Math.round(90 + p.vit * 14 + p.level * 8 + g.hp),
      atk: Math.round(6 + p.str * 2.5 + p.level * 1.5 + g.atk),
      def: Math.round(g.def + p.vit * 0.6),
      crit: Math.min(5 + g.crit + p.str * 0.3, 60),
      maxSp: Math.round(50 + p.spi * 7 + g.spi),
      spRegen: 2.5 + p.spi * 0.35,
      speed: 7.2 * (1 + g.spd / 100),
    };
    this.uniques = new Set(['weapon', 'armor', 'charm'].map((s) => eq[s]?.unique).filter(Boolean));
    if (this.hp > this.stats.maxHp) this.hp = this.stats.maxHp;
  }

  healFull() { this.recompute(); this.hp = this.stats.maxHp; this.sp = this.stats.maxSp; }

  skillUnlocked(i) {
    if (i === 1) return G.save.fox.joined && G.save.fox.bondLevel >= 3;
    return G.save.player.level >= SKILL_UNLOCKS[i + 1];
  }

  update(dt) {
    this.t += dt;
    if (!this.alive) { this.updateModel(dt, 0); return; }
    this.combatTimer = Math.max(0, this.combatTimer - dt);
    for (let i = 0; i < 4; i++) this.cds[i] = Math.max(0, this.cds[i] - dt);
    this.iframes = Math.max(0, this.iframes - dt);
    // regen
    this.sp = Math.min(this.stats.maxSp, this.sp + this.stats.spRegen * dt);
    if (this.combatTimer <= 0) this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.maxHp * 0.02 * dt);
    this.staminaDelay -= dt;
    if (this.staminaDelay <= 0) this.stamina = Math.min(100, this.stamina + 32 * dt);

    const canAct = !G.paused && !G.inDialogue;
    const steer = G.settings.controls !== 'mouse';
    // keyboard
    let fwdIn = 0, turnIn = 0;
    if (canAct) {
      if (down('w') || down('ArrowUp')) fwdIn += 1;
      if (down('s') || down('ArrowDown')) fwdIn -= 1;
      if (down('a') || down('ArrowLeft')) turnIn += 1;
      if (down('d') || down('ArrowRight')) turnIn -= 1;
    }
    this.turning = turnIn;
    // camera
    if (canAct) {
      const sens = 0.0024 * G.settings.sensitivity;
      if (steer) {
        // optional: drag with the right mouse button to glance around; the view eases back behind you
        this.camOffset -= input.dx * sens;
        if (!input.rightDown) this.camOffset *= Math.max(0, 1 - dt * (fwdIn || turnIn ? 4 : 1.2));
      } else this.camYaw -= input.dx * sens;
      this.camPitch = clamp(this.camPitch + input.dy * sens, -0.15, 1.15);
      this.camDist = clamp(this.camDist + input.wheel * 0.8, 4.5, 16);
    }

    // movement intent
    let dir, dl;
    if (steer) {
      // A/D and the left/right arrows turn the hero, and the camera swings around with them
      if (turnIn && this.state !== 'dodge' && this.dashT <= 0) this.facing += turnIn * 2.6 * dt * (this.state === 'attack' ? 0.5 : 1);
      const back = fwdIn < 0 ? -1 : 1;
      dir = { x: Math.sin(this.facing) * back, z: Math.cos(this.facing) * back };
      dl = fwdIn ? 1 : 0;
      this.backing = fwdIn < 0;
    } else {
      const mx = -turnIn, mz = -fwdIn;
      const fwd = { x: -Math.sin(this.camYaw), z: -Math.cos(this.camYaw) };
      const right = { x: Math.cos(this.camYaw), z: -Math.sin(this.camYaw) };
      dir = { x: fwd.x * -mz + right.x * mx, z: fwd.z * -mz + right.z * mx };
      dl = Math.hypot(dir.x, dir.z);
      if (dl > 0) { dir.x /= dl; dir.z /= dl; }
      this.backing = false;
    }

    // actions
    if (canAct) {
      if ((input.clicked || (input.mouseDown && this.state !== 'attack')) && this.state !== 'dodge') this.tryAttack();
      if (hit(' ') && this.state !== 'dodge' && this.stamina >= 20) {
        let dd = { x: Math.sin(this.facing), z: Math.cos(this.facing) };
        if (steer) {
          if (fwdIn < 0) dd = { x: -dd.x, z: -dd.z };
          else if (!fwdIn && turnIn) { const a = this.facing + (turnIn * Math.PI) / 2; dd = { x: Math.sin(a), z: Math.cos(a) }; }
        } else if (dl > 0) dd = dir;
        this.startDodge(dd, steer);
      }
      for (let i = 0; i < 4; i++) if (hit(SKILLS[i].key)) this.useSkill(i);
      if (hit('q')) this.drink();
    }

    let speed = 0;
    const inMarshWater = heightAt(this.pos.x, this.pos.z) < 0.05 && Math.hypot(this.pos.x - MARSH.x, this.pos.z - MARSH.z) < MARSH.r + 6;
    if (this.state === 'dodge') {
      this.dodgeT -= dt;
      const k = this.dodgeT / 0.42;
      this.move(this.dodgeDir.x * 15 * (0.4 + k), this.dodgeDir.z * 15 * (0.4 + k), dt);
      if (this.dodgeT <= 0) this.state = 'idle';
    } else if (this.dashT > 0) {
      this.dashT -= dt;
      this.move(this.dodgeDir.x * 36, this.dodgeDir.z * 36, dt);
      for (const e of G.enemies) {
        if (!e.alive || this.dashHit.has(e)) continue;
        if (Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) < 2.6 + e.radius) { this.dashHit.add(e); this.dealDamage(e, 1.6, this.dodgeDir); }
      }
      if (this.dashT <= 0) this.state = 'idle';
    } else if (this.state === 'attack') {
      this.attackT -= dt;
      const dur = this.combo === 2 ? 0.46 : 0.36;
      const prog = 1 - this.attackT / dur;
      if (!this.hitDone && prog > 0.38) { this.hitDone = true; this.applySwing(); }
      // slight lunge
      if (prog < 0.4) this.move(Math.sin(this.facing) * 4, Math.cos(this.facing) * 4, dt);
      if (this.attackT <= 0) {
        if (this.queued) { this.queued = false; this.combo = (this.combo + 1) % 3; this.beginSwing(); }
        else { this.state = 'idle'; this.comboReset = 0.6; }
      }
    } else {
      const sprint = down('Shift') && dl > 0 && this.stamina > 1;
      speed = dl > 0 ? this.stats.speed * (sprint ? 1.55 : 1) : 0;
      if (this.backing) speed *= 0.6;
      // out of combat you settle into a faster jog, so the bigger world doesn't feel slow
      this.cruise = dl > 0 && !this.backing && !sprint && this.combatTimer <= 0 ? Math.min(1, this.cruise + dt / 1.2) : 0;
      speed *= 1 + 0.4 * this.cruise;
      if (inMarshWater && !this.uniques.has('mirewalker')) speed *= 0.72;
      if (sprint) { this.stamina -= 16 * dt; this.staminaDelay = 0.5; }
      this.move(dir.x * speed, dir.z * speed, dt);
      if (dl > 0 && !steer) this.facing += angleDiff(this.facing, Math.atan2(dir.x, dir.z)) * Math.min(dt * 14, 1);
      this.state = dl > 0 ? 'move' : 'idle';
      if (this.comboReset > 0) { this.comboReset -= dt; if (this.comboReset <= 0) this.combo = 0; }
    }
    if (this.moonfallT > 0) { this.moonfallT -= dt; if (this.moonfallT <= 0) this.moonfallImpact(); }
    this.speedNow = speed;
    this.updateModel(dt, speed || (turnIn && this.state === 'idle' ? 2.5 : 0));
    this.updateCamera(dt);
  }

  move(vx, vz, dt) {
    const nx = this.pos.x + vx * dt, nz = this.pos.z + vz * dt;
    const pier = worldRefs.pier;
    const onPier = (x, z) => pier && x > pier.x0 && x < pier.x1 && z > pier.z0 && z < pier.z1;
    const p = { x: nx, z: nz };
    if (isDeepWater(p.x, p.z) && !onPier(p.x, p.z)) {
      // slide along the shore
      if (!isDeepWater(nx, this.pos.z) || onPier(nx, this.pos.z)) { p.x = nx; p.z = this.pos.z; }
      else if (!isDeepWater(this.pos.x, nz) || onPier(this.pos.x, nz)) { p.x = this.pos.x; p.z = nz; }
      else return;
    }
    G.colliders.resolve(p, 0.45);
    const r = Math.hypot(p.x, p.z);
    if (r > MAP_R) { p.x *= MAP_R / r; p.z *= MAP_R / r; }
    // block steep mountain climbs
    if (heightAt(p.x, p.z) - heightAt(this.pos.x, this.pos.z) > 1.4 * Math.max(dt * 10, 0.3) && r > 258) return;
    this.pos.x = p.x; this.pos.z = p.z;
    const gy = onPier(p.x, p.z) ? Math.max(pier.y, groundY(p.x, p.z)) : groundY(p.x, p.z);
    this.y = lerp(this.y, gy, Math.min(dt * 18, 1));
  }

  tryAttack() {
    if (this.state === 'attack') { if (this.attackT < 0.22) this.queued = true; return; }
    if (this.comboReset <= 0) this.combo = 0; else this.combo = (this.combo + 1) % 3;
    this.beginSwing();
  }
  beginSwing() {
    this.state = 'attack';
    this.attackT = this.combo === 2 ? 0.46 : 0.36;
    this.hitDone = false;
    // soft lock: face the nearest enemy in front (or right beside you)
    const steer = G.settings.controls !== 'mouse';
    const aim = steer ? this.facing : Math.atan2(-Math.sin(this.camYaw), -Math.cos(this.camYaw));
    let best = null, bd = 7;
    for (const e of G.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) - e.radius;
      const a = Math.atan2(e.pos.x - this.pos.x, e.pos.z - this.pos.z);
      const inCone = Math.abs(angleDiff(aim, a)) < (steer ? 1.7 : 1.3);
      if (d < bd && (inCone || d < 2.5)) { bd = d; best = a; }
    }
    this.facing = best ?? aim;
    Audio.sfx('swing');
  }
  applySwing() {
    const big = this.combo === 2;
    slash(this.pos.x, this.y, this.pos.z, this.facing, big ? 0xffe0a0 : 0xfff6e0, big);
    const range = big ? 3.6 : 3.0, arc = big ? 1.5 : 1.15;
    let any = false;
    for (const e of G.enemies) {
      if (!e.alive) continue;
      const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz) - e.radius;
      if (d > range) continue;
      if (Math.abs(angleDiff(this.facing, Math.atan2(dx, dz))) > arc && d > 0.6) continue;
      this.dealDamage(e, big ? 1.6 : 1.0, { x: dx, z: dz }, big ? 7 : 4);
      any = true;
    }
    if (any) {
      this.hitCount++;
      if (this.uniques.has('aurelsLight') && this.hitCount % 3 === 0) this.fireWave();
    }
  }
  fireWave() {
    projectile({ x: this.pos.x, y: this.y + 1.2, z: this.pos.z, dx: Math.sin(this.facing), dz: Math.cos(this.facing), speed: 22, owner: 'player', color: 0xffb547, radius: 1.4, size: 0.5, life: 0.9, onHit: (e) => this.dealDamage(e, 1.4, null, 3) });
  }

  dealDamage(e, mult, dir, knock = 3) {
    const crit = Math.random() * 100 < this.stats.crit;
    const dmg = Math.round(this.stats.atk * mult * rand(0.9, 1.1) * (crit ? 1.8 : 1));
    e.takeDamage(dmg, crit, dir, knock);
    this.combatTimer = 4;
    if (crit) { G.hitStop = 0.07; G.shake = Math.max(G.shake, 0.35); Audio.sfx('crit'); }
    else { G.hitStop = Math.max(G.hitStop, 0.035); G.shake = Math.max(G.shake, 0.15); Audio.sfx('hit'); }
    return dmg;
  }

  startDodge(dir, keepFacing = false) {
    this.state = 'dodge'; this.dodgeT = 0.42; this.iframes = 0.38;
    this.dodgeDir = { x: dir.x, z: dir.z };
    if (!keepFacing) this.facing = Math.atan2(dir.x, dir.z);
    this.stamina -= 22; this.staminaDelay = 0.7;
    Audio.sfx('dodge');
  }

  useSkill(i) {
    const s = SKILLS[i];
    if (!this.skillUnlocked(i)) {
      if (i === 1) UI.toast(G.save.fox.joined ? `Reach bond level 3 with ${G.save.fox.name} to learn Fox Flame.` : 'You need a companion for this.', 'info');
      else UI.toast(`${s.name} unlocks at level ${SKILL_UNLOCKS[i + 1]}.`, 'info');
      return;
    }
    if (this.cds[i] > 0) return;
    const cost = Math.round(s.cost * (this.uniques.has('sorasRibbon') ? 0.8 : 1));
    if (this.sp < cost) { UI.toast('Not enough spirit.', 'warn'); return; }
    if (i === 1 && !G.fox?.castFlame()) { UI.toast('No hollows in range.', 'info'); return; }
    this.sp -= cost; this.cds[i] = s.cd;
    this.combatTimer = 4;
    Audio.sfx('skill');
    if (i === 0) {
      ring(this.pos.x, this.pos.z, s.color, 6, 0.5);
      ring(this.pos.x, this.pos.z, 0xffffff, 4, 0.35);
      sparks(this.pos.x, this.y + 1, this.pos.z, s.color, 40, 9, 0.7);
      for (const e of G.enemies) if (e.alive && Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) < 5.5 + e.radius) this.dealDamage(e, 2.2, { x: e.pos.x - this.pos.x, z: e.pos.z - this.pos.z }, 9);
      G.shake = 0.4;
    } else if (i === 2) {
      const camF = Math.atan2(-Math.sin(this.camYaw), -Math.cos(this.camYaw));
      if (G.settings.controls === 'mouse' && this.state !== 'move') this.facing = camF;
      this.dodgeDir = { x: Math.sin(this.facing), z: Math.cos(this.facing) };
      this.dashT = 0.26; this.iframes = 0.35; this.dashHit = new Set(); this.state = 'dash';
      sparks(this.pos.x, this.y + 1, this.pos.z, s.color, 24, 6, 0.5);
    } else if (i === 3) {
      this.moonfallT = 0.55;
      ring(this.pos.x, this.pos.z, s.color, 8.5, 0.55);
    }
  }
  moonfallImpact() {
    ring(this.pos.x, this.pos.z, 0xcfd8ff, 10, 0.7);
    ring(this.pos.x, this.pos.z, 0xffffff, 7, 0.5);
    sparks(this.pos.x, this.y + 2, this.pos.z, 0xcfd8ff, 70, 14, 1);
    Audio.sfx('boom');
    G.shake = 0.8; G.hitStop = 0.1;
    for (const e of G.enemies) if (e.alive && Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) < 8.5 + e.radius) this.dealDamage(e, 3.6, { x: e.pos.x - this.pos.x, z: e.pos.z - this.pos.z }, 12);
  }

  drink() {
    if (this.hp >= this.stats.maxHp) { UI.toast('You\'re already at full health.', 'info'); return; }
    if (!removeItem('tonic', 1)) { UI.toast('No Lantern Tonics left. Mira sells them at the inn.', 'warn'); return; }
    this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.maxHp * 0.45);
    sparks(this.pos.x, this.y + 1, this.pos.z, 0xff7a8a, 18, 3, 0.8);
    Audio.sfx('pickup');
    bus.emit('itemsChanged');
  }

  takeDamage(raw, from) {
    if (!this.alive || this.iframes > 0 || G.inDialogue) return;
    const dmg = Math.max(1, Math.round(raw * (100 / (100 + this.stats.def * 4))));
    this.hp -= dmg;
    this.combatTimer = 5;
    this.iframes = 0.25;
    UI.damageNumber(this.pos.x, this.y + 2.4, this.pos.z, dmg, 'player');
    UI.hurtFlash();
    G.shake = Math.max(G.shake, 0.3);
    Audio.sfx('hurt');
    if (from) { const dx = this.pos.x - from.x, dz = this.pos.z - from.z, d = Math.hypot(dx, dz) || 1; this.move(dx / d * 18, dz / d * 18, 0.05); }
    if (this.hp <= 0) this.die();
    else if (this.hp < this.stats.maxHp * 0.4) UI.tip('lowhp', 'Your health is low. Press Q to drink a Lantern Tonic, or get away from the fight and your health will come back.');
  }

  die() {
    const f = G.save.fox;
    if (f.joined && f.bondLevel >= 7 && f.revivedDay !== G.day) {
      f.revivedDay = G.day;
      this.hp = this.stats.maxHp * 0.5;
      this.iframes = 2;
      ring(this.pos.x, this.pos.z, 0xffb547, 7, 0.8);
      sparks(this.pos.x, this.y + 1, this.pos.z, 0xffb547, 60, 8, 1.2);
      UI.foxSays(`${f.name} throws itself between you and the dark. You rise again.`);
      Audio.sfx('bond');
      return;
    }
    this.alive = false; this.hp = 0;
    G.save.stats.deaths++;
    Audio.sfx('die');
    UI.deathScreen(() => this.respawn());
  }
  respawn() {
    const r = G.save.player.respawn;
    const lost = Math.floor(G.save.player.gold * 0.1);
    G.save.player.gold -= lost;
    this.pos.x = r.x; this.pos.z = r.z + 3; this.y = groundY(this.pos.x, this.pos.z);
    this.alive = true; this.state = 'idle'; this.snap = true;
    this.healFull();
    this.iframes = 2;
    bus.emit('respawn', lost);
  }

  updateModel(dt, speed) {
    const m = this.model, u = m.userData;
    m.position.set(this.pos.x, this.y, this.pos.z);
    m.rotation.y = this.facing;
    if (!this.alive) { m.rotation.z = lerp(m.rotation.z, Math.PI / 2, dt * 5); u.body.position.y = lerp(u.body.position.y, -0.3, dt * 5); return; }
    m.rotation.z = 0;
    animateHumanoid(m, this.t, speed, { attacking: this.state === 'attack' });
    if (this.state === 'attack') {
      const dur = this.combo === 2 ? 0.46 : 0.36;
      const k = 1 - this.attackT / dur;
      const sw = this.combo === 1 ? -1 : 1;
      u.armR.rotation.x = -1.4 + Math.sin(k * Math.PI) * 0.4;
      u.armR.rotation.z = sw * (1.2 - k * 2.6);
      u.body.rotation.y = sw * (0.5 - k * 1.0);
    } else {
      u.body.rotation.y = lerp(u.body.rotation.y, 0, dt * 10);
    }
    if (this.state === 'dodge') { u.body.rotation.x = (1 - this.dodgeT / 0.42) * Math.PI * 2; u.body.position.y = 0.3; }
    else if (this.dashT > 0) { u.body.rotation.x = 0.5; }
    else u.body.rotation.x = 0;
    // flicker while invulnerable after a hit
    m.visible = !(this.iframes > 0 && this.state !== 'dodge' && this.dashT <= 0 && Math.floor(this.t * 20) % 2 === 0 && this.iframes < 1.5);
  }

  updateCamera(dt) {
    const cam = G.camera;
    const head = this.y + 1.8;
    // in conversation, frame the person you're talking to over your shoulder
    if (G.inDialogue && G.talkTarget) {
      const n = G.talkTarget;
      const dx = this.pos.x - n.x, dz = this.pos.z - n.z, d = Math.hypot(dx, dz) || 1;
      const ny = groundY(n.x, n.z);
      const tx = n.x + (dx / d) * 4.4 + (dz / d) * 2.6, tz = n.z + (dz / d) * 4.4 - (dx / d) * 2.6;
      const ty = ny + 2.7;
      const k = Math.min(dt * 5, 1);
      cam.position.x = lerp(cam.position.x, tx, k); cam.position.y = lerp(cam.position.y, Math.max(ty, heightAt(tx, tz) + 1), k); cam.position.z = lerp(cam.position.z, tz, k);
      this._look = this._look || new THREE.Vector3(this.pos.x, head, this.pos.z);
      this._look.lerp(tmpLook.set(n.x - (dz / d) * 0.6, ny + 1.15, n.z + (dx / d) * 0.6), k);
      cam.lookAt(this._look);
      return;
    }
    if (G.settings.controls !== 'mouse') {
      const target = this.facing + Math.PI + this.camOffset;
      this.camYaw += angleDiff(this.camYaw, target) * (this.snap ? 1 : Math.min(dt * 5, 1));
    }
    const cp = Math.cos(this.camPitch), spch = Math.sin(this.camPitch);
    // pull the camera in when a building is in the way
    let dist = this.camDist;
    for (let t = 0.2; t <= 1; t += 0.08) {
      const sx = this.pos.x + Math.sin(this.camYaw) * this.camDist * cp * t, sz = this.pos.z + Math.cos(this.camYaw) * this.camDist * cp * t;
      const sy = head + spch * this.camDist * t;
      if (sy - groundY(sx, sz) < 7.5 && G.colliders.insideBox(sx, sz)) { dist = Math.max(3.2, this.camDist * (t - 0.1)); break; }
    }
    let cx = this.pos.x + Math.sin(this.camYaw) * dist * cp;
    let cz = this.pos.z + Math.cos(this.camYaw) * dist * cp;
    let cy = head + spch * dist;
    const gy = heightAt(cx, cz) + 0.8;
    if (cy < gy) cy = gy;
    const k = this.snap ? 1 : Math.min(dt * 12, 1);
    this.snap = false;
    cam.position.x = lerp(cam.position.x, cx, k);
    cam.position.y = lerp(cam.position.y, cy, k);
    cam.position.z = lerp(cam.position.z, cz, k);
    if (G.shake > 0) {
      cam.position.x += (Math.random() - 0.5) * G.shake;
      cam.position.y += (Math.random() - 0.5) * G.shake;
      G.shake = Math.max(0, G.shake - dt * 2.5);
    }
    if (this._look) this._look.set(this.pos.x, head, this.pos.z);
    cam.lookAt(this.pos.x, head, this.pos.z);
  }

  saveState() {
    const sp = G.save.player;
    sp.x = this.pos.x; sp.z = this.pos.z; sp.yaw = this.facing; sp.hp = this.hp; sp.sp = this.sp;
  }
}

export { countItem };
