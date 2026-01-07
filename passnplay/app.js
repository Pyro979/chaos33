// Main app logic for pass-and-play game

let currentState = 'next-player'; // 'next-player', 'normal-turn', 'duel'
let lastScreenType = null; // Track last screen to avoid back-to-back duels
let lastChaosPrompt = null;
let lastWord = null;
let lastDuel = null;

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
let currentDuelCategory = null;
let currentDuelLetter = null;
let duelCategoryRevealed = false;
let duelLetterRevealed = false;

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
    // Set up event listeners
    document.getElementById('next-player-btn').addEventListener('click', handleNextPlayer);
    document.getElementById('next-player-normal-btn').addEventListener('click', handleNextPlayer);
    document.getElementById('next-player-duel-btn').addEventListener('click', handleNextPlayer);
    
    document.getElementById('swap-btn').addEventListener('click', () => showSwapModal('normal'));
    document.getElementById('swap-duel-btn').addEventListener('click', () => showSwapModal('duel'));
    
    document.getElementById('swap-cancel-btn').addEventListener('click', hideSwapModal);
    document.getElementById('swap-confirm-btn').addEventListener('click', handleSwapConfirm);
    
    document.getElementById('timer-start-btn').addEventListener('click', startTimer);
    document.getElementById('timer-reset-btn').addEventListener('click', resetTimer);
    
    document.getElementById('reveal-btn').addEventListener('click', handleReveal);
    
    // Start with next player screen
    showScreen('next-player');
    lastScreenType = null; // Reset on initial load
}

function handleNextPlayer() {
    // Stop timer if running
    stopTimer();
    resetTimer();
    
    // Reset duel reveals
    duelCategoryRevealed = false;
    duelLetterRevealed = false;
    
    // Decide: 25% chance for duel, 75% for normal turn
    // But avoid back-to-back duels and never start with a duel
    let isDuel = false;
    if (lastScreenType !== 'duel' && lastScreenType !== null) {
        // Only allow duel if we've had at least one normal turn
        isDuel = Math.random() < 0.25;
    }
    // If last was a duel or this is the first turn, force normal turn
    
    if (isDuel) {
        startDuel();
        lastScreenType = 'duel';
    } else {
        startNormalTurn();
        lastScreenType = 'normal-turn';
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
    // Get new random items
    currentChaosPrompt = getRandomItem(gameData.chaosPrompts, lastChaosPrompt);
    currentWord = getRandomItem(gameData.words, lastWord);
    
    // Update last items
    lastChaosPrompt = currentChaosPrompt;
    lastWord = currentWord;
    
    // Update UI
    document.getElementById('chaos-title').textContent = currentChaosPrompt.title;
    document.getElementById('chaos-description').innerHTML = formatText(currentChaosPrompt.description);
    document.getElementById('word-text').textContent = currentWord;
    
    // Reset timer display
    timerSeconds = 33;
    updateTimerDisplay();
    
    showScreen('normal-turn');
}

function startDuel() {
    // Get random duel
    currentDuel = getRandomItem(gameData.duels, lastDuel);
    lastDuel = currentDuel;
    
    // Update UI
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
    
    // Determine what to reveal based on duel type
    if (currentDuel.title === 'Alpha Blitz') {
        // Alpha Blitz: needs category and letter
        currentDuelCategory = getRandomCategory(currentDuel.categories.length > 0 
            ? currentDuel.categories 
            : gameData.duelCategories.alphaBlitz);
        currentDuelLetter = getRandomLetter();
        revealText.style.display = 'block';
        revealValues.style.display = 'none';
        revealValues.innerHTML = '';
        revealBtn.style.cursor = 'pointer';
        revealSection.style.display = 'block';
    } else if (currentDuel.title === 'Theme Blitz') {
        // Theme Blitz: needs category only
        currentDuelCategory = getRandomCategory(currentDuel.categories.length > 0 
            ? currentDuel.categories 
            : gameData.duelCategories.themeBlitz);
        currentDuelLetter = null;
        revealText.style.display = 'block';
        revealValues.style.display = 'none';
        revealValues.innerHTML = '';
        revealBtn.style.cursor = 'pointer';
        revealSection.style.display = 'block';
    } else if (currentDuel.title === 'Scavenge') {
        // Scavenge: needs category from scavenge list
        currentDuelCategory = getRandomCategory(gameData.duelCategories.scavenge);
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

function handleSwapConfirm() {
    const modal = document.getElementById('swap-modal');
    const screenType = modal.dataset.screenType;
    
    if (screenType === 'normal') {
        // Swap chaos prompt and word
        currentChaosPrompt = getRandomItem(gameData.chaosPrompts, currentChaosPrompt);
        currentWord = getRandomItem(gameData.words, currentWord);
        
        document.getElementById('chaos-title').textContent = currentChaosPrompt.title;
        document.getElementById('chaos-description').innerHTML = formatText(currentChaosPrompt.description);
        document.getElementById('word-text').textContent = currentWord;
        
        // Reset timer
        stopTimer();
        timerSeconds = 33;
        updateTimerDisplay();
    } else {
        // Swap duel
        currentDuel = getRandomItem(gameData.duels, currentDuel);
        
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
        
        if (currentDuel.title === 'Alpha Blitz') {
            currentDuelCategory = getRandomCategory(currentDuel.categories.length > 0 
                ? currentDuel.categories 
                : gameData.duelCategories.alphaBlitz);
            currentDuelLetter = getRandomLetter();
            revealText.style.display = 'block';
            revealValues.style.display = 'none';
            revealValues.innerHTML = '';
            revealBtn.style.cursor = 'pointer';
            revealSection.style.display = 'block';
        } else if (currentDuel.title === 'Theme Blitz') {
            currentDuelCategory = getRandomCategory(currentDuel.categories.length > 0 
                ? currentDuel.categories 
                : gameData.duelCategories.themeBlitz);
            currentDuelLetter = null;
            revealText.style.display = 'block';
            revealValues.style.display = 'none';
            revealValues.innerHTML = '';
            revealBtn.style.cursor = 'pointer';
            revealSection.style.display = 'block';
        } else if (currentDuel.title === 'Scavenge') {
            currentDuelCategory = getRandomCategory(gameData.duelCategories.scavenge);
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
    
    timerRunning = true;
    document.getElementById('timer-start-btn').textContent = 'Stop';
    
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
    document.getElementById('timer-start-btn').textContent = 'Start';
}

function resetTimer() {
    stopTimer();
    timerSeconds = 33;
    progress = 0;
    const timerCircle = document.querySelector('.timer-circle');
    if (timerCircle) {
        timerCircle.style.strokeDashoffset = 100;
    }
    const countdownEl = document.getElementById('timer-countdown');
    if (countdownEl) {
        countdownEl.style.color = 'var(--accent)';
        countdownEl.classList.remove('time-up');
    }
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const countdown = document.getElementById('timer-countdown');
    const timerCircle = document.querySelector('.timer-circle');
    
    if (countdown) {
        countdown.textContent = timerSeconds > 0 ? timerSeconds : 0;
    }
    
    if (timerCircle) {
        // Calculate progress: 0% = full circle, 100% = empty
        const totalSeconds = 33;
        const progressPercent = ((totalSeconds - timerSeconds) / totalSeconds) * 100;
        const offset = 100 - progressPercent;
        timerCircle.style.strokeDashoffset = offset;
    }
    
    // Add time-up styling
    if (timerSeconds <= 0) {
        const countdownEl = document.getElementById('timer-countdown');
        if (countdownEl) {
            countdownEl.style.color = '#c62828';
            countdownEl.classList.add('time-up');
        }
    } else {
        const countdownEl = document.getElementById('timer-countdown');
        if (countdownEl) {
            countdownEl.style.color = 'var(--accent)';
            countdownEl.classList.remove('time-up');
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

