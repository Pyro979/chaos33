/**
 * RULES_IMPL (v1) - see plan: negative event = Event/People that spend Drive if unpaid;
 * obstacle = kind event && base Drive cost > 0; People cost = numeric Drive before discounts.
 */

export function isNegativeRoadCard(def) {
  if (!def || def.kind === 'atmospheric') return false;
  const k = def.kind;
  const r = def.resolve;
  if (k === 'resource' || k === 'restore') return false;
  if (k === 'event') {
    if (r.type === 'payDrive' && r.amount > 0) return true;
    return false;
  }
  if (k === 'people') {
    if (r.type === 'payDrive' && r.amount > 0) return true;
    if (r.type === 'peopleOr' && r.payDrive > 0) return true;
    if (r.type === 'r15choice') return true;
    return false;
  }
  if (k === 'choice') return true;
  return false;
}

export function isObstacleEvent(def) {
  return (
    def &&
    def.kind === 'event' &&
    def.resolve &&
    def.resolve.type === 'payDrive' &&
    def.resolve.amount > 0
  );
}

export function isHazardEvent(def) {
  return def && def.kind === 'event';
}

/** Base Drive cost before reductions (for display / guardsman). */
export function baseDriveCost(def) {
  if (!def || !def.resolve) return 0;
  const r = def.resolve;
  if (r.type === 'payDrive') return r.amount;
  if (r.type === 'peopleOr') return r.payDrive;
  if (r.type === 'choice') {
    const opts = r.options || [];
    const pd = opts.find((o) => o.payDrive != null);
    return pd ? pd.payDrive : 0;
  }
  return 0;
}
