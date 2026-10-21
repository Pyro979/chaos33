(() => {
  'use strict';
  const catalog = window.XENOPHYTE;
  const $ = id => document.getElementById(id);
  const types = { sun: 'Starting star', asteroid: 'Asteroid', galaxy: 'Solar space', portal: 'Wormhole', biohazard: 'Dead space' };
  const storageKey = 'xenophyte-level-editor-v1';
  const coordinates = [];
  for (let row = 11; row >= 1; row--) for (let col = 0; col < 11; col++) coordinates.push(`${String.fromCharCode(65 + col)}${row}`);
  const validCoordinates = new Set(coordinates);
  const clone = value => JSON.parse(JSON.stringify(value));
  const title = id => id.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
  let state = { name: 'New level', backgroundId: 'dark-starfield', pieces: {} };
  let tool = null, selected = null, drag = null;
  const past = [], future = [];
  const cells = new Map();
  function message(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
  function validate(input) {
    if (!input || typeof input !== 'object' || !input.pieces || typeof input.pieces !== 'object' || Array.isArray(input.pieces)) throw Error('Include a pieces object with arrays of cell coordinates.');
    const pieces = {}, occupied = new Set();
    for (const [type, positions] of Object.entries(input.pieces)) {
      if (!Object.hasOwn(types, type)) throw Error(`Unknown item type: ${type}`);
      if (!Array.isArray(positions)) throw Error(`${type} must contain an array of coordinates.`);
      for (const coordinate of positions) {
        if (!validCoordinates.has(coordinate)) throw Error(`Invalid cell: ${coordinate}. Use A1 through K11.`);
        if (occupied.has(coordinate)) throw Error(`More than one item at ${coordinate}.`);
        occupied.add(coordinate);
      }
      pieces[type] = [...positions];
    }
    const backgroundId = input.backgroundId || 'dark-starfield';
    if (!catalog.backgrounds.some(background => background.id === backgroundId)) throw Error('Choose one of the available backgrounds.');
    if (input.id != null && (typeof input.id !== 'string' || !/^[a-z0-9-]+$/.test(input.id))) throw Error('Map ID must use lowercase letters, numbers, or hyphens.');
    return { ...(input.id ? { id: input.id } : {}), name: String(input.name || 'New level').slice(0, 100), backgroundId, pieces };
  }
  try { const saved = localStorage.getItem(storageKey); if (saved) state = validate(JSON.parse(saved)); } catch { message('Could not restore the saved layout. Starting with a blank field.'); }
  function occupant(coordinate) { return Object.keys(types).find(type => (state.pieces[type] || []).includes(coordinate)); }
  function remove(coordinate) { for (const type of Object.keys(types)) state.pieces[type] = (state.pieces[type] || []).filter(cell => cell !== coordinate); }
  function add(type, coordinate) { (state.pieces[type] ||= []).push(coordinate); }
  function commit(change) {
    const before = clone(state);
    change();
    if (JSON.stringify(before) === JSON.stringify(state)) return;
    past.push(before); if (past.length > 100) past.shift(); future.length = 0;
    render();
  }
  function layout() {
    const slug = state.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'new-level';
    return { game: 'xenophyte', id: state.id || slug, name: state.name, backgroundId: state.backgroundId,
      pieces: Object.fromEntries(Object.keys(types).map(type => [type, [...(state.pieces[type] || [])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))])) };
  }
  function syncSelection() {
    for (const button of $('palette').children) button.setAttribute('aria-pressed', String(button.dataset.type === tool));
    $('erase').setAttribute('aria-pressed', String(tool === 'erase'));
    for (const [coordinate, element] of cells) element.classList.toggle('selected', coordinate === selected);
    $('selection').textContent = selected ? `${types[occupant(selected)]}: ${selected}. Choose a destination or press Delete.` : tool === 'erase' ? 'Erase tool: select an occupied cell' : tool ? `${types[tool]}: select an empty cell` : 'Choose an item from the field kit';
  }
  function render() {
    let total = 0;
    for (const type of Object.keys(types)) { const count = (state.pieces[type] || []).length; $(`count-${type}`).textContent = count; total += count; }
    $('total').textContent = total; $('empty').textContent = 121 - total;
    $('name').value = state.name; $('map-label').textContent = state.name; $('background').value = state.backgroundId;
    $('board').style.backgroundImage = `url("assets/${state.backgroundId}.jpg")`;
    for (const [coordinate, element] of cells) {
      const type = occupant(coordinate);
      element.dataset.type = type || '';
      element.draggable = Boolean(type);
      element.setAttribute('aria-label', `${coordinate}: ${type ? types[type] : 'empty'}`);
      element.replaceChildren();
      const label = document.createElement('span'); label.className = 'coordinate'; label.textContent = coordinate; element.append(label);
      if (type) { const icon = document.createElement('img'); icon.src = catalog.icons[type]; icon.alt = ''; element.append(icon); }
    }
    if (selected && !occupant(selected)) selected = null;
    $('undo').disabled = !past.length; $('redo').disabled = !future.length;
    if (!$('json-panel').hidden && document.activeElement !== $('json')) $('json').value = JSON.stringify(layout(), null, 2);
    try { localStorage.setItem(storageKey, JSON.stringify(state)); $('saved').textContent = 'Saved in this browser'; }
    catch { $('saved').textContent = 'Browser storage unavailable. Copy to keep your work.'; }
    syncSelection();
  }
  function move(from, to) {
    const type = occupant(from), other = occupant(to);
    if (!type || from === to) return;
    commit(() => { remove(from); remove(to); add(type, to); if (other) add(other, from); selected = null; });
    message(other ? `Swapped ${from} and ${to}.` : `Moved ${types[type]} from ${from} to ${to}.`);
  }
  function place(type, coordinate) {
    if (occupant(coordinate)) { message(`${coordinate} is occupied. Move or erase its item first.`, true); return; }
    commit(() => { add(type, coordinate); selected = null; }); message(`Placed ${types[type]} at ${coordinate}.`);
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
    const icon = document.createElement('img'); icon.src = catalog.icons[type]; icon.alt = '';
    const label = document.createElement('span'); label.textContent = name;
    const count = document.createElement('strong'); count.id = `count-${type}`; count.textContent = '0';
    button.append(icon, label, count); $('palette').append(button);
    button.addEventListener('click', () => { tool = tool === type ? null : type; selected = null; syncSelection(); });
    button.addEventListener('dragstart', event => { drag = { type }; event.dataTransfer.setData('text/plain', type); event.dataTransfer.effectAllowed = 'copy'; });
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
    element.addEventListener('drop', event => { event.preventDefault(); element.classList.remove('drag-over'); if (!drag) return; if (drag.from) move(drag.from, coordinate); else if (types[drag.type]) place(drag.type, coordinate); drag = null; });
    element.addEventListener('dragend', () => { drag = null; document.querySelectorAll('.drag-over').forEach(cell => cell.classList.remove('drag-over')); });
    $('board').append(element); cells.set(coordinate, element);
  }
  for (const background of catalog.backgrounds) $('background').add(new Option(title(background.id), background.id));
  const mapTitle = map => /^map-\d+$/.test(map.id) ? `Map ${Number(map.id.slice(4))}` : map.name || map.id;
  for (const map of [...catalog.maps].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))) {
    $('preset').add(new Option(`${mapTitle(map)}${map.id === 'map-00' ? ' (empty)' : ''}`, map.id));
  }
  function openMap(mapId) {
    const map = catalog.maps.find(map => map.id === mapId);
    tool = null; selected = null;
    commit(() => { state.id = map.id; state.name = mapTitle(map); state.pieces = clone(map.pieces); });
    $('preset').value = map.id;
    syncSelection();
    message(`Editing ${state.name}. Move, add, or erase items, then copy the updated layout. Undo restores the previous field.`);
  }
  $('preset').value = catalog.maps.some(map => map.id === state.id) ? state.id : 'map-00';
  $('erase').addEventListener('click', () => { tool = tool === 'erase' ? null : 'erase'; selected = null; syncSelection(); });
  $('name').addEventListener('change', () => { const name = $('name').value.trim() || 'New level'; commit(() => { state.name = name; }); });
  $('background').addEventListener('change', () => { const background = $('background').value; commit(() => { state.backgroundId = background; }); });
  $('load').addEventListener('click', () => openMap($('preset').value));
  $('clear').addEventListener('click', () => { commit(() => { state.pieces = {}; selected = null; }); message('Field cleared. Undo restores your items.'); });
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
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
    if (event.key === 'Escape') { selected = null; tool = null; syncSelection(); }
    if ((event.key === 'Delete' || event.key === 'Backspace') && selected) { event.preventDefault(); commit(() => { remove(selected); selected = null; }); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
  });
  render();
})();
