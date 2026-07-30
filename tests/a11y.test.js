// tests/a11y.test.js — spec §8's keyboard floor and spec §0's Laws, over rendered markup.
//
// Plan Task 10 Steps 2 and 5 are written as manual browser passes ("play one full loop using only
// Tab/Enter/Space/1-4"). Most of what they ask is not actually a question about pixels: whether
// every control is reachable, whether tab order follows source order, whether every commit
// banner is one of the five named commitments, and whether every red or green amount carries a
// sign are all answerable from the markup the renderers emit. A manual pass verifies one
// afternoon; these verify every commit.
//
// The keyboard *bindings* (Space works the meter, Enter activates it, 1-4 pick actions, Space
// stands down over a focused button) are already covered in tests/main.test.js and are
// deliberately not restated here.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { mountAll, SCREEN_STATES, PHASES_COVERED, ALL_PHASES } from './support/screens.js';

const SCREENS = mountAll();
const css = ['src/styles.css', ...readdirSync('src/styles').map((f) => `src/styles/${f}`)]
  .map((f) => readFileSync(f, 'utf8')).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
const mainJs = readFileSync('src/main.js', 'utf8');

// Anything the browser puts in the tab ring. `[tabindex]` is what brings the meter in.
const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex], [contenteditable="true"]';
const all = (sel) => Object.entries(SCREENS)
  .flatMap(([name, host]) => [...host.querySelectorAll(sel)].map((el) => ({ name, el })));

describe('the state matrix covers every screen', () => {
  it('reaches all four phases', () => {
    expect([...PHASES_COVERED].sort()).toEqual([...ALL_PHASES].sort());
    expect(Object.keys(SCREEN_STATES).length).toBeGreaterThanOrEqual(9);
  });
});

// --- Spec §8: "Keyboard parity … Tab order follows source order." ---
describe('every control is reachable (spec §8)', () => {
  // The action names main.js will answer to, read out of its own handler table rather than
  // restated: a handler added with no button, or a button whose action was renamed, is exactly
  // the failure this catches, and both are silent today (wire() simply finds no handler).
  const handlerBlock = mainJs.slice(mainJs.indexOf('const handlers = {'));
  const HANDLERS = [...handlerBlock.slice(0, handlerBlock.indexOf('\n};'))
    .matchAll(/^\s{2}'?([\w-]+)'?:/gm)].map((m) => m[1]);

  it('reads main.js\'s handler table', () => {
    expect(HANDLERS.length).toBeGreaterThanOrEqual(18);
    expect(HANDLERS).toContain('next-fight');
    expect(HANDLERS).toContain('press');
  });

  it('renders a control for every handler, and a handler for every control', () => {
    const rendered = new Set(all('[data-action]').map(({ el }) => el.getAttribute('data-action')));
    // A handler nothing renders is dead code or, worse, a control that was renamed on one side.
    expect(HANDLERS.filter((a) => !rendered.has(a))).toEqual([]);
    // A control no handler answers is a button that looks alive and does nothing when clicked.
    expect([...rendered].filter((a) => !HANDLERS.includes(a)).sort()).toEqual([]);
  });

  it('puts every action on something the browser will focus', () => {
    const unreachable = all('[data-action]')
      // A natively `disabled` button is deliberately out of the tab ring: btn() emits the real
      // attribute only for a true no-op (nothing to repair, nobody to heal), and §8 asks for
      // reachable *controls*, not for dead ones to be focusable.
      .filter(({ el }) => !el.disabled && !el.matches(FOCUSABLE))
      .map(({ name, el }) => `${name}: ${el.tagName} [${el.getAttribute('data-action')}]`);
    expect(unreachable).toEqual([]);
  });

  // Spec §6.4 gives the meter `role="application"`, which is unreachable without a tabindex —
  // and §8 then demands focus-visible and Enter-to-activate on it. The role and the tabindex
  // stand or fall together.
  it('keeps the timing meter in the tab ring', () => {
    const meters = all('[data-meter]');
    expect(meters.length).toBeGreaterThan(0);
    for (const { name, el } of meters) {
      expect(el.getAttribute('tabindex'), name).toBe('0');
      expect(el.getAttribute('role'), name).toBeTruthy();
      expect(el.getAttribute('aria-label'), name).toBeTruthy();
    }
  });

  it('uses no positive tabindex anywhere - order is source order', () => {
    // A single positive value re-sequences the *whole document*, so this is the one attribute
    // that can break §8's tab-order promise without any rule or markup near it looking wrong.
    const positive = all('[tabindex]')
      .filter(({ el }) => Number(el.getAttribute('tabindex')) > 0)
      .map(({ name, el }) => `${name}: tabindex=${el.getAttribute('tabindex')}`);
    expect(positive).toEqual([]);
  });

  // …and nothing in the sheets re-sequences the *visual* order away from it. `order`, a reversed
  // flex direction or `direction: rtl` would leave tab order following source order while the eye
  // reads a different sequence, which is the failure mode §8's line is written against.
  it('lets no rule reorder a container away from source order', () => {
    const offenders = [];
    for (const [, prelude, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (prelude.trim().startsWith('@')) continue;
      if (/(^|;)\s*order\s*:/.test(body)) offenders.push(`${prelude.trim()}: order`);
      if (/(flex-direction|flex-flow)\s*:[^;]*reverse/.test(body)) offenders.push(`${prelude.trim()}: reverse`);
      if (/direction\s*:\s*rtl/.test(body)) offenders.push(`${prelude.trim()}: rtl`);
      if (/\bwrap-reverse\b/.test(body)) offenders.push(`${prelude.trim()}: wrap-reverse`);
    }
    expect(offenders).toEqual([]);
  });
});

// --- Spec §8: "Targets >= 44x44px (all .btn, shop cards, the meter itself)." ---
// Height only. jsdom lays nothing out, so a *width* is not knowable here — every control the
// game renders is either full-width in its column or sized by its label, and that is the half of
// this floor the browser pass has to confirm.
describe('interactive targets are at least 44px tall (spec §8)', () => {
  const heights = new Map();
  for (const [, prelude, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const h = /(?:^|;)\s*(?:min-)?height\s*:\s*(\d+(?:\.\d+)?)px/.exec(body);
    if (!h) continue;
    for (const sel of prelude.split(',').map((s) => s.trim())) {
      if (/^\.[\w-]+$/.test(sel)) heights.set(sel.slice(1), Math.max(heights.get(sel.slice(1)) ?? 0, Number(h[1])));
    }
  }

  it('found the sizing rules', () => {
    expect(heights.get('btn')).toBeGreaterThanOrEqual(44);
  });

  it('sizes every focusable the screens render', () => {
    const short = new Set();
    for (const { name, el } of all(FOCUSABLE)) {
      const best = Math.max(0, ...[...el.classList].map((c) => heights.get(c) ?? 0));
      if (best < 44) short.add(`${name}: ${el.tagName}.${[...el.classList].join('.')} -> ${best}px`);
    }
    expect([...short]).toEqual([]);
  });
});

// --- Spec Law 3 / §3: "Every red/green money value also carries a +/- sign." ---
// Colour is never the only channel, so this is the redundancy that has to hold in the markup.
// The codepoints are asserted numerically, never against a pasted character: a comparison with
// a pasted U+2212 passes when both sides are a hyphen, which is exactly how the U+00A0 bug hid.
describe('Law 3 — every signed amount carries its sign', () => {
  const PLUS = 0x2b;
  const MINUS = 0x2212;
  const toned = all('.amount--pos, .amount--neg');

  it('found amounts on both sides of zero', () => {
    expect(toned.filter(({ el }) => el.classList.contains('amount--pos')).length).toBeGreaterThan(0);
    expect(toned.filter(({ el }) => el.classList.contains('amount--neg')).length).toBeGreaterThan(0);
  });

  it('opens every green amount with + and every red one with U+2212', () => {
    const wrong = [];
    for (const { name, el } of toned) {
      const text = el.textContent.trim();
      const want = el.classList.contains('amount--pos') ? PLUS : MINUS;
      // The injuries tally is the one exception, pinned by the assertion below.
      if (labelOf(el) === 'Injuries gained') continue;
      if (text.codePointAt(0) !== want) {
        wrong.push(`${name}: "${text}" (${labelOf(el)}) opens U+${text.codePointAt(0).toString(16)}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  // The one red amount in the game with no sign, named so the exception cannot spread. The
  // ledger's other tally row states `U+2212 3 durability`, so the two rows disagree about
  // whether a count is signed, and "Injuries gained: 1" is distinguished from ": 0" by colour
  // alone. Whether the fix is `+1` (an injury *gained*) or a glyph is a §6.6/§9 copy decision,
  // not a verification-pass edit — so it is recorded here rather than changed.
  it('has exactly one unsigned red amount: the injuries tally', () => {
    const unsigned = toned
      .filter(({ el }) => {
        const c = el.textContent.trim().codePointAt(0);
        return c !== PLUS && c !== MINUS;
      })
      .map(({ el }) => labelOf(el));
    expect([...new Set(unsigned)]).toEqual(['Injuries gained']);
  });

  // The ledger row's own `<dt>`, so a failure names the line rather than a number.
  function labelOf(el) {
    const row = el.closest('.ledger__row');
    return row?.querySelector('dt')?.textContent.trim().replace(/\s*\(.*/, '') ?? null;
  }
});

// --- Spec Law 3 / §8: "blue = commitment … Next Fight / Press the Attack / Retire Rich /
// Fight Again / Return to Ludus." ---
// Both directions. A sixth blue banner is a Law 3 violation; a named commitment that stops
// rendering blue is one too, and only the reverse check notices that one.
describe('Law 3 — commit blue only on the five named commitments', () => {
  const ARROW = '▸'; // U+25B8 BLACK RIGHT-POINTING SMALL TRIANGLE, written as an escape.
  const COMMITMENTS = new Set([
    `Next Fight ${ARROW}`, `Press the Attack ${ARROW}`, 'Retire Rich',
    `Fight Again ${ARROW}`, 'Return to Ludus',
  ]);
  // The label is the button's own first text node: `btn()` appends a price slot after it
  // (the result CTA reads "Return to Ludus" + "140 G"), so textContent would concatenate money
  // into the label and no allowlist could ever match.
  const labels = all('.btn--commit').map(({ name, el }) => ({
    name, label: el.childNodes[0].textContent.trim(),
  }));

  it('renders commit banners to check', () => {
    expect(labels.length).toBeGreaterThanOrEqual(9);
  });

  it('wears blue on nothing but a named commitment', () => {
    expect(labels.filter(({ label }) => !COMMITMENTS.has(label))).toEqual([]);
  });

  it('renders all five of them somewhere in the matrix', () => {
    const seen = new Set(labels.map((l) => l.label));
    expect([...COMMITMENTS].filter((c) => !seen.has(c))).toEqual([]);
  });
});
