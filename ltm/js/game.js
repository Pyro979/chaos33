/**
 * Luck in the Time of Misery - core game engine (RULES_IMPL v1 in resolution.js).
 * Balance: F14 aura - monitor; Boxer restore penalty - monitor; M10 + forced discard - intentional.
 */

import { shuffle, randomPick } from './rng.js';
import { ensureDeck, adjustRestoreAmount, maybeNurseBonus } from './effects.js';
import {
  isNegativeRoadCard,
  isObstacleEvent,
  isHazardEvent,
  baseDriveCost
} from './resolution.js';

const LS_KEY = 'ltm_pb_runs';

function uid() {
  return `i_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

export function readPersonalBest() {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v == null) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function writePersonalBestIfBetter(runs) {
  const prev = readPersonalBest();
  if (prev == null || runs < prev) {
    try {
      localStorage.setItem(LS_KEY, String(runs));
    } catch {}
    return true;
  }
  return false;
}

export function createState(catalog) {
  return {
    catalog,
    phase: 'character',
    flight: {
      roadOrder: null,
      runsTaken: 0,
      winRuns: null
    },
    run: null,
    roadIndex: 0,
    slotMeta: Array.from({ length: 20 }, () => ({ oneTimeCleared: false, skipped: false })),
    cache: Array.from({ length: 20 }, () => []),
    decks: {},
    pendingResolution: null,
    /** luck card instance uid -> pending pick */
    pickRoadFind: null,
    draftPool: [],
    draftSelected: new Set(),
    rng: Math.random
  };
}

function initDecks(state) {
  const c = state.catalog;
  const rng = state.rng;
  state.decks = {
    starting: shuffle([...c.starting.map((x) => x.id)], rng),
    startingDiscard: [],
    finds: shuffle([...c.finds.map((x) => x.id)], rng),
    findsDiscard: [],
    luck: shuffle([...c.luck.map((x) => x.id)], rng),
    luckDiscard: [],
    misery: shuffle([...c.misery.map((x) => x.id)], rng),
    miseryDiscard: []
  };
}

export function startNewFlight(state) {
  const ids = state.catalog.road.map((c) => c.id);
  shuffle(ids, state.rng);
  state.flight.roadOrder = ids;
  state.flight.runsTaken = 0;
  state.flight.winRuns = null;
  state.roadIndex = 0;
  state.slotMeta = Array.from({ length: 20 }, () => ({ oneTimeCleared: false, skipped: false }));
  state.cache = Array.from({ length: 20 }, () => []);
  initDecks(state);
  state.run = null;
  state.pendingResolution = null;
  state.pickRoadFind = null;
  state.phase = 'character';
}

export function itemSlots(inst, catalog) {
  const def = catalog.startingById[inst.defId] || catalog.findsById[inst.defId];
  return def.slots ?? 0;
}

export function totalSlotsUsed(state) {
  const c = state.catalog;
  let ch = state.run.character;
  let bonus = state.run.slotBonus || 0;
  let used = 0;
  for (const inst of state.run.items) {
    const def = c.startingById[inst.defId] || c.findsById[inst.defId];
    let sl = def.slots ?? 0;
    if (ch.special?.backpackerZeroSlotImmunity && sl === 0) sl = 0;
    used += sl;
  }
  return { used, max: ch.slots + bonus };
}

function makeItemInstance(defId, catalog) {
  const def = catalog.startingById[defId] || catalog.findsById[defId];
  return {
    uid: uid(),
    defId,
    charges: def.charges ?? 1
  };
}

function drawMiseryToHand(state) {
  const d = state.decks.misery;
  const dis = state.decks.miseryDiscard;
  ensureDeck(d, dis, null, state.rng);
  if (!d.length) return null;
  const id = d.shift();
  miseryEnterHand(state, id);
  return id;
}

function miseryEnterHand(state, id) {
  const luckCountBefore = state.run.luck.length;
  const inst = { uid: uid(), defId: id };
  if (id === 'M03' && luckCountBefore === 0) {
    loseDrive(state, 1);
  }
  if (id === 'M04' || id === 'M05') {
    loseDrive(state, 1);
    state.decks.miseryDiscard.push(id);
    return;
  }
  if (id === 'M06') {
    if (state.run.luck.length) {
      randomDiscardLuck(state);
    } else {
      loseDrive(state, 1);
    }
    state.decks.miseryDiscard.push(id);
    return;
  }
  if (id === 'M07') {
    discardRandomItem(state);
    state.decks.miseryDiscard.push(id);
    return;
  }
  if (id === 'M09') {
    pushBackRoad(state);
    state.decks.miseryDiscard.push(id);
    return;
  }
  state.run.misery.push(inst);
  if (id === 'M10') {
    state.run.luckBlocked = true;
  }
}

function randomDiscardLuck(state) {
  const pick = randomPick(state.run.luck, state.rng);
  if (!pick) return;
  state.decks.luckDiscard.push(pick.defId);
}

function discardRandomItem(state) {
  const items = state.run.items.filter((i) => itemCountsForRandomDiscard(state, i));
  if (!items.length) {
    loseDrive(state, 2);
    return;
  }
  const pick = randomPick(items, state.rng);
  removeItemByUid(state, pick.uid);
}

function itemCountsForRandomDiscard(state, inst) {
  const def = state.catalog.startingById[inst.defId] || state.catalog.findsById[inst.defId];
  if (state.run.character.special?.backpackerZeroSlotImmunity && (def.slots ?? 0) === 0) {
    return false;
  }
  return true;
}

function removeItemByUid(state, itemUid) {
  const ix = state.run.items.findIndex((x) => x.uid === itemUid);
  if (ix >= 0) state.run.items.splice(ix, 1);
}

function pushBackRoad(state) {
  if (state.roadIndex > 0) {
    state.roadIndex -= 1;
    const meta = state.slotMeta[state.roadIndex];
    if (meta.oneTimeCleared) return;
  }
}

function loseDrive(state, n) {
  state.run.drive = Math.max(0, state.run.drive - n);
}

function gainDrive(state, baseAmount, isRestoreItem) {
  let n = adjustRestoreAmount(state, baseAmount);
  if (isRestoreItem) {
    n = maybeNurseBonus(state, n);
  }
  state.run.drive = Math.min(state.run.driveMax, state.run.drive + n);
}

export function selectCharacter(state, charId) {
  const ch = state.catalog.charactersById[charId];
  if (!ch) return;
  const draftSize = ch.special?.prepperLoadoutCount === 8 ? 8 : 5;
  let deck = [...state.decks.starting];
  shuffle(deck, state.rng);
  const poolIds = [];
  if (ch.special?.librarianS03) {
    const si = deck.indexOf('S03');
    if (si >= 0) deck.splice(si, 1);
    poolIds.push('S03');
  }
  while (poolIds.length < draftSize && deck.length) {
    poolIds.push(deck.shift());
  }
  state.decks.starting = deck;

  state.run = {
    character: ch,
    drive: ch.drive,
    driveMax: ch.drive,
    slotBonus: 0,
    items: [],
    luck: [],
    misery: [],
    nurseExtraUsed: false,
    convictRevealUsed: false,
    guardsmanUsed: false,
    auraAllEventsMinus: 0,
    luckBlocked: false,
    nextRestorePenalty: 0,
    pendingLookAhead: null,
    s03Used: false
  };
  state.draftPool = poolIds;
  state.draftSelected = new Set();
  state.phase = 'draft';
}

export function toggleDraftSelection(state, defId) {
  if (!state.draftPool.includes(defId)) return;
  const sel = state.draftSelected;
  if (sel.has(defId)) sel.delete(defId);
  else sel.add(defId);
}

export function confirmDraft(state) {
  const ch = state.run.character;
  const selected = [...state.draftSelected];
  let slotsNeeded = 0;
  const instances = [];
  for (const id of selected) {
    const def = state.catalog.startingById[id];
    slotsNeeded += def.slots ?? 0;
    instances.push(makeItemInstance(id, state.catalog));
  }
  if (slotsNeeded > ch.slots) return false;

  for (const id of state.draftPool) {
    if (!selected.includes(id)) state.decks.startingDiscard.push(id);
  }
  state.run.items.push(...instances);

  state.flight.runsTaken += 1;

  const sd = ch.startingDraw;
  for (let i = 0; i < sd.finds; i++) drawFindToHand(state);
  for (let i = 0; i < sd.luck; i++) drawLuckToHand(state);
  for (let i = 0; i < sd.misery; i++) drawMiseryToHand(state);

  for (const inst of state.run.items) {
    applyItemPickupOnce(inst, state);
  }

  pickInheritedCache(state);

  state.phase = 'road';
  state.pendingResolution = null;
  return true;
}

function drawFindToHand(state) {
  ensureDeck(state.decks.finds, state.decks.findsDiscard, null, state.rng);
  if (!state.decks.finds.length) return;
  const id = state.decks.finds.shift();
  const inst = makeItemInstance(id, state.catalog);
  state.run.items.push(inst);
  applyItemPickupOnce(inst, state);
}

function drawLuckToHand(state) {
  ensureDeck(state.decks.luck, state.decks.luckDiscard, null, state.rng);
  if (!state.decks.luck.length) return;
  const id = state.decks.luck.shift();
  state.run.luck.push({ uid: uid(), defId: id });
}

function applyItemPickupOnce(inst, state) {
  if (inst.pickupDone) return;
  inst.pickupDone = true;
  applyItemPickup(inst, state);
}

function applyItemPickup(inst, state) {
  const def = state.catalog.startingById[inst.defId] || state.catalog.findsById[inst.defId];
  const pu = def.abilities?.pickup;
  if (!pu) return;
  for (const fx of pu) {
    if (fx.drawLuck) drawLuckToHand(state);
    if (fx.drawMisery) drawMiseryToHand(state);
    if (fx.grantSlots) state.run.slotBonus += fx.grantSlots;
    if (fx.auraAllEventsMinus) {
      state.run.auraAllEventsMinus += fx.auraAllEventsMinus;
    }
  }
}

function pickInheritedCache(state) {
  const ix = state.roadIndex;
  const pile = state.cache[ix];
  if (!pile.length) return;
  const incoming = pile.splice(0, pile.length);
  state.run.items.push(...incoming);
  for (const inst of incoming) {
    applyItemPickupOnce(inst, state);
  }
}

function roadDefAt(state, ix) {
  const rid = state.flight.roadOrder[ix];
  return state.catalog.roadById[rid];
}

export function canUseLuck(state) {
  return !state.run.luckBlocked;
}

/** Start resolving the road card at state.roadIndex (call after moving to card). */
export function openResolution(state) {
  const ix = state.roadIndex;
  if (ix >= 20) {
    winFlight(state);
    return;
  }
  const meta = state.slotMeta[ix];
  const def = roadDefAt(state, ix);
  if (meta.oneTimeCleared && def.oneTime) {
    finishRoadCard(state, false);
    return;
  }
  if (meta.skipped) {
    meta.skipped = false;
    finishRoadCard(state, false);
    return;
  }

  pickInheritedCache(state);

  const convictReveal =
    state.run.character.special?.convictRevealPeople &&
    !state.run.convictRevealUsed &&
    def.kind === 'people';

  state.pendingResolution = {
    ix,
    def,
    convictReveal,
    guardsmanAvailable:
      state.run.character.special?.guardsmanHazardDiscount &&
      !state.run.guardsmanUsed &&
      isHazardEvent(def),
    appliedNextReduction: 0,
    bypassUsed: false,
    peopleCostReveal: convictReveal ? baseDriveCost(def) : null
  };

  state.phase = 'resolve';
}

export function finishRoadCard(state, clearedOneTime) {
  const ix = state.roadIndex;
  const def = roadDefAt(state, ix);
  if (clearedOneTime && def.oneTime) {
    state.slotMeta[ix].oneTimeCleared = true;
  }
  discardMiseryAfterEvent(state);
  state.run.luckBlocked = false;
  state.pendingResolution = null;
  state.roadIndex += 1;
  if (state.roadIndex >= 20) {
    winFlight(state);
    return;
  }
  state.phase = 'road';
}

function discardMiseryAfterEvent(state) {
  const keep = [];
  for (const m of state.run.misery) {
    if (m.defId === 'M10') {
      state.decks.miseryDiscard.push(m.defId);
      continue;
    }
    keep.push(m);
  }
  state.run.misery = keep;
}

function winFlight(state) {
  state.flight.winRuns = state.flight.runsTaken;
  writePersonalBestIfBetter(state.flight.runsTaken);
  state.pendingResolution = null;
  state.run = null;
  state.phase = 'win';
}

export function overflowChoice(state) {
  state.run.items = [];
  for (const l of state.run.luck) state.decks.luckDiscard.push(l.defId);
  for (const m of state.run.misery) state.decks.miseryDiscard.push(m.defId);
  state.run.luck = [];
  state.run.misery = [];
  state.run.drive = 0;
  reshuffleLuckMisery(state);
  state.run = null;
  state.phase = 'character';
}

function stashCacheAndEndRun(state) {
  const ix = state.roadIndex;
  state.cache[ix].push(...state.run.items.map((i) => ({ ...i })));
  for (const l of state.run.luck) state.decks.luckDiscard.push(l.defId);
  for (const m of state.run.misery) state.decks.miseryDiscard.push(m.defId);
  reshuffleLuckMisery(state);
  state.run = null;
  state.phase = 'character';
}

function reshuffleLuckMisery(state) {
  state.decks.luck.push(...state.decks.luckDiscard.splice(0));
  state.decks.misery.push(...state.decks.miseryDiscard.splice(0));
  shuffle(state.decks.luck, state.rng);
  shuffle(state.decks.misery, state.rng);
}

export function endRunDriveZero(state) {
  stashCacheAndEndRun(state);
}

function effectivePayDriveCost(state, rawCost) {
  let c = Math.max(0, rawCost);
  c -= state.run.auraAllEventsMinus || 0;
  c = Math.max(0, c);
  const pending = state.pendingResolution;
  if (pending?.guardsmanApplied) c = Math.max(0, c - 2);
  const surges = state.run.misery.filter((m) =>
    ['M01', 'M02', 'M03'].includes(m.defId)
  ).length;
  if (surges > 0 && isNegativeRoadCard(pending?.def)) {
    c += surges;
  }
  return Math.max(0, c);
}

function consumeMiseryTriggersForNegative(state, def) {
  if (!isNegativeRoadCard(def)) return;
  state.run.misery = state.run.misery.filter((m) => {
    if (['M01', 'M02', 'M03'].includes(m.defId)) {
      state.decks.miseryDiscard.push(m.defId);
      return false;
    }
    return true;
  });
}

/** Submit payment plan from UI. Returns false if invalid / death. */
export function submitSimplePay(state, opts) {
  const pr = state.pendingResolution;
  if (!pr || !pr.def) return false;
  const def = pr.def;
  let cost = pr.previewCost ?? baseDriveCost(def);
  if (def.resolve.type === 'payDrive') {
    cost = def.resolve.amount;
  }

  cost = applyPlayerMitigations(state, cost, opts);

  if (def.kind === 'people' && opts?.f15PeopleReduction) {
    cost = Math.max(0, cost - 2);
  }

  cost = effectivePayDriveCost(state, cost);

  if (state.run.drive < cost) {
    overflowChoice(state);
    return false;
  }
  state.run.drive -= cost;

  consumeMiseryTriggersForNegative(state, def);

  runAfterPay(state, def.resolve.afterPay);

  if (state.run.drive <= 0) {
    endRunDriveZero(state);
    return false;
  }

  const ot = def.oneTime && !state.slotMeta[pr.ix].oneTimeCleared;
  finishRoadCard(state, ot);
  return true;
}

function runAfterPay(state, afterList) {
  if (!afterList) return;
  for (const step of afterList) {
    if (step === 'drawMisery') drawMiseryToHand(state);
    if (step === 'drawLuck') drawLuckToHand(state);
    if (step === 'drawRoadFind') drawFindToHand(state);
  }
}

function applyPlayerMitigations(state, cost, opts) {
  let c = cost;
  if (opts?.nextReduction) c -= opts.nextReduction;
  if (opts?.anyReduction) c -= opts.anyReduction;
  if (opts?.bypass && state.pendingResolution?.def && isObstacleEvent(state.pendingResolution.def)) {
    c = 0;
    removeItemByUid(state, opts.bypassUid);
  }
  return Math.max(0, c);
}

export function previewPayCost(state, opts) {
  const pr = state.pendingResolution;
  const def = pr.def;
  let cost = def.resolve.type === 'payDrive' ? def.resolve.amount : baseDriveCost(def);
  cost = applyPlayerMitigations(state, cost, opts);
  cost = effectivePayDriveCost(state, cost);
  pr.previewCost = cost;
  return cost;
}

export function applyGuardsman(state) {
  if (!state.pendingResolution?.guardsmanAvailable) return false;
  state.run.guardsmanUsed = true;
  state.pendingResolution.guardsmanApplied = true;
  return true;
}

export function revealConvictPeople(state) {
  if (!state.pendingResolution?.convictReveal) return;
  state.run.convictRevealUsed = true;
  state.pendingResolution.convictReveal = false;
}

export function advanceRoadSkip(state) {
  const ix = state.roadIndex;
  state.slotMeta[ix].skipped = true;
  state.roadIndex += 1;
  state.phase = 'road';
}

export function clickContinueRoad(state) {
  if (state.roadIndex >= 20) {
    winFlight(state);
    return;
  }
  openResolution(state);
}

export function resetFlightFromWin(state) {
  startNewFlight(state);
}

function countItems(state) {
  return state.run.items.length;
}

function canFulfillChoiceOption(state, opt, opts) {
  if (opt.payDrive != null) {
    let c = applyPlayerMitigations(state, opt.payDrive, opts || {});
    c = effectivePayDriveCost(state, c);
    return state.run.drive >= c;
  }
  if (opt.discardItems != null) {
    return countItems(state) >= opt.discardItems;
  }
  return false;
}

export function choiceOverflow(state, opts) {
  const def = state.pendingResolution.def;
  const options = def.resolve.options || [];
  let any = false;
  for (let i = 0; i < options.length; i++) {
    if (canFulfillChoiceOption(state, options[i], opts)) any = true;
  }
  return !any;
}

export function submitChoice(state, payload) {
  const pr = state.pendingResolution;
  const def = pr.def;
  const r = def.resolve;
  const opt = r.options[payload.optionIndex];
  const opts = payload.opts || {};

  if (choiceOverflow(state, opts)) {
    overflowChoice(state);
    return false;
  }

  if (opt.payDrive != null) {
    let c = applyPlayerMitigations(state, opt.payDrive, opts);
    c = effectivePayDriveCost(state, c);
    if (state.run.drive < c) {
      overflowChoice(state);
      return false;
    }
    state.run.drive -= c;
  } else if (opt.discardItems != null) {
    const uids = payload.discardUids || [];
    if (uids.length !== opt.discardItems) return false;
    for (const u of uids) removeItemByUid(state, u);
  }

  consumeMiseryTriggersForNegative(state, def);

  const after = r.afterResolve || [];
  for (const step of after) {
    if (step === 'drawLuck') drawLuckToHand(state);
  }

  if (state.run.drive <= 0) {
    endRunDriveZero(state);
    return false;
  }

  finishRoadCard(state, false);
  return true;
}

export function peopleOrOverflow(state, opts, f15) {
  const r = state.pendingResolution.def.resolve;
  let c = applyPlayerMitigations(state, r.payDrive, opts || {});
  if (f15) c = Math.max(0, c - 2);
  c = effectivePayDriveCost(state, c);
  const canPay = state.run.drive >= c;
  const canDiscard = countItems(state) >= r.orDiscardItems;
  return !canPay && !canDiscard;
}

export function submitPeopleOr(state, payload) {
  const pr = state.pendingResolution;
  const def = pr.def;
  const r = def.resolve;
  const opts = payload.opts || {};

  if (peopleOrOverflow(state, opts, payload.f15PeopleReduction)) {
    overflowChoice(state);
    return false;
  }

  if (payload.usePay) {
    let c = r.payDrive;
    c = applyPlayerMitigations(state, c, opts);
    if (def.kind === 'people' && payload.f15PeopleReduction) {
      c = Math.max(0, c - 2);
    }
    c = effectivePayDriveCost(state, c);
    if (state.run.drive < c) {
      overflowChoice(state);
      return false;
    }
    state.run.drive -= c;
  } else {
    const n = r.orDiscardItems;
    const uids = payload.discardUids || [];
    if (uids.length !== n) return false;
    for (const u of uids) removeItemByUid(state, u);
  }

  consumeMiseryTriggersForNegative(state, def);

  if (state.run.drive <= 0) {
    endRunDriveZero(state);
    return false;
  }

  finishRoadCard(state, false);
  return true;
}

export function submitR15(state, payload) {
  const pr = state.pendingResolution;
  const def = pr.def;

  if (payload.branch === 'b') {
    consumeMiseryTriggersForNegative(state, def);
    finishRoadCard(state, false);
    return true;
  }

  const uids = payload.discardUids || [];
  if (uids.length !== 1) return false;
  removeItemByUid(state, uids[0]);

  ensureDeck(state.decks.finds, state.decks.findsDiscard, null, state.rng);
  const c1 = state.decks.finds.shift();
  ensureDeck(state.decks.finds, state.decks.findsDiscard, null, state.rng);
  const c2 = state.decks.finds.shift();
  const candidates = [c1, c2].filter(Boolean);
  if (candidates.length === 0) {
    consumeMiseryTriggersForNegative(state, def);
    finishRoadCard(state, false);
    return true;
  }
  if (candidates.length === 1) {
    state.run.items.push(makeItemInstance(candidates[0], state.catalog));
    applyItemPickupOnce(state.run.items[state.run.items.length - 1], state);
    consumeMiseryTriggersForNegative(state, def);
    finishRoadCard(state, false);
    return true;
  }
  state.pickRoadFind = {
    candidates,
    keepOne: true,
    roadIx: pr.ix,
    afterMisery: def,
    freeResolve: false
  };
  state.phase = 'pick_find';
  return true;
}

export function confirmPickRoadFind(state, keepDefId) {
  const pk = state.pickRoadFind;
  if (!pk) return false;
  const lose = pk.candidates.filter((id) => id !== keepDefId);
  for (const id of lose) state.decks.findsDiscard.push(id);
  const inst = makeItemInstance(keepDefId, state.catalog);
  state.run.items.push(inst);
  applyItemPickupOnce(inst, state);
  state.pickRoadFind = null;

  if (pk.freeResolve) {
    state.phase = 'resolve';
    const pr = state.pendingResolution;
    const ot = pr.def.oneTime && !state.slotMeta[pr.ix].oneTimeCleared;
    finishRoadCard(state, ot);
    return true;
  }

  consumeMiseryTriggersForNegative(state, pk.afterMisery);
  state.phase = 'resolve';
  finishRoadCard(state, false);
  return true;
}

function execFreeAction(state, action) {
  const name = action[0];
  if (name === 'restoreDrive') {
    gainDrive(state, action[1], false);
    return;
  }
  if (name === 'drawLuck') {
    drawLuckToHand(state);
    return;
  }
  if (name === 'drawRoadFind') {
    drawFindToHand(state);
    return;
  }
  if (name === 'drawRoadFindsKeep') {
    const n = action[1];
    const ids = [];
    for (let i = 0; i < n; i++) {
      ensureDeck(state.decks.finds, state.decks.findsDiscard, null, state.rng);
      if (!state.decks.finds.length) break;
      ids.push(state.decks.finds.shift());
    }
    if (ids.length <= 1) {
      if (ids.length === 1) {
        state.run.items.push(makeItemInstance(ids[0], state.catalog));
        applyItemPickupOnce(state.run.items[state.run.items.length - 1], state);
      }
      return;
    }
    state.pickRoadFind = {
      candidates: ids,
      keepOne: true,
      roadIx: state.pendingResolution.ix,
      afterMisery: null,
      freeResolve: true
    };
    state.phase = 'pick_find';
    return;
  }
}

export function submitFreeRoad(state) {
  const pr = state.pendingResolution;
  const def = pr.def;
  const actions = def.resolve.actions || [];
  for (const a of actions) {
    execFreeAction(state, a);
    if (state.phase === 'pick_find') return true;
    if (state.run.drive <= 0) {
      endRunDriveZero(state);
      return false;
    }
  }
  const ot = def.oneTime && !state.slotMeta[pr.ix].oneTimeCleared;
  finishRoadCard(state, ot);
  return true;
}

export function submitNoneRoad(state) {
  finishRoadCard(state, false);
  return true;
}

export function dispatchRoadResolution(state, payload) {
  const def = state.pendingResolution?.def;
  if (!def) return false;
  const t = def.resolve.type;
  if (t === 'payDrive') return submitSimplePay(state, payload);
  if (t === 'choice') return submitChoice(state, payload);
  if (t === 'peopleOr') return submitPeopleOr(state, payload);
  if (t === 'r15choice') return submitR15(state, payload);
  if (t === 'free') return submitFreeRoad(state);
  if (t === 'none') return submitNoneRoad(state);
  return false;
}
