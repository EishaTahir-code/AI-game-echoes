# Lanternmere

A 3D action RPG that runs in the browser. It's festival week in a lakeside mountain town: the lanterns keep going out, hollows walk the roads at night, and everyone in town remembers what you do.

It's the playable first step toward the AI detective game described in [`docs/PRD.md`](docs/PRD.md): the same town and cast, with scripted dialogue that remembers your choices. The code is laid out so live AI characters can plug in later.

## Play

**Online:** once GitHub Pages is switched on (see below), the game is at `https://eishatahir-code.github.io/AI-game-echoes/`.

**On your PC:** browsers block games opened straight from a file, so run a tiny local server in this folder:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Controls

No mouse needed to move: when you turn, the camera turns with you. Press **H** in the game to see this list.

| Key | Action |
| --- | --- |
| W / ↑ | Walk forward |
| S / ↓ | Walk backward |
| A D / ← → | Turn left and right (the camera follows) |
| Shift | Sprint (you also jog faster automatically when travelling) |
| Left click | Attack, aimed at the nearest hollow |
| Space | Dodge roll |
| 1 2 3 4 | Skills (unlock as you level up and bond with your fox) |
| Q | Drink a Lantern Tonic |
| E | Talk, open, pick up |
| F | Pet your fox |
| C, J, M | Character and bag, journal, map |
| H | Show the controls |
| Esc | Menus and settings |

Prefer mouse-look? Switch **Controls** to "Mouse look" in Settings (Esc).

## What's in it

- **Story:** 6 main chapters, 6 side quests, 2 bosses, daily bounties and Echo Rifts after the story.
- **People who remember:** friendship hearts, gifts, and dialogue that changes with what you did. Gossip spreads overnight.
- **Spirit fox companion:** you name it. Its bond grows as you play and unlocks perks: fighting beside you, Fox Flame, fetching loot, healing you, and saving you from falling once a day.
- **Progression:** levels, stat points, four skills, gear in five rarities, an upgrade forge and a shop that restocks daily.
- **Exploration:** the lakeside valley plus five outer regions (Maplewood, Frostpeak Pass, Cloudrest Highlands, Blossom Hills, Old Quarry), eleven lantern shrines for fast travel, hidden chests, 10 memory shards that tell the fox's story, eight viewpoints, a fog-of-war map and a day/night cycle.

Progress saves automatically in the browser.

## Code

Plain JavaScript modules with [three.js](https://threejs.org) (bundled in `game/vendor`). No build step.

| File | What it does |
| --- | --- |
| `game/main.js` | Startup, title screen, main loop |
| `game/world.js` | Terrain, lake, town, forest, sky, day/night |
| `game/player.js`, `game/enemies.js`, `game/fox.js` | Hero, hollows and bosses, fox companion |
| `game/data.js` | Characters, dialogue, quests, memories, deeds |
| `game/story.js` | Quest engine, memory flags, gossip, XP, bounties |
| `game/ui.js`, `game/dialogue.js` | HUD, menus, map, shop, forge, dialogue box |
