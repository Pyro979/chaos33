/* Presentation only. All decisions, legality and scoring come from Python. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const names = ['Red', 'Blue', 'Green', 'Purple'];
  const colors = ['#bc3345', '#2768bc', '#23825b', '#7b41b4'];
  const interval = () => Number($('play-speed').value);
  let editor, active = false, paused = false, timer, request, generation = 0;
  let replay, placements, index = 0, latestCell, ready = false;
  let lastReplay;
  const disabled = new Map();
  function status(text, error=false) { $('play-status').textContent=text; $('play-status').classList.toggle('error',error); }

  function lock() {
    document.querySelector('.workspace').classList.add('watching');
    document.querySelectorAll('.workspace button,.workspace input,.workspace select,.workspace textarea').forEach(el => {
      disabled.set(el, el.disabled); el.disabled = true;
    });
  }
  function unlock() {
    document.querySelector('.workspace').classList.remove('watching');
    disabled.forEach((value, el) => { el.disabled = value; }); disabled.clear();
    editor.restore();
  }
  function stop() {
    generation++; clearTimeout(timer); request?.abort(); request = null;
    active = false; paused = false; replay = null;
    if (latestCell) latestCell.classList.remove('latest-placement'); latestCell = null;
    unlock(); $('play-controls').hidden = true; $('play-scores').replaceChildren();
    $('play-progress').textContent = ''; $('play-summary').textContent = '';
    document.querySelectorAll('[data-play]').forEach(el => { el.disabled = false; });
  }
  function scores(rows) {
    const table = document.createElement('table');
    const header = table.createTHead().insertRow();
    ['Player / turn order', 'Adjacency', 'Majority', 'Asteroid', 'Total VP'].forEach(text => {
      const th = document.createElement('th'); th.scope = 'col'; th.textContent = text; header.append(th);
    });
    const body = table.createTBody();
    rows.forEach(s => {
      const row = body.insertRow(); const label = row.insertCell();
      const chip = document.createElement('span'); chip.className = 'player-chip'; chip.style.background = colors[s.player];
      label.append(chip, `${names[s.player]} (${(s.player - replay.result.first_player + replay.players) % replay.players + 1})`);
      ['adjacency_vp', 'majority_vp', 'asteroid_vp', 'vp'].forEach(k => { row.insertCell().textContent = s[k]; });
    });
    $('play-scores').replaceChildren(table);
  }
  function finish() {
    clearTimeout(timer); $('play-pause').hidden = true; $('play-download').hidden = false;
    const r = replay.result;
    const winner = r.winners.map(p => names[p]).join(' + ');
    $('play-progress').textContent = r.status === 'completed'
      ? `${winner} ${r.winners.length === 1 ? 'wins' : 'tie'}! ${placements.length} dice placed.`
      : `Game stopped: ${r.reason}. No winner awarded.`;
    $('selection').textContent = $('play-progress').textContent;
    status($('play-progress').textContent,r.status!=='completed');
    scores(r.players);
    const species = r.players.reduce((a,p) => a+p.species_placed, 0);
    const anomalies = r.players.reduce((a,p) => a+p.anomaly_placed, 0);
    const rerolls = r.players.reduce((a,p) => a+p.reroll_batches, 0);
    const contested = r.stars.filter(s => s.contested).length;
    const tied = r.stars.filter(s => s.tied_majority).length;
    $('play-summary').textContent = `${r.turns_played} turns · ${species} Species + ${anomalies} Anomalies · ${rerolls} rerolls · ${contested}/${r.stars.length} Suns contested · ${tied} tied Suns · Seed ${replay.seed}`;
  }
  function step() {
    if (!active || paused) return;
    if (index >= placements.length) { finish(); return; }
    const move = placements[index++]; const cell = editor.cells.get(move.cell);
    if (latestCell) latestCell.classList.remove('latest-placement'); latestCell = cell;
    const die = document.createElement('span'); die.className = `played-die ${move.kind}`;
    die.style.setProperty('--player-color', colors[move.player]); die.append(editor.dieIcon(move.value));
    die.title = `${names[move.player]} ${move.kind}, ${move.value}, ${move.cell}`;
    cell.append(die); cell.classList.add('latest-placement'); cell.dataset.played = 'true';
    cell.setAttribute('aria-label', die.title);
    $('play-progress').textContent = `Round ${move.round}/${replay.result.rounds_scheduled} · ${names[move.player]} · ${move.kind === 'anomaly' ? 'Anomaly' : 'Species'} ${move.value} at ${move.cell} · ${index}/${placements.length}`;
    $('selection').textContent = $('play-progress').textContent;
    scores(move.scores);
    if (index === placements.length) finish(); else if(interval()===0) step(); else timer = setTimeout(step, interval());
  }
  async function play(players) {
    if (!ready) { await connect(); if(!ready) return; }
    stop(); active = true; lock(); const token = generation;
    $('play-controls').hidden = false; $('play-pause').hidden = true; $('play-download').hidden = true;
    $('play-progress').textContent = 'Python bots are playing this layout...';
    $('selection').textContent = $('play-progress').textContent;
    status('Python bots are computing...');
    document.querySelectorAll('[data-play]').forEach(el => { el.disabled = true; });
    request = new AbortController();
    try {
      const response = await fetch('/api/xenophyte/play', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players, layout: editor.getLayout() }), signal: request.signal });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Could not simulate this layout.');
      if (token !== generation) return;
      replay = data; placements = data.events.filter(e => e.type === 'placement'); index = 0;
      lastReplay=data; $('play-copy').hidden=false;
      try { sessionStorage.setItem('xenophyte-last-replay',JSON.stringify(data)); } catch {}
      scores(Array.from({ length: players }, (_,player) => ({player, adjacency_vp:0, majority_vp:0, asteroid_vp:0, vp:0})));
      $('play-pause').hidden = false; $('play-pause').textContent = 'Pause';
      $('play-summary').textContent = `First: ${names[data.result.first_player]} · ${data.policy} · provisional majority VP can change.`;
      status(`Playing ${players}P. Pause or return to the editor above.`);
      timer = setTimeout(step, interval());
    } catch (error) {
      if (token !== generation || error.name === 'AbortError') return;
      stop(); $('play-progress').textContent = error.message; status(error.message,true);
    }
  }
  async function connect() {
    document.querySelectorAll('[data-play]').forEach(el => { el.disabled = true; });
    try {
      const r = await fetch('/api/xenophyte/health', {signal:AbortSignal.timeout(3000)}); const data = await r.json();
      if (!r.ok || !data.ready) throw Error('Unavailable');
      ready = true;
      status('Python connected');
      $('play-connection').textContent = 'Python simulator connected. Uses the throughput-v4.1 bots (v3 plus anomaly holding and blocking values).';
      document.querySelectorAll('[data-play]').forEach(el => { el.disabled = false; });
    } catch {
      ready=false;
      status('Python unavailable. Open the local editor on port 8765.',true);
      $('play-connection').textContent = 'To play with Python bots, run tools\\start-xenophyte-editor.cmd and use the local editor tab it opens.';
      const link = document.createElement('a'); link.href = 'http://127.0.0.1:8765/secret/xenophyte-editor/';
      link.textContent = ' Open local editor'; $('play-connection').append(link);
      const headerLink=link.cloneNode(true);$('play-status').append(headerLink);
      document.querySelectorAll('[data-play]').forEach(el => { el.disabled = false; });
    }
  }
  window.XenophytePlayback = {
    get active() { return active; },
    layoutChanged() {
      if (!active && ready) { status('Python connected'); $('play-progress').textContent = ''; }
    },
    attach(api) {
      editor = api;
      document.querySelectorAll('[data-play]').forEach(button => button.addEventListener('click', () => play(Number(button.dataset.play))));
      $('play-stop').addEventListener('click', stop);
      $('play-pause').addEventListener('click', () => {
        paused = !paused; $('play-pause').textContent = paused ? 'Resume' : 'Pause';
        clearTimeout(timer); if (!paused) timer = setTimeout(step, interval());
      });
      $('play-speed').addEventListener('change',()=>{if(active&&replay&&index<placements.length&&!paused){clearTimeout(timer);timer=setTimeout(step,interval());}});
      try {lastReplay=JSON.parse(sessionStorage.getItem('xenophyte-last-replay'));if(lastReplay)$('play-copy').hidden=false;}catch{}
      $('play-copy').addEventListener('click',async()=>{
        if(!lastReplay)return;
        const text=JSON.stringify(lastReplay,null,2);
        try {await navigator.clipboard.writeText(text);status('Game log copied, including bot evaluations.');}
        catch {const box=$('play-log');box.hidden=false;box.value=text;box.focus();box.select();status('Select the game log below and press Ctrl+C.');}
      });
      $('play-download').addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(replay, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob); const link = document.createElement('a');
        link.href = url; link.download = `xenophyte-${replay.players}p-${replay.seed}.json`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
      connect();
    }
  };
})();
