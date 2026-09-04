/* ══════════════════════════════════════════════════════════════
   CARDS-DATA.JS — Catalogue du système de collection BTS Archive
   ------------------------------------------------------------
   Ce fichier ne fait QUE définir des données statiques.
   Aucune dépendance à Supabase ni au DOM ici : collection.js s'en
   charge. Tu peux étendre ce catalogue à tout moment en ajoutant
   des entrées — le reste du système (packs, progression, %) est
   100% dynamique et se recalcule automatiquement.

   Champs d'une carte :
   - id       : identifiant unique stable (ne JAMAIS changer une fois
                publié, sinon les collections des utilisateurs cassent)
   - cat      : 'members' | 'eras' | 'albums' | 'mvs' | 'lore' | 'moments' | 'special' | 'secret'
   - sub      : sous-catégorie affichée (nom du membre, nom de l'era, etc.)
   - name     : nom affiché sur la carte
   - rarity   : 'common' | 'rare' | 'epic' | 'legendary'
   - img      : chemin d'image (Photo/...) ou null (fallback emoji utilisé)
   - emoji    : emoji de secours si pas d'image
   - desc     : description courte affichée dans la vue détaillée
   - action   : comment le bouton "EXPLORE" navigue
                { type:'era', idx:N }        → appelle showEra(N)
                { type:'lore' }              → ouvre la section BTS Universe
                null                          → pas de bouton Explore
   - source   : comment la carte peut être obtenue
                'pack' | 'discovery' | 'quest' | 'achievement' | 'event'
   - obtainHint : phrase courte affichée tant que la carte n'est pas trouvée
   ══════════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  const RARITY = {
    common:    { label: 'Common',    weight: 60, fragments: 5,  color: '#9a92ad' },
    rare:      { label: 'Rare',      weight: 28, fragments: 10, color: '#5fb0e0' },
    epic:      { label: 'Epic',      weight: 10, fragments: 25, color: '#b06bf2' },
    legendary: { label: 'Legendary', weight: 2,  fragments: 50, color: '#e0a83a' },
  };

  // Coût en fragments : conservé uniquement pour un usage futur éventuel.
  // Le passage de niveau se fait désormais via les DOUBLONS (voir collection.js) :
  // 1 exemplaire = Niveau 1 ; +2 doublons = Niveau 2 ; +2 doublons de plus = Niveau 3.
  const LEVEL_UP_COST = { 2: 40, 3: 90, master: 160 };

  const CARDS = [];
  function add(id, cat, sub, name, rarity, img, emoji, desc, action, source, obtainHint, imgLevels) {
    CARDS.push({ id, cat, sub, name, rarity, img: img || null, emoji: emoji || '💜', desc, action: action || null, source, obtainHint: obtainHint || '', imgLevels: imgLevels || null });
  }

  /* ────────────────────────────────────────────
     👤 MEMBERS — jalons de carrière par membre
  ──────────────────────────────────────────── */
  const M = [
    ['rm', 'RM', '🐨', [
      ['debut', 'RM — Debut', 'rare', 0, "L'ère où Namjoon débute avec BTS, leader dès le premier jour."],
      ['darkwild', 'RM — Dark & Wild', 'common', 2, "Première ère complète du groupe, encore en pleine construction."],
      ['wings', 'RM — Wings', 'epic', 6, "Le solo « Reflection », l'un des tournants émotionnels de RM."],
      ['indigo', 'RM — Indigo', 'legendary', null, "Premier album solo officiel de RM, sorti en décembre 2022."],
      ['rpwp', 'RM — Right Place, Wrong Person', 'epic', null, "Deuxième album solo de RM, sorti en mai 2024."],
      ['persona', 'RM — Persona', 'rare', 11, "L'ère Map of the Soul, centrée sur la question « qui suis-je ? »."],
    ]],
    ['jin', 'Jin', '🐹', [
      ['debut', 'Jin — Debut', 'rare', 0, "L'entrée en scène du « visuel » du groupe, dès 2013."],
      ['epiphany', 'Jin — Epiphany', 'epic', 9, "Le solo « Epiphany » sur Love Yourself: Her, un des plus marquants de Jin."],
      ['abyss', 'Jin — Abyss', 'rare', null, "Titre solo sorti en 2020, sur la solitude derrière l'image publique."],
      ['moon', 'Jin — Moon', 'epic', null, "Solo sur BE (2020), un hommage direct à l'ARMY."],
      ['thastlast', 'Jin — The Astronaut', 'legendary', null, "Premier single solo officiel de Jin, sorti en 2022."],
      ['happy', 'Jin — Happy', 'rare', null, "Premier mini-album solo de Jin, sorti en 2024."],
    ]],
    ['suga', 'SUGA', '🐱', [
      ['debut', 'SUGA — Debut', 'rare', 0, "Les débuts du rappeur/producteur du groupe."],
      ['agustd', 'SUGA — Agust D', 'epic', null, "Première mixtape solo sous son nom de scène alternatif, 2016."],
      ['daechwita', 'SUGA — D-2', 'epic', null, "Deuxième mixtape Agust D, portée par le single « Daechwita »."],
      ['dday', 'SUGA — D-DAY', 'legendary', null, "Dernier volet de la trilogie D-, premier album solo complet, 2023."],
      ['seesaw', 'SUGA — Seesaw', 'rare', 13, "Solo introspectif sur l'album BE (2020)."],
      ['wings', 'SUGA — Wings (First Love)', 'common', 6, "Solo sur le piano qui a façonné sa passion pour la musique."],
    ]],
    ['jhope', 'j-hope', '🐿️', [
      ['debut', 'j-hope — Debut', 'rare', 0, "Le sourire du groupe fait ses débuts en 2013."],
      ['hopeworld', 'j-hope — Hope World', 'epic', null, "Première mixtape solo, sortie en 2018."],
      ['jack', 'j-hope — Jack In The Box', 'epic', null, "Premier album solo complet, exploration plus sombre, 2022."],
      ['onthestreet', 'j-hope — on the street', 'rare', null, "Collaboration avec J. Cole, single de 2023."],
      ['hopeon', 'j-hope — HOPE ON THE STREET', 'legendary', null, "Album solo dédié à la danse et au hip-hop, 2024."],
      ['mama', 'j-hope — MAMA', 'common', 13, "Solo hommage à sa mère, sur l'album BE (2020)."],
    ]],
    ['jimin', 'Jimin', '🐥', [
      ['debut', 'Jimin — Debut', 'rare', 0, "Les débuts du danseur principal du groupe."],
      ['lieto', 'Jimin — Lie', 'epic', 8, "Solo sur Love Yourself: Her, salué pour sa performance vocale."],
      ['filter', 'Jimin — Filter', 'epic', 9, "Solo sur Love Yourself: Tear, à l'univers visuel très marqué."],
      ['face', 'Jimin — FACE', 'legendary', null, "Premier album solo, porté par « Like Crazy », 2023."],
      ['muse', 'Jimin — MUSE', 'epic', null, "Deuxième album solo de Jimin, sorti en 2024."],
      ['promise', 'Jimin — Promise', 'rare', null, "Single autoproduit sorti en 2018."],
    ]],
    ['v', 'V', '🐯', [
      ['debut', 'V — Debut', 'rare', 0, "L'entrée en scène de Taehyung, à la voix si reconnaissable."],
      ['singularity', 'V — Singularity', 'epic', 11, "Solo sur Map of the Soul: Persona, salué pour son ambiance unique."],
      ['inner child', 'V — Inner Child', 'rare', 13, "Solo introspectif sur l'album BE (2020)."],
      ['layover', 'V — Layover', 'legendary', null, "Premier album solo, esthétique rétro/soul, sorti en 2023."],
      ['fri(end)s', 'V — FRI(END)S', 'epic', null, "Single solo sorti en 2022, avant l'album complet."],
      ['sweetnight', 'V — Sweet Night', 'common', null, "OST du drama Itaewon Class, très populaire chez les fans."],
    ]],
    ['jk', 'Jung Kook', '🐰', [
      ['debut', 'Jung Kook — Debut', 'rare', 0, "Le maknae du groupe fait ses débuts en 2013, à 15 ans."],
      ['euphoria', 'Jung Kook — Euphoria', 'epic', 7, "Solo présenté dans le film Love Yourself: Highlight Reel."],
      ['stillwithyou', 'Jung Kook — Still With You', 'rare', null, "Premier titre self-produced de JK, sorti en 2020."],
      ['seven', 'Jung Kook — Seven', 'legendary', null, "Premier single solo officiel, énorme succès mondial en 2023."],
      ['golden', 'Jung Kook — GOLDEN', 'epic', null, "Premier album solo complet de Jung Kook, sorti en 2023."],
      ['standingnext', 'Jung Kook — Standing Next to You', 'rare', null, "Titre extrait de GOLDEN, tournée de promotion mondiale."],
    ]],
  ];
  // Tes vrais visuels "bébé" (Photo/Photocard/), un triptyque de 3 niveaux par membre.
  // ⚠️ À confirmer : mapping supposé nom-de-fichier → membre (dis-moi si je me trompe) :
  //   Baby-Leader → RM · Baby-Worldwide → Jin · Baby-Rapper → SUGA · Baby-Dancer → j-hope
  //   Baby-Mochi → Jimin · Baby-Good-Boy → V · Baby-Maknae → Jung Kook
  const BABY_ART = {
    rm: 'Baby-Leader', jin: 'Baby-Worldwide', suga: 'Baby-Rapper', jhope: 'Baby-Dancer',
    jimin: 'Baby-Mochi', v: 'Baby-Good-Boy', jk: 'Baby-Maknae',
  };
  function babyLevels(slug) {
    const base = BABY_ART[slug];
    if (!base) return null;
    return [1, 2, 3].map(n => 'Photo/Photocard/' + base + '-Niv' + n + '.png');
  }

  M.forEach(([slug, memberName, emoji, list]) => {
    list.forEach(([key, name, rarity, eraIdx, desc]) => {
      const isDebut = key === 'debut';
      add('mem_' + slug + '_' + key, 'members', memberName, name, rarity,
        isDebut ? null : 'Photo/' + (slug === 'jk' ? 'Jk.cover' : slug.charAt(0).toUpperCase() + slug.slice(1)) + '.jpg',
        emoji, desc, eraIdx !== null ? { type: 'era', idx: eraIdx } : null, 'pack',
        'Ouvre des packs ' + memberName + ' ou explore l\'Archive pour la débloquer.',
        isDebut ? babyLevels(slug) : null);
    });
  });

  /* ────────────────────────────────────────────
     🌸 ERAS — une carte par era de l'Archive
  ──────────────────────────────────────────── */
  const E = [
    [0, 'Pre-Debut', 'rare', 'Photo/Pre-debut.jpg', '🌱'],
    [1, 'School Trilogy', 'common', 'Photo/School.Trilogy.jpg', '🏫'],
    [2, 'Dark & Wild', 'common', 'Photo/Dark-and-wild.jpg', '🌑'],
    [3, 'HYYH Pt.1', 'rare', 'Photo/The-most-beautiful-moment-in-live.jpg', '🌸'],
    [4, 'HYYH Pt.2', 'rare', 'Photo/The-most-beautiful-moment-in-live-2.jpg', '🌊'],
    [5, 'Young Forever', 'epic', 'Photo/Young-forever.jpg', '🌀'],
    [6, 'Wings', 'legendary', 'Photo/Wings.png', '🪶'],
    [7, 'You Never Walk Alone', 'epic', 'Photo/YNWA.jpg', '🍀'],
    [8, 'Love Yourself: Her', 'epic', 'Photo/Love-Yourself-Her.jpg', '💜'],
    [9, 'Love Yourself: Tear', 'epic', 'Photo/Love-Yourself-Tear.jpg', '🖤'],
    [10, 'Love Yourself: Answer', 'legendary', 'Photo/Love-Yourself-Answer.jpg', '✨'],
    [11, 'Map of the Soul: Persona', 'epic', 'Photo/Map-of-the-soul-persona.jpg', '🗺️'],
    [12, 'Map of the Soul: 7', 'legendary', 'Photo/Map-of-the-soul-seven.jpg', '7️⃣'],
    [13, 'BE', 'epic', 'Photo/Be.jpg', '🍃'],
    [14, 'Butter', 'legendary', 'Photo/Butter.png', '🧈'],
    [15, 'Arirang', 'rare', 'Photo/Arirang.jpg', '아'],
  ];
  E.forEach(([idx, name, rarity, img, emoji]) => {
    add('era_' + idx, 'eras', name, name, rarity, img, emoji,
      "Explore l'ère " + name + " au complet : musiques, concerts, interviews et anecdotes.",
      { type: 'era', idx }, 'discovery', "Visite cette era dans l'Archive pour débloquer sa carte.");
  });

  /* ────────────────────────────────────────────
     💿 ALBUMS
  ──────────────────────────────────────────── */
  const AL = [
    ['dark_wild', 'Dark & Wild', 'rare', 'Photo/Dark-and-wild.jpg', '🌑', 2],
    ['hyyh1', 'The Most Beautiful Moment in Life, Pt.1', 'epic', 'Photo/The-most-beautiful-moment-in-live.jpg', '🌸', 3],
    ['hyyh2', 'The Most Beautiful Moment in Life, Pt.2', 'epic', 'Photo/The-most-beautiful-moment-in-live-2.jpg', '🌊', 4],
    ['young_forever', 'Young Forever', 'epic', 'Photo/Young-forever.jpg', '🌀', 5],
    ['wings', 'Wings', 'legendary', 'Photo/Wings.png', '🪶', 6],
    ['ynwa', 'You Never Walk Alone', 'rare', 'Photo/YNWA.jpg', '🍀', 7],
    ['lyher', 'Love Yourself: Her', 'epic', 'Photo/Love-Yourself-Her.jpg', '💜', 8],
    ['lytear', 'Love Yourself: Tear', 'legendary', 'Photo/Love-Yourself-Tear.jpg', '🖤', 9],
    ['lyanswer', 'Love Yourself: Answer', 'legendary', 'Photo/Love-Yourself-Answer.jpg', '✨', 10],
    ['motspersona', 'Map of the Soul: Persona', 'epic', 'Photo/Map-of-the-soul-persona.jpg', '🗺️', 11],
    ['mots7', 'Map of the Soul: 7', 'legendary', 'Photo/Map-of-the-soul-seven.jpg', '7️⃣', 12],
    ['be', 'BE', 'epic', 'Photo/Be.jpg', '🍃', 13],
    ['proof', 'Proof', 'legendary', null, '📀', null],
  ];
  AL.forEach(([id, name, rarity, img, emoji, eraIdx]) => {
    add('album_' + id, 'albums', name, name, rarity, img, emoji,
      "L'album " + name + " et tous ses contenus associés dans l'Archive.",
      eraIdx !== null ? { type: 'era', idx: eraIdx } : null, 'pack',
      'Obtiens-la via un Era Pack ou en explorant l\'album correspondant.');
  });

  /* ────────────────────────────────────────────
     🎬 MVS
  ──────────────────────────────────────────── */
  const MV = [
    ['ineedu', 'I NEED U', 'epic', 3],
    ['run', 'RUN', 'epic', 4],
    ['bloodsweat', 'Blood Sweat & Tears', 'legendary', 6],
    ['springday', 'Spring Day', 'legendary', 7],
    ['notoday', 'Not Today', 'epic', 7],
    ['dna', 'DNA', 'legendary', 8],
    ['mic drop', 'MIC Drop', 'epic', 8],
    ['fakelove', 'FAKE LOVE', 'legendary', 9],
    ['idol', 'IDOL', 'epic', 10],
    ['boywithluv', 'Boy With Luv', 'legendary', 11],
    ['onmv', 'ON', 'epic', 12],
    ['blackswan', 'Black Swan', 'legendary', 12],
    ['dynamite', 'Dynamite', 'legendary', null],
    ['lifegoeson', 'Life Goes On', 'epic', 13],
    ['butter', 'Butter', 'legendary', 14],
    ['permission', 'Permission to Dance', 'epic', null],
    ['yettocome', 'Yet To Come', 'rare', null],
    ['taketwo', 'Take Two', 'epic', null],
  ];
  MV.forEach(([id, name, rarity, eraIdx]) => {
    add('mv_' + id, 'mvs', name, name, rarity, null, '🎬',
      "Le clip " + name + " et ses contenus liés (making-of, chorégraphie, réactions).",
      eraIdx !== null ? { type: 'era', idx: eraIdx } : null, 'pack',
      'Obtiens-la via un pack, ou en regardant le clip dans l\'Archive.');
  });

  /* ────────────────────────────────────────────
     🌌 BTS UNIVERSE / LORE
  ──────────────────────────────────────────── */
  const LORE = [
    ['papillon', 'Papillon', 'legendary', '🦋', 'Symbole central du BTS Universe, lié au destin et au changement.'],
    ['fleur', 'Fleur de Smeraldo', 'epic', '🌸', 'Fleur fictive qui ne fleurit que lorsqu\'on croit en un amour impossible.'],
    ['miroir', 'Miroir', 'rare', '🪞', 'Motif récurrent des théories HYYH, symbole du double et de l\'identité.'],
    ['feu', 'Feu', 'rare', '🔥', 'Élément associé aux moments de rupture et de renaissance dans le lore.'],
    ['eau', 'Eau', 'rare', '💧', 'Élément associé à la mémoire et à ce qui submerge les personnages.'],
    ['lune', 'Lune', 'epic', '🌙', 'Symbole de nuit, de rêve et de vérité cachée dans les théories.'],
    ['masque', 'Masque', 'epic', '🎭', 'Représente les différentes personas explorées dans Map of the Soul.'],
    ['porte', 'Porte', 'rare', '🚪', 'Symbole de passage entre les époques dans les Highlight Reels.'],
    ['ombre', 'Ombre', 'epic', '👤', 'Concept clé de Map of the Soul : ce que l\'on refuse de voir en soi.'],
    ['plume', 'Plume', 'rare', '🪶', 'Symbole de liberté et de choix, central à l\'ère Wings.'],
    ['horloge', 'Horloge', 'common', '⏰', 'Motif récurrent lié au temps qui passe dans les théories HYYH.'],
    ['etoile', 'Étoile', 'legendary', '⭐', 'Symbole d\'espoir traversant plusieurs eras et théories du fandom.'],
  ];
  LORE.forEach(([id, name, rarity, emoji, desc]) => {
    add('lore_' + id, 'lore', 'BTS Universe', name, rarity, null, emoji, desc,
      { type: 'lore' }, 'discovery', 'Explore le BTS Universe et ses théories pour la débloquer.');
  });

  /* ────────────────────────────────────────────
     💜 MOMENTS
  ──────────────────────────────────────────── */
  const MOM = [
    ['un2018', 'Discours à l\'ONU (2018)', 'legendary', '🎤', 'RM prend la parole devant l\'Assemblée générale des Nations Unies.'],
    ['grammy', 'Nomination aux Grammy Awards', 'legendary', '🏆', 'Première nomination d\'un groupe de K-pop aux Grammy Awards.'],
    ['wembley', 'Concert au Wembley Stadium', 'epic', '🏟️', 'Deux soirs mémorables à guichets fermés à Londres, en 2019.'],
    ['mama_daesang', 'Daesang aux MAMA', 'epic', '🥇', 'Un des nombreux grands prix remportés par le groupe.'],
    ['runbts', 'Moment culte de Run BTS!', 'rare', '🎬', 'Un fou rire ou un jeu mémorable de l\'émission variety du groupe.'],
    ['insoop', 'In the SOOP', 'rare', '🏡', 'Moments de détente en résidence, loin des projecteurs.'],
    ['festa_family', 'Portrait de famille FESTA', 'epic', '📸', 'La photo de groupe annuelle publiée pour l\'anniversaire du groupe.'],
    ['ptdla', 'Permission to Dance on Stage - LA', 'epic', '🎫', 'Premier concert en stade après la pandémie, novembre 2021.'],
    ['bulletproof', 'Anniversaire du 1er single', 'rare', '🎉', 'Le tout premier single « No More Dream », sorti le 13 juin 2013.'],
    ['fanchant', 'Fan chant parfaitement synchronisé', 'common', '📣', 'Un moment où l\'ARMY et le groupe ne font plus qu\'un.'],
    ['jin_wave', 'Salut mémorable en fansign', 'common', '👋', 'Un petit moment tendre capturé lors d\'un fansign.'],
    ['ot7_hug', 'Câlin de groupe OT7', 'rare', '🤗', 'Un instant de complicité entre les sept membres.'],
  ];
  MOM.forEach(([id, name, rarity, emoji, desc]) => {
    add('moment_' + id, 'moments', 'Moments', name, rarity, null, emoji, desc, null, 'pack',
      'Obtenue aléatoirement dans les packs, ou via certaines quêtes.');
  });

  /* ────────────────────────────────────────────
     ✨ SPECIAL — événements, saisons, éditions limitées
  ──────────────────────────────────────────── */
  const SPE = [
    ['festa2024', 'FESTA 2024', 'epic', '🎂', 'Célébration annuelle de l\'anniversaire du groupe.', true],
    ['festa2025', 'FESTA 2025', 'epic', '🎂', 'Célébration annuelle de l\'anniversaire du groupe.', true],
    ['anniv10', '10e anniversaire de BTS', 'legendary', '🎊', 'Dix ans depuis le début de BTS, célébrés le 13 juin 2023.', false],
    ['newyear', 'Message du Nouvel An', 'rare', '🎆', 'Message adressé chaque année à l\'ARMY pour la nouvelle année.', true],
    ['winter_pkg', 'Winter Package', 'epic', '❄️', 'Contenu exclusif du package hivernal annuel.', true],
    ['summer_pkg', 'Summer Package', 'epic', '☀️', 'Contenu exclusif du package estival annuel.', true],
    ['armyday', 'ARMY Day', 'rare', '💜', 'Jour de célébration du fandom ARMY, le 9 juillet.', true],
    ['muster', 'BTS Muster', 'epic', '🎪', 'Fanmeeting officiel annuel du groupe.', false],
    ['halloween', 'Halloween Special', 'rare', '🎃', 'Contenu spécial publié autour d\'Halloween.', true],
    ['xmas', 'Christmas Special', 'rare', '🎄', 'Contenu spécial publié autour de Noël.', true],
  ];
  SPE.forEach(([id, name, rarity, emoji, desc, seasonal]) => {
    add('special_' + id, 'special', 'Special', name, rarity, null, emoji, desc, null, 'event',
      seasonal ? 'Disponible uniquement pendant une période limitée chaque année.' : 'Carte spéciale liée à un événement ponctuel du site.');
  });

  /* ────────────────────────────────────────────
     🔐 SECRET — une carte par Easter egg existant
     (les clés fnName correspondent EXACTEMENT aux fonctions
     eggXXX déjà définies dans index.html)
  ──────────────────────────────────────────── */
  const EGGS = [
    ['eggBTS', 'Écho — "BTS"', 'rare', '🔤'],
    ['eggARMY', 'Écho — "ARMY"', 'rare', '💜'],
    ['eggBANGTAN', 'Écho — "Bangtan"', 'rare', '방'],
    ['eggBORAHAE', 'Borahae', 'epic', '💜'],
    ['eggOT7', 'OT7', 'legendary', '7️⃣'],
    ['eggMIKROKOSMOS', 'Mikrokosmos', 'epic', '🌌'],
    ['eggMAGICSHOP', 'Magic Shop', 'epic', '🏪'],
    ['eggWHALIEN', 'Whalien 52', 'epic', '🐋'],
    ['eggAPOBANGPO', 'Apobangpo', 'rare', '🔄'],
    ['egg0613', '13 juin', 'legendary', '🎂'],
    ['eggMERCI', 'Merci BTS', 'rare', '💌'],
    ['eggSPRINGDAY', 'Spring Day', 'epic', '🌸'],
    ['eggDYNAMITE', 'Dynamite', 'epic', '💥'],
    ['eggBLACKSWAN', 'Black Swan', 'epic', '🦢'],
    ['eggFESTA', 'Festa', 'rare', '🎉'],
    ['eggARMYBOMB', 'Purple Ocean', 'epic', '🔮'],
    ['eggCOMPTE', 'Mon Compte', 'common', '👤'],
    ['eggLOUNGE', 'ARMY Lounge', 'rare', '🛋️'],
    ['eggGAMES', 'Salle de jeux', 'rare', '🎮'],
    ['eggCOMMUNITY', 'Communauté', 'rare', '🫂'],
    ['eggPWA', 'Installation PWA', 'common', '📲'],
    ['eggJIMIN', 'Secret — Jimin', 'epic', '🐥'],
    ['eggJIN', 'Secret — Jin', 'epic', '🐹'],
    ['eggSUGA', 'Secret — SUGA', 'epic', '🐱'],
    ['eggJHOPE', 'Secret — j-hope', 'epic', '🐿️'],
    ['eggV', 'Secret — V', 'epic', '🐯'],
    ['eggJK', 'Secret — Jung Kook', 'epic', '🐰'],
    ['eggRM', 'Secret — RM', 'epic', '🐨'],
    ['eggKONAMI', 'Konami Code', 'epic', '🎮'],
    ['eggCHAT10', 'Bavard·e — 10 messages', 'common', '💬'],
    ['eggCHAT25', 'Bavard·e — 25 messages', 'rare', '💬'],
    ['eggCHAT50', 'Bavard·e — 50 messages', 'epic', '💬'],
    ['eggCHAT100', 'Bavard·e — 100 messages', 'legendary', '💬'],
  ];
  EGGS.forEach(([fnName, name, rarity, emoji]) => {
    add('secret_' + fnName, 'secret', 'Secret', name, rarity, null, emoji,
      "Carte débloquée en trouvant l'Easter egg « " + name + " » caché dans le site.",
      null, 'discovery', 'Trouve l\'Easter egg correspondant dans la barre de recherche.');
  });

  /* ────────────────────────────────────────────
     EXPORT
  ──────────────────────────────────────────── */
  global.COLLECTION_RARITY = RARITY;
  global.COLLECTION_LEVEL_COST = LEVEL_UP_COST;
  global.COLLECTION_CARDS = CARDS;
  // Table de correspondance Easter egg → id de carte, utilisée par collection.js
  global.COLLECTION_EGG_MAP = {};
  EGGS.forEach(([fnName]) => { global.COLLECTION_EGG_MAP[fnName] = 'secret_' + fnName; });

  // Catégories affichées dans l'ordre, avec leur libellé + icône
  global.COLLECTION_CATEGORIES = [
    { key: 'members', label: 'Members', icon: '👤' },
    { key: 'eras', label: 'Eras', icon: '🌸' },
    { key: 'albums', label: 'Albums', icon: '💿' },
    { key: 'mvs', label: 'MVs', icon: '🎬' },
    { key: 'lore', label: 'BTS Universe', icon: '🌌' },
    { key: 'moments', label: 'Moments', icon: '💜' },
    { key: 'special', label: 'Special', icon: '✨' },
    { key: 'secret', label: 'Secret', icon: '🔐' },
  ];

})(window);
