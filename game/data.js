// Story content: townsfolk, dialogue with memory, quests, fox memories and deeds.
import { S } from './story.js';
import { PLACES } from './world.js';

const fox = () => S.foxName();

// ---------------------------------------------------------------- NPCs
// Dialogue nodes: { text, choices:[{text, hint, cond, effect, next}] , next, effect }
// text and next can be functions of nothing (they read state through S).
export const NPCS = {
  mira: {
    name: 'Mira Hal', title: 'Innkeeper of the Driftwood', pos: { x: -12, z: -7 }, face: 0.3,
    look: { skin: 0xf0c4a0, hair: 0x8a4a2a, hairStyle: 'bun', coat: 0x7a4a5a, coat2: 0xf2d16b, apron: 0xf2ead6 },
    startAff: 35, likes: ['cake', 'moonpetal'], dislikes: ['dust'], portraitBg: '#7a4a5a',
    root() {
      if (S.qStep('m1') === 0) return 'intro';
      if (S.qStep('m1') === 5) return 'm1done';
      if (S.qStep('m6') === 2) return 'ending';
      if (S.qStep('s1') === 1 && S.has('moonpetal', 5)) return 's1turn';
      return 'hub';
    },
    nodes: {
      intro: {
        text: 'Oh! A traveler, during festival week of all weeks. Welcome to Lanternmere, love. I\'m Mira. I run the Driftwood Inn, which means I hear everything.',
        choices: [
          { text: 'Everything? Then tell me why half the lanterns are dark.', hint: 'Curious', next: 'intro2' },
          { text: 'I\'m only passing through.', hint: 'Guarded', effect: () => S.setFlag('mira', 'guarded'), next: 'intro2' },
        ],
      },
      intro2: {
        text: () => (S.flag('mira', 'guarded') ? 'Everyone\'s only passing through, until the lake decides otherwise. ' : 'Sharp, aren\'t you. ') + 'Three nights ago Lord Aurel, who paid for this whole festival, was pulled out of the lake. Since then the lanterns go out by themselves, and shadows walk the roads after dark. Hollows, the old folk call them.',
        next: 'intro3',
      },
      intro3: {
        text: 'Something cried out at the Old Lantern Shrine west of town last night. Nobody dares go look. You have a sword and a face I think I can trust. Would you?',
        choices: [
          { text: 'I\'ll go. Keep a room warm for me.', hint: '♥ +5', effect: () => { S.addAff('mira', 5); S.advance('m1'); }, next: null },
          { text: 'What do I get out of it?', hint: 'Practical', effect: () => { S.setFlag('mira', 'mercenary'); S.advance('m1'); }, next: 'intro4' },
        ],
      },
      intro4: { text: 'A free bed, a hot meal and my undying gossip. Off you go, love. West road, past the fence.', next: null },
      m1done: {
        text: () => `You found it! And who is this? A spirit fox... and you named it ${fox()}. Aurel had a fox like that once, you know. Always curled up inside his lantern. Funny thing.`,
        choices: [
          { text: () => `${fox()} saved me as much as I saved it.`, hint: '♥ +5', effect: () => S.addAff('mira', 5), next: 'm1done2' },
          { text: 'Funny thing indeed. What else do you know about Aurel?', hint: 'Investigate', effect: () => S.setFlag('mira', 'askedAurel'), next: 'm1done2' },
        ],
      },
      m1done2: {
        text: 'Here, for your trouble. Old Teodor down at the docks has been seeing things on the water. He won\'t tell me, but he might tell you. And if you find moonpetals, I need five for the festival feast.',
        effect: () => { S.complete('m1'); S.startQuest('s1'); }, next: null,
      },
      s1turn: {
        text: 'Moonpetals! Five of them, and still glowing. The feast is saved. You\'re a treasure, you know that?',
        effect: () => { S.take('moonpetal', 5); S.complete('s1'); }, next: null,
      },
      ending: {
        text: () => `Look at the square. Every lantern lit, and the lake quiet for the first time in days. ${fox()} hasn't left your side once. Whatever you did out there, Lanternmere will remember it. I'll make sure of that.`,
        next: 'ending2',
      },
      ending2: {
        text: 'But love... the Warden was only what the lake made of the dark. Someone still put Aurel in that water. When you\'re ready to find out who, I\'ll be here. I always am.',
        effect: () => S.complete('m6'), next: null,
      },
      hub: {
        text: () => S.pickLine([
          [S.questDone('m6'), `The hero of the festival! Free cider for you and ${fox()}, forever.`],
          [S.heard('lieTeodor'), 'Teodor says you weren\'t straight with him about those lantern pieces. He forgives slowly, love. I\'d mend that.', 'Heard you lied to Teodor'],
          [S.heard('gaveJournal'), 'Inés has been reading that journal you gave her day and night. Whatever is in it, it\'s eating at her.', 'Heard you gave Inés the journal'],
          [S.heard('helpedRuel'), 'Ruel actually smiled yesterday. Said a certain traveler held the watchtower with him. You\'re good for this town.', 'Heard you held the watchtower'],
          [S.isNight(), 'Out late again? Mind the hollows, and come rest when you need to.'],
          [S.aff('mira') >= 70, `There you are. And ${fox()}! I saved the crispy end of the bread for you, little one.`],
          [true, S.flag('mira', 'mercenary') ? 'Back for that free bed? It\'s still yours.' : 'Welcome back, love. What\'ll it be?'],
        ]),
        choices: [
          { text: 'Show me what you have for sale.', effect: () => S.openShop(), next: null },
          { text: 'I\'d like to rest.', next: 'rest' },
          { text: 'Any news around town?', next: 'news' },
          { text: 'I brought you something.', cond: () => S.hasGift(), effect: () => S.openGift('mira'), next: null },
          { text: 'Goodbye.', next: null },
        ],
      },
      rest: {
        text: 'A soft bed and a warm fire. When should I wake you?',
        choices: [
          { text: 'At nightfall.', effect: () => S.rest('night'), next: null },
          { text: 'In the morning.', effect: () => S.rest('morning'), next: null },
          { text: 'Never mind.', next: 'hub' },
        ],
      },
      news: {
        text: () => S.pickLine([
          [!S.questStarted('m2'), 'Teodor at the docks has been staring at the water like it owes him money. Go and see him.'],
          [!S.questStarted('m3'), 'Inés Calloway, Aurel\'s sister, waits by the forest road every evening. She wants something from the manor ruins.'],
          [!S.questStarted('m4'), 'Captain Ruel is stretched thin at the north gate. Proud man. He\'d never ask for help, so offer it.'],
          [!S.questStarted('m5'), 'Sora hasn\'t played a note since Aurel died. Her stage is right there in the square.'],
          [true, 'The notice board by the square always has bounties posted. Good coin, and they change every morning.'],
        ]),
        next: 'hub',
      },
    },
    milestone: { aff: 60, text: () => `I want you to have this. My mother's bell. Hang it on ${fox()}'s collar, or keep it close.`, reward: () => S.giveGear('charm', 2) },
  },

  teodor: {
    name: 'Teodor', title: 'Ferryman of Lantern Lake', pos: { x: 33, z: 11 }, face: -1.4,
    look: { skin: 0xd8a882, hair: 0xb8b8b8, hairStyle: 'short', beard: true, coat: 0x4a5a4a, coat2: 0x8a6a44, hat: 'wide', weapon: 'pole' },
    startAff: 15, likes: ['cake'], dislikes: ['moonpetal'], portraitBg: '#4a5a4a',
    root() {
      if (S.qStep('m2') === 0) return 'm2start';
      if (S.qStep('m2') === 3) return 'm2turn';
      if (S.qStep('s2') === 1) return 's2turn';
      return 'hub';
    },
    nodes: {
      m2start: {
        text: () => `Hm. You're the one Mira sent. And that's... ${fox()}, is it. I knew a fox like that. It used to sit in Lord Aurel's lantern while I rowed him out.`,
        next: 'm2start2',
      },
      m2start2: {
        text: 'Every night since he drowned, I see lanterns under the water. Pieces of them wash up along the shore, and the hollows guard them like treasure. Bring me three. I need to know.',
        choices: [
          { text: 'I\'ll bring them.', hint: '♥ +3', effect: () => { S.addAff('teodor', 3); S.advance('m2'); }, next: null },
          { text: 'You were with him that night, weren\'t you?', hint: 'Press', effect: () => { S.setFlag('teodor', 'pressed'); S.addAff('teodor', -3); S.advance('m2'); }, next: 'm2press' },
        ],
      },
      m2press: { text: 'I row people across a lake. That\'s all I do. Bring the pieces.', next: null },
      m2turn: {
        text: 'You have them. Let me see. These marks... is that what I think it is?',
        choices: [
          { text: 'It\'s the Aurel crest. Someone broke his lantern on purpose.', hint: 'Truth ♥ +8', effect: () => { S.addAff('teodor', 8); S.setFlag('teodor', 'toldTruth', true); }, next: 'm2truth' },
          { text: 'Just old festival paint. Nothing to worry about.', hint: 'Lie', effect: () => { S.setFlag('teodor', 'lied', true); S.gossip('lieTeodor'); }, next: 'm2lie' },
        ],
      },
      m2truth: {
        text: 'Then it wasn\'t the lake that took him. Thank you for not dressing it up. Here. And if you ever go into the Whispering Pines... my grandson lost a little charm there. I tied it myself.',
        effect: () => { S.take('lanternPiece', 3); S.complete('m2'); S.startQuest('s2'); }, next: null,
      },
      m2lie: {
        text: 'Paint. Of course. I\'ve been rowing sixty years, traveler, I know paint. Go on, then. Inés Calloway wants a word with you by the forest road.',
        effect: () => { S.take('lanternPiece', 3); S.complete('m2'); S.startQuest('s2'); }, next: null,
      },
      s2turn: {
        text: 'That\'s it. That\'s his charm. He cried for two days, you know. Take mine. It\'s kept me afloat for forty years.',
        effect: () => { S.take('charmLost', 1); S.complete('s2'); }, next: null,
      },
      hub: {
        text: () => S.pickLine([
          [S.flag('teodor', 'lied') && !S.flag('teodor', 'forgiven'), 'Painted lanterns. Hm.', 'Remembers you lied about the lantern pieces'],
          [S.questDone('m6'), 'The water is calm tonight. First time in a long while. You did that.'],
          [S.heard('helpedRuel'), 'Heard you stood with the captain. He and I don\'t talk. But that was decent of you.', 'Heard you stood with the captain'],
          [S.isNight(), 'Look at the lanterns rising over the water. Aurel used to count them.'],
          [S.aff('teodor') >= 60, `Sit a while. ${fox()} likes the sound of the water. So do I.`],
          [true, 'Ferry\'s closed. Lake\'s not safe. What do you want?'],
        ]),
        choices: [
          { text: 'I\'m sorry I lied about the lantern pieces.', cond: () => S.flag('teodor', 'lied') && !S.flag('teodor', 'forgiven'), hint: '♥ +10', effect: () => { S.setFlag('teodor', 'forgiven'); S.addAff('teodor', 10); }, next: 'forgive' },
          { text: 'What did you see on the lake that night?', cond: () => S.aff('teodor') >= 50, next: 'secret' },
          { text: 'I brought you something.', cond: () => S.hasGift(), effect: () => S.openGift('teodor'), next: null },
          { text: 'Goodbye.', next: null },
        ],
      },
      forgive: { text: 'Hm. Takes a spine to say that. We\'re square.', next: null },
      secret: { text: 'A boat with no lamp, heading for the middle of the lake an hour before he drowned. It wasn\'t mine. That\'s all I\'ll say until I\'m sure.', effect: () => S.setFlag('teodor', 'secretBoat'), next: null },
    },
    milestone: { aff: 60, text: 'You\'ve been straight with me. Here. Found it in my nets years ago. Never knew what to do with it.', reward: () => S.giveGear('weapon', 3) },
  },

  ines: {
    name: 'Inés Calloway', title: 'Lord Aurel\'s sister', pos: { x: -34, z: -24 }, face: 2.2,
    look: { skin: 0xf3d6c0, hair: 0x1a1418, hairStyle: 'long', coat: 0x2a2030, coat2: 0x6a3a5a, hat: 'veil' },
    startAff: 10, likes: ['moonpetal'], dislikes: ['cake'], portraitBg: '#2a2030',
    root() {
      if (S.qStep('m3') === 0) return 'm3start';
      if (S.qStep('m3') === 4) return 'm3turn';
      if (S.qStep('s5') === 1) return 's5turn';
      return 'hub';
    },
    nodes: {
      m3start: {
        text: 'You\'re the one going around with my brother\'s fox. Don\'t look surprised. Everyone in Lanternmere knew that creature.',
        next: 'm3start2',
      },
      m3start2: {
        text: 'Aurel kept a journal. It wasn\'t on him when they pulled him out. It must be at the manor, in the ruins in the Whispering Pines. Something guards it now. Something that wears armor.',
        choices: [
          { text: 'I\'ll find his journal for you.', hint: '♥ +4', effect: () => { S.addAff('ines', 4); S.advance('m3'); }, next: null },
          { text: 'You inherit everything now, don\'t you?', hint: 'Accuse ♥ -8', effect: () => { S.addAff('ines', -8); S.setFlag('ines', 'accused', true); S.gossip('accusedInes'); S.advance('m3'); }, next: 'm3accuse' },
        ],
      },
      m3accuse: { text: 'I inherit a drowned brother and a town that whispers behind my back. Find the journal. Then accuse me if you still want to.', next: null },
      m3turn: {
        text: 'You found it. You actually found it. Give it to me. Please.',
        choices: [
          { text: 'It\'s yours. He was your brother.', hint: '♥ +12', effect: () => { S.addAff('ines', 12); S.setFlag('ines', 'gaveJournal', true); S.gossip('gaveJournal'); S.take('journal', 1); }, next: 'm3give' },
          { text: 'I\'ll keep it a while. It may be evidence.', hint: 'Keep ♥ -6', effect: () => { S.addAff('ines', -6); S.setFlag('ines', 'keptJournal', true); S.gossip('keptJournal'); }, next: 'm3keep' },
        ],
      },
      m3give: {
        text: '"The lake gives back what it takes." He wrote that on every page. Thank you. Captain Ruel at the north gate is asking for you. Be careful what you tell him.',
        effect: () => S.complete('m3'), next: null,
      },
      m3keep: {
        text: 'Evidence. Then you think someone killed him too. At least we agree on that much. Ruel wants you at the north gate. Don\'t let him take it.',
        effect: () => S.complete('m3'), next: null,
      },
      s5turn: {
        text: () => `You've been finding his memories, haven't you? ${fox()} remembers him. When we were children he used to say the fox would outlive us both. I hated that. I don't anymore.`,
        effect: () => S.complete('s5'), next: null,
      },
      hub: {
        text: () => S.pickLine([
          [S.flag('ines', 'accused') && S.aff('ines') < 40, 'Come to accuse me again?', 'Remembers you accused her'],
          [S.flag('ines', 'keptJournal'), 'Have you read it yet? Does he mention me?', 'Remembers you kept the journal'],
          [S.questDone('m6'), 'The lanterns are lit. He would have loved to see it. Thank you.'],
          [S.heard('helpedRuel') && S.flag('ines', 'gaveJournal'), 'Ruel asked me for the journal yesterday. I said no. You trusted me with it, and I won\'t break that.', 'Remembers you trusted her with the journal'],
          [S.aff('ines') >= 60, `${fox()}, come here. You look just like you did when Aurel carried you.`],
          [true, 'The forest is quiet tonight. I don\'t trust quiet.'],
        ]),
        choices: [
          { text: 'Tell me about your brother.', next: 'brother' },
          { text: 'I brought you something.', cond: () => S.hasGift(), effect: () => S.openGift('ines'), next: null },
          { text: 'Goodbye.', next: null },
        ],
      },
      brother: {
        text: () => (S.aff('ines') >= 50
          ? 'He was kind to everyone except himself. The week before he died he was frightened of something. He kept asking Teodor about the currents.'
          : 'You haven\'t earned that story yet.'),
        effect: () => { if (S.aff('ines') >= 50) S.setFlag('ines', 'toldBrother'); },
        next: null,
      },
    },
    milestone: { aff: 60, text: 'This was his. He would want it used, not kept in a drawer.', reward: () => S.giveGear('charm', 3) },
  },

  ruel: {
    name: 'Captain Ruel', title: 'Captain of the Watch', pos: { x: 2, z: -35 }, face: 3.14,
    look: { skin: 0xe2b48e, hair: 0x5a3a24, hairStyle: 'short', beard: true, coat: 0x3a4a6a, coat2: 0xb03030, hat: 'helm', weapon: 'spear', scale: 1.08 },
    startAff: 20, likes: ['cake'], dislikes: ['moonpetal'], portraitBg: '#3a4a6a',
    root() {
      if (S.qStep('m4') === 0) return 'm4start';
      if (S.qStep('m4') === 3) return 'm4turn';
      if (S.qStep('s4') === 1) return 's4turn';
      return 'hub';
    },
    nodes: {
      m4start: {
        text: () => (S.flag('ines', 'keptJournal')
          ? 'You have Aurel\'s journal. Don\'t deny it, this town has no secrets. Keep it for now. I have a bigger problem.'
          : S.flag('ines', 'gaveJournal')
            ? 'You gave the journal to the sister. Interesting choice. We\'ll see if you regret it. I have a bigger problem.'
            : 'You\'re the traveler. I have a problem.'),
        next: 'm4start2',
      },
      m4start2: {
        text: 'The watchtower on the hill went dark two nights ago and my men won\'t go near it. Light the shrine up there and hold the hill until the hollows break. I can\'t leave this gate.',
        choices: [
          { text: 'Consider it done, Captain.', hint: '♥ +5', effect: () => { S.addAff('ruel', 5); S.advance('m4'); }, next: null },
          { text: 'Can\'t, or won\'t?', hint: 'Needle ♥ -4', effect: () => { S.addAff('ruel', -4); S.setFlag('ruel', 'needled'); S.advance('m4'); }, next: 'm4needle' },
        ],
      },
      m4needle: { text: 'Twenty years I\'ve held this gate. I don\'t owe you an explanation. The hill. Go.', next: null },
      m4turn: {
        text: 'The tower burns again. I saw it from here. I... misjudged you, traveler.',
        effect: () => { S.setFlag('ruel', 'helped', true); S.gossip('helpedRuel'); S.complete('m4'); }, next: 'm4turn2',
      },
      m4turn2: { text: 'Sora has been asking about the old shrines. Something about a song her grandmother taught her. Go and hear her out.', next: null },
      s4turn: { text: 'Ten hollows in the dark. You fight like you\'ve done it all your life. The watch could use you. Take this, it\'s better than what my men wear.', effect: () => S.complete('s4'), next: null },
      hub: {
        text: () => S.pickLine([
          [S.flag('ruel', 'needled') && S.aff('ruel') < 40, 'You again.', 'Remembers you questioned his courage'],
          [S.questDone('m6'), 'The roads are safe. My men can sleep. That\'s your doing.'],
          [S.heard('keptJournal') && !S.flag('ines', 'keptJournal'), 'Word is you\'re holding Aurel\'s journal. Smart. Don\'t trust that family.', 'Heard you kept the journal'],
          [S.heard('accusedInes'), 'I hear you put hard questions to the sister. Good. Someone had to.', 'Heard you accused Inés'],
          [S.isNight(), 'Stay inside the fence after dark if you can. If you can\'t, stay sharp.'],
          [true, 'Gate\'s holding. What do you need?'],
        ]),
        choices: [
          { text: 'Any work for me?', cond: () => S.questDone('m4') && !S.questStarted('s4'), effect: () => S.startQuest('s4'), next: 'patrol' },
          { text: 'Where were you the night Aurel drowned?', cond: () => S.aff('ruel') >= 50, next: 'alibi' },
          { text: 'I brought you something.', cond: () => S.hasGift(), effect: () => S.openGift('ruel'), next: null },
          { text: 'Goodbye.', next: null },
        ],
      },
      patrol: { text: 'Night patrol. Put down ten hollows after dark. The roads, the fields, wherever you find them.', next: null },
      alibi: { text: 'At this gate. Alone. Which means nobody can say I wasn\'t. I know how that sounds.', effect: () => S.setFlag('ruel', 'alibi'), next: null },
    },
    milestone: { aff: 60, text: 'I don\'t do this. Take my old blade. It\'s served me well, and it should serve someone who\'ll use it.', reward: () => S.giveUnique('ruelBlade') },
  },

  sora: {
    name: 'Sora', title: 'Festival musician', pos: { x: 12, z: -14 }, face: 0,
    look: { skin: 0xf6d8bc, hair: 0x3a6ab0, hairStyle: 'bob', coat: 0xe8e0d0, coat2: 0x3a6ab0, weapon: 'lute' },
    startAff: 25, likes: ['moonpetal', 'cake'], dislikes: ['dust'], portraitBg: '#3a6ab0',
    root() {
      if (S.qStep('s3') === 1 && S.has('strings', 1)) return 's3turn';
      if (S.qStep('m5') === 0) return 'm5start';
      if (S.qStep('m5') === 2) return 'm5turn';
      return 'hub';
    },
    nodes: {
      m5start: {
        text: 'Ruel sent you? He never sends anyone. You must be something. My grandmother taught me a song for the lake. She said if the shrines burn, the song can calm whatever the water has made.',
        next: 'm5start2',
      },
      m5start2: {
        text: 'Light five of the lantern shrines around the valley. Then come back to me and I\'ll tell you where to go.',
        choices: [
          { text: 'And then you\'ll sing again?', hint: '♥ +5', effect: () => { S.addAff('sora', 5); S.advance('m5'); }, next: 'm5yes' },
          { text: 'A song? You\'re trusting your life to a lullaby?', hint: 'Tease ♥ -3', effect: () => { S.addAff('sora', -3); S.setFlag('sora', 'teased'); S.advance('m5'); }, next: 'm5tease' },
        ],
      },
      m5yes: { text: 'For you? Maybe twice.', next: null },
      m5tease: { text: 'You\'re trusting yours to a fox and a borrowed sword. Light the shrines.', next: null },
      m5turn: {
        text: 'Five shrines! I can feel them, like strings tuned right. The heart of it is in Mirefen Marsh, at the stone ring. It only wakes at night. I\'ll sing from here, and you\'ll hear me. I promise.',
        effect: () => { S.complete('m5'); }, next: null,
      },
      s3turn: {
        text: 'My strings! You found the thief! Okay, I take back everything I thought about you. Well. Most of it.',
        effect: () => { S.take('strings', 1); S.complete('s3'); }, next: null,
      },
      hub: {
        text: () => S.pickLine([
          [S.questDone('m6'), 'Did you hear me? Out in the marsh? I sang until my voice gave out.'],
          [S.flag('sora', 'teased') && S.aff('sora') < 40, 'Here comes the critic.', 'Remembers you teased her about the song'],
          [!S.questStarted('s3') && S.questDone('m1'), 'One of those lantern-eating hollows stole my silver strings. Right off the stage!'],
          [S.heard('lieTeodor'), 'Did you really lie to old Teodor? He looks sadder than usual.', 'Heard you lied to Teodor'],
          [S.aff('sora') >= 70, `If you and ${fox()} ever get tired of saving the world, the stage needs a dancer.`],
          [true, 'No requests until I get my nerve back.'],
        ]),
        choices: [
          { text: 'I\'ll get your strings back.', cond: () => !S.questStarted('s3') && S.questDone('m1'), effect: () => S.startQuest('s3'), next: 'strings' },
          { text: 'Will you play something?', cond: () => S.questDone('m6'), next: 'play' },
          { text: 'Who did you sing for, out on the water?', cond: () => S.aff('sora') >= 55, next: 'secret' },
          { text: 'I brought you something.', cond: () => S.hasGift(), effect: () => S.openGift('sora'), next: null },
          { text: 'Goodbye.', next: null },
        ],
      },
      strings: { text: 'It flew off toward the Whispering Pines, glowing like a stolen moon. You can\'t miss it.', next: null },
      play: { text: 'Only because you asked.', effect: () => S.music('song'), next: null },
      secret: { text: 'For Aurel. We were... it doesn\'t matter now. He said he\'d meet me at the pier that night. He never came.', effect: () => S.setFlag('sora', 'secretLover'), next: null },
    },
    milestone: { aff: 60, text: 'Here. My ribbon. For luck. Don\'t make it weird.', reward: () => S.giveUnique('sorasRibbon') },
  },

  hild: {
    name: 'Hild', title: 'Smith', pos: { x: -18.5, z: 12.5 }, face: 2.2,
    look: { skin: 0xc89070, hair: 0xc8642a, hairStyle: 'spiky', coat: 0x5a4a3a, coat2: 0x3a2a1c, apron: 0x3a2a1c, weapon: 'hammer', scale: 1.05 },
    startAff: 30, likes: ['dust'], dislikes: ['moonpetal'], portraitBg: '#5a4a3a',
    root() {
      if (S.qStep('s6') === 1 && S.has('dust', 10)) return 's6turn';
      return 'hub';
    },
    nodes: {
      hub: {
        text: () => {
          const w = S.weapon();
          if (!w) return 'No blade? Bold. Stupid, but bold.';
          if (w.rarity >= 4) return `Is that ${w.name}? Where did you... no, don't tell me. Let me just look at it.`;
          if (w.rarity >= 3) return 'Now that\'s proper steel. Somebody loved whoever made that.';
          if (w.upgrade >= 3) return 'My work holds up, I see. Keep feeding me echo dust and it\'ll only get better.';
          return 'Fires are hot. What are we sharpening today?';
        },
        choices: [
          { text: 'Improve my gear.', effect: () => S.openForge(), next: null },
          { text: 'Need anything?', cond: () => !S.questStarted('s6'), effect: () => S.startQuest('s6'), next: 'commission' },
          { text: 'I brought you something.', cond: () => S.hasGift(), effect: () => S.openGift('hild'), next: null },
          { text: 'Goodbye.', next: null },
        ],
      },
      commission: { text: 'Echo dust. The stuff hollows leave behind. Bring me ten and I\'ll make you something worth swinging.', next: null },
      s6turn: { text: 'Ten! Good. Give me a moment... there. Balanced, sharp and a little bit haunted. My best yet.', effect: () => { S.take('dust', 10); S.complete('s6'); }, next: null },
    },
    milestone: { aff: 60, text: 'I made this on my own time. Don\'t thank me. Just don\'t die.', reward: () => S.giveGear('weapon', 3) },
  },
};

export const GIFT_LINES = {
  like: ['Oh, you remembered! Thank you.', 'For me? That\'s lovely.', 'You know me too well.'],
  neutral: ['Thank you, I suppose.', 'That\'s... kind.'],
  dislike: ['Ah. I don\'t really... thank you anyway.', 'Hm. Not my favorite.'],
};

// ---------------------------------------------------------------- quests
export const QUESTS = {
  m1: {
    title: 'A Light in the Mist', giver: 'mira', type: 'main', chapter: 1,
    steps: [
      { text: 'Talk to Mira outside the Driftwood Inn', type: 'talk', npc: 'mira' },
      { text: 'Find the Old Lantern Shrine west of town', type: 'reach', x: -48, z: 4, r: 12 },
      { text: 'Drive off the wisps at the shrine', type: 'kill', enemy: 'wisp', count: 3, spawn: { type: 'wisp', n: 3, x: -47, z: 9, lvl: 1, tag: 'm1' } },
      { text: 'Help the injured fox', type: 'interact', id: 'foxRescue', x: -45, z: 9 },
      { text: 'Light the Old Lantern Shrine', type: 'interact', id: 'shrine:old', x: -48, z: 4 },
      { text: 'Return to Mira', type: 'talk', npc: 'mira' },
    ],
    rewards: { xp: 120, gold: 40, items: [['tonic', 3]] }, unlocks: ['m2'],
  },
  m2: {
    title: 'Echoes on the Water', giver: 'teodor', type: 'main', chapter: 2,
    steps: [
      { text: 'Talk to Teodor at the docks', type: 'talk', npc: 'teodor' },
      { text: 'Recover drowned lantern pieces on the shore', type: 'collect', item: 'lanternPiece', count: 3, spawn: { type: 'husk', n: 2, at: 'pieces', lvl: 2, tag: 'm2' } },
      { text: 'Clear the lantern-eaters at the boathouse', type: 'kill', enemy: 'eater', count: 3, spawn: { type: 'eater', n: 3, x: 26, z: 40, lvl: 3, tag: 'm2b' } },
      { text: 'Bring the pieces to Teodor', type: 'talk', npc: 'teodor' },
    ],
    rewards: { xp: 300, gold: 70, gear: 2 }, unlocks: ['m3'],
  },
  m3: {
    title: 'The Sister\'s Request', giver: 'ines', type: 'main', chapter: 3,
    steps: [
      { text: 'Talk to Inés on the forest road', type: 'talk', npc: 'ines' },
      { text: 'Reach the Aurel Manor ruins in the Whispering Pines', type: 'reach', x: PLACES.manor.x, z: PLACES.manor.z, r: 18 },
      { text: 'Defeat the Drowned Knight', type: 'kill', enemy: 'knight', count: 1, spawn: { type: 'knight', n: 1, x: -108, z: -100, lvl: 6, tag: 'm3', boss: true } },
      { text: 'Search the ruins for Aurel\'s journal', type: 'interact', id: 'journal', x: PLACES.journal.x, z: PLACES.journal.z },
      { text: 'Return to Inés', type: 'talk', npc: 'ines' },
    ],
    rewards: { xp: 600, gold: 120, gear: 3 }, unlocks: ['m4', 's5'],
  },
  m4: {
    title: 'The Captain\'s Watch', giver: 'ruel', type: 'main', chapter: 4,
    steps: [
      { text: 'Talk to Captain Ruel at the north gate', type: 'talk', npc: 'ruel' },
      { text: 'Light the Watchtower Shrine', type: 'interact', id: 'shrine:tower', x: -84, z: 88 },
      { text: 'Hold the hill: defeat 8 hollows', type: 'kill', enemy: 'any', count: 8, zone: 'tower', spawn: { type: 'mix', n: 5, x: -90, z: 84, lvl: 7, tag: 'm4', waves: 2 } },
      { text: 'Report to Captain Ruel', type: 'talk', npc: 'ruel' },
    ],
    rewards: { xp: 900, gold: 180, gear: 3 }, unlocks: ['m5'],
  },
  m5: {
    title: 'Song for the Lake', giver: 'sora', type: 'main', chapter: 5,
    steps: [
      { text: 'Talk to Sora at the festival stage', type: 'talk', npc: 'sora' },
      { text: 'Light five lantern shrines across the valley', type: 'shrines', count: 5 },
      { text: 'Return to Sora', type: 'talk', npc: 'sora' },
    ],
    rewards: { xp: 1200, gold: 220, gear: 3 }, unlocks: ['m6'],
  },
  m6: {
    title: 'The Mire Warden', giver: 'sora', type: 'main', chapter: 6,
    steps: [
      { text: 'Go to the stone ring in Mirefen Marsh after nightfall', type: 'reach', x: PLACES.bossArena.x, z: PLACES.bossArena.z, r: 13, night: true },
      { text: 'Defeat the Mire Warden', type: 'kill', enemy: 'warden', count: 1, spawn: { type: 'warden', n: 1, x: 86, z: 116, lvl: 12, tag: 'm6', boss: true } },
      { text: 'Return to Mira in the festival square', type: 'talk', npc: 'mira' },
    ],
    rewards: { xp: 2500, gold: 600, unique: 'firstBell' }, unlocks: [],
  },
  s1: {
    title: 'Moonpetals for the Feast', giver: 'mira', type: 'side',
    steps: [
      { text: 'Gather 5 moonpetals (they glow at night)', type: 'collect', item: 'moonpetal', count: 5 },
      { text: 'Bring the moonpetals to Mira', type: 'talk', npc: 'mira' },
    ],
    rewards: { xp: 100, gold: 30, items: [['cake', 3]], aff: ['mira', 10] },
  },
  s2: {
    title: 'The Grandson\'s Charm', giver: 'teodor', type: 'side',
    steps: [
      { text: 'Search the Whispering Pines for a little knotted charm', type: 'interact', id: 'charmSpot', x: PLACES.charm.x, z: PLACES.charm.z, hideMarker: true, area: 30 },
      { text: 'Return the charm to Teodor', type: 'talk', npc: 'teodor' },
    ],
    rewards: { xp: 220, gold: 20, unique: 'teodorKnot', aff: ['teodor', 15] },
  },
  s3: {
    title: 'Stolen Strings', giver: 'sora', type: 'side',
    steps: [
      { text: 'Hunt the glowing thief in the Whispering Pines', type: 'collect', item: 'strings', count: 1, spawn: { type: 'eater', n: 1, x: -62, z: -74, lvl: 4, tag: 's3', elite: 'Strings Thief', drop: 'strings' } },
      { text: 'Return the strings to Sora', type: 'talk', npc: 'sora' },
    ],
    rewards: { xp: 300, gold: 60, gear: 2, aff: ['sora', 15] },
  },
  s4: {
    title: 'Night Patrol', giver: 'ruel', type: 'side',
    steps: [
      { text: 'Defeat 10 hollows after dark', type: 'kill', enemy: 'any', count: 10, night: true },
      { text: 'Report to Captain Ruel', type: 'talk', npc: 'ruel' },
    ],
    rewards: { xp: 700, gold: 160, gearSlot: ['armor', 3] },
  },
  s5: {
    title: 'Ashes and Ink', giver: 'ines', type: 'side',
    steps: [
      { text: 'Find 3 of the fox\'s memory shards', type: 'shards', count: 3 },
      { text: 'Talk to Inés', type: 'talk', npc: 'ines' },
    ],
    rewards: { xp: 380, gold: 80, aff: ['ines', 15] },
  },
  s6: {
    title: 'Hild\'s Commission', giver: 'hild', type: 'side',
    steps: [
      { text: 'Collect 10 echo dust from hollows', type: 'collect', item: 'dust', count: 10 },
      { text: 'Bring the dust to Hild', type: 'talk', npc: 'hild' },
    ],
    rewards: { xp: 260, gold: 40, gearSlot: ['weapon', 2], aff: ['hild', 12] },
  },
};

// ---------------------------------------------------------------- fox memories
export const SHARDS = [
  { x: -30, z: -62, text: 'A warm hand lifts a paper lantern. A man\'s voice: "There. Now you\'ll never be lost."' },
  { x: -125, z: -25, text: 'Lord Aurel, younger, laughing on the pier. You are curled inside the lantern at his feet.' },
  { x: -128, z: -122, text: 'Festival drums. Hundreds of lanterns on the water. He lets you choose which one to light first.' },
  { x: -55, z: 112, text: 'Two voices arguing behind the manor. One of them is his sister\'s.' },
  { x: -122, z: 100, text: 'Rain on the lake. Aurel writing late: "The lake gives back what it takes. I must be careful."' },
  { x: 20, z: -98, text: 'A boat with no lamp, gliding toward the middle of the lake at an hour when no boat should be out.' },
  { x: 60, z: -112, text: 'A captain\'s badge, glinting in the reeds below the pier. What was it doing there?' },
  { x: 116, z: -94, text: 'A song drifts over the water. Someone is singing for a person who never arrives.' },
  { x: 28, z: 120, text: 'Cold water. A hand reaches for your lantern. Then the light goes out.' },
  { x: 22, z: 76, text: 'You remember your name now. Not the one the town gave you. The one he did.' },
];

export const VISTAS = [
  { id: 'cliff', x: 52, z: -66, name: 'Lake overlook', text: 'The whole lake spread out below, lanterns rising like slow sparks.' },
  { id: 'ridge', x: -136, z: -46, name: 'Pine ridge', text: 'An ocean of pines, and somewhere in it the manor\'s broken towers.' },
  { id: 'hilltop', x: -104, z: 68, name: 'Watchtower hilltop', text: 'The festival square glows far off, small and brave in the valley.' },
  { id: 'marshlook', x: 118, z: 84, name: 'Marsh lookout', text: 'Mist curls over the marsh. In the middle, a ring of standing stones.' },
];

export const CHESTS = [
  { id: 'c1', x: -54, z: 12, tier: 0 }, { id: 'c2', x: 24, z: 38, tier: 1 }, { id: 'c3', x: -60, z: -44, tier: 1 },
  { id: 'c4', x: -100, z: -112, tier: 2 }, { id: 'c5', x: -142, z: -72, tier: 2, hidden: true }, { id: 'c6', x: -98, z: 84, tier: 1 },
  { id: 'c7', x: -132, z: 112, tier: 2, hidden: true }, { id: 'c8', x: 102, z: -86, tier: 1 }, { id: 'c9', x: 66, z: 98, tier: 2 },
  { id: 'c10', x: 98, z: 128, tier: 3, hidden: true }, { id: 'c11', x: 10, z: -62, tier: 0 }, { id: 'c12', x: -20, z: 62, tier: 0 },
  { id: 'c13', x: 128, z: -76, tier: 3, hidden: true }, { id: 'c14', x: -148, z: 12, tier: 3, hidden: true },
];

export const HERBS = [
  [-40, 20], [-60, -10], [-30, 48], [12, 52], [30, 64], [-12, -58], [26, -60], [-78, -30], [-50, -80], [-112, -60],
  [-70, 60], [-110, 40], [44, 72], [70, -70], [10, 98], [-24, 96], [-140, -10], [40, -84],
];

export const RIFT_SPOTS = [[-30, -96], [-138, 40], [18, 98], [112, -78], [-60, 58], [-20, 120]];

// ---------------------------------------------------------------- deeds
export const DEEDS = [
  { id: 'first', name: 'First light', desc: 'Defeat your first hollow.', test: (s) => s.stats.kills >= 1, gold: 20 },
  { id: 'lv5', name: 'Finding your feet', desc: 'Reach level 5.', test: (s) => s.player.level >= 5, gold: 60 },
  { id: 'lv10', name: 'Seasoned', desc: 'Reach level 10.', test: (s) => s.player.level >= 10, gold: 150 },
  { id: 'lv20', name: 'Legend of Lanternmere', desc: 'Reach level 20.', test: (s) => s.player.level >= 20, gold: 500 },
  { id: 'kills100', name: 'Hollow hunter', desc: 'Defeat 100 hollows.', test: (s) => s.stats.kills >= 100, prog: (s) => [s.stats.kills, 100], gold: 200 },
  { id: 'chests10', name: 'Treasure seeker', desc: 'Open 10 chests.', test: (s) => s.stats.chests >= 10, prog: (s) => [s.stats.chests, 10], gold: 150 },
  { id: 'shrines', name: 'Keeper of flames', desc: 'Light all 6 lantern shrines.', test: (s) => s.world.shrines.length >= 6, prog: (s) => [s.world.shrines.length, 6], gold: 200 },
  { id: 'shards', name: 'Every memory', desc: 'Find all 10 memory shards.', test: (s) => s.world.shards.length >= 10, prog: (s) => [s.world.shards.length, 10], gold: 300 },
  { id: 'vistas', name: 'Wanderer\'s eye', desc: 'Find all 4 vistas.', test: (s) => s.world.vistas.length >= 4, prog: (s) => [s.world.vistas.length, 4], gold: 120 },
  { id: 'legend', name: 'Touched by legend', desc: 'Find a Legendary item.', test: (s) => s.stats.legendaries >= 1, gold: 100 },
  { id: 'friend', name: 'Kindred spirit', desc: 'Reach 90 friendship with anyone in town.', test: (s) => Object.values(s.npc).some((n) => n.aff >= 90), gold: 250 },
  { id: 'bond', name: 'Inseparable', desc: 'Reach bond level 10 with your fox.', test: (s) => s.fox.bondLevel >= 10, prog: (s) => [s.fox.bondLevel, 10], gold: 300 },
  { id: 'knight', name: 'Rust and ruin', desc: 'Defeat the Drowned Knight.', test: (s) => s.world.knightDefeated, gold: 100 },
  { id: 'warden', name: 'Lanterns relit', desc: 'Defeat the Mire Warden.', test: (s) => s.world.bossDefeated, gold: 500 },
  { id: 'rifts', name: 'Rift walker', desc: 'Clear 5 Echo Rifts.', test: (s) => s.world.riftsCleared >= 5, prog: (s) => [s.world.riftsCleared, 5], gold: 300 },
  { id: 'bounties', name: 'Board regular', desc: 'Complete 10 bounties.', test: (s) => (s.stats.bounties || 0) >= 10, prog: (s) => [s.stats.bounties || 0, 10], gold: 250 },
  { id: 'gifts', name: 'Thoughtful', desc: 'Give 10 gifts.', test: (s) => s.stats.gifts >= 10, prog: (s) => [s.stats.gifts, 10], gold: 100 },
];

// Fox bond perks, unlocked by bond level.
export const BOND_PERKS = [
  { lvl: 2, text: 'fights beside you' },
  { lvl: 3, text: 'learns Fox Flame (skill 2)' },
  { lvl: 4, text: 'fetches loot for you' },
  { lvl: 5, text: 'heals you when you\'re hurt' },
  { lvl: 7, text: 'saves you from falling once a day' },
  { lvl: 10, text: 'remembers its true form' },
];
