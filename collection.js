/* ══════════════════════════════════════════════════════════════
   COLLECTION.JS — Moteur du système de collection BTS Archive
   ------------------------------------------------------------
   Dépend de : data/cards-data.js (COLLECTION_CARDS, COLLECTION_RARITY,
   COLLECTION_LEVEL_COST, COLLECTION_EGG_MAP, COLLECTION_CATEGORIES)

   Intégration minimale depuis index.html (voir COLLECTION-INTEGRATION.md) :
     CollectionSystem.init(sb);              // une fois, au chargement
     CollectionSystem.setUser(user);         // dans onSignedIn(user)
     CollectionSystem.clearUser();           // dans onSignedOut()
     CollectionSystem.unlockCard(cardId);    // partout où une carte doit
                                              // pouvoir être débloquée
     CollectionSystem.openCollectionPage();  // pour afficher la page
   ══════════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  const RARITY = global.COLLECTION_RARITY;
  const LEVEL_COST = global.COLLECTION_LEVEL_COST;
  const CARDS = global.COLLECTION_CARDS;
  const EGG_MAP = global.COLLECTION_EGG_MAP;
  const CATEGORIES = global.COLLECTION_CATEGORIES;
  const CARD_BY_ID = {};
  CARDS.forEach(c => { CARD_BY_ID[c.id] = c; });

  const PITY_THRESHOLD = 8; // packs sans nouvelle carte avant un "Lucky Pack"
  const DUPES_PER_LEVEL = 2;  // doublons nécessaires pour passer au niveau suivant
  const MAX_LEVEL = 3;
  const ERA_PACK_COST = 5;    // diamants pour ouvrir un Era Pack débloqué

  let sb = null;
  let currentUser = null;
  let owned = new Map();     // cardId -> { count, level }
  let wallet = { fragments: 0, last_daily_claim: null, pity_counter: 0, unlocked_packs: { era: [], member: [], lore: false, event: [] }, quests: {} };
  let animationsEnabled = true;
  let listeners = { onUnlock: [], onWalletChange: [] };

  function catCards(cat) { return CARDS.filter(c => c.cat === cat); }

  /* ────────────────── PERSISTENCE ────────────────── */

  async function loadState() {
    owned = new Map();
    wallet = { fragments: 0, last_daily_claim: null, pity_counter: 0, unlocked_packs: { era: [], member: [], lore: false, event: [] }, quests: {} };
    if (!sb || !currentUser) return;

    const [{ data: cardRows }, { data: walletRow }] = await Promise.all([
      sb.from('card_collection').select('card_id,count,level').eq('user_id', currentUser.id),
      sb.from('user_wallet').select('*').eq('user_id', currentUser.id).single(),
    ]);

    (cardRows || []).forEach(r => owned.set(r.card_id, { count: r.count, level: r.level }));

    if (walletRow) {
      wallet.fragments = walletRow.fragments || 0;
      wallet.last_daily_claim = walletRow.last_daily_claim;
      wallet.pity_counter = walletRow.pity_counter || 0;
      wallet.unlocked_packs = walletRow.unlocked_packs || wallet.unlocked_packs;
      wallet.quests = walletRow.quests || {};
    } else {
      await sb.from('user_wallet').insert({ user_id: currentUser.id }).select().maybeSingle();
    }
    animationsEnabled = localStorage.getItem('collectionAnimations') !== 'false';
  }

  async function saveWallet() {
    if (!sb || !currentUser) return;
    await sb.from('user_wallet').upsert({
      user_id: currentUser.id,
      fragments: wallet.fragments,
      last_daily_claim: wallet.last_daily_claim,
      pity_counter: wallet.pity_counter,
      unlocked_packs: wallet.unlocked_packs,
      quests: wallet.quests,
      updated_at: new Date().toISOString(),
    });
    listeners.onWalletChange.forEach(fn => fn(wallet));
  }

  /* ────────────────── CARTES : obtention ────────────────── */

  // Retourne { isNew, count, level, fragmentsGained }
  async function grantCard(cardId, opts) {
    opts = opts || {};
    const card = CARD_BY_ID[cardId];
    if (!card) return null;
    if (!sb || !currentUser) return null;

    const existing = owned.get(cardId);
    if (!existing) {
      owned.set(cardId, { count: 1, level: 1 });
      await sb.from('card_collection').insert({ user_id: currentUser.id, card_id: cardId, count: 1, level: 1 });
      wallet.pity_counter = 0;
      await saveWallet();
      listeners.onUnlock.forEach(fn => fn({ card, isNew: true, fragmentsGained: 0 }));
      return { isNew: true, count: 1, level: 1, fragmentsGained: 0 };
    } else {
      const gained = RARITY[card.rarity].fragments;
      existing.count += 1;
      wallet.fragments += gained;
      await sb.from('card_collection').update({ count: existing.count }).eq('user_id', currentUser.id).eq('card_id', cardId);
      await saveWallet();
      listeners.onUnlock.forEach(fn => fn({ card, isNew: false, fragmentsGained: gained }));
      return { isNew: false, count: existing.count, level: existing.level, fragmentsGained: gained };
    }
  }

  // API publique : débloque une carte précise (Easter eggs, quêtes, achievements...)
  async function unlockCard(cardId, source) {
    if (!currentUser) return null;
    if (!sb) return null;
    if (!loadedOnce) await ensureLoaded();
    const result = await grantCard(cardId);
    if (result) renderToastForGrant(cardId, result);
    return result;
  }

  // Raccourci pour les Easter eggs déjà présents dans index.html
  async function unlockEggCard(eggFnName) {
    const cardId = EGG_MAP[eggFnName];
    if (!cardId) return null;
    return unlockCard(cardId, 'discovery');
  }

  // Raccourci pour la visite d'une era (appelé depuis showEra)
  async function unlockEraVisit(eraIdx) {
    const cardId = 'era_' + eraIdx;
    if (!CARD_BY_ID[cardId]) return null;
    return unlockCard(cardId, 'discovery');
  }

  async function levelUpCard(cardId) {
    const entry = owned.get(cardId);
    const card = CARD_BY_ID[cardId];
    if (!entry || !card) return { ok: false, reason: 'not_owned' };
    if (entry.level >= MAX_LEVEL) return { ok: false, reason: 'max_level' };
    if (entry.count < DUPES_PER_LEVEL + 1) {
      return { ok: false, reason: 'not_enough_dupes', needed: (DUPES_PER_LEVEL + 1) - entry.count };
    }
    entry.count -= DUPES_PER_LEVEL;
    entry.level += 1;
    await sb.from('card_collection').update({ level: entry.level, count: entry.count }).eq('user_id', currentUser.id).eq('card_id', cardId);
    return { ok: true, level: entry.level };
  }

  /* ────────────────── PACKS ────────────────── */

  function weightedPick(pool) {
    const totalWeight = pool.reduce((sum, c) => sum + RARITY[c.rarity].weight, 0);
    let r = Math.random() * totalWeight;
    for (const c of pool) {
      r -= RARITY[c.rarity].weight;
      if (r <= 0) return c;
    }
    return pool[pool.length - 1];
  }

  function poolForPack(packType) {
    if (packType === 'daily') return CARDS.filter(c => ['members', 'eras', 'albums', 'mvs', 'moments'].includes(c.cat));
    if (packType.startsWith('era:')) {
      const eraIdx = Number(packType.split(':')[1]);
      const focused = CARDS.filter(c => (c.action && c.action.type === 'era' && c.action.idx === eraIdx));
      const rest = CARDS.filter(c => !focused.includes(c) && ['members', 'eras', 'albums', 'mvs'].includes(c.cat));
      // 65% de chances de piocher dans le pool ciblé, sinon pool général
      return { focused, rest };
    }
    if (packType.startsWith('member:')) {
      const slug = packType.split(':')[1];
      const focused = CARDS.filter(c => c.id.startsWith('mem_' + slug + '_'));
      const rest = CARDS.filter(c => c.cat === 'members' && !c.id.startsWith('mem_' + slug + '_'));
      return { focused, rest };
    }
    if (packType === 'lore') return CARDS.filter(c => c.cat === 'lore');
    if (packType === 'event') return CARDS.filter(c => c.cat === 'special' || c.cat === 'moments');
    return CARDS.filter(c => c.cat !== 'secret');
  }

  function drawOne(packType) {
    const pool = poolForPack(packType);
    if (Array.isArray(pool)) return weightedPick(pool);
    // pool ciblé / pool de secours (era, member packs)
    const useFocused = pool.focused.length && Math.random() < 0.65;
    return weightedPick(useFocused ? pool.focused : (pool.rest.length ? pool.rest : pool.focused));
  }

  async function openPack(packType) {
    if (!currentUser) return { ok: false, reason: 'not_logged_in' };
    if (!canOpenPack(packType)) return { ok: false, reason: 'unavailable' };

    if (packType.startsWith('era:')) {
      wallet.fragments -= ERA_PACK_COST; // le coût est prélevé ici ; canOpenPack a déjà vérifié le solde
    }

    let draws = [drawOne(packType), drawOne(packType), drawOne(packType)];

    // Système anti-frustration : garantit une nouvelle carte après PITY_THRESHOLD packs
    const anyNew = draws.some(c => !owned.has(c.id));
    if (!anyNew && wallet.pity_counter + 1 >= PITY_THRESHOLD) {
      const pool = CARDS.filter(c => c.cat !== 'secret' && !owned.has(c.id));
      if (pool.length) draws[2] = pool[Math.floor(Math.random() * pool.length)];
    }
    if (!anyNew) wallet.pity_counter += 1;

    markPackConsumed(packType);

    const results = [];
    for (const card of draws) {
      const r = await grantCard(card.id);
      results.push({ card, ...r });
    }
    await saveWallet();
    return { ok: true, results };
  }

  function todayStr() { return new Date().toISOString().slice(0, 10); }

  function canOpenPack(packType) {
    if (packType === 'daily') return wallet.last_daily_claim !== todayStr();
    if (packType.startsWith('era:')) {
      const idx = packType.split(':')[1];
      return wallet.unlocked_packs.era.includes(idx) && wallet.fragments >= ERA_PACK_COST;
    }
    if (packType.startsWith('member:')) return wallet.unlocked_packs.member.includes(packType.split(':')[1]);
    if (packType === 'lore') return !!wallet.unlocked_packs.lore;
    if (packType === 'event') return (wallet.unlocked_packs.event || []).length > 0;
    return false;
  }

  function markPackConsumed(packType) {
    if (packType === 'daily') wallet.last_daily_claim = todayStr();
    // Les Era Packs restent débloqués une fois obtenus : seul le coût en diamants
    // est prélevé à chaque ouverture (voir openPack). Rien à retirer ici.
    if (packType.startsWith('member:')) {
      const slug = packType.split(':')[1];
      wallet.unlocked_packs.member = wallet.unlocked_packs.member.filter(x => x !== slug);
    }
    if (packType === 'event') wallet.unlocked_packs.event = (wallet.unlocked_packs.event || []).slice(1);
  }

  // À appeler pour débloquer progressivement des packs (exploration, quêtes...)
  async function grantPackUnlock(kind, key) {
    if (!currentUser) return;
    if (kind === 'era' && !wallet.unlocked_packs.era.includes(key)) wallet.unlocked_packs.era.push(key);
    if (kind === 'member' && !wallet.unlocked_packs.member.includes(key)) wallet.unlocked_packs.member.push(key);
    if (kind === 'lore') wallet.unlocked_packs.lore = true;
    if (kind === 'event') { wallet.unlocked_packs.event = wallet.unlocked_packs.event || []; wallet.unlocked_packs.event.push(key || 'event'); }
    await saveWallet();
  }

  /* ────────────────── QUÊTES (système générique) ──────────────────
     Exemple préconfiguré : "THE LOST PURPLE STAR" — 7 fragments cachés
     dans le site. Appelle CollectionSystem.questStep('lost_purple_star', 7)
     depuis n'importe quel endroit du site (voir guide d'intégration) pour
     faire progresser une étape ; la récompense se déclenche automatiquement
     une fois le total atteint.
  ──────────────────────────────────────────── */
  const QUESTS = {
    lost_purple_star: { total: 7, rewardCard: 'lore_etoile', label: 'The Lost Purple Star' },
  };

  async function questStep(questId, total) {
    if (!currentUser || !QUESTS[questId]) return null;
    const q = QUESTS[questId];
    const current = wallet.quests[questId] || 0;
    if (current >= q.total) return { done: true, progress: q.total, total: q.total };
    const next = Math.min(q.total, current + 1);
    wallet.quests[questId] = next;
    await saveWallet();
    if (next >= q.total) {
      await grantCard(q.rewardCard);
      renderToast('🌌 QUÊTE TERMINÉE — ' + q.label, 'Récompense débloquée !');
    }
    return { done: next >= q.total, progress: next, total: q.total };
  }

  /* ────────────────── PROGRESSION / STATS ────────────────── */

  function progressFor(cat) {
    const all = cat ? catCards(cat) : CARDS;
    const found = all.filter(c => owned.has(c.id)).length;
    return { found, total: all.length };
  }

  let loadedOnce = false;
  async function ensureLoaded() {
    if (loadedOnce) return;
    await loadState();
    loadedOnce = true;
  }

  /* ────────────────── UI : TOASTS ────────────────── */

  function ensureToastRoot() {
    let root = document.getElementById('collection-toast-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'collection-toast-root';
      document.body.appendChild(root);
    }
    return root;
  }

  function renderToast(title, sub) {
    const root = ensureToastRoot();
    const el = document.createElement('div');
    el.className = 'coll-toast';
    el.innerHTML = '<div class="coll-toast-title">' + title + '</div><div class="coll-toast-sub">' + (sub || '') + '</div>';
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 3600);
  }

  function renderToastForGrant(cardId, result) {
    const card = CARD_BY_ID[cardId];
    if (!card) return;
    if (result.isNew) renderToast('🎴 NOUVELLE CARTE — ' + card.name, RARITY[card.rarity].label);
    else renderToast('♻️ Doublon — ' + card.name, '+' + result.fragmentsGained + ' fragments');
  }

  /* ────────────────── UI : PAGE COLLECTION ────────────────── */

  function cardVisualClass(card, entry) {
    let cls = 'coll-card rarity-' + card.rarity;
    if (!entry) cls += ' locked';
    else if (entry.level >= MAX_LEVEL) cls += ' level-master';
    else cls += ' level-' + entry.level;
    return cls;
  }

  function cardImageSrc(card, entry) {
    const lvl = entry ? Math.min(entry.level, MAX_LEVEL) : 1;
    if (card.imgLevels && card.imgLevels[lvl - 1]) return card.imgLevels[lvl - 1];
    return card.img;
  }

  function cardMediaHtml(card, entry) {
    const src = cardImageSrc(card, entry);
    if (src) return '<img src="' + src + '" alt="" onerror="this.style.display=\'none\'">';
    return '<span class="coll-card-emoji">' + card.emoji + '</span>';
  }

  function renderCardTile(card) {
    const entry = owned.get(card.id);
    const stars = entry ? '⭐'.repeat(entry.level) : '';
    return '' +
      '<button class="' + cardVisualClass(card, entry) + '" data-card-id="' + card.id + '" onclick="CollectionSystem.openCardDetail(\'' + card.id + '\')">' +
        '<span class="coll-card-media">' + (entry ? cardMediaHtml(card, entry) : '<span class="coll-card-emoji">❔</span>') + '</span>' +
        '<span class="coll-card-name">' + (entry ? card.name : '???') + '</span>' +
        (entry && entry.count > 1 ? '<span class="coll-card-dupe">x' + entry.count + '</span>' : '') +
        (stars ? '<span class="coll-card-stars">' + stars + '</span>' : '') +
      '</button>';
  }

  function renderProgressBar(found, total, label) {
    const pct = total ? Math.round((found / total) * 100) : 0;
    return '' +
      '<div class="coll-progress-row">' +
        '<div class="coll-progress-label"><span>' + label + '</span><span>' + found + ' / ' + total + '</span></div>' +
        '<div class="coll-progress-track"><div class="coll-progress-fill" style="width:' + pct + '%"></div></div>' +
      '</div>';
  }

  let activeCategory = 'members';

  function renderCollectionPage() {
    const root = document.getElementById('collection-page');
    if (!root) return;
    const total = progressFor(null);

    let html = '<div class="coll-header">';
    html += '<div class="coll-header-title">🎴 MY COLLECTION</div>';
    html += renderProgressBar(total.found, total.total, 'Total');
    html += '<div class="coll-wallet"><span class="coll-frag-icon">💎</span><span id="coll-frag-count">' + wallet.fragments + '</span> fragments</div>';
    html += '</div>';

    html += '<div class="coll-cat-progress">';
    CATEGORIES.forEach(c => {
      const p = progressFor(c.key);
      html += renderProgressBar(p.found, p.total, c.icon + ' ' + c.label);
    });
    html += '</div>';

    html += renderPacksSection();

    html += '<div class="coll-tabs">';
    CATEGORIES.forEach(c => {
      html += '<button class="coll-tab-btn' + (c.key === activeCategory ? ' active' : '') + '" onclick="CollectionSystem.switchCategory(\'' + c.key + '\')">' + c.icon + ' ' + c.label + '</button>';
    });
    html += '</div>';

    html += '<div class="coll-grid" id="coll-grid">';
    html += catCards(activeCategory).map(renderCardTile).join('');
    html += '</div>';

    root.innerHTML = html;
  }

  function renderPacksSection() {
    const dailyReady = canOpenPack('daily');
    let html = '<div class="coll-packs">';
    html += '<div class="coll-pack-card" onclick="' + (dailyReady ? "CollectionSystem.startPackOpening('daily')" : '') + '">';
    html += '<div class="coll-pack-icon">🎁</div><div class="coll-pack-name">Daily ARMY Pack</div>';
    html += '<div class="coll-pack-status">' + (dailyReady ? 'Disponible — 3 cartes' : 'Reviens demain 💜') + '</div>';
    html += '</div>';

    wallet.unlocked_packs.era.forEach(idx => {
      const eraCard = CARD_BY_ID['era_' + idx];
      const affordable = wallet.fragments >= ERA_PACK_COST;
      html += '<div class="coll-pack-card' + (affordable ? '' : ' disabled') + '" onclick="' + (affordable ? "CollectionSystem.startPackOpening('era:" + idx + "')" : '') + '">';
      html += '<div class="coll-pack-icon">🌌</div><div class="coll-pack-name">' + (eraCard ? eraCard.name : 'Era') + ' Pack</div>';
      html += '<div class="coll-pack-status">' + ERA_PACK_COST + ' 💎 — ' + (affordable ? 'Ouvrir' : 'Pas assez de diamants') + '</div></div>';
    });
    wallet.unlocked_packs.member.forEach(slug => {
      html += '<div class="coll-pack-card" onclick="CollectionSystem.startPackOpening(\'member:' + slug + '\')">';
      html += '<div class="coll-pack-icon">👤</div><div class="coll-pack-name">' + slug.toUpperCase() + ' Pack</div>';
      html += '<div class="coll-pack-status">Disponible</div></div>';
    });
    if (wallet.unlocked_packs.lore) {
      html += '<div class="coll-pack-card" onclick="CollectionSystem.startPackOpening(\'lore\')">';
      html += '<div class="coll-pack-icon">🌌</div><div class="coll-pack-name">Lore Pack</div><div class="coll-pack-status">Disponible</div></div>';
    }
    (wallet.unlocked_packs.event || []).forEach(() => {
      html += '<div class="coll-pack-card" onclick="CollectionSystem.startPackOpening(\'event\')">';
      html += '<div class="coll-pack-icon">🎉</div><div class="coll-pack-name">Event Pack</div><div class="coll-pack-status">Disponible</div></div>';
    });
    html += '</div>';
    return html;
  }

  function switchCategory(cat) {
    activeCategory = cat;
    renderCollectionPage();
  }

  /* ────────────────── UI : DÉTAIL D'UNE CARTE ────────────────── */

  function openCardDetail(cardId) {
    const card = CARD_BY_ID[cardId];
    const entry = owned.get(cardId);
    if (!card) return;
    let overlay = document.getElementById('coll-detail-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'coll-detail-overlay';
      overlay.className = 'coll-overlay';
      overlay.onclick = function (e) { if (e.target === overlay) closeCardDetail(); };
      document.body.appendChild(overlay);
    }
    const canLevel = entry && entry.level < MAX_LEVEL;
    const dupesNeeded = canLevel ? Math.max(0, (DUPES_PER_LEVEL + 1) - entry.count) : 0;
    const readyToLevel = canLevel && dupesNeeded === 0;

    overlay.innerHTML = '' +
      '<div class="coll-detail-card ' + cardVisualClass(card, entry) + '">' +
        '<button class="coll-detail-close" onclick="CollectionSystem.closeCardDetail()">✕</button>' +
        '<div class="coll-detail-media">' + (entry ? cardMediaHtml(card, entry) : '<span class="coll-card-emoji">❔</span>') + '</div>' +
        '<div class="coll-detail-name">' + (entry ? card.name : '??? — Carte non découverte') + '</div>' +
        '<div class="coll-detail-meta">' +
          '<span class="coll-badge rarity-' + card.rarity + '">' + RARITY[card.rarity].label + '</span>' +
          (entry ? '<span class="coll-badge">Niveau ' + entry.level + ' / ' + MAX_LEVEL + '</span>' : '') +
          (entry && entry.count > 1 ? '<span class="coll-badge">x' + entry.count + ' obtenues</span>' : '') +
        '</div>' +
        '<div class="coll-detail-desc">' + (entry ? card.desc : card.obtainHint) + '</div>' +
        (canLevel && readyToLevel ? '<button class="coll-detail-btn" onclick="CollectionSystem.tryLevelUp(\'' + cardId + '\')">⬆️ Améliorer (2 doublons)</button>' : '') +
        (canLevel && !readyToLevel ? '<div class="coll-detail-hint">♻️ Encore ' + dupesNeeded + ' doublon(s) pour passer au niveau ' + (entry.level + 1) + '</div>' : '') +
        (entry && card.action ? '<button class="coll-detail-btn coll-detail-btn-explore" onclick="CollectionSystem.exploreCard(\'' + cardId + '\')">🔗 EXPLORE THIS CONTENT</button>' : '') +
      '</div>';
    overlay.classList.add('open');
  }

  function closeCardDetail() {
    const overlay = document.getElementById('coll-detail-overlay');
    if (overlay) overlay.classList.remove('open');
  }

  async function tryLevelUp(cardId) {
    const res = await levelUpCard(cardId);
    if (res.ok) {
      renderToast('⬆️ Amélioration réussie', CARD_BY_ID[cardId].name + ' — niveau ' + res.level);
      openCardDetail(cardId);
      renderCollectionPage();
    } else if (res.reason === 'not_enough_dupes') {
      renderToast('♻️ Doublons insuffisants', 'Il te faut ' + res.needed + ' doublon(s) de plus.');
    }
  }

  function exploreCard(cardId) {
    const card = CARD_BY_ID[cardId];
    closeCardDetail();
    if (!card.action) return;
    if (card.action.type === 'era' && typeof window.showEra === 'function') window.showEra(card.action.idx);
    if (card.action.type === 'lore' && document.getElementById('lore-section') && typeof window.showLore === 'function') window.showLore();
  }

  /* ────────────────── UI : OUVERTURE DE PACK ────────────────── */

  async function startPackOpening(packType) {
    const overlay = document.getElementById('coll-pack-overlay') || (function () {
      const el = document.createElement('div');
      el.id = 'coll-pack-overlay';
      el.className = 'coll-overlay';
      document.body.appendChild(el);
      return el;
    })();
    overlay.classList.add('open');
    overlay.innerHTML = '<div class="coll-pack-anim"><div class="coll-pack-box" id="coll-pack-box">🎁</div><div class="coll-pack-hint">Touche pour ouvrir</div></div>';

    const box = document.getElementById('coll-pack-box');
    box.onclick = async function () {
      box.classList.add('opening');
      const outcome = await openPack(packType);
      if (!outcome.ok) { overlay.classList.remove('open'); return; }
      setTimeout(() => revealCards(overlay, outcome.results), animationsEnabled ? 550 : 0);
    };
  }

  function revealCards(overlay, results) {
    let html = '<div class="coll-reveal"><div class="coll-reveal-title">3 CARDS DISCOVERED</div><div class="coll-reveal-row">';
    results.forEach((r, i) => {
      const rarityGlow = (r.card.rarity === 'legendary') ? ' legendary-glow' : (r.card.rarity === 'epic' ? ' epic-glow' : '');
      html += '<div class="coll-reveal-card rarity-' + r.card.rarity + rarityGlow + '" style="animation-delay:' + (animationsEnabled ? i * 0.25 : 0) + 's">';
      html += '<span class="coll-card-media">' + cardMediaHtml(r.card, { level: 1 }) + '</span>';
      html += '<span class="coll-card-name">' + r.card.name + '</span>';
      html += '<span class="coll-badge rarity-' + r.card.rarity + '">' + RARITY[r.card.rarity].label + '</span>';
      html += r.isNew ? '<span class="coll-reveal-new">NEW!</span>' : '<span class="coll-reveal-dupe">+' + r.fragmentsGained + ' 💎</span>';
      html += '</div>';
    });
    html += '</div><button class="coll-detail-btn" onclick="CollectionSystem.closePackOpening()">Ajouter à ma collection</button></div>';
    overlay.innerHTML = html;
  }

  function closePackOpening() {
    const overlay = document.getElementById('coll-pack-overlay');
    if (overlay) overlay.classList.remove('open');
    renderCollectionPage();
  }

  /* ────────────────── OUVERTURE DEPUIS LE RESTE DU SITE ────────────────── */

  async function openCollectionPage() {
    if (!currentUser) {
      if (typeof window.authTogglePanel === 'function') window.authTogglePanel();
      return;
    }
    await ensureLoaded();
    document.querySelectorAll('.era-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.era-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('lore-section') && document.getElementById('lore-section').classList.remove('active');
    document.getElementById('about-section') && document.getElementById('about-section').classList.remove('active');
    document.getElementById('profile-section') && document.getElementById('profile-section').classList.remove('active');
    document.getElementById('homepage') && document.getElementById('homepage').classList.add('hp-hidden');
    const page = document.getElementById('collection-page');
    if (page) page.classList.add('active');
    renderCollectionPage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeCollectionPage() {
    const page = document.getElementById('collection-page');
    if (page) page.classList.remove('active');
  }

  function toggleAnimations(enabled) {
    animationsEnabled = enabled;
    localStorage.setItem('collectionAnimations', enabled ? 'true' : 'false');
  }

  /* ────────────────── PUBLIC API ────────────────── */

  global.CollectionSystem = {
    init(sbClient) { sb = sbClient; },
    async setUser(user) { currentUser = user; loadedOnce = false; await ensureLoaded(); },
    clearUser() { currentUser = null; owned = new Map(); loadedOnce = false; },
    unlockCard,
    unlockEggCard,
    unlockEraVisit,
    grantPackUnlock,
    questStep,
    openCollectionPage,
    closeCollectionPage,
    switchCategory,
    openCardDetail,
    closeCardDetail,
    tryLevelUp,
    exploreCard,
    startPackOpening,
    closePackOpening,
    toggleAnimations,
    progressFor,
    get fragments() { return wallet.fragments; },
    onUnlock(fn) { listeners.onUnlock.push(fn); },
  };

})(window);
