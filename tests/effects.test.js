// tests/effects.test.js — money theater (spec §6.6 ledger sequence, §6.7 ticker + chips).
//
// Everything in here is driven by timers and an *injected* clock, never by
// requestAnimationFrame: the browser pane this game is developed in reports
// `visibilityState: "hidden"` and paints zero frames, so a rAF-driven ticker would silently
// freeze at its starting value there. Each test stubs rAF to a spy and asserts it was never
// called, so a future rewrite cannot quietly reintroduce the dependency.
//
// The clock is passed in rather than read from `performance.now()` because vitest's fake
// timers do not fake `performance` — advancing timers alone would leave `now()` frozen and
// every progress fraction at 0. This is the same trap Task 6's meter capture hit from the
// other side: derive from the clock, never from the number of callbacks that happened to run.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  tickTo, runLedgerTheater, spawnDeltaChip, spawnShortfallChip, purseShake,
  BEAT_MS, THEATER_MAX_MS, TICKER_MS, CHIP_LIFE_MS, CHIP_MERGE_MS, CHIP_MAX, SHAKE_MS,
} from '../src/ui/effects.js';
import { formatGold } from '../src/ui/format.js';

let clock = 0;
const now = () => clock;
let raf;

beforeEach(() => {
  vi.useFakeTimers();
  clock = 0;
  raf = vi.fn();
  vi.stubGlobal('requestAnimationFrame', raf);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// Advance the injected clock and the timer queue together, the way real time does.
function advance(ms) {
  clock += ms;
  vi.advanceTimersByTime(ms);
}

const reduceMotion = (matches) =>
  vi.stubGlobal('matchMedia', vi.fn((q) => ({ media: q, matches })));

const ledger = (rows) => {
  const el = document.createElement('div');
  el.innerHTML = `<section class="ledger">${rows}</section>`;
  return el;
};
const plainRows = (n) =>
  Array.from({ length: n }, () => '<div class="ledger__row is-hidden"></div>').join('');
const moneyRow = (value, unit = 'gold-signed') =>
  `<div class="ledger__row is-hidden"><dt>Purse</dt>` +
  `<dd class="amount" data-value="${value}" data-unit="${unit}">` +
  `${formatGold(value, { signed: unit === 'gold-signed' })}</dd></div>`;

describe('tickTo (spec §6.7 ticker)', () => {
  it('counts from the old value to the new one and lands exactly on it', () => {
    const el = document.createElement('span');
    tickTo(el, 100, 700, { durationMs: 600, now });
    expect(el.textContent).toBe(formatGold(100)); // starts on the old number, not the new one
    advance(300);
    expect(el.textContent).toBe(formatGold(400));
    advance(300);
    expect(el.textContent).toBe(formatGold(700));
    expect(el.getAttribute('data-value')).toBe('700');
  });

  // The Task 6 lesson, restated for the ticker: the displayed value is a function of elapsed
  // time, not of how many callbacks have run. A tick-counting implementation reads 160 here.
  it('derives the value from the clock, not from the number of ticks that ran', () => {
    const el = document.createElement('span');
    tickTo(el, 100, 700, { durationMs: 600, stepMs: 60, now });
    clock = 300; // the clock jumped — a stalled tab, a slow frame, a coarse timer
    vi.advanceTimersByTime(60); // …but only one 60ms tick actually fired
    expect(el.textContent).toBe(formatGold(400));
  });

  it('paints no frames', () => {
    const el = document.createElement('span');
    tickTo(el, 0, 500, { durationMs: TICKER_MS, now });
    advance(TICKER_MS);
    expect(raf).not.toHaveBeenCalled();
  });

  it('counts down as well as up, in whole gold', () => {
    const el = document.createElement('span');
    tickTo(el, 500, 0, { durationMs: 600, now });
    advance(150);
    expect(el.textContent).toBe(formatGold(375));
    advance(450);
    expect(el.textContent).toBe(formatGold(0));
  });

  it('cancelling completes instantly instead of leaving a half-counted number', () => {
    const el = document.createElement('span');
    const cancel = tickTo(el, 0, 900, { durationMs: 600, now });
    advance(120);
    expect(el.textContent).not.toBe(formatGold(900));
    cancel();
    expect(el.textContent).toBe(formatGold(900));
    advance(600); // the cancelled timers must not write again
    expect(el.textContent).toBe(formatGold(900));
  });

  it('writes the target immediately under reduced motion', () => {
    reduceMotion(true);
    const el = document.createElement('span');
    tickTo(el, 0, 250, { durationMs: 600, now });
    expect(el.textContent).toBe(formatGold(250));
  });

  it('never runs longer than spec §6.7 allows', () => {
    expect(TICKER_MS).toBeLessThanOrEqual(600);
  });
});

describe('runLedgerTheater (spec §6.6)', () => {
  it('reveals rows one beat at a time', () => {
    const el = ledger(plainRows(3));
    runLedgerTheater(el, { beatMs: BEAT_MS, now });
    expect(el.querySelectorAll('.is-hidden').length).toBe(3);
    advance(BEAT_MS);
    expect(el.querySelectorAll('.is-hidden').length).toBe(2);
    advance(BEAT_MS * 2);
    expect(el.querySelectorAll('.is-hidden').length).toBe(0);
  });

  it('a click skips straight to the final state', () => {
    const el = ledger(plainRows(2));
    runLedgerTheater(el, { beatMs: BEAT_MS, now });
    el.click();
    expect(el.querySelectorAll('.is-hidden').length).toBe(0);
    advance(BEAT_MS * 4); // the cleared timers must not fire behind the skip
    expect(el.querySelectorAll('.is-hidden').length).toBe(0);
  });

  // §6.6: "Money rows count from 0 to value over the beat."
  it('counts each money row up from zero over its own beat', () => {
    const el = ledger(moneyRow(600));
    const amount = el.querySelector('.amount');
    runLedgerTheater(el, { beatMs: 400, now });
    expect(amount.textContent).toBe(formatGold(600, { signed: true })); // still hidden, still final
    advance(400); // the row is revealed and starts at zero
    expect(amount.textContent).toBe(formatGold(0, { signed: true }));
    advance(200);
    expect(amount.textContent).toBe(formatGold(300, { signed: true }));
    advance(200);
    expect(amount.textContent).toBe(formatGold(600, { signed: true }));
  });

  it('counts a negative row down to its posted value', () => {
    const el = ledger(moneyRow(-90));
    const amount = el.querySelector('.amount');
    runLedgerTheater(el, { beatMs: 400, now });
    advance(800);
    expect(amount.textContent).toBe(formatGold(-90, { signed: true }));
    expect(amount.textContent.codePointAt(0)).toBe(0x2212); // U+2212, never a hyphen
  });

  it('a skip finishes every counter too, not just the reveals', () => {
    const el = ledger(moneyRow(600) + moneyRow(-90));
    runLedgerTheater(el, { beatMs: BEAT_MS, now });
    advance(BEAT_MS); // first row revealed and mid-count
    el.click();
    const amounts = [...el.querySelectorAll('.amount')].map((a) => a.textContent);
    expect(amounts).toEqual([
      formatGold(600, { signed: true }), formatGold(-90, { signed: true })]);
  });

  // §6.6: "Total sequence ≤ 2.5s." A fixed 350ms beat blows that budget on a long ledger,
  // so the beat compresses rather than the sequence overrunning.
  it('fits the whole sequence, counters included, inside the §6.6 budget', () => {
    const el = ledger(plainRows(12));
    runLedgerTheater(el, { beatMs: BEAT_MS, now });
    advance(THEATER_MAX_MS);
    expect(el.querySelectorAll('.is-hidden').length).toBe(0);
    // …and a short ledger still runs at the full --dur-tally beat.
    const short = ledger(plainRows(2));
    runLedgerTheater(short, { beatMs: BEAT_MS, now });
    advance(BEAT_MS - 1);
    expect(short.querySelectorAll('.is-hidden').length).toBe(2);
  });

  it('pre-tallies everything under reduced motion (spec §5)', () => {
    reduceMotion(true);
    const el = ledger(moneyRow(600) + plainRows(2));
    runLedgerTheater(el, { beatMs: BEAT_MS, now });
    expect(el.querySelectorAll('.is-hidden').length).toBe(0);
    expect(el.querySelector('.amount').textContent).toBe(formatGold(600, { signed: true }));
  });

  // A row revealed with no options is revealed *pre-tallied*: it states the figure the renderer
  // already wrote. Getting there by starting a ten-timer count and clearing it in the same
  // breath is ten timers per money row per skip, and says the opposite of what it means.
  it('reveals a pre-tallied row with a plain write, scheduling nothing', () => {
    const el = ledger(moneyRow(600) + moneyRow(-90));
    runLedgerTheater(el, { beatMs: BEAT_MS, now });
    const scheduled = vi.spyOn(globalThis, 'setTimeout');
    try {
      el.click(); // the skip reveals every remaining row pre-tallied
      expect(scheduled).not.toHaveBeenCalled();
      expect([...el.querySelectorAll('.amount')].map((a) => a.textContent)).toEqual([
        formatGold(600, { signed: true }), formatGold(-90, { signed: true })]);
      expect([...el.querySelectorAll('.amount')].map((a) => a.getAttribute('data-value')))
        .toEqual(['600', '-90']); // …and still agree with the value they were counted from
    } finally {
      scheduled.mockRestore();
    }
  });

  it('paints no frames', () => {
    const el = ledger(plainRows(3) + moneyRow(600));
    runLedgerTheater(el, { beatMs: BEAT_MS, now });
    advance(THEATER_MAX_MS);
    expect(raf).not.toHaveBeenCalled();
  });

  it('survives an empty or missing container', () => {
    expect(() => runLedgerTheater(null)).not.toThrow();
    expect(() => runLedgerTheater(ledger(''))).not.toThrow();
  });
});

describe('spawnDeltaChip (spec §6.7)', () => {
  it('renders a signed amount and removes itself after its lifetime', () => {
    const host = document.createElement('div');
    spawnDeltaChip(host, -90, { lifeMs: CHIP_LIFE_MS, now });
    const chip = host.querySelector('.delta-chip');
    expect(chip.textContent).toBe(formatGold(-90, { signed: true }));
    expect(chip.textContent.codePointAt(0)).toBe(0x2212);
    expect(chip.className).toContain('delta-chip--neg');
    advance(CHIP_LIFE_MS);
    expect(host.querySelector('.delta-chip')).toBeNull();
  });

  it('signs a gain positively', () => {
    const host = document.createElement('div');
    const chip = spawnDeltaChip(host, 600, { now });
    expect(chip.textContent).toBe(formatGold(600, { signed: true }));
    expect(chip.className).toContain('delta-chip--pos');
  });

  // §6.7: "Consolidate same-sign changes within 300ms into one chip."
  it('consolidates same-sign changes inside the merge window into one chip', () => {
    const host = document.createElement('div');
    spawnDeltaChip(host, 10, { now });
    advance(CHIP_MERGE_MS - 1);
    spawnDeltaChip(host, 20, { now });
    const chips = host.querySelectorAll('.delta-chip');
    expect(chips.length).toBe(1);
    expect(chips[0].textContent).toBe(formatGold(30, { signed: true }));
  });

  // §6.7's window is "within 300ms" — of the first change, not of the last merge. Restamping the
  // merged chip restarts the window, so a player clicking every 299ms consolidates forever and
  // the purse never once shows what a single purchase cost.
  it('measures the merge window from the first chip, not from the last merge', () => {
    const host = document.createElement('div');
    spawnDeltaChip(host, 10, { now });
    advance(CHIP_MERGE_MS - 1);
    spawnDeltaChip(host, 10, { now }); // inside the window: merges to +20
    expect(host.querySelectorAll('.delta-chip').length).toBe(1);
    advance(CHIP_MERGE_MS - 1); // now well past 300ms from the first chip
    spawnDeltaChip(host, 10, { now });
    expect([...host.querySelectorAll('.delta-chip')].map((c) => c.textContent)).toEqual([
      formatGold(20, { signed: true }), formatGold(10, { signed: true })]);
  });

  it('does not consolidate across a sign change or past the window', () => {
    const host = document.createElement('div');
    spawnDeltaChip(host, 10, { now });
    spawnDeltaChip(host, -20, { now }); // opposite sign: a separate chip
    expect(host.querySelectorAll('.delta-chip').length).toBe(2);

    const later = document.createElement('div');
    spawnDeltaChip(later, 10, { now });
    advance(CHIP_MERGE_MS + 1);
    spawnDeltaChip(later, 20, { now });
    expect(later.querySelectorAll('.delta-chip').length).toBe(2);
  });

  it('a merged chip lives out a full lifetime from the merge', () => {
    const host = document.createElement('div');
    spawnDeltaChip(host, 10, { lifeMs: CHIP_LIFE_MS, now });
    advance(CHIP_MERGE_MS);
    spawnDeltaChip(host, 20, { lifeMs: CHIP_LIFE_MS, now });
    advance(CHIP_LIFE_MS - 1); // the first chip's original timer has long since passed
    expect(host.querySelectorAll('.delta-chip').length).toBe(1);
    advance(1);
    expect(host.querySelectorAll('.delta-chip').length).toBe(0);
  });

  it('caps visible chips at two, evicting the oldest', () => {
    const host = document.createElement('div');
    // Alternating signs, so §6.7's consolidation never merges them into one.
    spawnDeltaChip(host, 10, { now });
    spawnDeltaChip(host, -20, { now });
    spawnDeltaChip(host, 30, { now });
    const chips = [...host.querySelectorAll('.delta-chip')];
    expect(chips.length).toBe(CHIP_MAX);
    expect(chips.map((c) => c.textContent)).toEqual([
      formatGold(-20, { signed: true }), formatGold(30, { signed: true })]);
  });

  it('paints no frames', () => {
    const host = document.createElement('div');
    spawnDeltaChip(host, 10, { now });
    advance(CHIP_LIFE_MS);
    expect(raf).not.toHaveBeenCalled();
  });

  it('lingers longer under reduced motion, since it no longer travels', () => {
    reduceMotion(true);
    const host = document.createElement('div');
    spawnDeltaChip(host, 10, { lifeMs: CHIP_LIFE_MS, now });
    advance(CHIP_LIFE_MS);
    expect(host.querySelector('.delta-chip')).not.toBeNull();
  });
});

describe('spawnShortfallChip (spec §6.7 rejected purchase)', () => {
  it('names the gap and carries the loss sign', () => {
    const host = document.createElement('div');
    const chip = spawnShortfallChip(host, formatGold(150), { now });
    expect(chip.textContent).toContain(formatGold(150));
    expect(chip.textContent.codePointAt(0)).toBe(0x2212); // sign, not colour alone (§3)
    expect(chip.className).toContain('delta-chip--neg');
    advance(CHIP_LIFE_MS);
    expect(host.querySelector('.delta-chip')).toBeNull();
  });

  it('escapes a hostile shortfall string instead of injecting it', () => {
    const host = document.createElement('div');
    spawnShortfallChip(host, '<img src=x>', { now });
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('.delta-chip').textContent).toContain('<img src=x>');
  });

  it('never merges with a money chip', () => {
    const host = document.createElement('div');
    spawnDeltaChip(host, -10, { now });
    spawnShortfallChip(host, formatGold(150), { now });
    expect(host.querySelectorAll('.delta-chip').length).toBe(2);
  });
});

describe('purseShake (spec §6.7)', () => {
  it('adds the shake class and takes it off again', () => {
    const el = document.createElement('span');
    purseShake(el);
    expect(el.classList.contains('is-shaking')).toBe(true);
    advance(SHAKE_MS);
    expect(el.classList.contains('is-shaking')).toBe(false);
  });

  it('restarts a shake already in flight rather than swallowing it', () => {
    const el = document.createElement('span');
    purseShake(el);
    advance(SHAKE_MS - 10);
    purseShake(el);
    advance(20); // the first shake's timer has now passed…
    expect(el.classList.contains('is-shaking')).toBe(true); // …but the second is still running
    advance(SHAKE_MS);
    expect(el.classList.contains('is-shaking')).toBe(false);
  });

  it('does nothing under reduced motion, and nothing at all without a purse', () => {
    reduceMotion(true);
    const el = document.createElement('span');
    purseShake(el);
    expect(el.classList.contains('is-shaking')).toBe(false);
    expect(() => purseShake(null)).not.toThrow();
  });
});
