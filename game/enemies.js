// Hollows: enemy types, AI, spawn camps, quest spawns, bosses and drops.
import * as THREE from 'three';
import { G } from './state.js';
import { makeEnemy, makeTelegraph, animateHumanoid } from './models.js';
import { groundY, isDeepWater, heightAt, ZONES, zoneAt, isNight, PLACES, MAP_R, lakeE, SHRINES, pathDist } from './world.js';
import { angleDiff, rand, randInt, pick, seeded, bus, textSprite, clamp } from './util.js';
import { projectile, sparks, ring, pillar } from './fx.js';
import { grantXP } from './story.js';
import { dropCoins, dropItem, dropStack } from './loot.js';
import { randomLoot, makeUnique } from './items.js';
import * as UI from './ui.js';
import * as Audio from './audio.js';

const BASE = {
  wisp: { name: 'Wisp', hp: (l) => 22 + l * 9, dmg: (l) => 6 + l * 2.2, speed: 5.4, range: 2.2, cd: 1.5, windup: 0.5, xp: (l) => 12 + l * 4, aggro: 9, floats: true, loot: 0.06 },
  husk: { name: 'Husk', hp: (l) => 52 + l * 18, dmg: (l) => 11 + l * 3.4, speed: 3.3, range: 2.6, cd: 2.2, windup: 0.85, xp: (l) => 22 + l * 6, aggro: 8, aoe: 2.8, loot: 0.1 },
  eater: { name: 'Lantern-eater', hp: (l) => 34 + l * 12, dmg: (l) => 8 + l * 2.6, speed: 3.8, range: 11, cd: 2.4, windup: 0.65, xp: (l) => 18 + l * 5, aggro: 11, floats: true, ranged: true, loot: 0.09 },
  brute: { name: 'Marsh Brute', hp: (l) => 120 + l * 30, dmg: (l) => 18 + l * 4.6, speed: 3.0, range: 3.4, cd: 2.6, windup: 1.0, xp: (l) => 55 + l * 10, aggro: 9, aoe: 4, loot: 0.25 },
  knight: { name: 'The Drowned Knight', hp: (l) => 950 + l * 60, dmg: (l) => 18 + l * 3, speed: 4.4, range: 3.6, cd: 1.3, windup: 0.7, xp: () => 420, aggro: 22, boss: true, loot: 1 },
  warden: { name: 'The Mire Warden', hp: (l) => 3400 + l * 150, dmg: (l) => 24 + l * 2.6, speed: 3.6, range: 7, cd: 1.6, windup: 0.9, xp: () => 1600, aggro: 30, boss: true, loot: 1 },
};

const tmpV = new THREE.Vector3();

export class Enemy {
  constructor(type, x, z, level, opts = {}) {
    const b = BASE[type];
    this.type = type; this.b = b; this.level = level;
    this.elite = opts.elite || null;
    this.boss = !!b.boss;
    const mult = this.elite ? 2.6 : 1;
    this.maxHp = Math.round(b.hp(level) * mult); this.hp = this.maxHp;
    this.dmg = b.dmg(level) * (this.elite ? 1.3 : 1) * 0.85;
    this.model = makeEnemy(type);
    if (this.elite) this.model.scale.setScalar(1.35);
    this.radius = this.model.userData.radius * (this.elite ? 1.35 : 1);
    this.height = this.model.userData.height * (this.elite ? 1.35 : 1);
    this.pos = { x, z }; this.spawn = { x, z };
    this.y = groundY(x, z);
    this.facing = rand(0, 6.28);
    this.state = 'idle'; this.timer = rand(0, 2); this.cd = rand(0.5, 1.5);
    this.knock = { x: 0, z: 0 };
    this.alive = true; this.deadT = 0;
    this.flash = 0;
    this.tag = opts.tag || null; this.drop = opts.drop || null; this.camp = opts.camp || null;
    this.wander = { x, z };
    this.t = rand(0, 10);
    this.phase = 1;
    this.pattern = 0;
    G.scene.add(this.model);
    // health bar
    if (!this.boss) {
      const bar = new THREE.Group();
      const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.14), new THREE.MeshBasicMaterial({ color: 0x1e2a44, transparent: true, opacity: 0.8, depthWrite: false }));
      const fg = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.1), new THREE.MeshBasicMaterial({ color: this.elite ? 0xffb547 : 0xe0566b, depthWrite: false }));
      fg.position.z = 0.001; bar.add(bg, fg);
      bar.position.y = this.height + 0.5; bar.visible = false;
      this.model.add(bar); this.bar = bar; this.barFg = fg;
    }
    if (this.elite) {
      const label = textSprite(THREE, `${this.elite}  Lv ${level}`, { size: 34, color: '#ffd28a' });
      label.position.y = this.height + 1.1; this.model.add(label);
    }
    if (this.boss) { UI.bossBar(this); Audio.sfx('roar'); }
  }

  takeDamage(dmg, crit, dir, knock = 3) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.flash = 0.12;
    UI.damageNumber(this.pos.x, this.y + this.height + 0.3, this.pos.z, dmg, crit ? 'crit' : 'hit');
    sparks(this.pos.x, this.y + this.height * 0.55, this.pos.z, crit ? 0xffd070 : 0xbfa8ff, crit ? 16 : 8, 6, 0.45);
    if (dir && !this.boss) {
      const d = Math.hypot(dir.x, dir.z) || 1;
      const k = this.type === 'brute' ? knock * 0.3 : knock;
      this.knock.x += (dir.x / d) * k; this.knock.z += (dir.z / d) * k;
    }
    if (this.state === 'idle' || this.state === 'return') this.state = 'chase';
    if (this.bar) { this.bar.visible = true; this.barFg.scale.x = Math.max(this.hp / this.maxHp, 0); this.barFg.position.x = -0.68 * (1 - this.barFg.scale.x); }
    if (this.boss) UI.bossBar(this);
    if (this.hp <= 0) this.die();
  }

  die() {
    this.alive = false; this.deadT = 0;
    if (this.telegraph) { G.scene.remove(this.telegraph); this.telegraph = null; }
    sparks(this.pos.x, this.y + this.height * 0.5, this.pos.z, 0x9a7aff, this.boss ? 120 : 26, this.boss ? 14 : 7, this.boss ? 1.6 : 0.8);
    grantXP(this.b.xp(this.level) * (this.elite ? 3 : 1));
    // drops
    const gold = Math.round((3 + this.level * 2.2) * (this.boss ? 25 : this.elite ? 5 : 1) * rand(0.6, 1.4));
    dropCoins(this.pos.x, this.pos.z, gold);
    if (Math.random() < 0.45 || this.boss) dropStack(this.pos.x, this.pos.z, 'dust', this.boss ? 8 : this.type === 'brute' ? 3 : 1);
    if (this.drop) dropStack(this.pos.x, this.pos.z, this.drop, 1);
    const luck = this.elite ? 2 : 0;
    if (this.type === 'knight') { dropItem(this.pos.x, this.pos.z, randomLoot(this.level + 1, 3, 3)); G.save.world.knightDefeated = true; }
    else if (this.type === 'warden') { dropItem(this.pos.x, this.pos.z, makeUnique(pick(['aurelsLight', 'mirewalker']), this.level)); dropItem(this.pos.x + 1, this.pos.z, randomLoot(this.level, 3, 3)); }
    else if (Math.random() < this.b.loot * (this.elite ? 10 : 1)) dropItem(this.pos.x, this.pos.z, randomLoot(this.level, luck, this.elite ? 2 : 0));
    if (Math.random() < 0.05) dropStack(this.pos.x, this.pos.z, 'tonic', 1);
    if (this.boss) { UI.bossBar(null); G.shake = 1; Audio.sfx('boom'); pillar(this.pos.x, this.pos.z, 0xffd080, 30, 2.5); }
    bus.emit('kill', this);
  }

  update(dt) {
    this.t += dt;
    const m = this.model, u = m.userData;
    if (!this.alive) {
      this.deadT += dt;
      m.scale.multiplyScalar(1 - dt * 2.5);
      m.position.y -= dt * 1.5;
      return this.deadT < 0.9;
    }
    const pl = G.player;
    const dx = pl.pos.x - this.pos.x, dz = pl.pos.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    const toP = Math.atan2(dx, dz);
    const b = this.b;
    const night = isNight();
    const aggro = (b.aggro + (night ? 2 : 0)) * (this.elite ? 1.3 : 1);
    this.cd -= dt;
    let speed = 0, mvx = 0, mvz = 0;

    switch (this.state) {
      case 'idle': {
        this.timer -= dt;
        if (this.timer <= 0) { this.timer = rand(2, 5); this.wander = { x: this.spawn.x + rand(-6, 6), z: this.spawn.z + rand(-6, 6) }; }
        const wx = this.wander.x - this.pos.x, wz = this.wander.z - this.pos.z, wd = Math.hypot(wx, wz);
        if (wd > 0.6) { mvx = wx / wd; mvz = wz / wd; speed = b.speed * 0.35; }
        if (d < aggro && pl.alive && !G.inDialogue) { this.state = 'chase'; if (this.boss) Audio.sfx('roar'); }
        break;
      }
      case 'chase': {
        const leash = this.boss || this.tag ? 70 : 28;
        if (!pl.alive || Math.hypot(this.pos.x - this.spawn.x, this.pos.z - this.spawn.z) > leash) { this.state = 'return'; break; }
        this.facing += angleDiff(this.facing, toP) * Math.min(dt * 8, 1);
        if (b.ranged) {
          const want = 8.5;
          const side = Math.sin(this.t * 0.7) > 0 ? 1 : -1;
          if (d > want + 2) { mvx = dx / d; mvz = dz / d; } else if (d < want - 2) { mvx = -dx / d; mvz = -dz / d; } else { mvx = (dz / d) * side; mvz = (-dx / d) * side; }
          speed = b.speed;
        } else if (d > b.range * 0.8 + this.radius) { mvx = dx / d; mvz = dz / d; speed = b.speed * (this.boss && this.phase === 2 ? 1.3 : 1); }
        if (d < b.range + this.radius + 0.5 && this.cd <= 0) this.startWindup(d);
        break;
      }
      case 'windup': {
        this.timer -= dt;
        if (this.attack !== 'leap' && this.attack !== 'charge') this.facing += angleDiff(this.facing, toP) * Math.min(dt * 4, 1);
        if (this.telegraph) {
          const k = 1 - this.timer / this.windupDur;
          this.telegraph.userData.fill.scale.setScalar(Math.max(k, 0.01));
          if (this.attack === 'slam' || this.attack === 'quake') this.telegraph.position.set(this.pos.x, groundY(this.pos.x, this.pos.z) + 0.08, this.pos.z);
        }
        if (this.timer <= 0) this.strike();
        break;
      }
      case 'charge': {
        this.timer -= dt;
        mvx = Math.sin(this.facing); mvz = Math.cos(this.facing); speed = 20;
        if (d < this.radius + 1.2 && !this.chargeHit) { this.chargeHit = true; pl.takeDamage(this.dmg * 1.4, this.pos); }
        if (this.timer <= 0) { this.state = 'recover'; this.timer = 0.8; }
        break;
      }
      case 'recover': {
        this.timer -= dt;
        if (this.timer <= 0) this.state = 'chase';
        break;
      }
      case 'return': {
        const rx = this.spawn.x - this.pos.x, rz = this.spawn.z - this.pos.z, rd = Math.hypot(rx, rz);
        if (rd > 1) { mvx = rx / rd; mvz = rz / rd; speed = b.speed * 1.2; this.facing = Math.atan2(rx, rz); }
        else { this.state = 'idle'; this.hp = this.maxHp; if (this.bar) this.bar.visible = false; if (this.boss) UI.bossBar(this); }
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.2 * dt);
        if (d < aggro * 0.6 && pl.alive) this.state = 'chase';
        break;
      }
    }
    // boss phase change
    if (this.boss && this.phase === 1 && this.hp < this.maxHp * 0.5) {
      this.phase = 2; Audio.sfx('roar'); G.shake = 0.8;
      UI.toast(`${b.name} grows furious.`, 'warn');
      ring(this.pos.x, this.pos.z, 0xff5a3a, 12, 0.8);
      if (this.type === 'warden') spawnGroup({ type: 'wisp', n: 4, x: this.pos.x, z: this.pos.z, lvl: Math.max(8, this.level - 3), tag: this.tag });
    }

    // apply movement + knockback
    const kx = this.knock.x, kz = this.knock.z;
    this.knock.x *= Math.max(0, 1 - dt * 8); this.knock.z *= Math.max(0, 1 - dt * 8);
    let nx = this.pos.x + (mvx * speed + kx) * dt, nz = this.pos.z + (mvz * speed + kz) * dt;
    // separation
    for (const o of G.enemies) {
      if (o === this || !o.alive) continue;
      const sx = nx - o.pos.x, sz = nz - o.pos.z, sd = Math.hypot(sx, sz), md = this.radius + o.radius;
      if (sd < md && sd > 0.01) { nx += (sx / sd) * (md - sd) * 0.5; nz += (sz / sd) * (md - sd) * 0.5; }
    }
    // stay off the player
    const px = nx - pl.pos.x, pz = nz - pl.pos.z, pd = Math.hypot(px, pz), pm = this.radius + 0.5;
    if (pd < pm && pd > 0.01 && this.state !== 'charge') { nx = pl.pos.x + (px / pd) * pm; nz = pl.pos.z + (pz / pd) * pm; }
    if (!b.floats && isDeepWater(nx, nz)) { nx = this.pos.x; nz = this.pos.z; }
    const p = { x: nx, z: nz };
    if (!this.boss) G.colliders.resolve(p, this.radius * 0.8);
    const r = Math.hypot(p.x, p.z); if (r > MAP_R) { p.x *= MAP_R / r; p.z *= MAP_R / r; }
    this.pos.x = p.x; this.pos.z = p.z;
    const gy = groundY(this.pos.x, this.pos.z);
    this.y = b.floats ? Math.max(gy, 0) + 0.2 + Math.sin(this.t * 2.4) * 0.2 : gy;

    // visuals
    m.position.set(this.pos.x, this.y, this.pos.z);
    m.rotation.y = this.facing;
    if (u.humanoid) animateHumanoid(u.humanoid, this.t, speed, { attacking: this.state === 'windup' });
    const body = u.body;
    if (this.state === 'windup') {
      const k = 1 - this.timer / this.windupDur;
      body.scale.set(1 + k * 0.12, 1 - k * 0.08, 1 + k * 0.12);
      body.rotation.x = -k * 0.3;
      if (u.humanoid) { u.humanoid.userData.armR.rotation.x = -2.6 * k; }
    } else {
      body.scale.set(1, 1 + Math.sin(this.t * 3) * 0.03, 1);
      body.rotation.x = this.state === 'recover' ? 0.25 : 0;
    }
    if (this.flash > 0) { this.flash -= dt; u.skin.emissive.setHex(0xffffff); u.skin.emissiveIntensity = 0.8; }
    else { u.skin.emissive.setHex(this.state === 'windup' ? 0xff3a20 : 0x000000); u.skin.emissiveIntensity = this.state === 'windup' ? 0.35 : 0; }
    if (this.bar) this.bar.quaternion.copy(G.camera.quaternion).premultiply(tmpQ.copy(m.quaternion).invert());
    return true;
  }

  startWindup(d) {
    const b = this.b;
    this.state = 'windup';
    this.attack = 'melee';
    let dur = b.windup * (this.phase === 2 ? 0.75 : 1);
    if (this.type === 'husk' || this.type === 'brute') this.attack = 'slam';
    if (b.ranged) this.attack = 'shoot';
    if (this.type === 'knight') {
      this.pattern = (this.pattern + 1) % 4;
      this.attack = d > 6 || this.pattern === 3 ? 'leap' : 'sweep';
      if (this.attack === 'leap') dur = 1.0;
    }
    if (this.type === 'warden') {
      this.pattern = (this.pattern + 1) % 5;
      this.attack = ['quake', 'volley', 'charge', 'quake', 'summon'][this.pattern];
      if (d > 10 && this.attack === 'quake') this.attack = 'volley';
      dur = this.attack === 'quake' ? 1.2 : this.attack === 'charge' ? 0.9 : 0.8;
    }
    this.timer = this.windupDur = dur;
    // telegraphs
    const pl = G.player;
    if (this.attack === 'slam') this.addTele(b.aoe, this.pos.x, this.pos.z);
    if (this.attack === 'quake') this.addTele(8, this.pos.x, this.pos.z);
    if (this.attack === 'leap') { this.leapTo = { x: pl.pos.x, z: pl.pos.z }; this.addTele(4.2, pl.pos.x, pl.pos.z); }
    if (this.attack === 'sweep') this.addTele(4.2, this.pos.x + Math.sin(this.facing) * 2, this.pos.z + Math.cos(this.facing) * 2);
    if (this.attack === 'charge') { this.facing = Math.atan2(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z); }
  }
  addTele(r, x, z) {
    UI.tip('circles', 'Red circle on the ground: a heavy hit lands there when it fills. Step out of it or roll with Space.');
    if (this.telegraph) G.scene.remove(this.telegraph);
    this.telegraph = makeTelegraph(r);
    this.telegraph.position.set(x, groundY(x, z) + 0.08, z);
    G.scene.add(this.telegraph);
    this.teleR = r; this.teleX = x; this.teleZ = z;
  }

  strike() {
    const pl = G.player, b = this.b;
    const dx = pl.pos.x - this.pos.x, dz = pl.pos.z - this.pos.z, d = Math.hypot(dx, dz);
    const inTele = () => Math.hypot(pl.pos.x - this.teleX, pl.pos.z - this.teleZ) < this.teleR + 0.4;
    switch (this.attack) {
      case 'melee': {
        // lunge
        this.knock.x += Math.sin(this.facing) * 9; this.knock.z += Math.cos(this.facing) * 9;
        if (d < b.range + this.radius + 0.8 && Math.abs(angleDiff(this.facing, Math.atan2(dx, dz))) < 1.2) pl.takeDamage(this.dmg, this.pos);
        break;
      }
      case 'slam': case 'quake': case 'sweep': {
        if (inTele()) pl.takeDamage(this.dmg * (this.attack === 'quake' ? 1.5 : 1.2), this.pos);
        ring(this.teleX, this.teleZ, 0xff7a4a, this.teleR, 0.4);
        sparks(this.teleX, groundY(this.teleX, this.teleZ) + 0.3, this.teleZ, 0x9a7aff, 20, 7, 0.6);
        G.shake = Math.max(G.shake, this.boss ? 0.6 : 0.25);
        Audio.sfx('boom');
        break;
      }
      case 'leap': {
        this.pos.x = this.leapTo.x - Math.sin(this.facing) * 1.2; this.pos.z = this.leapTo.z - Math.cos(this.facing) * 1.2;
        if (inTele()) pl.takeDamage(this.dmg * 1.6, this.pos);
        ring(this.teleX, this.teleZ, 0x7fffd4, this.teleR, 0.5);
        sparks(this.teleX, groundY(this.teleX, this.teleZ) + 0.3, this.teleZ, 0x7fffd4, 40, 9, 0.8);
        G.shake = 0.7; Audio.sfx('boom');
        break;
      }
      case 'shoot': {
        const n = this.elite ? 3 : 1;
        for (let i = 0; i < n; i++) {
          const a = Math.atan2(dx, dz) + (i - (n - 1) / 2) * 0.25;
          projectile({ x: this.pos.x, y: this.y + this.height * 0.7, z: this.pos.z, dx: Math.sin(a), dz: Math.cos(a), speed: 13, dmg: this.dmg, color: 0xffb050 });
        }
        Audio.sfx('shoot');
        break;
      }
      case 'volley': {
        const n = this.phase === 2 ? 14 : 10;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + this.t;
          projectile({ x: this.pos.x, y: this.y + 3, z: this.pos.z, dx: Math.sin(a), dz: Math.cos(a), speed: 11, dmg: this.dmg * 0.8, color: 0xff7a30, size: 0.5, radius: 0.8, life: 3.5 });
        }
        projectile({ x: this.pos.x, y: this.y + 3, z: this.pos.z, dx, dz, speed: 15, dmg: this.dmg, color: 0xffd070, size: 0.6, radius: 0.9 });
        Audio.sfx('shoot');
        break;
      }
      case 'charge': {
        this.state = 'charge'; this.timer = 0.75; this.chargeHit = false;
        if (this.telegraph) { G.scene.remove(this.telegraph); this.telegraph = null; }
        return;
      }
      case 'summon': {
        spawnGroup({ type: 'wisp', n: this.phase === 2 ? 3 : 2, x: this.pos.x, z: this.pos.z, lvl: Math.max(8, this.level - 3), tag: this.tag });
        ring(this.pos.x, this.pos.z, 0x9a7aff, 6, 0.6);
        break;
      }
    }
    if (this.telegraph) { G.scene.remove(this.telegraph); this.telegraph = null; }
    this.state = 'recover';
    this.timer = this.boss ? (this.phase === 2 ? 0.5 : 0.8) : 0.7;
    this.cd = b.cd * (this.phase === 2 ? 0.7 : 1) * rand(0.85, 1.2);
  }

  remove() {
    if (this.telegraph) G.scene.remove(this.telegraph);
    G.scene.remove(this.model);
  }
}
const tmpQ = new THREE.Quaternion();

// ---------------------------------------------------------------- spawning
const camps = [];
const questSpawns = {};

export function initEnemies() {
  const rnd = seeded(99);
  const zoneTypes = {
    meadow: ['wisp', 'wisp', 'husk'], fields: ['wisp', 'husk', 'wisp'], docks: ['husk', 'wisp'], pines: ['wisp', 'husk', 'eater'],
    manor: ['husk', 'eater'], tower: ['husk', 'eater', 'wisp'], shore: ['eater', 'husk', 'wisp'], north: ['eater', 'husk', 'wisp'],
    marsh: ['brute', 'husk', 'wisp'], wilds: ['wisp', 'husk', 'eater'],
    maples: ['husk', 'eater', 'wisp'], snow: ['wisp', 'brute', 'eater'], highlands: ['eater', 'brute', 'husk'],
    blossom: ['wisp', 'eater', 'husk'], quarry: ['husk', 'brute', 'wisp'],
  };
  // a few fixed groups so every bounty area has hollows to hunt
  for (const [x, z] of [[-100, -45], [-70, -85], [-110, -70], [-25, 95], [25, 100], [30, -70], [-15, -100]]) {
    const zone = zoneAt(x, z);
    camps.push({ x, z, zone, types: zoneTypes[zone.id] || zoneTypes.wilds, max: 2, alive: [], timer: 0 });
  }
  let tries = 0;
  while (camps.length < 45 && tries++ < 6000) {
    const x = (rnd() - 0.5) * 520, z = (rnd() - 0.5) * 520;
    const r = Math.hypot(x, z);
    if (r < 62 || r > 255) continue;
    if (heightAt(x, z) < 0.2 && !(Math.hypot(x - 70, z - 100) < 45)) continue;
    if (camps.some((c) => Math.hypot(c.x - x, c.z - z) < 34)) continue;
    if (pathDist(x, z) < 12) continue;
    if (SHRINES.some((s) => Math.hypot(s.x - x, s.z - z) < 24)) continue;
    if (Math.hypot(x - PLACES.bossArena.x, z - PLACES.bossArena.z) < 22) continue;
    if (Math.hypot(x - PLACES.manor.x, z - PLACES.manor.z) < 14) continue;
    const zone = zoneAt(x, z);
    const types = zoneTypes[zone.id] || zoneTypes.wilds;
    camps.push({ x, z, zone, types, max: rnd() < 0.35 ? 2 : 1, alive: [], timer: 0 });
  }
  bus.on('spawnQuest', (id, spec) => spawnQuest(spec));
}

function campLevel(c) {
  const [a, b] = c.zone.lvl;
  return randInt(a, b);
}

export function spawnGroup(spec) {
  const out = [];
  const pts = spec.at === 'pieces' ? PLACES.lanternPieces : null;
  const n = pts ? pts.length * (spec.n || 1) : spec.n;
  for (let i = 0; i < n; i++) {
    let x, z;
    if (pts) { const p = pts[i % pts.length]; x = p.x + rand(-4, 4); z = p.z + rand(-4, 4); }
    else { const a = (i / n) * Math.PI * 2 + rand(0, 1); const rr = spec.n > 1 ? rand(2.5, 6) : 0; x = spec.x + Math.cos(a) * rr; z = spec.z + Math.sin(a) * rr; }
    if (isDeepWater(x, z)) { x = spec.x ?? x; z = spec.z ?? z; }
    let type = spec.type;
    if (type === 'mix') type = pick(['husk', 'wisp', 'eater', 'wisp']);
    const e = new Enemy(type, x, z, spec.lvl, { tag: spec.tag, elite: spec.elite, drop: spec.drop });
    if (spec.aggro) e.state = 'chase';
    G.enemies.push(e); out.push(e);
  }
  return out;
}

function spawnQuest(spec) {
  const list = questSpawns[spec.tag];
  if (list && list.some((e) => e.alive)) return;
  const lvl = Math.max(spec.lvl, spec.boss ? spec.lvl : Math.min(G.save.player.level, spec.lvl + 2));
  questSpawns[spec.tag] = spawnGroup({ ...spec, lvl });
  if (spec.waves) questSpawns[spec.tag].wavesLeft = spec.waves - 1;
}

export function clearQuestSpawn(tag) {
  const list = questSpawns[tag];
  if (list) for (const e of list) if (e.alive) { e.alive = false; e.remove(); }
  delete questSpawns[tag];
}

let campTick = 0;
export function updateEnemies(dt) {
  const pl = G.player;
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    const keep = e.update(dt);
    const far = Math.hypot(e.pos.x - pl.pos.x, e.pos.z - pl.pos.z) > 120;
    if (!keep || (far && !e.tag && !e.boss)) {
      e.remove();
      G.enemies.splice(i, 1);
      if (e.camp) { e.camp.alive = e.camp.alive.filter((x) => x !== e); if (!keep) e.camp.timer = 120; }
    }
  }
  // quest waves
  for (const [tag, list] of Object.entries(questSpawns)) {
    if (list.wavesLeft > 0 && list.every((e) => !e.alive)) {
      const st = list[0];
      list.wavesLeft--;
      const next = spawnGroup({ type: 'mix', n: 4, x: st.spawn.x, z: st.spawn.z, lvl: st.level, tag, aggro: true });  // 4 + 4 = the 8 the quest asks for
      next.wavesLeft = list.wavesLeft;
      questSpawns[tag] = next;
      UI.toast('Another wave climbs the hill!', 'warn');
    }
  }
  campTick -= dt;
  if (campTick > 0) return;
  campTick = 0.5;
  const night = isNight();
  for (const c of camps) {
    const d = Math.hypot(c.x - pl.pos.x, c.z - pl.pos.z);
    if (d > 62) continue;
    c.timer -= 0.5;
    const max = c.max;
    if (c.alive.length < max && (c.timer <= 0) && d > 30) {
      const e = new Enemy(pick(c.types), c.x + rand(-5, 5), c.z + rand(-5, 5), campLevel(c), { camp: c });
      if (isDeepWater(e.pos.x, e.pos.z)) { e.remove(); continue; }
      G.enemies.push(e); c.alive.push(e);
      c.timer = c.alive.length < c.max ? 0 : 120;
    }
  }
  // the music knows when you're fighting
  const fighting = G.enemies.some((e) => e.alive && (e.state === 'chase' || e.state === 'windup') && Math.hypot(e.pos.x - pl.pos.x, e.pos.z - pl.pos.z) < 22);
  Audio.setCombat(fighting ? 1 : 0);
  if (fighting) UI.tip('fight', 'A hollow is coming! Left click to attack; click quickly for a combo. Press Space to roll out of the way. Press G for the full guide.');
}

export function resetEnemiesNearPlayer() {
  for (const e of G.enemies) if (e.alive && !e.boss) { e.state = 'return'; }
  for (const e of G.enemies) if (e.boss && e.alive) { e.hp = e.maxHp; e.phase = 1; e.state = 'idle'; e.pos.x = e.spawn.x; e.pos.z = e.spawn.z; UI.bossBar(null); }
}

export { camps }; // read by tests
