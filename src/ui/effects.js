// src/ui/effects.js — money theater (spec §6.6 ledger sequence, §6.7 ticker + delta chips).
// DOM-only: nothing here knows about game state, and nothing here decides *what* a number is,
// only how it travels from the old one to the new one.
//
// Two rules shape every function below.
//
// 1. **No requestAnimationFrame.** The pane this game is developed in reports
//    `visibilityState: "hidden"` and paints zero frames, so a rAF-driven ticker would sit at
//    its starting value there and nobody would notice. Timers plus a clock work in a hidden
//    tab, in jsdom, and under fake timers.
// 2. **Positions come from the clock, never from the number of callbacks that have run.**
//    Task 6's meter capture learned this the hard way. `now` is injectable so tests can
//    advance time deterministically — vitest's fake timers do not fake `performance`, so a
//    hard-wired `performance.now()` would freeze at 0 for the whole suite.
import { formatGold } from './format.js';

// Spec §6.7: "count toward the new value over <= 600ms". The step is the write interval, not
// the value quantum — the value is always recomputed from the clock, so a dropped step costs
// nothing but a skipped repaint.
export const TICKER_MS = 600;
export const TICKER_STEP_MS = 60;
// --dur-tally: one ledger line per beat (§6.6/§1).
export const BEAT_MS = 350;
// §6.6: "Total sequence <= 2.5s". A long ledger compresses its beat rather than overrunning.
export const THEATER_MAX_MS = 2500;
// --dur-chip (§1) and §6.7's consolidation window and visible cap.
export const CHIP_LIFE_MS = 900;
export const CHIP_MERGE_MS = 300;
export const CHIP_MAX = 2;
// A chip that no longer travels has to stay put long enough to be read (§5 reduced motion).
export const REDUCED_CHIP_LIFE_MS = 1500;
// §6.7: a 3-frame ±3px shake. The class carries the keyframes; this is how long they run.
export const SHAKE_MS = 300;

const MINUS = '\u2212'; // U+2212 MINUS SIGN, never a hyphen (spec §2)
const defaultNow = () => performance.now();
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// Not cached: a test (and a user) can flip the preference at any time, and the whole point of
// the query is that it is answered when the animation is about to start.
export function reducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Money formatters a ledger row can ask for by name. A row with no `data-unit` (an injury
// count, a durability figure) is not money and does not tick — §6.6 counts *money* rows.
const UNITS = {
  gold: (v) => formatGold(v),
  'gold-signed': (v) => formatGold(v, { signed: true }),
};

// Count `el` from `from` to `to` over `durationMs`, writing whole gold (§6.7). Returns a
// finish function: calling it stops the count and writes the final value, so a skip or a
// superseding render can never leave a half-counted number on screen.
export function tickTo(el, from, to, {
  durationMs = TICKER_MS, stepMs = TICKER_STEP_MS, format = UNITS.gold, now = defaultNow } = {}) {
  const write = (v) => {
    el.textContent = format(v);
    el.setAttribute('data-value', String(v));
  };
  if (!el) return () => {};
  const timers = [];
  const finish = () => {
    for (const t of timers) clearTimeout(t);
    timers.length = 0;
    write(to);
  };
  if (from === to || reducedMotion()) {
    write(to);
    return finish;
  }
  const t0 = now();
  const steps = Math.max(1, Math.ceil(durationMs / stepMs));
  for (let i = 1; i <= steps; i += 1) {
    timers.push(setTimeout(() => {
      // The last step writes the target outright. Everything before it is a function of the
      // clock, so a coarse timer, a stalled tab or a dropped step lands on the right number
      // anyway — and the final write means the count completes even where the clock does not
      // move at all (fake timers without a faked `performance`).
      if (i === steps) finish();
      else write(Math.round(from + (to - from) * clamp01((now() - t0) / durationMs)));
    }, (durationMs * i) / steps));
  }
  write(from);
  return finish;
}

// Reveal `.ledger__row.is-hidden` rows one beat apart, top to bottom, counting each money row
// up from zero as it lands (§6.6). Any click completes the sequence instantly — the spec is
// explicit that the player is never trapped in theater. Returns that same skip function.
export function runLedgerTheater(container, {
  beatMs = BEAT_MS, maxMs = THEATER_MAX_MS, now = defaultNow } = {}) {
  const noop = () => {};
  if (!container) return noop;
  const rows = [...container.querySelectorAll('.ledger__row.is-hidden')];
  if (!rows.length) return noop;

  const counters = [];
  const timers = [];
  const finish = () => {
    for (const t of timers) clearTimeout(t);
    timers.length = 0;
    for (const done of counters.splice(0)) done();
    for (const row of rows) revealRow(row);
  };
  if (reducedMotion()) {
    finish();
    return noop;
  }
  // The last row must have finished *counting* by maxMs, not merely have appeared, so the
  // budget is shared between (rows.length) beats of reveal and one final beat of counting.
  const beat = Math.min(beatMs, maxMs / (rows.length + 1));
  rows.forEach((row, i) => {
    timers.push(setTimeout(() => {
      counters.push(...revealRow(row, { durationMs: beat, now }));
    }, beat * (i + 1)));
  });
  container.addEventListener('click', finish, { once: true });
  return finish;
}

// Show one row and start its money counter. Returns the counter's finish functions (none for
// a row that carries no money). With no options the row is revealed pre-tallied.
function revealRow(row, opts = null) {
  row.classList.remove('is-hidden');
  const finishers = [];
  for (const amount of row.querySelectorAll('.amount[data-unit]')) {
    const format = UNITS[amount.getAttribute('data-unit')];
    const to = Number(amount.getAttribute('data-value'));
    if (!format || !Number.isFinite(to)) continue;
    const done = tickTo(amount, 0, to, { ...opts, format });
    if (opts) finishers.push(done);
    else done();
  }
  return finishers;
}

// --- Delta chips (§6.7) ---
// Each chip owns its removal timer. A WeakMap rather than a dataset field so a merged chip's
// timer can be cancelled without parsing a string back into a timer id.
const chipTimers = new WeakMap();

function mountChip(host, { text, negative, amount = null, lifeMs, now }) {
  const chips = [...host.querySelectorAll('.delta-chip')];
  const last = chips[chips.length - 1];
  // §6.7: "Consolidate same-sign changes within 300ms into one chip." Two trainings bought in
  // one breath read as one purse movement, not a stack of confetti. A shortfall chip carries
  // no amount, so it never merges with money.
  if (amount != null && last && last.dataset.amount) {
    const previous = Number(last.dataset.amount);
    const fresh = now() - Number(last.dataset.spawnedAt) <= CHIP_MERGE_MS;
    if (fresh && Math.sign(previous) === Math.sign(amount)) {
      dropChip(last);
      return mountChip(host, {
        ...signed(previous + amount), amount: previous + amount, lifeMs, now,
      });
    }
  }
  if (chips.length >= CHIP_MAX) dropChip(chips[0]);

  const chip = document.createElement('span');
  chip.className = `delta-chip ${negative ? 'delta-chip--neg' : 'delta-chip--pos'}`;
  // textContent, not innerHTML: the shortfall string is built from a data attribute that a
  // hostile amount could otherwise ride in on.
  chip.textContent = text;
  chip.dataset.spawnedAt = String(now());
  if (amount != null) chip.dataset.amount = String(amount);
  host.appendChild(chip);
  chipTimers.set(chip, setTimeout(() => dropChip(chip),
    reducedMotion() ? REDUCED_CHIP_LIFE_MS : lifeMs));
  return chip;
}

function dropChip(chip) {
  clearTimeout(chipTimers.get(chip));
  chipTimers.delete(chip);
  chip.remove();
}

const signed = (amount) => ({
  text: formatGold(amount, { signed: true }), negative: amount < 0,
});

// A floating +/- chip beside the purse, spawned on every gold change (§6.7).
export function spawnDeltaChip(host, amount, { lifeMs = CHIP_LIFE_MS, now = defaultNow } = {}) {
  return mountChip(host, { ...signed(amount), amount, lifeMs, now });
}

// The rejected-purchase twin (§6.7): no money moved, so it states the gap instead. `missing`
// is an already-formatted amount (`btn()`'s `data-missing`). The leading U+2212 is the
// non-colour channel §3 demands — the chip is red, and red is never the only signal. Written
// as an escape: a pasted minus sign is indistinguishable from a hyphen in review.
export function spawnShortfallChip(host, missing, { lifeMs = CHIP_LIFE_MS, now = defaultNow } = {}) {
  return mountChip(host, {
    text: `${MINUS}need ${missing} more`, negative: true, lifeMs, now,
  });
}

// The 3-frame rejection shake (§6.7). No modal, no beep: the purse itself says no.
const shakeTimers = new WeakMap();
export function purseShake(hudPurse) {
  if (!hudPurse || reducedMotion()) return;
  clearTimeout(shakeTimers.get(hudPurse));
  hudPurse.classList.remove('is-shaking');
  void hudPurse.offsetWidth; // reflow, so a shake already in flight restarts instead of ending
  hudPurse.classList.add('is-shaking');
  shakeTimers.set(hudPurse, setTimeout(() => hudPurse.classList.remove('is-shaking'), SHAKE_MS));
}
