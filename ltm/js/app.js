import { loadCatalog } from './catalog.js';
import {
  createState,
  startNewFlight,
  selectCharacter,
  toggleDraftSelection,
  confirmDraft,
  totalSlotsUsed,
  clickContinueRoad,
  dispatchRoadResolution,
  submitChoice,
  submitPeopleOr,
  submitR15,
  submitFreeRoad,
  submitNoneRoad,
  confirmPickRoadFind,
  applyGuardsman,
  revealConvictPeople,
  choiceOverflow,
  peopleOrOverflow,
  readPersonalBest,
  resetFlightFromWin,
  overflowChoice
} from './game.js';
import { isObstacleEvent } from './resolution.js';

const appEl = document.getElementById('app');

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

/** Full theme block for road / resolve panels */
function themedRoadCardHtml(def) {
  const title = def.title || def.name || def.id;
  const flavor = def.flavor || '';
  return `
    <div class="card-theme card-theme--road">
      <div class="card-theme__heading">${esc(def.id)} · ${esc(title)}</div>
      ${flavor ? `<blockquote class="card-theme__flavor">“${esc(flavor)}”</blockquote>` : ''}
      <div class="card-theme__rules">${esc(def.text || '')}</div>
    </div>
  `;
}

function roadSlotInnerHtml(id) {
  const c = state.catalog.roadById[id];
  const title = c.title || id;
  const flavor = c.flavor || '';
  return `
    <div class="road-face">
      <span class="road-face__id">${esc(id)}</span>
      <span class="road-face__title">${esc(title)}</span>
      ${flavor ? `<span class="road-face__flavor">${esc(flavor)}</span>` : ''}
      <span class="road-face__rules">${esc(c.text || '')}</span>
    </div>`;
}

function draftSlotsSelected(state) {
  let slots = 0;
  for (const id of state.draftSelected) {
    slots += state.catalog.startingById[id].slots ?? 0;
  }
  return slots;
}

function updateHud() {
  const hud = document.getElementById('ltm-hud');
  if (!hud || !state) return;
  if (!state.run) {
    hud.hidden = true;
    hud.innerHTML = '';
    document.body.classList.remove('with-run-hud');
    return;
  }

  const r = state.run;
  const driveMax = r.driveMax;
  const driveCur = r.drive;
  let slotUsed;
  let slotMax;

  if (state.phase === 'draft') {
    slotUsed = draftSlotsSelected(state);
    slotMax = r.character.slots;
  } else {
    const su = totalSlotsUsed(state);
    slotUsed = su.used;
    slotMax = su.max;
  }

  const luckNote =
    r.luckBlocked && state.phase !== 'draft'
      ? '<div class="ltm-hud__extra">Luck blocked (M10)</div>'
      : '';

  hud.hidden = false;
  document.body.classList.add('with-run-hud');
  hud.innerHTML = `
    <div class="ltm-hud__stat">Drive <span>${esc(driveCur)}</span> / ${esc(driveMax)}</div>
    <div class="ltm-hud__stat">Slots <span>${esc(slotUsed)}</span> / ${esc(slotMax)}</div>
    ${luckNote}
    <div class="ltm-hud__extra">${esc(r.character.name)}${
      state.phase === 'draft' ? ' · Drafting loadout' : ''
    }</div>
  `;
}

let state = null;

function render() {
  if (!state) return;
  const pb = readPersonalBest();
  const flightRuns = state.flight?.runsTaken ?? 0;

  if (state.phase === 'character') {
    updateHud();
    appEl.innerHTML = renderCharacter(pb, flightRuns);
    wireCharacter();
    return;
  }
  if (state.phase === 'draft') {
    updateHud();
    appEl.innerHTML = renderDraft(pb, flightRuns);
    wireDraft();
    return;
  }
  if (state.phase === 'road') {
    updateHud();
    appEl.innerHTML = renderRoad(pb, flightRuns);
    wireRoad();
    return;
  }
  if (state.phase === 'resolve') {
    updateHud();
    appEl.innerHTML =
      renderRoadStripOnly(pb, flightRuns) +
      `<div class="effect-stack">${renderResolve()}</div>` +
      renderHandPanel(pb, flightRuns);
    wireRoad();
    wireResolve();
    return;
  }
  if (state.phase === 'pick_find') {
    updateHud();
    appEl.innerHTML =
      renderRoadStripOnly(pb, flightRuns) +
      `<div class="effect-stack">${renderPickFind()}</div>` +
      renderHandPanel(pb, flightRuns);
    wireRoad();
    wirePickFind();
    return;
  }
  if (state.phase === 'win') {
    updateHud();
    appEl.innerHTML = renderWin(pb);
    wireWin();
    return;
  }
}

function header(pb, flightRuns) {
  return `
    <header class="panel site-header">
      <div class="site-header__intro">
        <h1 style="margin:0">Luck in the Time of Misery</h1>
        <p class="small" style="margin:0.25rem 0 0">Flight runs this attempt: <strong>${flightRuns}</strong>
        · Personal best (lowest runs): <strong>${pb != null ? pb : '-'}</strong></p>
      </div>
      <div class="site-header__actions">
        <button type="button" class="btn btn-secondary" id="btn-reset-flight">New flight</button>
      </div>
    </header>
  `;
}

function renderCharacter(pb, flightRuns) {
  const chars = state.catalog.characters;
  return `
    ${header(pb, flightRuns)}
    <section class="panel">
      <h2 style="margin-top:0">Choose character</h2>
      <div class="stats-grid">
        ${chars
          .map(
            (c) => `
          <button type="button" class="char-card" data-char="${esc(c.id)}">
            <strong>${esc(c.name)}</strong>
            <div class="small">Drive ${c.drive} · Slots ${c.slots}</div>
            <div class="small">Draw: ${c.startingDraw.finds} Finds, ${c.startingDraw.luck} Luck, ${c.startingDraw.misery} Misery</div>
            <div class="small">${esc(c.specialText)}</div>
          </button>`
          )
          .join('')}
      </div>
    </section>
  `;
}

function wireCharacter() {
  document.getElementById('btn-reset-flight')?.addEventListener('click', () => {
    startNewFlight(state);
    render();
  });
  document.querySelectorAll('.char-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectCharacter(state, btn.getAttribute('data-char'));
      render();
    });
  });
}

function renderDraft(pb, flightRuns) {
  const ch = state.run.character;
  const sel = state.draftSelected;
  const pool = state.draftPool;
  let slots = 0;
  for (const id of sel) {
    slots += state.catalog.startingById[id].slots ?? 0;
  }
  const ok = slots <= ch.slots;
  return `
    ${header(pb, flightRuns)}
    <section class="panel">
      <h2 style="margin-top:0">Starting loadout - ${esc(ch.name)}</h2>
      <p class="small">Pick cards up to ${ch.slots} slots total (selected ${slots} / ${ch.slots}). Tap a card to toggle. Full text below each id.</p>
      <div class="draft-grid">
        ${pool
          .map((id) => {
            const d = state.catalog.startingById[id];
            const picked = sel.has(id);
            return `
            <button type="button" class="draft-card ${picked ? 'picked' : ''}" data-draft="${esc(id)}">
              <span class="draft-card__title">${esc(d.title || id)}</span>
              <span class="draft-card__meta">${esc(id)} · ${d.slots ?? 0} slot(s)</span>
              ${d.flavor ? `<p class="draft-card__flavor">“${esc(d.flavor)}”</p>` : ''}
              <p class="draft-card__desc">${esc(d.text)}</p>
            </button>`;
          })
          .join('')}
      </div>
      <div class="row" style="margin-top:1rem">
        <button type="button" class="btn" id="btn-draft-confirm" ${ok ? '' : 'disabled'}>Begin run</button>
      </div>
    </section>
  `;
}

function wireDraft() {
  document.getElementById('btn-reset-flight')?.addEventListener('click', () => {
    startNewFlight(state);
    render();
  });
  document.querySelectorAll('.draft-card').forEach((el) => {
    el.addEventListener('click', () => {
      toggleDraftSelection(state, el.getAttribute('data-draft'));
      render();
    });
  });
  document.getElementById('btn-draft-confirm')?.addEventListener('click', () => {
    if (!confirmDraft(state)) {
      alert('Too many slots selected.');
      return;
    }
    render();
  });
}

function roadSlotsHtml() {
  const order = state.flight.roadOrder;
  const cur = state.roadIndex;
  let html = '<div class="road-scroll"><div class="road-row">';
  for (let i = 0; i < 20; i++) {
    const id = order[i];
    const meta = state.slotMeta[i];
    const cacheN = state.cache[i]?.length ?? 0;
    const faceUp =
      i < cur ||
      (['resolve', 'pick_find'].includes(state.phase) && i === cur);
    let cls = 'road-slot';
    if (i < cur) cls += ' past';
    else cls += ' future';
    if (i === cur && state.phase !== 'win') cls += ' current';
    if (meta.oneTimeCleared) cls += ' cleared';
    const face = faceUp ? roadSlotInnerHtml(id) : `<span class="road-face road-face--back">?</span>`;
    html += `<div class="${cls}">${face}${
      cacheN ? `<span class="cache-badge">${cacheN}</span>` : ''
    }</div>`;
  }
  html += '</div></div>';
  return html;
}

/** Header + road strip only (no hand, no resolve). */
function renderRoadStripOnly(pb, flightRuns) {
  const r = state.run;
  const luckBlk = r.luckBlocked ? ' <span class="small">· Luck blocked (M10)</span>' : '';
  return `
    ${header(pb, flightRuns)}
    <section class="panel panel--road-strip">
      <div class="row" style="justify-content:space-between;flex-wrap:wrap">
        <div>
          <strong>${esc(r.character.name)}</strong>${luckBlk}
        </div>
        <div class="stat"><strong>Road</strong> - card ${Math.min(state.roadIndex + 1, 20)} / 20</div>
      </div>
      ${roadSlotsHtml()}
      ${
        state.phase === 'road'
          ? `<p class="small road-strip-hint" style="margin:0.75rem 0 0">Use the <strong>Next</strong> button (bottom-right) to flip the next card.</p>`
          : ''
      }
    </section>
  `;
}

function renderRoadFab() {
  return `<button type="button" class="ltm-fab" id="btn-fab-flip" aria-label="Flip next road card"><span class="ltm-fab__arrow" aria-hidden="true">→</span><span class="ltm-fab__text">Next</span></button>`;
}

/** Items / Luck / Misery - shown below road (and below effect panel when resolving). */
function renderHandPanel(pb, flightRuns) {
  const r = state.run;
  const padFab = state.phase === 'road' ? 'style="padding-bottom:4.5rem"' : '';
  return `
    <section class="panel panel--hand" ${padFab}>
      <h3 style="margin-top:0">Items</h3>
      <ul class="small hand-list">${r.items.map((i) => renderItemRow(i)).join('') || '<li>None</li>'}</ul>
      <h3>Luck</h3>
      <ul class="small tag-luck hand-list">${r.luck.map((l) => renderLuckRow(l)).join('') || '<li>None</li>'}</ul>
      <h3>Misery</h3>
      <ul class="small tag-misery hand-list">${r.misery.map((m) => renderMiseryRow(m)).join('') || '<li>None</li>'}</ul>
    </section>
  `;
}

function renderRoad(pb, flightRuns) {
  return renderRoadStripOnly(pb, flightRuns) + renderRoadFab() + renderHandPanel(pb, flightRuns);
}

function renderLuckRow(l) {
  const d = state.catalog.luckById[l.defId];
  const title = d.title || d.name || l.defId;
  return `<li class="hand-item">
    <strong>${esc(l.defId)} · ${esc(title)}</strong>
    ${d.flavor ? `<div class="hand-flavor">“${esc(d.flavor)}”</div>` : ''}
    <div class="hand-rules">${esc(d.text)}</div>
  </li>`;
}

function renderMiseryRow(m) {
  const d = state.catalog.miseryById[m.defId];
  const title = d.title || d.name || m.defId;
  return `<li class="hand-item">
    <strong>${esc(m.defId)} · ${esc(title)}</strong>
    ${d.flavor ? `<div class="hand-flavor">“${esc(d.flavor)}”</div>` : ''}
    <div class="hand-rules">${esc(d.text)}</div>
  </li>`;
}

function renderItemRow(inst) {
  const def = state.catalog.startingById[inst.defId] || state.catalog.findsById[inst.defId];
  const title = def.title || def.name || inst.defId;
  return `<li class="hand-item">
    <strong>${esc(inst.defId)} · ${esc(title)}</strong>
    <span class="hand-item__charges">(${inst.charges})</span>
    ${def.flavor ? `<div class="hand-flavor">“${esc(def.flavor)}”</div>` : ''}
    <div class="hand-rules">${esc(def.text)}</div>
  </li>`;
}

function wireRoad() {
  document.getElementById('btn-reset-flight')?.addEventListener('click', () => {
    startNewFlight(state);
    render();
  });
  const flipNext = () => {
    clickContinueRoad(state);
    render();
  };
  document.getElementById('btn-fab-flip')?.addEventListener('click', flipNext);
}

function collectOpts() {
  const nextR = parseInt(document.getElementById('opt-next')?.value || '0', 10) || 0;
  const anyR = parseInt(document.getElementById('opt-any')?.value || '0', 10) || 0;
  const bypassEl = document.getElementById('opt-bypass');
  const bypassUid = bypassEl?.value || '';
  const payBypass = document.getElementById('opt-bypass-check')?.checked;
  const f15 = document.getElementById('opt-f15')?.checked;
  return {
    nextReduction: nextR,
    anyReduction: anyR,
    bypass: !!payBypass && !!bypassUid,
    bypassUid: payBypass ? bypassUid : null,
    f15PeopleReduction: !!f15
  };
}

function renderResolve() {
  const pr = state.pendingResolution;
  const def = pr.def;
  const r = def.resolve;
  const t = r.type;
  const obstacle = isObstacleEvent(def);
  let inner = '';

  if (t === 'payDrive') {
    inner = `
      <section class="panel resolve-form resolve-panel">
        <h2 style="margin-top:0">Resolve</h2>
        ${themedRoadCardHtml(def)}
        ${pr.convictReveal ? `<p class="small">Convict: reveal cost - base Drive portion ≈ <strong>${pr.peopleCostReveal ?? '?'}</strong></p>` : ''}
        ${pr.guardsmanAvailable ? `<button type="button" class="btn btn-secondary" id="btn-guardsman">Use Guardsman (−2 hazard)</button>` : ''}
        ${pr.convictReveal ? `<button type="button" class="btn btn-secondary" id="btn-convict">Reveal people cost (once)</button>` : ''}
        <label>Reduce next event cost (already queued) <input type="number" id="opt-next" min="0" value="0" /></label>
        <label>Reduce this event (any-item pool) <input type="number" id="opt-any" min="0" value="0" /></label>
        ${obstacle ? `<label><input type="checkbox" id="opt-bypass-check" /> Bypass obstacle with item</label>
          <select id="opt-bypass"><option value="">-</option>${state.run.items
            .filter((i) => {
              const d = state.catalog.startingById[i.defId] || state.catalog.findsById[i.defId];
              return d.abilities?.use?.some((x) => x.bypassObstacle);
            })
            .map((i) => `<option value="${esc(i.uid)}">${esc(i.defId)}</option>`)
            .join('')}</select>` : ''}
        ${def.kind === 'people' ? `<label><input type="checkbox" id="opt-f15" /> Apply F15 (−2 people cost)</label>` : ''}
        <div class="row" style="margin-top:0.75rem">
          <button type="button" class="btn" id="btn-resolve-pay">Confirm pay</button>
        </div>
        <p class="small">Enter reductions from items you are spending this resolution.</p>
      </section>
    `;
  } else if (t === 'choice') {
    const ov = choiceOverflow(state, {});
    inner = `
      <section class="panel resolve-panel">
        <h2 style="margin-top:0">Choice</h2>
        ${themedRoadCardHtml(def)}
        ${ov ? `<p class="tag-misery">Cannot fulfill either branch - click Overflow.</p>` : ''}
        <div class="row">
          <button type="button" class="btn" id="btn-ch-0">Pay Drive option</button>
          <button type="button" class="btn btn-secondary" id="btn-ch-1">Discard items option</button>
          <button type="button" class="btn btn-danger" id="btn-ch-overflow">Overflow</button>
        </div>
        <p class="small">Discard uses the first N items in your list order.</p>
      </section>
    `;
  } else if (t === 'peopleOr') {
    const ov = peopleOrOverflow(state, {}, false);
    inner = `
      <section class="panel resolve-panel">
        <h2 style="margin-top:0">People</h2>
        ${themedRoadCardHtml(def)}
        ${ov ? `<p class="tag-misery">Cannot pay or discard - use Overflow.</p>` : ''}
        <label><input type="checkbox" id="opt-f15" /> F15 people −2</label>
        <div class="row">
          <button type="button" class="btn" id="btn-po-pay">Pay Drive</button>
          <button type="button" class="btn btn-secondary" id="btn-po-disc">Discard ${r.orDiscardItems} item(s)</button>
          <button type="button" class="btn btn-danger" id="btn-po-overflow">Overflow</button>
        </div>
      </section>
    `;
  } else if (t === 'r15choice') {
    inner = `
      <section class="panel resolve-panel">
        <h2 style="margin-top:0">People</h2>
        ${themedRoadCardHtml(def)}
        <div class="row">
          <button type="button" class="btn" id="btn-r15a">Discard 1 + 2 finds keep 1</button>
          <button type="button" class="btn btn-secondary" id="btn-r15b">Pass</button>
        </div>
      </section>
    `;
  } else if (t === 'free') {
    inner = `
      <section class="panel resolve-panel">
        <h2 style="margin-top:0">${esc(def.name)}</h2>
        ${themedRoadCardHtml(def)}
        <button type="button" class="btn" id="btn-free">Resolve</button>
      </section>
    `;
  } else if (t === 'none') {
    inner = `
      <section class="panel resolve-panel">
        <h2 style="margin-top:0">${esc(def.name)}</h2>
        ${themedRoadCardHtml(def)}
        <button type="button" class="btn" id="btn-none">Continue</button>
      </section>
    `;
  }

  return inner;
}

function wireResolve() {
  document.getElementById('btn-reset-flight')?.addEventListener('click', () => {
    startNewFlight(state);
    render();
  });
  document.getElementById('btn-guardsman')?.addEventListener('click', () => {
    applyGuardsman(state);
    render();
  });
  document.getElementById('btn-convict')?.addEventListener('click', () => {
    revealConvictPeople(state);
    render();
  });
  document.getElementById('btn-resolve-pay')?.addEventListener('click', () => {
    const ok = dispatchRoadResolution(state, collectOpts());
    if (!ok && state.phase === 'character') render();
    else render();
  });
  document.getElementById('btn-ch-overflow')?.addEventListener('click', () => {
    overflowChoice(state);
    render();
  });

  document.getElementById('btn-ch-0')?.addEventListener('click', () => {
    submitChoice(state, { optionIndex: 0, opts: collectOpts() });
    render();
  });
  document.getElementById('btn-ch-1')?.addEventListener('click', () => {
    const r = state.pendingResolution.def.resolve;
    const n = r.options[1].discardItems;
    const uids = state.run.items.slice(0, n).map((i) => i.uid);
    submitChoice(state, { optionIndex: 1, discardUids: uids, opts: collectOpts() });
    render();
  });

  document.getElementById('btn-po-pay')?.addEventListener('click', () => {
    submitPeopleOr(state, {
      usePay: true,
      opts: collectOpts(),
      f15PeopleReduction: document.getElementById('opt-f15')?.checked
    });
    render();
  });
  document.getElementById('btn-po-overflow')?.addEventListener('click', () => {
    overflowChoice(state);
    render();
  });

  document.getElementById('btn-po-disc')?.addEventListener('click', () => {
    const n = state.pendingResolution.def.resolve.orDiscardItems;
    const uids = state.run.items.slice(0, n).map((i) => i.uid);
    submitPeopleOr(state, {
      usePay: false,
      discardUids: uids,
      opts: collectOpts(),
      f15PeopleReduction: document.getElementById('opt-f15')?.checked
    });
    render();
  });

  document.getElementById('btn-r15a')?.addEventListener('click', () => {
    const u = state.run.items[0]?.uid;
    if (!u) {
      alert('No item to discard.');
      return;
    }
    submitR15(state, { branch: 'a', discardUids: [u] });
    render();
  });
  document.getElementById('btn-r15b')?.addEventListener('click', () => {
    submitR15(state, { branch: 'b' });
    render();
  });

  document.getElementById('btn-free')?.addEventListener('click', () => {
    submitFreeRoad(state);
    render();
  });
  document.getElementById('btn-none')?.addEventListener('click', () => {
    submitNoneRoad(state);
    render();
  });
}

function renderPickFind() {
  const pk = state.pickRoadFind;
  if (!pk) return '';
  const cat = state.catalog;
  return `
    <section class="panel pick-find-section">
      <h2 style="margin-top:0">Keep one Road Find</h2>
      <p class="small">Read each card, then tap the one to keep.</p>
      <div class="pick-find-grid">
        ${pk.candidates
          .map((id) => {
            const d = cat.findsById[id];
            const title = d.title || d.name || id;
            const txt = d ? d.text : '';
            return `
            <button type="button" class="pick-find-card pick-find" data-id="${esc(id)}">
              <span class="pick-find-card__id">${esc(id)} · ${esc(title)}</span>
              ${d.flavor ? `<p class="pick-find-card__flavor">“${esc(d.flavor)}”</p>` : ''}
              <p class="pick-find-card__desc">${esc(txt)}</p>
            </button>`;
          })
          .join('')}
      </div>
    </section>
  `;
}

function wirePickFind() {
  document.querySelectorAll('.pick-find').forEach((btn) => {
    btn.addEventListener('click', () => {
      confirmPickRoadFind(state, btn.getAttribute('data-id'));
      render();
    });
  });
}

function renderWin(pb) {
  const runs = state.flight.winRuns;
  return `
    <section class="panel win-banner">
      <h2>Flight complete</h2>
      <p>Runs taken (lower is better): <strong>${runs}</strong></p>
      <p class="small">Personal best: ${pb != null ? pb : '-'}</p>
      <button type="button" class="btn" id="btn-new-flight">New flight</button>
    </section>
  `;
}

function wireWin() {
  document.getElementById('btn-new-flight')?.addEventListener('click', () => {
    resetFlightFromWin(state);
    render();
  });
}

async function boot() {
  try {
    const catalog = await loadCatalog();
    state = createState(catalog);
    startNewFlight(state);
    updateHud();
    render();
  } catch (e) {
    console.error(e);
    appEl.innerHTML = `<div class="loading tag-misery">Failed to load game data.</div>`;
  }
}

boot();
