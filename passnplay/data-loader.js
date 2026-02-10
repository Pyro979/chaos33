// Data loader for pass-and-play app
// Loads data from JSON files and filters by 'passnplay' tag

let gameData = {
    chaosPrompts: [],
    duels: [],
    words: [],
    duelCategories: null,
    duelTriggers: []
};

// Letters to avoid for Alpha Blitz
const AVOID_LETTERS = ['J', 'K', 'Q', 'V', 'X', 'Y', 'Z'];
const VALID_LETTERS = 'ABCDEFGHILMNOPRSTUW'.split('');

async function loadGameData() {
    try {
        // Data files are in chaos33/data/ (accessible as /data/ from site root)
        // From /passnplay/ the relative path is ../data/
        const basePath = '../data/';
        
        // Load all data files (already filtered for passnplay tag by generate.js)
        const [challengesData, duelsData, wordsData, categoriesData, triggersData] = await Promise.all([
            fetch(basePath + 'challenges.json').then(r => {
                if (!r.ok) throw new Error(`Failed to load challenges.json: ${r.status}`);
                return r.json();
            }),
            fetch(basePath + 'duels.json').then(r => {
                if (!r.ok) throw new Error(`Failed to load duels.json: ${r.status}`);
                console.log('Loading duels.json from:', r.url);
                return r.json();
            }).then(data => {
                console.log('Raw duels.json loaded:', data.length, 'items');
                console.log('Raw duel titles:', data.map(d => d.title));
                // Double-check filtering - filter again in case file wasn't properly filtered
                const filtered = data.filter(item => 
                    item.tags && item.tags.includes('passnplay') && !item.tags.includes('cut')
                );
                console.log('After client-side filter:', filtered.length, 'items');
                console.log('Filtered duel titles:', filtered.map(d => d.title));
                if (filtered.length !== data.length) {
                    console.warn('⚠️ WARNING: Client-side filtering removed', data.length - filtered.length, 'duels that should not be in the file!');
                }
                return filtered;
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
            })
        ]);

        // Data is already filtered for passnplay tag by generate.js, just map to format
        gameData.chaosPrompts = challengesData.map(item => ({
            title: item.title,
            description: item.text,
            cue: item.cue
        }));

        // Data is already filtered for passnplay tag by generate.js, just map to format
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
        
        // Store Duel Cues (filter for main tag)
        gameData.duelTriggers = triggersData
            .filter(item => item.tags && item.tags.includes('main') && !item.tags.includes('cut'))
            .map(item => ({
                card_text: item.card_text || item.text.replace(/^Duel:\s*/, ''),
                full_text: item.text || item.card_text || ''
            }));

        console.log('=== GAME DATA LOADED ===');
        console.log('Chaos Prompts:', gameData.chaosPrompts.length);
        console.log('Chaos Prompts titles:', gameData.chaosPrompts.map(p => p.title));
        console.log('\nDuels:', gameData.duels.length);
        console.log('Duel titles:', gameData.duels.map(d => d.title));
        console.log('All duel data:', gameData.duels);
        console.log('\nWords:', gameData.words.length);
        console.log('Sample words:', gameData.words.slice(0, 10));
        console.log('\nDuel Categories:', gameData.duelCategories);
        console.log('\nDuel Cues:', gameData.duelTriggers.length);
        console.log('Duel Cue texts:', gameData.duelTriggers.map(t => t.full_text || t.card_text));
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

