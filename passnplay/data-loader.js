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
        // Load all data files
        const [challengesData, duelsData, wordsData, categoriesData] = await Promise.all([
            fetch('../../data/challenges.json').then(r => r.json()),
            fetch('../../data/duels.json').then(r => r.json()),
            fetch('../../data/words.json').then(r => r.json()),
            fetch('../../data/duel_categories.json').then(r => r.json())
        ]);

        // Filter challenges by pnp tag
        gameData.chaosPrompts = challengesData.filter(item => 
            item.tags && item.tags.includes('pnp') && !item.tags.includes('cut')
        ).map(item => ({
            title: item.title,
            description: item.text
        }));

        // Filter duels by pnp tag
        gameData.duels = duelsData.filter(item => 
            item.tags && item.tags.includes('pnp') && !item.tags.includes('cut')
        ).map(item => ({
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

