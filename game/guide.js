// The in-game guide: rules and a how-to manual for new players.
// Numbers are read from the game's own data, so the guide stays accurate.
import { G } from './state.js';
import { ZONES, SHRINES } from './world.js';
import { BOND_PERKS, SHARDS, VISTAS } from './data.js';
import { RARITY } from './items.js';
import { SKILLS } from './player.js';
import { SKILL_UNLOCKS } from './story.js';
import { controlsList, closePanel } from './ui.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const list = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
const steps = (items) => `<ol>${items.map((i) => `<li>${i}</li>`).join('')}</ol>`;
const k = (key) => `<kbd>${esc(key)}</kbd>`;

function skillRows() {
  return SKILLS.map((s, i) => {
    const unlock = i === 1 ? 'Bond level 3 with your fox' : `Level ${SKILL_UNLOCKS[i + 1]}`;
    return `<tr><td>${k(s.key)} ${esc(s.name)}</td><td>${esc(s.desc)}</td><td class="nw">${s.cost} spirit</td><td class="nw">${s.cd} s</td><td>${unlock}</td></tr>`;
  }).join('');
}

function regionRows() {
  return ZONES.filter((z) => z.id !== 'wilds' && z.id !== 'square')
    .sort((a, b) => a.lvl[0] - b.lvl[0])
    .map((z) => `<tr><td>${esc(z.name)}</td><td>${z.lvl[0]} to ${z.lvl[1]}</td></tr>`).join('');
}

export function guideSections() {
  const fox = G.save?.fox?.joined ? esc(G.save.fox.name) : 'your fox';
  return [
    {
      id: 'rules', title: 'The rules of Lanternmere',
      html: `<p class="lead">Nine things every newcomer should know.</p>
      ${steps([
        '<b>Everyone remembers.</b> What you say changes how people feel about you, and word spreads around town overnight.',
        '<b>Choices are permanent.</b> The game saves constantly, so you can\'t reload to undo a conversation. Choose what you mean.',
        '<b>Night is dangerous.</b> After dark, hollows notice you from further away.',
        '<b>Falling costs gold.</b> If you are defeated you lose a tenth of your gold and wake at the last shrine you rested at.',
        '<b>Shrines are safe havens.</b> Rest at a lit shrine to heal fully and set your return point. Lit shrines also let you fast travel.',
        '<b>Red circles mean danger.</b> A heavy hit lands inside the circle when it fills. Step out or roll.',
        '<b>One gift per person per day.</b> Bring them something they like and they will warm to you.',
        `<b>${fox === 'your fox' ? 'Your fox' : fox} grows with you.</b> The stronger your bond, the more your companion can do.`,
        '<b>The world refreshes every morning.</b> New bounties, new shop stock, fresh moonpetals and new Echo Rifts.',
      ])}`,
    },
    {
      id: 'start', title: 'Getting started',
      html: `<p class="lead">It is festival week in Lanternmere. Lord Aurel, who paid for the festival, was pulled from the lake three nights ago. Since then the lanterns keep going out and shadows called hollows walk the roads.</p>
      <h4>Your first ten minutes</h4>
      ${steps([
        `Walk to <b>Mira</b>, the innkeeper waving outside the Driftwood Inn. Press ${k('E')} near anyone to talk.`,
        'Follow the <b>amber diamond</b> on your screen. It always points to your current goal and shows how far away it is.',
        'Help the hurt spirit fox at the Old Lantern Shrine and give it a name. It will travel with you from then on.',
        `Light the shrine with ${k('E')}. Lit shrines heal you, become your return point, and unlock fast travel.`,
        `When you level up, press ${k('C')} to spend your stat points.`,
      ])}
      <h4>Reading the screen</h4>
      ${list([
        '<b>Top left:</b> your level, health (red), spirit for skills (teal) and stamina for sprinting and rolling (green). Below them, your fox\'s bond.',
        '<b>Top right:</b> the minimap, the time of day and your gold. Below it, your current quest and a few short goals.',
        '<b>Bottom:</b> your skills and tonics, and the purple experience bar.',
        '<b>Above people\'s heads:</b> an amber <b>!</b> means they have a new quest for you. A blue <b>?</b> means you have something to tell them.',
      ])}`,
    },
    {
      id: 'controls', title: 'Controls',
      html: `<p class="lead">${G.settings.controls !== 'mouse' ? 'You steer with the keyboard and the camera turns with you, so you never need the mouse to move.' : 'Click the game to look around with the mouse.'} Switch between steering and mouse-look under Settings.</p>
      <dl class="keys">${controlsList().map(([key, d]) => `<dt>${esc(key)}</dt><dd>${esc(d)}</dd>`).join('')}</dl>`,
    },
    {
      id: 'combat', title: 'Fighting hollows',
      html: `<p class="lead">Hollows are shadows the lake has made. They wander near their camps and chase you if you get close.</p>
      <h4>Moves</h4>
      ${list([
        `<b>Attack:</b> left click. Click again quickly for a three-hit combo; the third hit is the strongest. Attacks turn you toward the nearest hollow.`,
        `<b>Roll:</b> ${k('Space')}. You can't be hurt during a roll. It uses stamina, so watch the green bar.`,
        `<b>Sprint:</b> hold ${k('Shift')}. Outside fights you also jog faster on your own after a second of walking.`,
        `<b>Heal:</b> ${k('Q')} drinks a Lantern Tonic and restores almost half your health. Health also comes back slowly once you stop fighting.`,
      ])}
      <h4>Skills</h4>
      <p>Skills cost spirit, which refills over time. Each one has a short wait before you can use it again.</p>
      <table><thead><tr><th>Skill</th><th>What it does</th><th>Cost</th><th>Wait</th><th>Unlocks at</th></tr></thead><tbody>${skillRows()}</tbody></table>
      <h4>Staying alive</h4>
      ${list([
        'Watch for <b>red circles</b> on the ground. Move out before they fill.',
        'A hollow that flashes red is about to strike. That is the moment to roll.',
        'Lantern-eaters throw fire from a distance. Close in quickly or keep moving sideways.',
        'Hollows give up the chase if you run far enough from their camp.',
        'Bosses get angrier when their health bar drops below half.',
      ])}`,
    },
    {
      id: 'fox', title: 'Your fox',
      html: `<p class="lead">The spirit fox you rescue becomes your companion. As your bond grows, ${fox} learns new things.</p>
      <h4>Growing your bond</h4>
      ${list([
        `Pet ${fox} with ${k('F')} when you are close. It helps most if you wait a little between pets.`,
        `Feed it honey cakes: open your bag with ${k('C')}, pick a cake and choose <b>Feed</b>.`,
        'Fight together. Every hollow you defeat brings you a little closer.',
        `Light shrines, find viewpoints, and above all find its <b>${SHARDS.length} memory shards</b>: pale blue crystals hidden around the world.`,
      ])}
      <h4>What it learns</h4>
      <table><thead><tr><th>Bond level</th><th>New ability</th></tr></thead><tbody>${BOND_PERKS.map((p) => `<tr><td>${p.lvl}</td><td>${esc(p.text.charAt(0).toUpperCase() + p.text.slice(1))}</td></tr>`).join('')}</tbody></table>`,
    },
    {
      id: 'people', title: 'People and friendship',
      html: `<p class="lead">Six townsfolk have their own stories, secrets and opinions of you. Their hearts show how much they like you.</p>
      ${list([
        'Some answers show a hint, like a heart with +5. Those change how the person feels about you. Answers without a hint can still matter later.',
        'When someone brings up something you did, a small <b>Remembers</b> note appears above their words.',
        'Gossip spreads at dawn. Lie to one person and others may hear about it tomorrow.',
        'You can give each person <b>one gift per day</b>. Things they like help a lot; things they dislike can set you back. Your journal records what you learn about their tastes.',
        'At 60 friendship, each person gives you something special.',
        'Some secrets only come out once someone trusts you enough.',
      ])}
      <h4>Who\'s who</h4>
      ${list([
        '<b>Mira</b>, innkeeper: sells supplies, lets you rest until morning or nightfall, and knows all the news.',
        '<b>Teodor</b>, the old ferryman at the docks: slow to trust, never forgets a lie.',
        '<b>Inés</b>, Lord Aurel\'s sister, on the forest road: grieving, sharp and easily offended.',
        '<b>Captain Ruel</b>, at the north gate: proud. Earn his respect before you question him.',
        '<b>Sora</b>, the musician on the festival stage: knows the old songs, and more than she says.',
        '<b>Hild</b>, the smith: upgrades your gear at the forge.',
      ])}`,
    },
    {
      id: 'quests', title: 'Quests and goals',
      html: `<p class="lead">There is always something to do next.</p>
      ${list([
        '<b>Main story:</b> six chapters. Each one leads to the next.',
        '<b>Side quests:</b> favors for the townsfolk. They pay well and build friendships.',
        `<b>Tracking:</b> the quest shown at the top right is the one the amber diamond points to. Change it in the journal (${k('J')}).`,
        '<b>Bounties:</b> three new hunting jobs on the notice board in the square every morning. Come back to the board to collect your reward.',
        '<b>Echo Rifts:</b> after chapter 3, two purple rifts open somewhere in the world each day. Survive three waves for good loot. Leaving the area closes the rift.',
        `<b>Deeds:</b> achievements with gold rewards. See them in the journal (${k('J')}) under Deeds.`,
      ])}`,
    },
    {
      id: 'gear', title: 'Gear, loot and money',
      html: `<p class="lead">You can wear a weapon, armor and a charm. Better gear means bigger numbers.</p>
      <h4>Rarity</h4>
      <p>Loot glows in its rarity color. The taller the beam of light, the better the item.</p>
      <table><thead><tr><th>Rarity</th><th>Extra bonuses</th></tr></thead><tbody>${RARITY.map((r) => `<tr><td><span style="color:${r.color};font-weight:700">${r.name}</span></td><td>${r.affixes ? `${r.affixes}` : 'None'}${r.name === 'Legendary' ? ', sometimes a special power' : ''}</td></tr>`).join('')}</tbody></table>
      <h4>Managing your bag</h4>
      ${list([
        `Open your bag with ${k('C')}. Hover an item to compare it with what you wear: green numbers are better, red are worse.`,
        'Double-click gear to equip it.',
        '<b>Break down</b> gear you don\'t need to get echo dust. Better gear gives more.',
        'Your bag holds 36 things. If it is full, loot stays on the ground until you make room.',
      ])}
      <h4>Spending</h4>
      ${list([
        '<b>Mira</b> sells tonics, spirit tea and honey cakes, plus a few pieces of gear that change every morning. She buys anything you want to sell.',
        '<b>Hild\'s forge</b> improves gear up to +10. Each step costs gold and echo dust and raises the item\'s main numbers.',
      ])}`,
    },
    {
      id: 'explore', title: 'Exploring',
      html: `<p class="lead">The valley around the lake is surrounded by five wilder regions, each with its own road, shrine and secrets.</p>
      ${list([
        `<b>${SHRINES.length} lantern shrines.</b> Light them all. Open the map (${k('M')}) and click a lit shrine to travel there instantly.`,
        '<b>Treasure chests.</b> Some sit by the roads; the best are hidden off the beaten path.',
        `<b>${SHARDS.length} memory shards</b> tell ${fox === 'your fox' ? 'the fox\'s' : `${fox}'s`} story.`,
        `<b>${VISTAS.length} viewpoints</b> reward you for finding the best views.`,
        '<b>Moonpetals</b> grow in the wild and glow at night. Pick them for quests and gifts. They grow back every day.',
        '<b>The map</b> fills in as you explore. Dark areas are places you haven\'t been yet.',
        'A day lasts about eight minutes. Rest at the inn to skip to morning or nightfall.',
      ])}
      <h4>Regions and their danger</h4>
      <p>Hollows are tougher further from town. The numbers are the levels of the hollows you'll meet.</p>
      <table><thead><tr><th>Region</th><th>Hollow levels</th></tr></thead><tbody>${regionRows()}</tbody></table>`,
    },
    {
      id: 'saving', title: 'Saving and settings',
      html: `${list([
        'The game saves itself every 20 seconds and after anything important. You never need to save by hand.',
        'Your save lives in this web browser on this computer. Clearing your browser\'s site data erases it.',
        `Press ${k('Esc')} for settings: sound, music, mouse sensitivity, controls and graphics.`,
        'If the game feels slow, set Graphics to Low.',
        'Starting a new journey from the title screen replaces your current save.',
      ])}`,
    },
    {
      id: 'tips', title: 'Tips for new players',
      html: `${list([
        'Spend stat points as soon as you get them. Vitality is a safe choice early on.',
        'Keep two or three Lantern Tonics with you before leaving town.',
        'Equip anything with a green number in its comparison. Break down the rest for echo dust.',
        'Stick to the roads at first; hollow camps sit away from them.',
        'Light every shrine you pass. It saves long walks if you fall.',
        'Talk to everyone again after big story moments. They notice what you have done.',
        `Pet ${fox} often. Its later abilities, like healing you, make a real difference.`,
        'Honesty usually pays off with the townsfolk. Usually.',
      ])}`,
    },
  ];
}

let current = 'rules';
export function openGuideAt(id) { current = id; }

export function renderGuide(root) {
  const sections = guideSections();
  const draw = (filter = '') => {
    const f = filter.trim().toLowerCase();
    const shown = f ? sections.filter((s) => (s.title + ' ' + s.html.replace(/<[^>]+>/g, ' ')).toLowerCase().includes(f)) : sections;
    if (!shown.find((s) => s.id === current) && shown.length) current = shown[0].id;
    const sec = shown.find((s) => s.id === current);
    root.querySelector('.guide-nav ul').innerHTML = shown.length
      ? shown.map((s) => `<li><button data-g="${s.id}" class="${s.id === current ? 'on' : ''}">${esc(s.title)}</button></li>`).join('')
      : '<li class="muted">Nothing matches that search.</li>';
    root.querySelector('.guide-body').innerHTML = sec ? `<h3>${esc(sec.title)}</h3>${sec.html}` : '';
    root.querySelector('.guide-body').scrollTop = 0;
    root.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => { current = b.dataset.g; draw(root.querySelector('#guide-search').value); }));
  };
  root.innerHTML = `<div class="guide"><nav class="guide-nav"><input id="guide-search" type="search" placeholder="Search the guide" aria-label="Search the guide"><ul></ul></nav><article class="guide-body"></article></div>`;
  const input = root.querySelector('#guide-search');
  input.addEventListener('input', () => draw(input.value));
  // typing in the search box shouldn't move the hero; Esc still closes the guide
  input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); input.blur(); closePanel(); } });
  draw();
}
