# 33 Seconds of Chaos - Pass & Play

A pass-and-play web app for "33 Seconds of Chaos" that runs entirely in the browser.

## Overview

This is a mobile-first, single-page web application that provides a digital pass-and-play experience for the game. Players take turns on a shared device, with the app randomly selecting content and managing the game flow.

## Features

- **Two-screen gameplay loop**: Next Player → Normal Turn or Duel
- **Normal Turn**: Shows a Chaos Prompt, a Word, and a 33-second timer
- **Duel Screen**: Shows duel instructions with optional hidden category/letter
- **Swap functionality**: Swap current content with confirmation
- **25% duel probability**: Each "Next player" press has a 25% chance of triggering a duel
- **Simple repeat avoidance**: Avoids showing the same item twice in a row

## How to Run Locally

### Option 1: NPM Script (Recommended)

From the repository root:

```bash
npm start
```

Or:

```bash
npm run serve
```

This starts a simple HTTP server on port 8000. Open your browser to:
```
http://localhost:8000/passnplay/
```

To use a different port:
```bash
PORT=3000 npm start
```

### Option 2: Simple HTTP Server

1. Navigate to the repository root:
   ```bash
   cd /path/to/mve-chaos33
   ```

2. Start a simple HTTP server. Choose one:

   **Python 3:**
   ```bash
   python -m http.server 8000
   ```

   **Python 2:**
   ```bash
   python -m SimpleHTTPServer 8000
   ```

   **Node.js (with http-server):**
   ```bash
   npx http-server -p 8000
   ```

   **PHP:**
   ```bash
   php -S localhost:8000
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:8000/passnplay/
   ```

### Option 3: VS Code Live Server

If you're using VS Code with the Live Server extension:

1. Right-click on `chaos33/passnplay/index.html`
2. Select "Open with Live Server"

## Entry Route

The main entry point is:
- **File**: `chaos33/passnplay/index.html`
- **URL**: `/passnplay/` (when served from the `chaos33` directory)

## Data Sources

The app loads data from JSON files in the `/data/` directory at the repository root:

- **Challenges** (source: `data/chaos33/challenges.json`; app uses `chaos33/data/challenges.json` after build): Chaos prompts filtered by `passnplay` tag
- **Duels** (source: `data/chaos33/duels.json`): Duel cards filtered by `passnplay` tag
- **Words** (source: `data/chaos33/words.json`): Word list for normal turns
- **Duel Categories** (source: `data/chaos33/duel_categories.json`): Categories for Alpha Blitz, Theme Blitz, and Scavenge duels

### Data Filtering

All content is filtered to only include items tagged with `passnplay` (and excludes items tagged with `cut`):

- **Chaos Prompts**: Must have `passnplay` tag
- **Duels**: Must have `passnplay` tag
- **Words**: All words from the word list are available

### Duel-Specific Data

- **Alpha Blitz**: Uses categories from the duel's `categories` array, or falls back to `duel_categories.json` → `alphaBlitz` array. Requires both a category and a random letter (avoiding J, K, Q, V, X, Y, Z).
- **Theme Blitz**: Uses categories from the duel's `categories` array, or falls back to `duel_categories.json` → `themeBlitz` array. Requires only a category.
- **Scavenge**: Uses categories from `duel_categories.json` → `scavenge` array. Requires only a category.

## File Structure

```
chaos33/passnplay/
├── index.html          # Main HTML entry point
├── styles.css          # App-specific styles (matches main site)
├── data-loader.js      # Data loading and filtering logic
├── app.js              # Main game logic and state management
└── README.md           # This file
```

## Game Flow

1. **Next Player Screen**: Shows a "Next player" button
2. **Random Decision**: 25% chance for duel, 75% for normal turn
3. **Normal Turn Screen**:
   - Chaos Prompt (constraint for giving clues)
   - Word (single word to clue)
   - 33-second timer (starts manually, shows "Time!" at 0)
   - Swap button (top-right)
   - Next player button (bottom)
4. **Duel Screen**:
   - Duel title and instructions
   - Optional hidden category/letter (tap to reveal)
   - Swap button (top-right)
   - Next player button (bottom)

## Technical Details

- **Pure JavaScript**: No build step required, runs directly in the browser
- **Mobile-first**: Responsive design optimized for mobile devices
- **No scrolling**: All content fits on a single card view
- **No state persistence**: Game state resets on page refresh
- **No player tracking**: No names, scores, or round tracking

## Browser Compatibility

Works in all modern browsers that support:
- ES6+ JavaScript (async/await, fetch API)
- CSS Grid and Flexbox
- CSS Custom Properties (variables)

## Notes

- Timer does not make sound when it reaches 0
- Swap confirmation modal prevents accidental swaps
- Hidden category/letter resets when navigating away or swapping
- Simple repeat avoidance: won't show the same item twice in a row for each content type

