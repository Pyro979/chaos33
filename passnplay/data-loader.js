// Data loader for pass-and-play app
// Loads data from JSON files (prepared by generate.js copyDataFiles)

let gameData = {
    chaosPrompts: [],
    duels: [],
    words: [],
    goblinWords: [],
    duelCategories: null,
    duelTriggers: [],
    duelTriggerPresets: []
};

// Letters to avoid for Alpha Blitz
const AVOID_LETTERS = ['J', 'K', 'Q', 'V', 'X', 'Y', 'Z'];
const VALID_LETTERS = 'ABCDEFGHILMNOPRSTUW'.split('');

function buildDuelTriggerPresets(categoriesData) {
    const sc = categoriesData.scavenge || [];
    const al = categoriesData.alphaBlitz || [];
    const th = categoriesData.themeBlitz || [];
    const st = categoriesData.starBlitz || [];
    const n = Math.max(sc.length, al.length, th.length, st.length, 1);
    const out = [];
    for (let i = 0; i < n; i++) {
        out.push({
            scavenge: sc[i % sc.length] || '',
            alphaBlitz: al[i % al.length] || '',
            themeBlitz: th[i % th.length] || '',
            starBlitz: st[i % st.length] || ''
        });
    }
    return out;
}

/** Goblin word pool: legacy string[] or { rank, word }[] → strings sorted by rank. */
function normalizeGoblinWordsForPlay(entries) {
    if (!Array.isArray(entries)) return [];
    const rows = entries.map((e, i) => {
        if (typeof e === 'string') {
            return { rank: i + 1, word: e };
        }
        const word = e != null && e.word != null ? String(e.word) : '';
        const rank = e != null && e.rank != null ? Number(e.rank) : i + 1;
        return { rank, word };
    });
    rows.sort((a, b) => a.rank - b.rank);
    return rows.map((r) => r.word).filter(Boolean);
}

async function loadGameData() {
    try {
        const basePath = '../data/';

        const [challengesData, duelsData, wordsData, categoriesData, triggersData, goblinWordsData] =
            await Promise.all([
                fetch(basePath + 'challenges.json').then(r => {
                    if (!r.ok) throw new Error(`Failed to load challenges.json: ${r.status}`);
                    return r.json();
                }),
                fetch(basePath + 'duels.json').then(r => {
                    if (!r.ok) throw new Error(`Failed to load duels.json: ${r.status}`);
                    return r.json();
                }),
                fetch(basePath + 'words.json').then(r => {
                    if (!r.ok) throw new Error(`Failed to load words.json: ${r.status}`);
                    return r.json();
                }),
                fetch(basePath + 'duel_categories.json').then(r => {
                    if (!r.ok) throw new Error(`Failed to load duel_categories.json: ${r.status}`);
                    return r.json();
                }),
                fetch(basePath + 'duel_triggers.json').then(r => {
                    if (!r.ok) throw new Error(`Failed to load duel_triggers.json: ${r.status}`);
                    return r.json();
                }),
                fetch(basePath + 'goblin_words.json').then(r => {
                    if (!r.ok) throw new Error(`Failed to load goblin_words.json: ${r.status}`);
                    return r.json();
                })
            ]);

        gameData.chaosPrompts = challengesData.map(item => ({
            title: item.title,
            description: item.text,
            cue: item.cue
        }));

        gameData.duels = duelsData.map(item => ({
            title: item.title,
            description: item.text || item.web_description || '',
            categories: item.categories || [],
            alphabetic: item.alphabetic || false,
            requiresJudge: Boolean(item.requiresJudge),
            chaosDuel: Boolean(item.chaosDuel),
            chaosPrompt: item.chaosPrompt || false,
            minPlayers: item.minPlayers,
            category: item.category || false,
            scavenge: item.scavenge || false,
            themeCategory: item.themeCategory || false,
            starBlitz: item.starBlitz || false
        }));

        gameData.words = wordsData[0]?.words || [];
        gameData.goblinWords = normalizeGoblinWordsForPlay(goblinWordsData.words || []);
        gameData.duelCategories = categoriesData;
        gameData.duelTriggerPresets = buildDuelTriggerPresets(categoriesData);

        gameData.duelTriggers = triggersData
            .filter(item => item.tags && item.tags.includes('main') && !item.tags.includes('cut'))
            .map(item => ({
                card_text: item.card_text || item.text.replace(/^Duel:\s*/, ''),
                full_text: item.text || item.card_text || ''
            }));

        console.log('=== GAME DATA LOADED ===');
        console.log('Chaos Prompts:', gameData.chaosPrompts.length);
        console.log('Duels (incl. Chaos Duels):', gameData.duels.length);
        console.log('Words:', gameData.words.length);
        console.log('Goblin words:', gameData.goblinWords.length);
        console.log('Duel trigger presets:', gameData.duelTriggerPresets.length);
        console.log('========================');

        return gameData;
    } catch (error) {
        console.error('Error loading game data:', error);
        throw error;
    }
}

function getRandomItem(array, lastItem = null) {
    if (array.length === 0) return null;
    if (array.length === 1) return array[0];

    let item;
    do {
        item = array[Math.floor(Math.random() * array.length)];
    } while (item === lastItem && array.length > 1);

    return item;
}

function shuffleArray(array) {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
    return arr;
}

function createDeck(array) {
    if (!array || array.length === 0) {
        return { items: [], index: 0 };
    }
    return { items: shuffleArray(array), index: 0 };
}

function getNextFromDeck(deck) {
    if (!deck || !deck.items || deck.items.length === 0) {
        return null;
    }
    if (deck.index >= deck.items.length) {
        const lastItem = deck.items[deck.items.length - 1];
        deck.items = shuffleArray(deck.items);
        if (deck.items.length > 1 && deck.items[0] === lastItem) {
            const swapIdx = Math.floor(Math.random() * (deck.items.length - 1)) + 1;
            const tmp = deck.items[0];
            deck.items[0] = deck.items[swapIdx];
            deck.items[swapIdx] = tmp;
        }
        deck.index = 0;
    }
    return deck.items[deck.index++];
}

function getRandomLetter() {
    return VALID_LETTERS[Math.floor(Math.random() * VALID_LETTERS.length)];
}

function getRandomCategory(categoryList) {
    if (!categoryList || categoryList.length === 0) return null;
    return categoryList[Math.floor(Math.random() * categoryList.length)];
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        loadGameData,
        getRandomItem,
        getRandomLetter,
        getRandomCategory,
        shuffleArray,
        createDeck,
        getNextFromDeck,
        gameData
    };
}
