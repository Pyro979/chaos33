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
    duelDeck = createDeck(gameData.duels);
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
        document.getElementById('duel-description').innerHTML = formatText(currentDuel.description);
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
    if (turnHistoryStack.length === 0) {
        if (currentState === 'normal-turn' || currentState === 'duel' || currentState === 'goblin-mode') {
            stopTimer();
            resetTimer();
            lastScreenType = null;
            screenHistory = [];
            showScreen('next-player');
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

    // Set up event listeners
    document.getElementById('next-player-btn').addEventListener('click', handleNextPlayer);
    document.getElementById('next-player-normal-btn').addEventListener('click', handleNextPlayer);
    document.getElementById('next-player-duel-btn').addEventListener('click', handleNextPlayer);
    document.getElementById('next-player-goblin-btn').addEventListener('click', handleNextPlayer);

    document.querySelectorAll('.btn-turn-back').forEach((btn) => {
        btn.addEventListener('click', handleBack);
    });
    
    document.getElementById('swap-btn').addEventListener('click', () => showSwapModal('normal'));
    document.getElementById('swap-duel-btn').addEventListener('click', () => showSwapModal('duel'));
    
    document.getElementById('swap-cancel-btn').addEventListener('click', hideSwapModal);
    document.getElementById('swap-confirm-btn').addEventListener('click', handleSwapConfirm);
    
    document.getElementById('flip-timer').addEventListener('click', startTimer);
    
    document.getElementById('reveal-btn').addEventListener('click', handleReveal);
    document.getElementById('goblin-reveal-btn').addEventListener('click', handleGoblinReveal);
    
    // How to play modal
    document.getElementById('how-to-play-btn').addEventListener('click', showHowToPlayModal);
    document.getElementById('how-to-play-link-normal').addEventListener('click', (e) => {
        e.preventDefault();
        showHowToPlayModal();
    });
    document.getElementById('how-to-play-link-duel').addEventListener('click', (e) => {
        e.preventDefault();
        showHowToPlayModal();
    });
    document.getElementById('how-to-play-link-goblin').addEventListener('click', (e) => {
        e.preventDefault();
        showHowToPlayModal();
    });
    document.getElementById('how-to-play-close-btn').addEventListener('click', hideHowToPlayModal);
    document.getElementById('how-to-play-close-btn-bottom').addEventListener('click', hideHowToPlayModal);
    
    // Close modal when clicking outside
    document.getElementById('how-to-play-modal').addEventListener('click', (e) => {
        if (e.target.id === 'how-to-play-modal') {
            hideHowToPlayModal();
        }
    });
    
    // Start with next player screen
    showScreen('next-player');
    lastScreenType = null; // Reset on initial load
    screenHistory = []; // Reset history on initial load
    turnHistoryStack = [];
    
    // Initialize timer with clock emoji
    resetTimer();
}

function handleNextPlayer() {
    if (currentState === 'normal-turn' || currentState === 'duel' || currentState === 'goblin-mode') {
        turnHistoryStack.push(buildTurnSnapshot());
    }

    // Stop timer if running
    stopTimer();
    resetTimer();
    
    // Reset duel reveals
    duelCategoryRevealed = false;
    duelLetterRevealed = false;

    // Reset goblin reveals
    goblinCategoryRevealed = false;
    currentGoblinCategory = null;
    currentGoblinLetter = null;
    
    // Check if we need to force a duel (no duel in past 5 turns)
    const hasDuelInLast5 = screenHistory.some(type => type === 'duel');
    const mustForceDuel = screenHistory.length >= 5 && !hasDuelInLast5;
    
    // Decide: 25% chance for duel, 75% for normal turn
    // But avoid back-to-back duels, never start with a duel, and force duel if none in last 5
    // Goblin Mode: ~10% chance, never back-to-back, never on first turn
    let isDuel = false;
    let isGoblinMode = false;
    const hasGoblinCards = gameData.goblinModes && gameData.goblinModes.length > 0;
    if (mustForceDuel) {
        isDuel = true;
    } else if (lastScreenType !== 'duel' && lastScreenType !== null) {
        const roll = Math.random();
        if (hasGoblinCards && lastScreenType !== 'goblin-mode' && roll < 0.10) {
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
    
    // Update history (keep only last 5)
    screenHistory.push(lastScreenType);
    if (screenHistory.length > 5) {
        screenHistory.shift();
    }
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
    
    // Update UI
    const duelTriggerEl = document.getElementById('duel-trigger');
    if (duelTriggerEl) {
        duelTriggerEl.textContent = 'Choose who you\'re dueling';
    }
    document.getElementById('duel-title').textContent = currentDuel.title;
    document.getElementById('duel-description').innerHTML = formatText(currentDuel.description);
    
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
    
    modal.classList.add('active');
    modal.dataset.screenType = screenType;
}

function hideSwapModal() {
    document.getElementById('swap-modal').classList.remove('active');
}

function showHowToPlayModal() {
    document.getElementById('how-to-play-modal').classList.add('active');
}

function hideHowToPlayModal() {
    document.getElementById('how-to-play-modal').classList.remove('active');
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
        document.getElementById('duel-description').innerHTML = formatText(currentDuel.description);
        
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
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show requested screen
    document.getElementById(`${screenName}-screen`).classList.add('active');
    currentState = screenName;
}

