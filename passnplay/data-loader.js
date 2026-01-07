// Data loader for pass-and-play app
// Loads data from JSON files and filters by 'pnp' tag

let gameData = {
    chaosPrompts: [],
    duels: [],
    words: [],
    duelCategories: null
};

// Letters to avoid for Alpha Blitz
const AVOID_LETTERS = ['J', 'K', 'Q', 'V', 'X', 'Y', 'Z'];
const VALID_LETTERS = 'ABCDEFGHILMNOPRSTUW'.split('');

async function loadGameData() {
    try {
        // Data files are in chaos33/data/ (accessible as /data/ from site root)
        // From /passnplay/ the relative path is ../data/
        const basePath = '../data/';
        
        // Load all data files (already filtered for pnp tag by generate.js)
        const [challengesData, duelsData, wordsData, categoriesData] = await Promise.all([
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
            })
        ]);

        // Data is already filtered for pnp tag by generate.js, just map to format
        gameData.chaosPrompts = challengesData.map(item => ({
            title: item.title,
            description: item.text
        }));

        // Data is already filtered for pnp tag by generate.js, just map to format
        gameData.duels = duelsData.map(item => ({
            title: item.title,
            description: item.text || item.web_description || '',
            categories: item.categories || [],
            alphabetic: item.alphabetic || false
        }));

        // Extract words (single word list)
        gameData.words = wordsData[0]?.words || [];

        // Store duel categories
        gameData.duelCategories = categoriesData;

        console.log('Game data loaded:', {
            chaosPrompts: gameData.chaosPrompts.length,
            duels: gameData.duels.length,
            words: gameData.words.length
        });

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

function getRandomLetter() {
    return VALID_LETTERS[Math.floor(Math.random() * VALID_LETTERS.length)];
}

function getRandomCategory(categoryList) {
    if (!categoryList || categoryList.length === 0) return null;
    return categoryList[Math.floor(Math.random() * categoryList.length)];
}

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { loadGameData, getRandomItem, getRandomLetter, getRandomCategory, gameData };
}

