// src/ui/components.js - the shared UI vocabulary: escaping, buttons, meters, posters.
// Screens (src/ui/render.js) compose these; nothing here knows what a screen is.
import { canAfford } from '../economy.js';
import { formatGold } from './format.js';

// Below this fraction of max, a bar turns urgent. Shared so the fight HP bar reads the same.
export const URGENT_FRACTION = 0.33;
// Deliberately NOT the same number as URGENT_FRACTION: spec §6.2 pulses the *Repair button*
// at durability < 50% so you are nagged to fix the weapon well before the durability *bar*
// (§6.1, URGENT_FRACTION) starts flashing. Two different affordances, two thresholds.
export const REPAIR_URGENT_FRACTION = 0.5;

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// The shortfall attribute, spec §6.2/§6.12. Empty string when the purse covers the cost, so
// callers can concatenate it unconditionally. Shared by `.btn` and the `.shop-item` card so
// the two commerce surfaces can never disagree about what "unaffordable" means or how the
// gap is spelled (formatGold is the only money formatter — spec §2).
export function shortfallAttr(cost, gold) {
  return canAfford(gold, cost) ? '' : ` data-missing="${escapeHtml(formatGold(cost - gold))}"`;
}

// The optional snark aside. `missing` is a shortfallAttr() result: spec §6.2 renders the gap
// via `.btn__snark::after { content: … attr(data-missing) … }`, and attr() resolves against
// the pseudo-element's own originating element — so the span, not just the enclosing control,
// has to carry it.
export function snarkAside(snark, missing = '') {
  return snark ? `<span class="btn__snark snark"${missing}>(${escapeHtml(snark)})</span>` : '';
}

// Commerce button per spec §6.2: [label] [price slot] [snark slot?].
// variant: '' (plank) | 'commit' (irreversible) | 'danger'.
// `action` is optional: buttons that are not clickable at all (owned gear, already bribed) still
// need the .btn skin, so they come through here instead of being hand-rolled per screen.
// Unaffordable is NOT disabled — the button stays clickable and the action layer rejects it,
// so the game tells you you are broke instead of hiding the option. The two dead states are
// `disabled` (native; a true no-op such as nothing to repair) and `owned` (inert plank for an
// already-taken option — aria-disabled so it is announced, not focus-trapped out of the tab order).
// Exported so the guard below can be exercised directly; screens use the render* wrappers.
export function btn(action, label, { cost = null, gold, variant = '', snark = '',
  urgent = false, disabled = false, owned = false } = {}) {
  // `gold` deliberately has no default. With one, a priced call site that forgot to pass it
  // would render a full-price button as unaffordable — wrong pixels, no error, green suite.
  if (cost != null && !Number.isFinite(gold)) {
    throw new TypeError(`btn(${JSON.stringify(action)}): a priced button needs \`gold\`, got ${gold}`);
  }
  const classes = ['btn'];
  if (variant) classes.push(`btn--${variant}`);
  if (urgent) classes.push('is-urgent');
  if (owned) classes.push('is-owned');
  let attrs = '';
  // Written twice on purpose — see snarkAside(). The button's copy is where spec §6.2 puts the
  // shortfall, reserved for Task 7's click-rejection message; no code consumes it yet, so do
  // not infer a reader from its presence.
  const missingAttr = cost != null ? shortfallAttr(cost, gold) : '';
  if (missingAttr) {
    classes.push('is-unaffordable');
    attrs += missingAttr;
  }
  if (owned) attrs += ' aria-disabled="true"';
  if (disabled) attrs += ' disabled';
  const actionAttr = action ? ` data-action="${action}"` : '';
  const price = cost != null ? `<span class="btn__price">${formatGold(cost)}</span>` : '';
  return `<button${actionAttr} class="${classes.join(' ')}"${attrs}>` +
    `${escapeHtml(label)}${price}${snarkAside(snark, missingAttr)}</button>`;
}

// Fill width as a whole percent, clamped to the track. Shared with the purely decorative
// training meter, which has no role and therefore no aria values to keep in step.
export function fillPct(value, max) {
  return Math.min(100, Math.max(0, Math.round((value / max) * 100)));
}

// One clamped, ARIA-correct meter. Mounted bare inside a poster's HP plate (spec §6.5) and
// wrapped with a label by bar() for the HUD beam (spec §6.1) — a second hand-rolled copy is
// how the two drift apart.
// `label` is plain text: it is escaped *here*, exactly once, so every call site passes it raw.
// Escaping used to be the caller's job and undocumented, which held only while every label was
// a literal; Task 7's enemy-name HP bar makes an unescaped `&`/`<`/`"` a live markup-corruption
// path. Do not escape before calling, or the aria-label double-encodes.
// `barClass` adds a layout class to the track itself (e.g. `.train-row__meter`, which sets
// the width the grid cell wants). `decorative` drops the role, every aria-* attribute and the
// numeral: a meter drawn against a *display-only* denominator must not claim a real maximum,
// and its call site (spec §6.11's training row) states the true number in its own label. The
// bar chrome still comes from here, so the decorative spelling cannot drift from the real one.
export function meter(label, value, max, {
  fillClass = '', urgent = false, barClass = '', decorative = false } = {}) {
  // role="meter" is invalid ARIA when valuenow falls outside [valuemin, valuemax], and the
  // visible numeral must match it or sighted and screen-reader users read different numbers.
  const now = Math.min(max, Math.max(0, value));
  const cls = `bar${urgent ? ' is-urgent' : ''}${barClass ? ` ${barClass}` : ''}`;
  const fill = `<span class="bar__fill${fillClass}" style="width:${fillPct(value, max)}%"></span>`;
  // `label` is deliberately unused here: nothing announces a decorative bar.
  if (decorative) return `<span class="${cls}">${fill}</span>`;
  return `<span class="${cls}" role="meter" aria-label="${escapeHtml(label)}"
      aria-valuenow="${now}" aria-valuemin="0" aria-valuemax="${max}">
      ${fill}
      <span class="bar__num">${now}/${max}</span>
    </span>`;
}

export function bar(label, value, max, opts) {
  return `<span class="hud__stat"><span class="hud__label">${label}</span>
    ${meter(label, value, max, opts)}</span>`;
}

// Gear card, spec §6.12's state triad: available / unaffordable / owned. Owned is different
// *structure*, not a dimmed button: no action, and the price row is replaced by the checkmark,
// so it renders as an inert div. It carries no `aria-disabled`: on a role-less div assistive
// tech ignores the attribute, and the visible "✓ Owned" already states the case.
// `item` is a config.gear entry ({ id, name, cost }); `snark` is the raw aside text.
export function shopItem(item, { owned = false, gold, snark = '' } = {}) {
  if (owned) {
    return `<div class="shop-item is-owned">
        <span class="shop-item__name">${escapeHtml(item.name)}</span>
        <span class="shop-item__owned">✓ Owned</span></div>`;
  }
  // Same guard as btn(): a purchasable card with no purse would silently price itself as
  // unaffordable (canAfford(undefined, cost) is false): wrong pixels, no error, green suite.
  if (!Number.isFinite(gold)) {
    throw new TypeError(`shopItem(${JSON.stringify(item.id)}): a buyable card needs \`gold\`, got ${gold}`);
  }
  const missingAttr = shortfallAttr(item.cost, gold);
  return `<button data-action="buy-${item.id}" class="shop-item${missingAttr ? ' is-unaffordable' : ''}"${missingAttr}>
      <span class="shop-item__name">${escapeHtml(item.name)}</span>
      <span class="btn__price">${formatGold(item.cost)}</span>
      ${snarkAside(snark, missingAttr)}</button>`;
}

// Wanted poster (spec §6.5): name, portrait well, one optional HP plate, sub line, snark.
// `sub` is markup — call sites embed `.amount` spans in it — so it is deliberately not
// escaped; everything else here is. hp: {value, max} | null. tilt: 1|2|3, and neighbouring
// posters must never share a tilt token.
export function poster({ name, sub = '', snark = '', hp = null, tilt = 1 }) {
  // Raw name: meter() escapes its own label (escaping here would double-encode).
  const hpBar = hp ? meter(`${name} health`, hp.value, hp.max) : '';
  return `<article class="poster tape poster--tilt-${tilt}">
    <h3 class="poster__name">${escapeHtml(name)}</h3>
    <div class="poster__portrait" aria-hidden="true"><span class="poster__silhouette"></span></div>
    ${hpBar}
    ${sub ? `<p class="poster__sub">${sub}</p>` : ''}
    ${snark ? `<span class="snark">(${escapeHtml(snark)})</span>` : ''}
  </article>`;
}
