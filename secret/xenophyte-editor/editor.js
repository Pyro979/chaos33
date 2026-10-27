(() => {
  'use strict';
  const catalog = window.XENOPHYTE;
  const $ = id => document.getElementById(id);
  const types = { sun: 'Starting star', asteroid: 'Asteroid', galaxy: 'Solar space', portal: 'Wormhole', biohazard: 'Dead space', whiteDie: 'White die' };
  const storageKey = 'xenophyte-level-editor-v1';
  const coordinates = [];
  for (let row = 11; row >= 1; row--) for (let col = 0; col < 11; col++) coordinates.push(`${String.fromCharCode(65 + col)}${row}`);
  const validCoordinates = new Set(coordinates);
  const clone = value => JSON.parse(JSON.stringify(value));
  const title = id => id.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
  let state = { name: 'New level', backgroundId: 'dark-starfield', pieces: {} };
  let tool = null, selected = null, drag = null, savedMaps = [], savedSnapshot = null;
  const past = [], future = [];
  const cells = new Map();
  function message(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
  function validate(input) {
    if (!input || typeof input !== 'object' || !input.pieces || typeof input.pieces !== 'object' || Array.isArray(input.pieces)) throw Error('Include a pieces object with arrays of cell coordinates.');
    const pieces = {}, occupied = new Set();
    for (const [type, positions] of Object.entries(input.pieces)) {
      if (!Object.hasOwn(types, type) || type === 'whiteDie') throw Error(`Unknown item type: ${type}`);
      if (!Array.isArray(positions)) throw Error(`${type} must contain an array of coordinates.`);
      for (const coordinate of positions) {
        if (!validCoordinates.has(coordinate)) throw Error(`Invalid cell: ${coordinate}. Use A1 through K11.`);
        if (occupied.has(coordinate)) throw Error(`More than one item at ${coordinate}.`);
        occupied.add(coordinate);
      }
      pieces[type] = [...positions];
    }
    const whiteDice = input.whiteDice ?? [];
    if (!Array.isArray(whiteDice)) throw Error('whiteDice must contain an array of dice with coordinate and value.');
    for (const die of whiteDice) {
      if (!die || !validCoordinates.has(die.coordinate)) throw Error(`Invalid cell: ${die?.coordinate}. Use A1 through K11.`);
      if (!Number.isInteger(die.value) || die.value < 1 || die.value > 6) throw Error('White die values must be whole numbers from 1 to 6.');
      if (occupied.has(die.coordinate)) throw Error(`More than one item at ${die.coordinate}.`);
      occupied.add(die.coordinate);
    }
    const backgroundId = input.backgroundId || 'dark-starfield';
    if (!catalog.backgrounds.some(background => background.id === backgroundId)) throw Error('Choose one of the available backgrounds.');
    if (input.id != null && (typeof input.id !== 'string' || !/^[a-z0-9-]+$/.test(input.id))) throw Error('Map ID must use lowercase letters, numbers, or hyphens.');
    return { ...(input.id ? { id: input.id } : {}), name: String(input.name || 'New level').slice(0, 100), backgroundId, pieces,
      whiteDice: whiteDice.map(({ coordinate, value }) => ({ coordinate, value })) };
  }
  try { const saved = localStorage.getItem(storageKey); if (saved) state = validate(JSON.parse(saved)); } catch { message('Could not restore the saved layout. Starting with a blank field.'); }
  function dieAt(coordinate) { return (state.whiteDice || []).find(die => die.coordinate === coordinate); }
  function occupant(coordinate) { return dieAt(coordinate) ? 'whiteDie' : Object.keys(state.pieces).find(type => state.pieces[type].includes(coordinate)); }
  function remove(coordinate) {
    for (const type of Object.keys(state.pieces)) state.pieces[type] = state.pieces[type].filter(cell => cell !== coordinate);
    if (state.whiteDice) state.whiteDice = state.whiteDice.filter(die => die.coordinate !== coordinate);
  }
  function add(type, coordinate, value = Number($('die-value').value)) {
    if (type === 'whiteDie') (state.whiteDice ||= []).push({ coordinate, value });
    else (state.pieces[type] ||= []).push(coordinate);
  }
  function dieIcon(value) {
    const pips = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]],
      4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
      6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.classList.add('die-icon'); icon.setAttribute('aria-hidden', 'true'); icon.setAttribute('viewBox', '0 0 100 100');
    icon.innerHTML = '<rect x="3" y="3" width="94" height="94" rx="16" fill="none" stroke="white" stroke-width="6"/>'
      + pips[value].map(([x, y]) => `<circle cx="${50 + x * 25}" cy="${50 + y * 25}" r="8" fill="white"/>`).join('');
    return icon;
  }
  function commit(change) {
    if (window.XenophytePlayback?.active) return;
    const before = clone(state);
    change();
    if (JSON.stringify(before) === JSON.stringify(state)) return;
    past.push(before); if (past.length > 100) past.shift(); future.length = 0;
    render();
  }
  function layout() {
    const slug = state.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'new-level';
    return { game: 'xenophyte', id: state.id || slug, name: state.name, backgroundId: state.backgroundId,
      pieces: Object.fromEntries(Object.keys(types).filter(type => type !== 'whiteDie').map(type => [type, [...(state.pieces[type] || [])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))])),
      ...((state.whiteDice || []).length ? { whiteDice: clone(state.whiteDice).sort((a, b) => a.coordinate.localeCompare(b.coordinate, undefined, { numeric: true })) } : {}) };
  }
  function syncSelection() {
    for (const button of $('palette').children) button.setAttribute('aria-pressed', String(button.dataset.type === tool));
    $('erase').setAttribute('aria-pressed', String(tool === 'erase'));
    for (const [coordinate, element] of cells) element.classList.toggle('selected', coordinate === selected);
    const itemName = selected && dieAt(selected) ? `White die (${dieAt(selected).value})` : types[occupant(selected)];
    $('selection').textContent = selected ? `${itemName}: ${selected}. Choose a destination or press Delete.` : tool === 'erase' ? 'Erase tool: select an occupied cell' : tool ? `${types[tool]}${tool === 'whiteDie' ? ` (${$('die-value').value})` : ''}: select an empty cell` : 'Choose an item from the field kit';
  }
  function render() {
    let total = 0;
    for (const type of Object.keys(types)) { const count = type === 'whiteDie' ? (state.whiteDice || []).length : (state.pieces[type] || []).length; $(`count-${type}`).textContent = count; total += count; }
    $('total').textContent = total; $('empty').textContent = 121 - total;
    $('name').value = state.name; $('map-label').textContent = state.name; $('background').value = state.backgroundId;
    $('board').style.backgroundImage = `url("assets/${state.backgroundId}.jpg")`;
    for (const [coordinate, element] of cells) {
      const type = occupant(coordinate);
      element.dataset.type = type || '';
      delete element.dataset.played;
      element.draggable = Boolean(type);
      element.setAttribute('aria-label', `${coordinate}: ${type ? types[type] : 'empty'}${type === 'whiteDie' ? `, value ${dieAt(coordinate).value}` : ''}`);
      element.replaceChildren();
      const label = document.createElement('span'); label.className = 'coordinate'; label.textContent = coordinate; element.append(label);
      if (type === 'whiteDie') element.append(dieIcon(dieAt(coordinate).value));
      else if (type) { const icon = document.createElement('img'); icon.src = catalog.icons[type]; icon.alt = ''; element.append(icon); }
    }
    if (selected && !occupant(selected)) selected = null;
    syncSaveStatus();
    $('undo').disabled = !past.length; $('redo').disabled = !future.length;
    if (!$('json-panel').hidden && document.activeElement !== $('json')) $('json').value = JSON.stringify(layout(), null, 2);
    try { localStorage.setItem(storageKey, JSON.stringify(state)); $('saved').textContent = 'Saved in this browser'; }
    catch { $('saved').textContent = 'Browser storage unavailable. Copy to keep your work.'; }
    syncSelection();
    window.XenophytePlayback?.layoutChanged();
  }
  function move(from, to) {
    const type = occupant(from), other = occupant(to);
    const value = dieAt(from)?.value, otherValue = dieAt(to)?.value;
    if (!type || from === to) return;
    commit(() => { remove(from); remove(to); add(type, to, value); if (other) add(other, from, otherValue); selected = null; });
    message(other ? `Swapped ${from} and ${to}.` : `Moved ${types[type]} from ${from} to ${to}.`);
  }
  function place(type, coordinate, value = Number($('die-value').value)) {
    if (occupant(coordinate)) { message(`${coordinate} is occupied. Move or erase its item first.`, true); return; }
    commit(() => { add(type, coordinate, value); selected = null; }); message(`Placed ${types[type]}${type === 'whiteDie' ? ` (${value})` : ''} at ${coordinate}.`);
  }
  function clickCell(coordinate) {
    if (tool === 'erase') { if (occupant(coordinate)) { commit(() => remove(coordinate)); message(`Cleared ${coordinate}.`); } return; }
    if (selected) { if (selected === coordinate) { selected = null; syncSelection(); } else move(selected, coordinate); return; }
    if (occupant(coordinate)) { selected = coordinate; tool = null; syncSelection(); return; }
    if (tool) place(tool, coordinate);
    else message('Choose an item from the field kit first.');
  }
  for (const [type, name] of Object.entries(types)) {
    const button = document.createElement('button'); button.className = 'tool'; button.draggable = true; button.dataset.type = type;
    const icon = type === 'whiteDie' ? dieIcon(1) : document.createElement('img');
    if (type !== 'whiteDie') { icon.src = catalog.icons[type]; icon.alt = ''; }
    const label = document.createElement('span'); label.textContent = name;
    const count = document.createElement('strong'); count.id = `count-${type}`; count.textContent = '0';
    button.append(icon, label, count); $('palette').append(button);
    button.addEventListener('click', () => { tool = tool === type ? null : type; selected = null; syncSelection(); });
    button.addEventListener('dragstart', event => { drag = { type, value: Number($('die-value').value) }; event.dataTransfer.setData('text/plain', type); event.dataTransfer.effectAllowed = 'copy'; });
    button.addEventListener('dragend', () => { drag = null; });
  }
  for (let col = 0; col < 11; col++) { const span = document.createElement('span'); span.textContent = String.fromCharCode(65 + col); $('top-axis').append(span); }
  for (let row = 11; row >= 1; row--) { const span = document.createElement('span'); span.textContent = row; $('left-axis').append(span); }
  for (const coordinate of coordinates) {
    const element = document.createElement('button'); element.className = 'cell'; element.dataset.coordinate = coordinate;
    element.addEventListener('click', () => clickCell(coordinate));
    element.addEventListener('dragstart', event => { if (!occupant(coordinate)) { event.preventDefault(); return; } drag = { from: coordinate }; event.dataTransfer.setData('text/plain', coordinate); event.dataTransfer.effectAllowed = 'move'; });
    element.addEventListener('dragover', event => { if (drag) { event.preventDefault(); element.classList.add('drag-over'); } });
    element.addEventListener('dragleave', () => element.classList.remove('drag-over'));
    element.addEventListener('drop', event => { event.preventDefault(); element.classList.remove('drag-over'); if (!drag) return; if (drag.from) move(drag.from, coordinate); else if (types[drag.type]) place(drag.type, coordinate, drag.value); drag = null; });
    element.addEventListener('dragend', () => { drag = null; document.querySelectorAll('.drag-over').forEach(cell => cell.classList.remove('drag-over')); });
    $('board').append(element); cells.set(coordinate, element);
  }
  for (const background of catalog.backgrounds) $('background').add(new Option(title(background.id), background.id));
  const mapTitle = map => /^map-\d+$/.test(map.id) ? `Map ${Number(map.id.slice(4))}` : map.name || map.id;
  const byId = (a, b) => a.id.localeCompare(b.id, undefined, { numeric: true });
  const isSaved = id => savedMaps.some(map => map.id === id);
  function fillPresets() {
    const value = $('preset').value;
    const builtIn = document.createElement('optgroup'); builtIn.label = 'Built-in maps';
    for (const map of [...catalog.maps].sort(byId)) builtIn.append(new Option(`${mapTitle(map)}${map.id === 'map-00' ? ' (empty)' : ''}`, map.id));
    const saved = document.createElement('optgroup'); saved.label = 'Saved maps';
    for (const map of [...savedMaps].sort(byId)) saved.append(new Option(map.name || map.id, map.id));
    $('preset').replaceChildren(builtIn, ...(savedMaps.length ? [saved] : []));
    $('preset').value = value;
  }
  fillPresets();
  function openMap(mapId) {
    const saved = savedMaps.find(map => map.id === mapId), map = saved || catalog.maps.find(map => map.id === mapId);
    tool = null; selected = null;
    commit(() => { state.id = map.id; state.name = saved ? map.name || map.id : mapTitle(map); state.backgroundId = map.backgroundId || state.backgroundId; state.pieces = clone(map.pieces); state.whiteDice = clone(map.whiteDice || []); });
    savedSnapshot = saved ? JSON.stringify(layout()) : null; syncSaveStatus();
    $('preset').value = map.id;
    syncSelection();
    message(`Editing ${state.name}. Move, add, or erase items, then copy the updated layout. Undo restores the previous field.`);
  }
  $('preset').value = catalog.maps.some(map => map.id === state.id) ? state.id : 'map-00';
  function syncSaveStatus() {
    if (!isSaved(state.id)) { $('save-status').textContent = 'Not saved to a file yet. Save stores it in games/xenoseed/editor-maps/.'; $('save-status').classList.remove('dirty'); return; }
    const dirty = JSON.stringify(layout()) !== savedSnapshot;
    $('save-status').textContent = `${dirty ? 'Unsaved changes to' : 'Saved as'} editor-maps/${state.id}.json`; $('save-status').classList.toggle('dirty', dirty);
  }
  async function postMap(map, overwrite) {
    const response = await fetch('/api/xenophyte/maps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ layout: map, overwrite }) });
    return { status: response.status, data: await response.json() };
  }
  async function saveMap(asNew) {
    if (window.XenophytePlayback?.active) return;
    let map = layout();
    if (asNew || !isSaved(state.id)) {
      const name = prompt('Save map as', isSaved(state.id) ? `${state.name} copy` : state.name)?.trim();
      if (!name) return;
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'new-level';
      map = { ...map, id, name: name.slice(0, 100) };
    }
    try {
      let { status, data } = await postMap(map, !asNew && map.id === state.id && isSaved(state.id));
      if (status === 409) {
        if (!confirm(`${data.error} Replace it?`)) return;
        ({ status, data } = await postMap(map, true));
      }
      if (status !== 200) throw Error(data.error || 'Could not save the map.');
      savedMaps = data.maps;
      commit(() => { state.id = map.id; state.name = map.name; });
      savedSnapshot = JSON.stringify(layout());
      fillPresets(); $('preset').value = map.id; syncSaveStatus();
      message(`Saved ${map.name} to ${data.path}.`);
    } catch (error) { message(error.message === 'Failed to fetch' ? 'Saving needs the local Python editor server.' : error.message, true); }
  }
  $('save').addEventListener('click', () => saveMap(false));
  $('save-as').addEventListener('click', () => saveMap(true));
  fetch('/api/xenophyte/maps').then(r => r.ok ? r.json() : { maps: [] }).then(data => {
    savedMaps = data.maps || []; fillPresets();
    if (isSaved(state.id)) { $('preset').value = state.id; savedSnapshot = JSON.stringify(savedMaps.find(map => map.id === state.id)); }
    syncSaveStatus();
  }).catch(() => { $('save').disabled = $('save-as').disabled = true; $('save-status').textContent = 'Saving needs the local Python editor server.'; });
  $('erase').addEventListener('click', () => { tool = tool === 'erase' ? null : 'erase'; selected = null; syncSelection(); });
  $('die-value').addEventListener('change', () => {
    const value = Number($('die-value').value);
    document.querySelector('[data-type="whiteDie"].tool .die-icon').replaceWith(dieIcon(value));
    tool = 'whiteDie'; selected = null; syncSelection();
  });
  $('name').addEventListener('change', () => { const name = $('name').value.trim() || 'New level'; commit(() => { state.name = name; }); });
  $('background').addEventListener('change', () => { const background = $('background').value; commit(() => { state.backgroundId = background; }); });
  $('load').addEventListener('click', () => openMap($('preset').value));
  function stepMap(delta) {
    const options = [...$('preset').options], index = options.findIndex(option => option.value === $('preset').value);
    openMap(options[(index + delta + options.length) % options.length].value);
  }
  $('prev-map').addEventListener('click', () => stepMap(-1));
  $('next-map').addEventListener('click', () => stepMap(1));
  $('clear').addEventListener('click', () => { commit(() => { state.pieces = {}; state.whiteDice = []; selected = null; }); message('Field cleared. Undo restores your items.'); });
  function undo() { if (!past.length) return; future.push(clone(state)); state = past.pop(); selected = null; render(); message('Change undone.'); }
  function redo() { if (!future.length) return; past.push(clone(state)); state = future.pop(); selected = null; render(); message('Change restored.'); }
  $('undo').addEventListener('click', undo); $('redo').addEventListener('click', redo);
  $('show-json').addEventListener('click', () => { $('json-panel').hidden = !$('json-panel').hidden; $('show-json').setAttribute('aria-expanded', String(!$('json-panel').hidden)); if (!$('json-panel').hidden) $('json').value = JSON.stringify(layout(), null, 2); });
  $('import').addEventListener('click', () => { try { const imported = validate(JSON.parse($('json').value)); commit(() => { state = imported; selected = null; }); message('Layout imported.'); } catch (error) { message(error.message, true); } });
  $('copy').addEventListener('click', async () => {
    const text = JSON.stringify(layout(), null, 2);
    try { await navigator.clipboard.writeText(text); message('Layout copied. Paste it into our chat.'); $('copy').textContent = 'Copied ✓'; setTimeout(() => { $('copy').textContent = 'Copy layout ↗'; }, 1800); }
    catch { $('json-panel').hidden = false; $('show-json').setAttribute('aria-expanded', 'true'); $('json').value = text; $('json').focus(); $('json').select(); message('Clipboard access is unavailable. Copy the selected JSON with Ctrl+C or Command+C.'); }
  });
  document.addEventListener('keydown', event => {
    if (window.XenophytePlayback.active) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
    if (event.key === 'Escape') { selected = null; tool = null; syncSelection(); }
    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); stepMap(event.key === 'ArrowLeft' ? -1 : 1); }
    if ((event.key === 'Delete' || event.key === 'Backspace') && selected) { event.preventDefault(); commit(() => { remove(selected); selected = null; }); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveMap(event.shiftKey); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
  });
  render();
  window.XenophytePlayback.attach({ getLayout: layout, restore: render, cells, dieIcon });
  window.XenophyteBatches.attach({ getLayout: layout });
})();
