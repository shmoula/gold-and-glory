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
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// The shortfall as a bare display amount, '' when the purse covers the cost. The single place
// that computes `cost - gold` and formats it (formatGold is the only money formatter — spec §2),
// so the `data-missing` attribute, the visual `.btn__snark::after`, and the AT text in
// snarkAside() can never state three different gaps.
export function shortfallAmount(cost, gold) {
  return canAfford(gold, cost) ? '' : formatGold(cost - gold);
}

// The shortfall attribute, spec §6.2/§6.12. Empty string when the purse covers the cost, so
// callers can concatenate it unconditionally. Shared by `.btn` and the `.shop-item` card so
// the two commerce surfaces can never disagree about what "unaffordable" means or how the
// gap is spelled.
export function shortfallAttr(cost, gold) {
  const amount = shortfallAmount(cost, gold);
  return amount ? ` data-missing="${escapeHtml(amount)}"` : '';
}

// The optional snark aside. `missing` is a shortfallAttr() result: spec §6.2 renders the gap
// via `.btn__snark::after { content: … attr(data-missing) … }`, and attr() resolves against
// the pseudo-element's own originating element — so the span, not just the enclosing control,
// has to carry it.
// Which is why the span is emitted for a shortfall even with no snark to put in it (backlog
// item 3): §6.2 hangs the shortfall off this *optional* slot, so the three Train buttons — the
// only priced controls in the game with no aside — rendered a red price and no "(need 50 more)"
// at all, and §6.2 is explicit that the game tells you you are broke rather than hiding it.
// An empty slot carries no parentheses of its own; the pseudo-element brings its own.
// `shortfall` is a shortfallAmount() result ('' when affordable): the visible gap is painted by
// `.btn__snark::after { content: … attr(data-missing) … }`, which is CSS-generated content — not
// reliably in the accessibility tree, and gone entirely with CSS off. This mirrors the same gap
// as real, `.sr-only`-clipped text so a screen reader that ignores generated content, and a
// CSS-off reader, both get the shortfall while the ::after stays as the visual. Same words, from
// the same formatted amount, so the spoken and the painted gap can never disagree. (A screen
// reader that *does* voice ::after content hears the gap twice — the far smaller failure than the
// gap being announced to no one, which is what this closes.)
export function snarkAside(snark, missing = '', shortfall = '') {
  if (!snark && !missing) return '';
  const body = snark ? `(${escapeHtml(snark)})` : '';
  const at = shortfall ? `<span class="sr-only"> (need ${escapeHtml(shortfall)} more)</span>` : '';
  return `<span class="btn__snark snark"${missing}>${body}${at}</span>`;
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
export function btn(
  action,
  label,
  {
    cost = null,
    price = null,
    gold,
    variant = '',
    snark = '',
    urgent = false,
    disabled = false,
    owned = false,
  } = {}
) {
  // `gold` deliberately has no default. With one, a priced call site that forgot to pass it
  // would render a full-price button as unaffordable — wrong pixels, no error, green suite.
  if (cost != null && !Number.isFinite(gold)) {
    throw new TypeError(
      `btn(${JSON.stringify(action)}): a priced button needs \`gold\`, got ${gold}`
    );
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
  // `price` is a *displayed* amount with no purchase semantics. Spec §6.6's result CTA puts the
  // resulting balance in the price slot ("Return to Ludus · 3,110 G"), and §9 forbids money
  // inside a label string — but a balance is not a cost: it can never be unaffordable, and
  // checking it against the purse would compare the purse with itself. `cost` keeps the
  // purchase spelling and its `gold` guard; this one is presentation only.
  const shown = cost ?? price;
  const priceSlot = shown != null ? `<span class="btn__price">${formatGold(shown)}</span>` : '';
  const missingAmount = cost != null ? shortfallAmount(cost, gold) : '';
  return (
    `<button${actionAttr} class="${classes.join(' ')}"${attrs}>` +
    `${escapeHtml(label)}${priceSlot}${snarkAside(snark, missingAttr, missingAmount)}</button>`
  );
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
export function meter(
  label,
  value,
  max,
  { fillClass = '', urgent = false, barClass = '', decorative = false } = {}
) {
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
  // Escaped here as well as in meter(): the `.hud__label` span is a second sink for the same
  // string, so the "every call site passes it raw" contract only holds if both are escaped.
  return `<span class="hud__stat"><span class="hud__label">${escapeHtml(label)}</span>
    ${meter(label, value, max, opts)}</span>`;
}

// Gear card, spec §6.12's state triad: available / unaffordable / owned. Owned is different
// *structure*, not a dimmed button: no action, and the price row is replaced by the checkmark,
// so it renders as an inert div. It carries no `aria-disabled`: on a role-less div assistive
// tech ignores the attribute, and the visible "✓ Owned" already states the case.
// `item` is a config.gear entry ({ id, name, cost }); `snark` is the raw aside text.
export function shopItem(item, { owned = false, gold, snark = '' } = {}) {
  if (owned) {
    return `<div class="shop-item parchment is-owned">
        <span class="shop-item__icon" aria-hidden="true"></span>
        <span class="shop-item__name">${escapeHtml(item.name)}</span>
        <span class="shop-item__owned">✓ Owned</span></div>`;
  }
  // Same guard as btn(): a purchasable card with no purse would silently price itself as
  // unaffordable (canAfford(undefined, cost) is false): wrong pixels, no error, green suite.
  if (!Number.isFinite(gold)) {
    throw new TypeError(
      `shopItem(${JSON.stringify(item.id)}): a buyable card needs \`gold\`, got ${gold}`
    );
  }
  const missingAttr = shortfallAttr(item.cost, gold);
  return `<button data-action="buy-${escapeHtml(item.id)}" class="shop-item parchment${missingAttr ? ' is-unaffordable' : ''}"${missingAttr}>
      <span class="shop-item__icon" aria-hidden="true"></span>
      <span class="shop-item__name">${escapeHtml(item.name)}</span>
      <span class="btn__price">${formatGold(item.cost)}</span>
      ${snarkAside(snark, missingAttr, shortfallAmount(item.cost, gold))}</button>`;
}

// ---- Combat log entry (spec §6.9) ----
// A log entry is data, not a sentence: `{ turn, kind, text, ...values }`. `text` is a trusted
// template written in combat.js with `{who} {dmg} {taken} {gold}` placeholders; every value
// that could ever carry content (an opponent name) travels in its own field. Both are escaped
// here, exactly once, and substitution runs in a single pass — so a fighter named `{dmg}`
// prints those six characters instead of minting a damage figure.
// `kind` is 'attack' or 'status'; §6.9 sets status clauses (block, counter, feint) in italics.
const SWORD = '\u2694'; // ⚔ CROSSED SWORDS — damage taken. Written as an escape, per the
const NBSP = '\u00a0'; // U+00A0 post-mortem: never paste an invisible or lookalike character.
const SLOT = /\{(who|dmg|taken|gold)\}/g;
// Two skins over one substitution pass, so the spoken twin cannot drift from the visible one.
const SKINS = {
  html: {
    who: (v) => escapeHtml(v),
    // Damage dealt: the bold value spec §6.9 paints in --blood-ink (.log__entry b).
    dmg: (v) => `<b>${Number(v)}</b>`,
    // Damage taken: plain ink, a sword glyph, and a non-breaking space so the glyph can never
    // be orphaned on its own line. The glyph is a visual channel; AT reads the number.
    taken: (v) => `<span aria-hidden="true">${SWORD}</span>${NBSP}${Number(v)}`,
    gold: (v) => `<span class="amount">${formatGold(v)}</span>`,
  },
  text: {
    who: (v) => String(v),
    dmg: (v) => String(Number(v)),
    taken: (v) => String(Number(v)),
    gold: (v) => formatGold(v),
  },
};

function logClause(entry, skin) {
  const paint = SKINS[skin];
  const clause = skin === 'html' ? escapeHtml(entry.text) : String(entry.text);
  // A replacement function's output is never rescanned, so a value containing `{dmg}` is inert.
  return clause.replace(SLOT, (match, key) =>
    entry[key] == null ? match : paint[key](entry[key])
  );
}

export function logEntry(entry) {
  const clause = logClause(entry, 'html');
  const body = entry.kind === 'status' ? `<em>${clause}</em>` : clause;
  const snark = entry.snark ? ` <span class="snark">(${escapeHtml(entry.snark)})</span>` : '';
  return (
    `<li class="log__entry"><span class="log__turn">T${Number(entry.turn)}</span> ` +
    `${body}${snark}</li>`
  );
}

// The speakable twin, for main.js's live region (spec §8). No markup, no decorative glyph,
// and no turn stamp: a screen reader is being told what just happened, not shown a strip.
export function logEntryText(entry) {
  return `${logClause(entry, 'text')}${entry.snark ? ` (${entry.snark})` : ''}`;
}

// One spelling of a banner stamp (spec §6.13). No role: a live region rendered inside #app
// arrives already-populated on every mount and announces nothing (items 26/28) — the stamp's
// text is announced by main.js through a persistent region instead (design 2026-08-01 §4d).
export function bannerStamp(variant, text) {
  return (
    `<p class="banner-stamp parchment banner-stamp--${escapeHtml(variant)}">` +
    `${escapeHtml(text)}</p>`
  );
}

// Title plaque (spec §6.16): the screen's h1 on a parchment plate that overlaps the HUD beam.
// Sentence-case in, CSS uppercases — §9 keeps shouting a presentation concern.
export function titlePlaque(text) {
  return `<div class="title-plaque parchment tape"><h1>${escapeHtml(text)}</h1></div>`;
}

// Wanted poster (spec §6.5): name, portrait well, one optional HP plate, sub line, snark.
// `sub` is markup — call sites embed `.amount` spans in it — so it is deliberately not
// escaped; everything else here is. hp: {value, max} | null. tilt: 1|2|3, and neighbouring
// posters must never share a tilt token.
export function poster({ name, sub = '', snark = '', hp = null, tilt = 1, urgent }) {
  // Raw name: meter() escapes its own label (escaping here would double-encode).
  // Urgency is derived here by default, not demanded of the caller. Spec §6.5 requires the
  // player poster and the HUD beam to read the same field, so they must not disagree about
  // when that number is alarming — and a call site that forgot the flag would show a calm
  // plate beside a flashing beam. Same URGENT_FRACTION as §6.1's bar: one threshold, not two.
  // `urgent` overrides that default when supplied (`??`, so only an omitted/undefined flag
  // re-arms the derivation): the result and game-over screens mount 0-HP plates, and a corpse
  // whose plate pulses forever is noise, not an alarm.
  const hpBar = hp
    ? meter(`${name} health`, hp.value, hp.max, {
        urgent: urgent ?? hp.value / hp.max < URGENT_FRACTION,
      })
    : '';
  return `<article class="poster parchment tape poster--tilt-${escapeHtml(tilt)}">
    <h3 class="poster__name">${escapeHtml(name)}</h3>
    <div class="poster__portrait" aria-hidden="true"><span class="poster__silhouette"></span></div>
    ${hpBar}
    ${sub ? `<p class="poster__sub">${sub}</p>` : ''}
    ${snark ? `<span class="snark">(${escapeHtml(snark)})</span>` : ''}
  </article>`;
}
