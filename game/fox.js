// The spirit fox companion: follows, fights, fetches, heals, and reacts to you.
import * as THREE from 'three';
import { G } from './state.js';
import { makeFox } from './models.js';
import { groundY, isDeepWater, isNight } from './world.js';
import { angleDiff, lerp, rand, pick, bus } from './util.js';
import { projectile, sparks, ring } from './fx.js';
import { grantBond } from './story.js';
import * as UI from './ui.js';
import * as Audio from './audio.js';
import { hit } from './input.js';

const RESCUE = { x: -45, z: 9 };

export class Fox {
  constructor() {
    this.model = makeFox();
    G.scene.add(this.model);
    const f = G.save.fox;
    if (f.joined) { this.pos = { x: G.player.pos.x - 2, z: G.player.pos.z + 1 }; this.state = 'follow'; }
    else { this.pos = { ...RESCUE }; this.state = 'injured'; }
    this.y = groundY(this.pos.x, this.pos.z);
    this.facing = 0; this.t = 0; this.biteCd = 0; this.healCd = 0; this.idleT = 0;
    this.target = null; this.jump = 0; this.speed = 0;
    this.chatterT = 40;
    this.lastNight = isNight();
    this.applyBondLook();
    bus.on('levelUp', () => { if (G.save.fox.joined) { this.jump = 0.6; sparks(this.pos.x, this.y + 1, this.pos.z, 0xffb547, 16, 4, 0.8); } });
  }

  applyBondLook() {
    const lvl = G.save.fox.bondLevel;
    const u = this.model.userData;
    u.tipMat.emissiveIntensity = 1 + lvl * 0.25;
    u.aura.scale.setScalar(1.2 + lvl * 0.18);
    if (lvl >= 10) { u.tipMat.emissive.setHex(0x9fe8ff); u.aura.material.map = null; u.aura.material.color.setHex(0x9fe8ff); }
  }

  get dmgMult() { return (1 + G.save.fox.bondLevel * 0.1) * (G.player.uniques.has('firstBell') ? 1.6 : 1); }

  castFlame() {
    let best = null, bd = 18;
    for (const e of G.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.pos.x - G.player.pos.x, e.pos.z - G.player.pos.z);
      if (d < bd) { bd = d; best = e; }
    }
    if (!best || this.state === 'injured') return false;
    const dx = best.pos.x - this.pos.x, dz = best.pos.z - this.pos.z;
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        if (!best.alive) return;
        projectile({ x: this.pos.x, y: this.y + 1, z: this.pos.z, dx: dx + rand(-2, 2), dz: dz + rand(-2, 2), speed: 16, owner: 'player', color: 0xff7a30, size: 0.3, radius: 0.9, homing: best, life: 2.5,
          onHit: (e) => { G.player.dealDamage(e, 0.8 * this.dmgMult, { x: e.pos.x - this.pos.x, z: e.pos.z - this.pos.z }, 2); } });
      }, i * 110);
    }
    this.jump = 0.4;
    Audio.sfx('yip');
    return true;
  }

  pet() {
    const f = G.save.fox;
    this.jump = 0.5;
    sparks(this.pos.x, this.y + 1.2, this.pos.z, 0xff8aa8, 14, 3, 1);
    Audio.sfx('yip');
    const now = G.save.stats.playSeconds;
    if (now - f.lastPet > 45) { f.lastPet = now; grantBond(4, `${f.name} leans into your hand.`); }
    else UI.foxSays(pick([`${f.name} wags its glowing tail.`, `${f.name} nuzzles your palm.`, `${f.name} makes a happy little chirp.`]));
  }

  update(dt) {
    this.t += dt;
    const f = G.save.fox, pl = G.player, m = this.model, u = m.userData;
    this.biteCd -= dt; this.healCd -= dt; this.jump = Math.max(0, this.jump - dt);
    if (this.state === 'injured') {
      if (f.joined) { this.state = 'follow'; }
      else {
        m.position.set(this.pos.x, this.y, this.pos.z);
        u.body.rotation.z = Math.PI / 2.4; u.body.position.y = -0.25;
        u.tipMat.emissiveIntensity = 0.3 + Math.sin(this.t * 2) * 0.2;
        return;
      }
    }
    u.body.rotation.z = 0;
    const dxp = pl.pos.x - this.pos.x, dzp = pl.pos.z - this.pos.z, dp = Math.hypot(dxp, dzp);
    // pet
    if (dp < 3.5 && hit('f') && !G.paused && !G.inDialogue) this.pet();
    // heal at bond 5
    if (f.bondLevel >= 5 && pl.alive && pl.hp < pl.stats.maxHp * 0.35 && this.healCd <= 0) {
      this.healCd = 60; pl.hp = Math.min(pl.stats.maxHp, pl.hp + pl.stats.maxHp * 0.3);
      ring(pl.pos.x, pl.pos.z, 0xffb547, 3, 0.6); sparks(pl.pos.x, pl.y + 1, pl.pos.z, 0xffd28a, 24, 3, 1);
      UI.foxSays(`${f.name} glows warmly. Your wounds close a little.`);
    }
    // pick a target to fight at bond 2
    if (f.bondLevel >= 2 && pl.combatTimer > 0) {
      if (!this.target || !this.target.alive || Math.hypot(this.target.pos.x - pl.pos.x, this.target.pos.z - pl.pos.z) > 14) {
        this.target = null; let bd = 12;
        for (const e of G.enemies) { if (!e.alive) continue; const d = Math.hypot(e.pos.x - pl.pos.x, e.pos.z - pl.pos.z); if (d < bd) { bd = d; this.target = e; } }
      }
    } else this.target = null;

    let tx, tz, speed = 0;
    if (this.target) {
      const e = this.target;
      const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      tx = e.pos.x - (dx / d) * (e.radius + 0.8); tz = e.pos.z - (dz / d) * (e.radius + 0.8);
      if (d < e.radius + 1.4 && this.biteCd <= 0) {
        this.biteCd = 1.1; this.jump = 0.3;
        const crit = Math.random() < 0.1;
        const dmg = Math.round(pl.stats.atk * 0.35 * this.dmgMult * (crit ? 1.8 : 1));
        e.takeDamage(dmg, crit, { x: dx, z: dz }, 1.5);
      }
    } else {
      // follow just behind and to the side of the player
      const side = Math.sin(this.t * 0.2) > 0 ? 1 : -1;
      tx = pl.pos.x - Math.sin(pl.facing) * 2 + Math.cos(pl.facing) * 1.4 * side;
      tz = pl.pos.z - Math.cos(pl.facing) * 2 - Math.sin(pl.facing) * 1.4 * side;
    }
    const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
    if (dp > 35) { this.pos.x = pl.pos.x - 2; this.pos.z = pl.pos.z - 2; this.y = groundY(this.pos.x, this.pos.z); }
    else if (d > 0.5) {
      speed = Math.min(d * 3, this.target ? 13 : d > 6 ? 12 : pl.speedNow > 0 ? pl.speedNow : 4);
      const nx = this.pos.x + (dx / d) * speed * dt, nz = this.pos.z + (dz / d) * speed * dt;
      if (!isDeepWater(nx, nz)) { this.pos.x = nx; this.pos.z = nz; }
      this.facing += angleDiff(this.facing, Math.atan2(dx, dz)) * Math.min(dt * 10, 1);
      this.idleT = 0;
    } else {
      this.idleT += dt;
      this.facing += angleDiff(this.facing, Math.atan2(dxp, dzp)) * Math.min(dt * 3, 1);
    }
    this.speed = speed;
    this.y = lerp(this.y, groundY(this.pos.x, this.pos.z), Math.min(dt * 15, 1));
    // animation
    const hop = this.jump > 0 ? Math.sin((this.jump / 0.5) * Math.PI) * 0.8 : 0;
    m.position.set(this.pos.x, this.y + hop, this.pos.z);
    m.rotation.y = this.facing;
    const run = Math.min(speed / 8, 1.3);
    u.legs.forEach((l, i) => { l.rotation.x = Math.sin(this.t * 14 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.9 * run; });
    const sitting = this.idleT > 3 && !this.target;
    u.body.rotation.x = lerp(u.body.rotation.x, sitting ? -0.45 : 0, dt * 5);
    u.body.position.y = lerp(u.body.position.y, sitting ? -0.12 : Math.abs(Math.sin(this.t * 14)) * 0.08 * run, dt * 10);
    u.tail.rotation.y = Math.sin(this.t * (sitting ? 3 : 8)) * 0.5;
    u.tail.rotation.x = sitting ? 0.6 : 0;
    u.head.rotation.y = sitting ? Math.sin(this.t * 0.7) * 0.4 : 0;
    u.aura.material.opacity = 0.55 + Math.sin(this.t * 3) * 0.2 + (isNight() ? 0.25 : 0);
    // little comments now and then
    this.chatterT -= dt;
    const night = isNight();
    if (night !== this.lastNight) { this.lastNight = night; if (night) UI.foxSays(`${f.name}'s tail burns brighter as night falls.`); }
    if (this.chatterT <= 0) {
      this.chatterT = rand(70, 120);
      const lines = [`${f.name} sniffs the air and looks toward the lake.`, `${f.name} chases a firefly and misses.`, `${f.name} stays close, watching the dark.`];
      if (pl.hp < pl.stats.maxHp * 0.5) lines.push(`${f.name} whines and presses against your leg.`);
      if (sitting) lines.push(`${f.name} curls up at your feet, waiting.`);
      UI.foxSays(pick(lines));
    }
  }
}
export { RESCUE };
