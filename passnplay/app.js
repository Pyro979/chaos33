// Main app logic for pass-and-play game

let currentState = 'next-player'; // 'next-player', 'normal-turn', 'duel'
let lastScreenType = null; // Track last screen to avoid back-to-back duels
let screenHistory = []; // Track last 5 screen types to ensure duel at least every 6th card
let lastWord = null;

let duelDeck = null;
let goblinDeck = null;
let chaosDeck = null;
let categoryDeckAlpha = null;
let categoryDeckScavenge = null;
let categoryDeckTheme = null;
let inlineCategoryDecks = null;

// Timer state
let timerInterval = null;
let timerSeconds = 33;
let timerRunning = false;
let progressInterval = null;
let progress = 0;

// Current turn data
let currentChaosPrompt = null;
let currentWord = null;
let currentDuel = null;
let currentGoblinMode = null;
let currentDuelCategory = null;
let currentDuelLetter = null;
let currentDuelTrigger = null; // Object with full_text and card_text
let duelCategoryRevealed = false;
let duelLetterRevealed = false;

let currentGoblinCategory = null;
let currentGoblinLetter = null;
let goblinCategoryRevealed = false;

/** Snapshots of completed turns for Back navigation (LIFO). */
let turnHistoryStack = [];

/** Session: unset until player count picked */
let sessionMode = 'unset'; // 'unset' | 'infinity' | 'twoP' | 'finite'
let playerCount = null; // null infinity; 2–8 otherwise
let turnsCompleted = 0; // finished play turns (Next from a play screen)
let tieBreakerActive = false;
let handoffTimeoutId = null;
let handoffTickIntervalId = null;
let shareQrInited = false;
let lastFocusBeforeModal = null;
let modalStack = [];

const KS_URL =
  'https://www.kickstarter.com/projects/33chaos/110087663?ref=d4rk8j&utm_source=passnplay&utm_medium=done_cta&utm_campaign=kickstarter';
const META_CAPI_PATH = '/api/meta-capi';

const CUE_TO_SLUG = {
  'Give clues in this voice': 'voice',
  'Give clues while doing this': 'doing',
  'Give clues with this attitude': 'attitude',
  'Give clues by describing': 'describing',
  'Give clues using only': 'using-only',
  'Every clue must follow this format': 'format',
  'Give clues but never say': 'never-say',
  'Give clues as if you are': 'as-if',
  'Give clues as if sharing a': 'as-if',
  'Give clues as if leading a': 'as-if',
  'Give clues as if narrating a': 'as-if',
  'Give clues as if giving a': 'as-if',
  'Give clues as if doing': 'as-if',
  'Give clues as if delivering a': 'as-if'
};

function getCueSlug(cue) {
  if (!cue || typeof cue !== 'string') return 'unknown';
  const slug = CUE_TO_SLUG[cue.trim()];
  return slug || 'unknown';
}

function newEventId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch (e) { /* ignore */ }
  return 'pnp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 11);
}

function trackKeyEvent(name, params) {
  const p = params && typeof params === 'object' ? params : {};
  const eventId = newEventId();
  if (typeof window.gtag === 'function') {
    window.gtag('event', name, p);
  }
  if (typeof window.fbq === 'function') {
    window.fbq('trackCustom', name, p, { eventID: eventId });
  }
  if (window.goatcounter && typeof window.goatcounter.count === 'function') {
    try {
      window.goatcounter.count({
        path: String(name).toLowerCase().replace(/_/g, '-'),
        title: name,
        event: true
      });
    } catch (e) { /* ignore */ }
  }
  if (typeof window.clarity === 'function') {
    try {
      window.clarity('set', 'passnplay_event', name);
    } catch (e) { /* ignore */ }
  }
  if (typeof fetch === 'function') {
    fetch(META_CAPI_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_name: name, event_id: eventId, custom_data: p })
    }).catch(function () {});
  }
}

function sessionStarted() {
  return sessionMode !== 'unset';
}

function maxTurnsForSession() {
  if (sessionMode === 'finite' || sessionMode === 'twoP') {
    return playerCount * 3;
  }
  return Infinity;
}

function formatDuelDescriptionForSession(description) {
  let text = description || '';
  if (sessionMode === 'twoP') {
    text = text
      .replace(/\*\*letter chosen by the Judge\*\*/gi, '**the letter shown below**')
      .replace(/letter chosen by the Judge/gi, 'the letter shown below')
      .replace(/The Judge picks a letter\.?/gi, 'The letter is shown below.')
      .replace(/The Judge picks a letter/gi, 'The letter is shown below');
  }
  return text;
}

/** Tie-breaker duel after Done, or last duel of a finite / 2P session (next tap goes to Done). */
function isFinalDuelChrome() {
  if (currentState !== 'duel') return false;
  if (tieBreakerActive) return true;
  if (sessionMode !== 'finite' && sessionMode !== 'twoP') return false;
  const maxT = maxTurnsForSession();
  if (!Number.isFinite(maxT)) return false;
  return turnsCompleted === maxT - 1;
}

function hideModalByTop(top) {
  if (top === 'player-count') {
    const el = document.getElementById('player-count-modal');
    if (el) el.classList.remove('active');
  } else if (top === 'how-to') {
    const el = document.getElementById('how-to-play-modal');
    if (el) el.classList.remove('active');
  } else if (top === 'share') {
    const el = document.getElementById('share-modal');
    if (el) el.classList.remove('active');
  } else if (top === 'swap') {
    document.getElementById('swap-modal').classList.remove('active');
  } else if (top === 'end-session') {
    const el = document.getElementById('end-session-modal');
    if (el) el.classList.remove('active');
  }
  if (lastFocusBeforeModal && typeof lastFocusBeforeModal.focus === 'function') {
    lastFocusBeforeModal.focus();
    lastFocusBeforeModal = null;
  }
}

function modalPush(name) {
  modalStack.push(name);
  history.pushState({ pnpModal: name }, '');
}

function updateSessionChrome() {
  const maxT = maxTurnsForSession();
  const infinity = !Number.isFinite(maxT);
  ['normal', 'duel', 'goblin'].forEach(function (suffix) {
    const wrap = document.getElementById('session-progress-' + suffix);
    if (!wrap) return;
    if (
      infinity ||
      currentState === 'next-player' ||
      currentState === 'handoff' ||
      currentState === 'done' ||
      isFinalDuelChrome()
    ) {
      wrap.classList.add('pnp-hidden');
      return;
    }
    wrap.classList.remove('pnp-hidden');
    const fill = document.getElementById('session-progress-fill-' + suffix);
    const label = document.getElementById('session-progress-label-' + suffix);
    const pct = Math.min(100, (turnsCompleted / maxT) * 100);
    if (fill) fill.style.width = pct + '%';
    const playN = playerCount > 0 ? (turnsCompleted % playerCount) + 1 : 1;
    const rnd = playerCount > 0 ? Math.floor(turnsCompleted / playerCount) + 1 : 1;
    if (label) {
      label.textContent = 'Player ' + playN + ' of ' + playerCount + ' · Round ' + rnd + '/3';
    }
    wrap.setAttribute('aria-valuemax', String(maxT));
    wrap.setAttribute('aria-valuenow', String(Math.min(turnsCompleted + 1, maxT)));
  });

  const duelNextBtn = document.getElementById('next-player-duel-btn');
  if (duelNextBtn) {
    if (isFinalDuelChrome()) {
      duelNextBtn.textContent = 'Done!';
      duelNextBtn.setAttribute('aria-label', 'Done - end session');
    } else {
      duelNextBtn.textContent = 'Next Player →';
      duelNextBtn.setAttribute('aria-label', 'Next player');
    }
  }
}

function updateIntroModeVisibility() {
  const def = document.getElementById('intro-text-default');
  const t2 = document.getElementById('intro-text-2p');
  if (!def || !t2) return;
  if (sessionMode === 'twoP' && currentState === 'next-player') {
    def.classList.add('pnp-hidden');
    t2.classList.remove('pnp-hidden');
  } else {
    t2.classList.add('pnp-hidden');
    def.classList.remove('pnp-hidden');
  }
}

function openPlayerCountModal() {
  const m = document.getElementById('player-count-modal');
  if (!m) return;
  lastFocusBeforeModal = document.activeElement;
  m.classList.add('active');
  modalPush('player-count');
  const first = m.querySelector('.btn-player-count');
  if (first) first.focus();
}

function closePlayerCountModalCommit() {
  const m = document.getElementById('player-count-modal');
  if (m) m.classList.remove('active');
  if (modalStack.length && modalStack[modalStack.length - 1] === 'player-count') {
    modalStack.pop();
    history.replaceState({ pnpLaunch: true }, '');
  }
  if (lastFocusBeforeModal && typeof lastFocusBeforeModal.focus === 'function') {
    lastFocusBeforeModal.focus();
    lastFocusBeforeModal = null;
  }
}

function closePlayerCountModal() {
  if (modalStack.length && modalStack[modalStack.length - 1] === 'player-count') {
    history.back();
  } else {
    closePlayerCountModalCommit();
  }
}

function applySessionChoice(mode, count) {
  sessionMode = mode;
  playerCount = mode === 'infinity' ? null : count;
  turnsCompleted = 0;
  tieBreakerActive = false;
  turnHistoryStack = [];
  lastScreenType = null;
  screenHistory = [];
  resetShuffleDecks();
  closePlayerCountModalCommit();
  trackKeyEvent('passnplay_session_start', {
    session_mode: mode,
    player_count: playerCount || 0
  });
  if (typeof window.clarity === 'function') {
    try {
      window.clarity('set', 'passnplay_session_mode', mode);
    } catch (e) { /* ignore */ }
  }
  history.pushState({ pnpSession: true }, '');
  dealNextTurn();
  updateSessionChrome();
  updateIntroModeVisibility();
}

function getSharePnpEmailUrl() {
  return new URL(
    '/pnp-email/?utm_source=passnplay&utm_medium=share_icon&utm_campaign=pnp_qr',
    window.location.origin
  ).href;
}

function openShareModal() {
  const m = document.getElementById('share-modal');
  if (!m) return;
  lastFocusBeforeModal = document.activeElement;
  const url = getSharePnpEmailUrl();
  const shareBtn = document.getElementById('share-link-btn');
  if (shareBtn) {
    const canShare = typeof navigator.share === 'function';
    shareBtn.textContent = canShare ? 'Share' : 'Copy link';
    shareBtn.setAttribute(
      'aria-label',
      canShare ? 'Share link with your device' : 'Copy link to clipboard'
    );
  }
  if (typeof QRCode !== 'undefined' && !shareQrInited) {
    const container = document.getElementById('share-qrcode');
    if (container) {
      container.innerHTML = '';
      // eslint-disable-next-line no-new
      new QRCode(container, {
        text: url,
        width: 200,
        height: 200,
        colorDark: '#000000',
        colorLight: '#ffffff'
      });
      shareQrInited = true;
    }
  } else if (typeof QRCode !== 'undefined' && shareQrInited) {
    const container = document.getElementById('share-qrcode');
    if (container && !container.firstChild) {
      // eslint-disable-next-line no-new
      new QRCode(container, {
        text: url,
        width: 200,
        height: 200,
        colorDark: '#000000',
        colorLight: '#ffffff'
      });
    }
  }
  m.classList.add('active');
  modalPush('share');
  trackKeyEvent('passnplay_share_open', {});
  document.getElementById('share-modal-close').focus();
}

function closeShareModal() {
  if (modalStack.length && modalStack[modalStack.length - 1] === 'share') {
    history.back();
  } else {
    document.getElementById('share-modal').classList.remove('active');
  }
}

function handleDoneTieDuel() {
  trackKeyEvent('passnplay_done_tie_duel', {});
  tieBreakerActive = true;
  startDuel();
  lastScreenType = 'duel';
  screenHistory.push('duel');
  if (screenHistory.length > 5) screenHistory.shift();
  showScreen('duel');
  updateSessionChrome();
}

function handleDoneRestart() {
  trackKeyEvent('passnplay_done_restart', {});
  resetShuffleDecks();
  sessionMode = 'unset';
  playerCount = null;
  turnsCompleted = 0;
  tieBreakerActive = false;
  turnHistoryStack = [];
  lastScreenType = null;
  screenHistory = [];
  lastWord = null;
  history.replaceState({ pnpLaunch: true }, '');
  modalStack = [];
  showScreen('next-player');
  updateSessionChrome();
  updateIntroModeVisibility();
  openPlayerCountModal();
}

function confirmEndSession() {
  trackKeyEvent('passnplay_end_session', {});
  stopTimer();
  clearHandoffTimers();
  document.getElementById('end-session-modal').classList.remove('active');
  const hadEndModal =
    modalStack.length && modalStack[modalStack.length - 1] === 'end-session';
  if (hadEndModal) {
    modalStack.pop();
  }
  sessionMode = 'unset';
  playerCount = null;
  turnsCompleted = 0;
  tieBreakerActive = false;
  turnHistoryStack = [];
  lastScreenType = null;
  screenHistory = [];
  lastWord = null;
  resetShuffleDecks();
  if (hadEndModal) {
    history.back();
  }
  history.replaceState({ pnpLaunch: true }, '');
  showScreen('next-player');
  updateSessionChrome();
  updateIntroModeVisibility();
}

function cancelEndSession() {
  if (modalStack.length && modalStack[modalStack.length - 1] === 'end-session') {
    history.back();
  } else {
    document.getElementById('end-session-modal').classList.remove('active');
  }
}

function rebuildDuelDeck() {
  const all = gameData.duels || [];
  let pool =
    sessionMode === 'twoP' ? all.filter(function (d) { return !d.requiresJudge; }) : all;
  if (sessionMode === 'twoP' && pool.length === 0 && all.length > 0) {
    console.warn('Passnplay: no judge-free duels in data; using full duel deck');
    pool = all;
  }
  duelDeck = createDeck(pool);
}

function updateChaosCueChip(prompt) {
  const chipEl = document.getElementById('chaos-cue-chip');
  if (!chipEl) return;
  if (!prompt || !prompt.cue) {
    chipEl.style.display = 'none';
    chipEl.textContent = '';
    return;
  }
  chipEl.textContent = prompt.cue + '...';
  chipEl.className = 'chaos-cue-chip chaos-cue-chip--' + getCueSlug(prompt.cue);
  chipEl.style.display = '';
}

function resetShuffleDecks() {
    rebuildDuelDeck();
    goblinDeck = createDeck(gameData.goblinModes);
    chaosDeck = createDeck(gameData.chaosPrompts);
    const dc = gameData.duelCategories || {};
    categoryDeckAlpha = createDeck(dc.alphaBlitz || []);
    categoryDeckScavenge = createDeck(dc.scavenge || []);
    categoryDeckTheme = createDeck(dc.themeBlitz || []);
    inlineCategoryDecks = new Map();
}

function getInlineDeck(title, categories) {
    if (!title || !categories || categories.length === 0) return null;
    if (!inlineCategoryDecks.has(title)) {
        inlineCategoryDecks.set(title, createDeck([...categories]));
    }
    return inlineCategoryDecks.get(title);
}

function nextDuelCategory(duel) {
    if (duel.alphabetic) {
        if (duel.categories && duel.categories.length > 0) {
            const deck = getInlineDeck(duel.title, duel.categories);
            return deck ? getNextFromDeck(deck) : null;
        }
        return getNextFromDeck(categoryDeckAlpha);
    }
    if (duel.title === 'Scavenge') {
        return getNextFromDeck(categoryDeckScavenge);
    }
    if (duel.categories && duel.categories.length > 0) {
        const deck = getInlineDeck(duel.title, duel.categories);
        return deck ? getNextFromDeck(deck) : null;
    }
    return null;
}

function nextGoblinCategory(mode) {
    if (mode.alphabetic || mode.category) {
        return getNextFromDeck(categoryDeckAlpha);
    }
    if (mode.scavenge) {
        return getNextFromDeck(categoryDeckScavenge);
    }
    if (mode.themeCategory) {
        return getNextFromDeck(categoryDeckTheme);
    }
    return null;
}

function buildTurnSnapshot() {
    const duelRevealSection = document.getElementById('duel-reveal-section');
    const goblinRevealSection = document.getElementById('goblin-reveal-section');
    const countdownEl = document.getElementById('timer-countdown');
    const timerText = countdownEl ? countdownEl.textContent.trim() : '';
    const timerWasEmoji = timerText === '⏳' || timerText === '';

    return {
        screen: currentState,
        lastScreenType,
        screenHistory: screenHistory.slice(),
        lastWord,
        currentChaosPrompt,
        currentWord,
        currentDuel,
        currentDuelCategory,
        currentDuelLetter,
        duelCategoryRevealed,
        duelLetterRevealed,
        duelRevealSectionDisplay: duelRevealSection ? duelRevealSection.style.display || '' : 'none',
        duelRevealValuesHtml: document.getElementById('reveal-values')?.innerHTML || '',
        currentGoblinMode,
        currentGoblinCategory,
        currentGoblinLetter,
        goblinCategoryRevealed,
        goblinRevealSectionDisplay: goblinRevealSection ? goblinRevealSection.style.display || '' : 'none',
        goblinRevealValuesHtml: document.getElementById('goblin-reveal-values')?.innerHTML || '',
        timerSeconds,
        progress,
        timerWasEmoji
    };
}

function applyTimerFromSnapshot(snap) {
    if (snap.timerWasEmoji) {
        resetTimer();
        return;
    }
    timerSeconds = snap.timerSeconds;
    progress = snap.progress;
    timerRunning = false;
    const countdownEl = document.getElementById('timer-countdown');
    const timerCircle = document.querySelector('#normal-turn-screen .timer-circle');
    const flipTimer = document.getElementById('flip-timer');
    if (countdownEl) {
        if (timerSeconds > 0) {
            countdownEl.textContent = String(timerSeconds);
        } else {
            countdownEl.textContent = '0';
        }
    }
    if (timerCircle) {
        const totalSeconds = 33;
        const progressPercent = ((totalSeconds - timerSeconds) / totalSeconds) * 100;
        timerCircle.style.strokeDashoffset = String(100 - progressPercent);
    }
    if (flipTimer) {
        flipTimer.classList.toggle('time-up', timerSeconds <= 0);
    }
    updateTimerDisplay();
}

function applyTurnSnapshot(snap) {
    stopTimer();
    lastScreenType = snap.lastScreenType;
    screenHistory = snap.screenHistory.slice();
    lastWord = snap.lastWord;

    if (snap.screen === 'normal-turn') {
        currentChaosPrompt = snap.currentChaosPrompt;
        currentWord = snap.currentWord;
        document.getElementById('chaos-title').textContent = currentChaosPrompt.title;
        document.getElementById('chaos-description').innerHTML = formatText(currentChaosPrompt.description);
        document.getElementById('word-text').textContent = currentWord;
        updateChaosCueChip(currentChaosPrompt);
        applyTimerFromSnapshot(snap);
        showScreen('normal-turn');
        return;
    }

    resetTimer();

    if (snap.screen === 'duel') {
        currentDuel = snap.currentDuel;
        currentDuelCategory = snap.currentDuelCategory;
        currentDuelLetter = snap.currentDuelLetter;
        duelCategoryRevealed = snap.duelCategoryRevealed;
        duelLetterRevealed = snap.duelLetterRevealed;
        const duelTriggerEl = document.getElementById('duel-trigger');
        if (duelTriggerEl) {
            duelTriggerEl.textContent = 'Choose who you\'re dueling';
        }
        document.getElementById('duel-title').textContent = currentDuel.title;
        document.getElementById('duel-description').innerHTML = formatText(
            formatDuelDescriptionForSession(currentDuel.description)
        );
        const revealText = document.getElementById('reveal-text');
        const revealValues = document.getElementById('reveal-values');
        const revealBtn = document.getElementById('reveal-btn');
        const revealSection = document.getElementById('duel-reveal-section');
        const sectionDisplay = snap.duelRevealSectionDisplay || 'none';
        revealSection.style.display = sectionDisplay === '' ? 'block' : sectionDisplay;
        if (snap.duelCategoryRevealed && snap.duelRevealValuesHtml) {
            revealValues.innerHTML = snap.duelRevealValuesHtml;
            revealText.style.display = 'none';
            revealValues.style.display = 'block';
            revealBtn.style.cursor = 'default';
        } else {
            revealText.style.display = 'block';
            revealValues.style.display = 'none';
            revealValues.innerHTML = '';
            revealBtn.style.cursor = sectionDisplay === 'none' ? 'default' : 'pointer';
        }
        showScreen('duel');
        return;
    }

    if (snap.screen === 'goblin-mode') {
        currentGoblinMode = snap.currentGoblinMode;
        currentGoblinCategory = snap.currentGoblinCategory;
        currentGoblinLetter = snap.currentGoblinLetter;
        goblinCategoryRevealed = snap.goblinCategoryRevealed;
        document.getElementById('goblin-title').textContent = currentGoblinMode.title;
        document.getElementById('goblin-description').innerHTML = formatText(currentGoblinMode.text);
        const revealSection = document.getElementById('goblin-reveal-section');
        const goblinRevealText = document.getElementById('goblin-reveal-text');
        const goblinRevealValues = document.getElementById('goblin-reveal-values');
        const goblinRevealBtn = document.getElementById('goblin-reveal-btn');
        const gSectionDisplay = snap.goblinRevealSectionDisplay || 'none';
        revealSection.style.display = gSectionDisplay === '' ? 'block' : gSectionDisplay;
        if (snap.goblinCategoryRevealed && snap.goblinRevealValuesHtml) {
            goblinRevealValues.innerHTML = snap.goblinRevealValuesHtml;
            goblinRevealText.style.display = 'none';
            goblinRevealValues.style.display = 'block';
            goblinRevealBtn.style.cursor = 'default';
        } else {
            goblinRevealText.style.display = 'block';
            goblinRevealValues.style.display = 'none';
            goblinRevealValues.innerHTML = '';
            goblinRevealBtn.style.cursor = gSectionDisplay === 'none' ? 'default' : 'pointer';
        }
        showScreen('goblin-mode');
    }
}

function handleBack() {
    hideSwapModal();
    if (currentState === 'handoff') {
        return;
    }
    if (turnHistoryStack.length === 0) {
        if (currentState === 'normal-turn' || currentState === 'duel' || currentState === 'goblin-mode') {
            stopTimer();
            resetTimer();
            lastScreenType = null;
            screenHistory = [];
            showScreen('next-player');
            updateIntroModeVisibility();
        }
        return;
    }
    const snap = turnHistoryStack.pop();
    applyTurnSnapshot(snap);
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    // Load game data
    try {
        await loadGameData();
        initializeApp();
    } catch (error) {
        console.error('Failed to initialize app:', error);
        document.body.innerHTML = '<div class="error">Failed to load game data. Please refresh the page.</div>';
    }
});

function initializeApp() {
    resetShuffleDecks();

    history.replaceState({ pnpLaunch: true }, '');

    window.addEventListener('popstate', function () {
        if (modalStack.length > 0) {
            const top = modalStack.pop();
            hideModalByTop(top);
            return;
        }
        if (
            sessionStarted() &&
            currentState !== 'next-player' &&
            currentState !== 'done' &&
            currentState !== 'handoff'
        ) {
            document.getElementById('end-session-modal').classList.add('active');
            history.pushState({ pnpModal: 'end-session' }, '');
            modalStack.push('end-session');
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        if (modalStack.length > 0) {
            const top = modalStack[modalStack.length - 1];
            if (top === 'how-to') hideHowToPlayModal();
            else if (top === 'share') closeShareModal();
            else if (top === 'swap') hideSwapModal();
            else if (top === 'player-count') {
                closePlayerCountModal();
            } else if (top === 'end-session') {
                cancelEndSession();
            }
        }
    });

    document.getElementById('next-player-btn').addEventListener('click', function () {
        openPlayerCountModal();
    });
    document.getElementById('player-count-cancel').addEventListener('click', closePlayerCountModal);
    document.getElementById('next-player-normal-btn').addEventListener('click', handleNextPlayer);
    document.getElementById('next-player-duel-btn').addEventListener('click', handleNextPlayer);
    document.getElementById('next-player-goblin-btn').addEventListener('click', handleNextPlayer);

    document.querySelectorAll('.btn-player-count').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const mode = btn.getAttribute('data-mode');
            const count = parseInt(btn.getAttribute('data-count'), 10) || 0;
            if (mode === 'infinity') {
                applySessionChoice('infinity', null);
            } else if (mode === 'twoP') {
                applySessionChoice('twoP', 2);
            } else {
                applySessionChoice('finite', count);
            }
        });
    });

    document.querySelectorAll('.btn-turn-back').forEach(function (btn) {
        btn.addEventListener('click', handleBack);
    });

    document.getElementById('swap-btn').addEventListener('click', function () {
        showSwapModal('normal');
    });
    document.getElementById('swap-duel-btn').addEventListener('click', function () {
        showSwapModal('duel');
    });

    document.getElementById('swap-cancel-btn').addEventListener('click', hideSwapModal);
    document.getElementById('swap-confirm-btn').addEventListener('click', handleSwapConfirm);

    document.getElementById('flip-timer').addEventListener('click', startTimer);

    document.getElementById('reveal-btn').addEventListener('click', handleReveal);
    document.getElementById('goblin-reveal-btn').addEventListener('click', handleGoblinReveal);

    document.getElementById('how-to-play-btn').addEventListener('click', showHowToPlayModal);
    document.getElementById('how-to-play-link-normal').addEventListener('click', function (e) {
        e.preventDefault();
        showHowToPlayModal();
    });
    document.getElementById('how-to-play-link-duel').addEventListener('click', function (e) {
        e.preventDefault();
        showHowToPlayModal();
    });
    document.getElementById('how-to-play-link-goblin').addEventListener('click', function (e) {
        e.preventDefault();
        showHowToPlayModal();
    });
    document.getElementById('how-to-play-close-btn').addEventListener('click', hideHowToPlayModal);
    document.getElementById('how-to-play-close-btn-bottom').addEventListener('click', hideHowToPlayModal);

    document.getElementById('how-to-play-modal').addEventListener('click', function (e) {
        if (e.target.id === 'how-to-play-modal') {
            hideHowToPlayModal();
        }
    });

    document.getElementById('done-tie-duel-btn').addEventListener('click', handleDoneTieDuel);
    document.getElementById('done-restart-btn').addEventListener('click', handleDoneRestart);
    document.getElementById('done-kickstarter-btn').addEventListener('click', function () {
        trackKeyEvent('passnplay_done_kickstarter', {});
    });

    document.getElementById('share-fab').addEventListener('click', openShareModal);
    document.getElementById('share-modal-close').addEventListener('click', closeShareModal);
    document.getElementById('share-modal').addEventListener('click', function (e) {
        if (e.target.id === 'share-modal') {
            closeShareModal();
        }
    });
    document.getElementById('share-link-btn').addEventListener('click', function () {
        const url = getSharePnpEmailUrl();
        const titleEl = document.getElementById('share-modal-title');
        const title = titleEl ? titleEl.textContent.trim() : 'Pass & Play';

        function fallbackCopy() {
            trackKeyEvent('passnplay_share_action', { method: 'clipboard' });
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(url).catch(function () {});
            }
        }

        if (typeof navigator.share === 'function') {
            navigator
                .share({
                    title: title,
                    text: 'Chaos 33 - PnP email page',
                    url: url
                })
                .then(function () {
                    trackKeyEvent('passnplay_share_action', { method: 'web_share' });
                })
                .catch(function (err) {
                    if (err && err.name === 'AbortError') {
                        return;
                    }
                    fallbackCopy();
                });
        } else {
            fallbackCopy();
        }
    });

    document.getElementById('end-session-cancel').addEventListener('click', cancelEndSession);
    document.getElementById('end-session-confirm').addEventListener('click', confirmEndSession);

    const ksBtn = document.getElementById('done-kickstarter-btn');
    if (ksBtn) {
        ksBtn.href = KS_URL;
    }

    showScreen('next-player');
    lastScreenType = null;
    screenHistory = [];
    turnHistoryStack = [];
    sessionMode = 'unset';
    playerCount = null;
    turnsCompleted = 0;
    tieBreakerActive = false;
    modalStack = [];

    resetTimer();
    updateSessionChrome();
    updateIntroModeVisibility();
}

function dealNextTurn() {
    if (sessionMode === 'twoP') {
        startDuel();
        lastScreenType = 'duel';
        screenHistory.push('duel');
        if (screenHistory.length > 5) screenHistory.shift();
        return;
    }

    const hasDuelInLast5 = screenHistory.some(function (type) { return type === 'duel'; });
    const mustForceDuel = screenHistory.length >= 5 && !hasDuelInLast5;
    let isDuel = false;
    let isGoblinMode = false;
    const hasGoblinCards = gameData.goblinModes && gameData.goblinModes.length > 0;
    if (mustForceDuel) {
        isDuel = true;
    } else if (lastScreenType !== 'duel' && lastScreenType !== null) {
        const roll = Math.random();
        if (hasGoblinCards && lastScreenType !== 'goblin-mode' && roll < 0.1) {
            isGoblinMode = true;
        } else if (roll < (hasGoblinCards ? 0.35 : 0.25)) {
            isDuel = true;
        }
    }

    if (isGoblinMode) {
        startGoblinMode();
        lastScreenType = 'goblin-mode';
    } else if (isDuel) {
        startDuel();
        lastScreenType = 'duel';
    } else {
        startNormalTurn();
        lastScreenType = 'normal-turn';
    }
    screenHistory.push(lastScreenType);
    if (screenHistory.length > 5) {
        screenHistory.shift();
    }
}

function clearHandoffTimers() {
    if (handoffTimeoutId) {
        clearTimeout(handoffTimeoutId);
        handoffTimeoutId = null;
    }
    if (handoffTickIntervalId) {
        clearInterval(handoffTickIntervalId);
        handoffTickIntervalId = null;
    }
}

function runHandoffThen(callback) {
    clearHandoffTimers();
    const secEl = document.getElementById('handoff-seconds');
    if (secEl) secEl.textContent = '3';
    showScreen('handoff');
    let n = 2;
    handoffTickIntervalId = setInterval(function () {
        if (secEl) secEl.textContent = String(n);
        n--;
        if (n < 0 && handoffTickIntervalId) {
            clearInterval(handoffTickIntervalId);
            handoffTickIntervalId = null;
        }
    }, 1000);
    handoffTimeoutId = setTimeout(function () {
        clearHandoffTimers();
        callback();
    }, 3000);
}

function handleNextPlayer() {
    hideSwapModal();
    if (currentState === 'handoff') {
        return;
    }

    if (currentState === 'normal-turn' || currentState === 'duel' || currentState === 'goblin-mode') {
        turnHistoryStack.push(buildTurnSnapshot());
    }

    stopTimer();
    resetTimer();

    duelCategoryRevealed = false;
    duelLetterRevealed = false;

    goblinCategoryRevealed = false;
    currentGoblinCategory = null;
    currentGoblinLetter = null;

    if (tieBreakerActive && currentState === 'duel') {
        tieBreakerActive = false;
        showScreen('done');
        updateSessionChrome();
        return;
    }

    const fromPlay =
        currentState === 'normal-turn' ||
        currentState === 'duel' ||
        currentState === 'goblin-mode';

    if (fromPlay) {
        turnsCompleted++;
    }

    if (
        (sessionMode === 'finite' || sessionMode === 'twoP') &&
        turnsCompleted >= maxTurnsForSession()
    ) {
        showScreen('done');
        updateSessionChrome();
        return;
    }

    const deal = function () {
        dealNextTurn();
        updateSessionChrome();
    };

    if (sessionStarted() && fromPlay && turnsCompleted > 0) {
        runHandoffThen(deal);
        return;
    }
    deal();
}

// Helper function to convert \n to <br> and **text** to <strong>text</strong>
function formatText(text) {
    if (!text) return '';
    // Remove "Avoid: [letter list]" pattern (case insensitive, flexible spacing)
    // Matches "Avoid:" followed by any letters, commas, spaces, and periods
    let formatted = text.replace(/\s*Avoid:\s*[A-Z,\s]+\.?\s*/gi, '');
    // Convert markdown bold **text** to <strong>text</strong>
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Convert \n and actual newlines to <br>
    formatted = formatted.replace(/\\n/g, '<br>').replace(/\n/g, '<br>');
    return formatted;
}

function startNormalTurn() {
    currentChaosPrompt = getNextFromDeck(chaosDeck);
    currentWord = getRandomItem(gameData.words, lastWord);
    lastWord = currentWord;
    
    // Update UI
    document.getElementById('chaos-title').textContent = currentChaosPrompt.title;
    document.getElementById('chaos-description').innerHTML = formatText(currentChaosPrompt.description);
    document.getElementById('word-text').textContent = currentWord;
    updateChaosCueChip(currentChaosPrompt);
    
    // Reset timer - this will show the clock emoji
    resetTimer();
    
    showScreen('normal-turn');
}

function startDuel() {
    currentDuel = getNextFromDeck(duelDeck);
    if (!currentDuel) {
        console.error('Passnplay: duel deck is empty');
        showScreen('next-player');
        return;
    }

    // Update UI
    const duelTriggerEl = document.getElementById('duel-trigger');
    if (duelTriggerEl) {
        duelTriggerEl.textContent = 'Choose who you\'re dueling';
    }
    document.getElementById('duel-title').textContent = currentDuel.title;
    document.getElementById('duel-description').innerHTML = formatText(
        formatDuelDescriptionForSession(currentDuel.description)
    );
    
    // Reset reveals
    duelCategoryRevealed = false;
    duelLetterRevealed = false;
    
    // Reset reveal section
    const revealText = document.getElementById('reveal-text');
    const revealValues = document.getElementById('reveal-values');
    const revealBtn = document.getElementById('reveal-btn');
    const revealSection = document.getElementById('duel-reveal-section');
    
    // Determine what to reveal based on duel data fields (not title) so all blitz variants work.
    if (currentDuel.alphabetic) {
        // Alpha Blitz family (alphabetic:true): needs category + letter
        currentDuelCategory = nextDuelCategory(currentDuel);
        currentDuelLetter = getRandomLetter();
        revealText.style.display = 'block';
        revealValues.style.display = 'none';
        revealValues.innerHTML = '';
        revealBtn.style.cursor = 'pointer';
        revealSection.style.display = 'block';
    } else if (currentDuel.title === 'Scavenge') {
        // Scavenge: needs category from the scavenge pool
        currentDuelCategory = nextDuelCategory(currentDuel);
        currentDuelLetter = null;
        revealText.style.display = 'block';
        revealValues.style.display = 'none';
        revealValues.innerHTML = '';
        revealBtn.style.cursor = 'pointer';
        revealSection.style.display = 'block';
    } else if (currentDuel.categories && currentDuel.categories.length > 0) {
        // Theme Blitz family (non-alphabetic, has categories): needs category only
        currentDuelCategory = nextDuelCategory(currentDuel);
        currentDuelLetter = null;
        revealText.style.display = 'block';
        revealValues.style.display = 'none';
        revealValues.innerHTML = '';
        revealBtn.style.cursor = 'pointer';
        revealSection.style.display = 'block';
    } else {
        // Other duels: no category or letter - hide the reveal section
        currentDuelCategory = null;
        currentDuelLetter = null;
        revealText.style.display = 'none';
        revealValues.style.display = 'none';
        revealValues.innerHTML = '';
        revealBtn.style.cursor = 'default';
        revealSection.style.display = 'none'; // Hide completely when nothing to reveal
    }
    
    showScreen('duel');
}

function startGoblinMode() {
    currentGoblinMode = getNextFromDeck(goblinDeck);

    document.getElementById('goblin-title').textContent = currentGoblinMode.title;
    document.getElementById('goblin-description').innerHTML = formatText(currentGoblinMode.text);

    // Set up reveal section based on card flags
    const revealSection = document.getElementById('goblin-reveal-section');
    const goblinRevealText = document.getElementById('goblin-reveal-text');
    const goblinRevealValues = document.getElementById('goblin-reveal-values');
    const goblinRevealBtn = document.getElementById('goblin-reveal-btn');

    goblinCategoryRevealed = false;
    goblinRevealText.style.display = 'block';
    goblinRevealValues.style.display = 'none';
    goblinRevealValues.innerHTML = '';
    goblinRevealBtn.style.cursor = 'pointer';

    if (currentGoblinMode.alphabetic) {
        currentGoblinCategory = nextGoblinCategory(currentGoblinMode);
        currentGoblinLetter = getRandomLetter();
        revealSection.style.display = 'block';
    } else if (currentGoblinMode.category) {
        currentGoblinCategory = nextGoblinCategory(currentGoblinMode);
        currentGoblinLetter = null;
        revealSection.style.display = 'block';
    } else if (currentGoblinMode.scavenge) {
        currentGoblinCategory = nextGoblinCategory(currentGoblinMode);
        currentGoblinLetter = null;
        revealSection.style.display = 'block';
    } else if (currentGoblinMode.themeCategory) {
        currentGoblinCategory = nextGoblinCategory(currentGoblinMode);
        currentGoblinLetter = null;
        revealSection.style.display = 'block';
    } else {
        currentGoblinCategory = null;
        currentGoblinLetter = null;
        revealSection.style.display = 'none';
    }

    showScreen('goblin-mode');
}

function handleReveal() {
    // Don't reveal if already revealed or nothing to reveal
    if (duelCategoryRevealed || (!currentDuelCategory && !currentDuelLetter)) {
        return;
    }
    
    const revealText = document.getElementById('reveal-text');
    const revealValues = document.getElementById('reveal-values');
    const revealBtn = document.getElementById('reveal-btn');
    
    let content = '';
    
    if (currentDuelCategory && currentDuelLetter) {
        // Alpha Blitz: show both category and letter
        content = `Category: <span class="reveal-category">${currentDuelCategory}</span><br>Letter: <span class="reveal-letter">${currentDuelLetter}</span>`;
    } else if (currentDuelCategory) {
        // Theme Blitz or Scavenge: show category only
        content = `Category: <span class="reveal-category">${currentDuelCategory}</span>`;
    }
    // If neither, content stays empty (blank space)
    
    if (content) {
        revealValues.innerHTML = content;
        revealText.style.display = 'none';
        revealValues.style.display = 'block';
        revealBtn.style.cursor = 'default';
        duelCategoryRevealed = true;
        if (currentDuelLetter) {
            duelLetterRevealed = true;
        }
    }
}

function handleGoblinReveal() {
    if (goblinCategoryRevealed || !currentGoblinCategory) return;

    const goblinRevealText = document.getElementById('goblin-reveal-text');
    const goblinRevealValues = document.getElementById('goblin-reveal-values');
    const goblinRevealBtn = document.getElementById('goblin-reveal-btn');

    let content = '';
    if (currentGoblinCategory && currentGoblinLetter) {
        content = `Category: <span class="reveal-category">${currentGoblinCategory}</span><br>Letter: <span class="reveal-letter">${currentGoblinLetter}</span>`;
    } else if (currentGoblinCategory) {
        content = `Category: <span class="reveal-category">${currentGoblinCategory}</span>`;
    }

    if (content) {
        goblinRevealValues.innerHTML = content;
        goblinRevealText.style.display = 'none';
        goblinRevealValues.style.display = 'block';
        goblinRevealBtn.style.cursor = 'default';
        goblinCategoryRevealed = true;
    }
}

function showSwapModal(screenType) {
    const modal = document.getElementById('swap-modal');
    const modalText = document.getElementById('swap-modal-text');

    if (screenType === 'normal') {
        modalText.textContent = 'Swap this prompt?';
    } else {
        modalText.textContent = 'Swap this duel?';
    }

    lastFocusBeforeModal = document.activeElement;
    modal.classList.add('active');
    modal.dataset.screenType = screenType;
    modalPush('swap');
    document.getElementById('swap-cancel-btn').focus();
}

function hideSwapModal() {
    if (modalStack.length && modalStack[modalStack.length - 1] === 'swap') {
        history.back();
    } else {
        document.getElementById('swap-modal').classList.remove('active');
    }
}

function showHowToPlayModal() {
    const multi = document.getElementById('rules-multi');
    const r2 = document.getElementById('rules-2p');
    const modalEl = document.getElementById('how-to-play-modal');
    if (!modalEl) return;
    if (multi && r2) {
        if (sessionMode === 'twoP') {
            multi.classList.add('pnp-hidden');
            r2.classList.remove('pnp-hidden');
            modalEl.setAttribute('aria-labelledby', 'how-to-play-heading-2p');
        } else {
            r2.classList.add('pnp-hidden');
            multi.classList.remove('pnp-hidden');
            modalEl.setAttribute('aria-labelledby', 'how-to-play-heading');
        }
    }
    lastFocusBeforeModal = document.activeElement;
    modalEl.classList.add('active');
    modalPush('how-to');
    document.getElementById('how-to-play-close-btn').focus();
}

function hideHowToPlayModal() {
    if (modalStack.length && modalStack[modalStack.length - 1] === 'how-to') {
        history.back();
    } else {
        document.getElementById('how-to-play-modal').classList.remove('active');
    }
}

function handleSwapConfirm() {
    const modal = document.getElementById('swap-modal');
    const screenType = modal.dataset.screenType;
    
    if (screenType === 'normal') {
        // Swap chaos prompt and word
        currentChaosPrompt = getNextFromDeck(chaosDeck);
        currentWord = getRandomItem(gameData.words, currentWord);
        
        document.getElementById('chaos-title').textContent = currentChaosPrompt.title;
        document.getElementById('chaos-description').innerHTML = formatText(currentChaosPrompt.description);
        document.getElementById('word-text').textContent = currentWord;
        updateChaosCueChip(currentChaosPrompt);
        
        // Reset timer
        resetTimer();
    } else {
        // Swap duel
        currentDuel = getNextFromDeck(duelDeck);
        
        const duelTriggerEl = document.getElementById('duel-trigger');
        if (duelTriggerEl) {
            duelTriggerEl.textContent = 'Choose who you\'re dueling';
        }
        document.getElementById('duel-title').textContent = currentDuel.title;
        document.getElementById('duel-description').innerHTML = formatText(
            formatDuelDescriptionForSession(currentDuel.description)
        );

        // Reset category/letter and re-setup based on new duel
        duelCategoryRevealed = false;
        duelLetterRevealed = false;
        
        // Reset reveal section
        const revealText = document.getElementById('reveal-text');
        const revealValues = document.getElementById('reveal-values');
        const revealBtn = document.getElementById('reveal-btn');
        const revealSection = document.getElementById('duel-reveal-section');
        
        if (currentDuel.alphabetic) {
            currentDuelCategory = nextDuelCategory(currentDuel);
            currentDuelLetter = getRandomLetter();
            revealText.style.display = 'block';
            revealValues.style.display = 'none';
            revealValues.innerHTML = '';
            revealBtn.style.cursor = 'pointer';
            revealSection.style.display = 'block';
        } else if (currentDuel.title === 'Scavenge') {
            currentDuelCategory = nextDuelCategory(currentDuel);
            currentDuelLetter = null;
            revealText.style.display = 'block';
            revealValues.style.display = 'none';
            revealValues.innerHTML = '';
            revealBtn.style.cursor = 'pointer';
            revealSection.style.display = 'block';
        } else if (currentDuel.categories && currentDuel.categories.length > 0) {
            currentDuelCategory = nextDuelCategory(currentDuel);
            currentDuelLetter = null;
            revealText.style.display = 'block';
            revealValues.style.display = 'none';
            revealValues.innerHTML = '';
            revealBtn.style.cursor = 'pointer';
            revealSection.style.display = 'block';
        } else {
            currentDuelCategory = null;
            currentDuelLetter = null;
            revealText.style.display = 'none';
            revealValues.style.display = 'none';
            revealValues.innerHTML = '';
            revealBtn.style.cursor = 'default';
            revealSection.style.display = 'none'; // Hide completely when nothing to reveal
        }
    }
    
    hideSwapModal();
}

function startTimer() {
    if (timerRunning) {
        stopTimer();
        return;
    }
    
    // If timer hasn't started yet (showing sand timer emoji), initialize it
    const countdownEl = document.getElementById('timer-countdown');
    if (countdownEl && (countdownEl.textContent === '⏳' || countdownEl.textContent.trim() === '')) {
        timerSeconds = 33;
        progress = 0;
        const timerCircle = document.querySelector('.timer-circle');
        if (timerCircle) {
            timerCircle.style.strokeDashoffset = 100;
            timerCircle.style.stroke = 'var(--accent)';
        }
        if (countdownEl) {
            countdownEl.textContent = '33';
        }
    }
    
    timerRunning = true;
    
    // Start progress animation
    const totalSeconds = 33;
    const totalUpdates = totalSeconds * 10; // Update 10 times per second for smooth animation
    progress = ((33 - timerSeconds) / 33) * 100;
    
    if (progressInterval) {
        clearInterval(progressInterval);
    }
    
    progressInterval = setInterval(() => {
        progress += 100 / totalUpdates;
        const timerCircle = document.querySelector('.timer-circle');
        if (timerCircle) {
            const offset = 100 - progress;
            timerCircle.style.strokeDashoffset = offset;
        }
        
        if (progress >= 100) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
    }, 100);
    
    timerInterval = setInterval(() => {
        timerSeconds--;
        updateTimerDisplay();
        
        if (timerSeconds <= 0) {
            stopTimer();
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
    timerRunning = false;
}

function resetTimer() {
    stopTimer();
    timerSeconds = 33;
    progress = 0;
    const timerCircle = document.querySelector('.timer-circle');
    if (timerCircle) {
        timerCircle.style.strokeDashoffset = 100;
        timerCircle.style.stroke = 'var(--accent)';
    }
    const countdownEl = document.getElementById('timer-countdown');
    if (countdownEl) {
        countdownEl.textContent = '⏳';
        countdownEl.style.color = 'var(--accent)';
        countdownEl.classList.remove('time-up');
    }
    const flipTimer = document.getElementById('flip-timer');
    if (flipTimer) {
        flipTimer.classList.remove('time-up');
    }
}

function updateTimerDisplay() {
    const countdown = document.getElementById('timer-countdown');
    const timerCircle = document.querySelector('.timer-circle');
    const flipTimer = document.getElementById('flip-timer');
    
    if (countdown) {
        if (timerSeconds > 0) {
            countdown.textContent = timerSeconds;
        } else {
            countdown.textContent = '0';
        }
    }
    
    if (timerCircle) {
        // Calculate progress: 0% = full circle, 100% = empty
        const totalSeconds = 33;
        const progressPercent = ((totalSeconds - timerSeconds) / totalSeconds) * 100;
        const offset = 100 - progressPercent;
        timerCircle.style.strokeDashoffset = offset;
    }
    
    // Add time-up styling - turn whole circle red
    if (timerSeconds <= 0) {
        if (countdown) {
            countdown.style.color = '#c62828';
            countdown.classList.add('time-up');
        }
        if (timerCircle) {
            timerCircle.style.stroke = '#c62828';
        }
        if (flipTimer) {
            flipTimer.classList.add('time-up');
        }
    } else {
        if (countdown) {
            countdown.style.color = 'var(--accent)';
            countdown.classList.remove('time-up');
        }
        if (timerCircle) {
            timerCircle.style.stroke = 'var(--accent)';
        }
        if (flipTimer) {
            flipTimer.classList.remove('time-up');
        }
    }
}

function showScreen(screenName) {
    document.querySelectorAll('.screen').forEach(function (screen) {
        screen.classList.remove('active');
    });
    const el = document.getElementById(screenName + '-screen');
    if (el) {
        el.classList.add('active');
    }
    currentState = screenName;
    updateSessionChrome();
}

