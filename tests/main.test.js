// tests/main.test.js — the fight-screen wiring: sweet-spot seeding, timestamp capture,
// the freeze, and keyboard parity (spec §6.4 interaction, §8 keyboard floor).
//
// Deliberately runs with requestAnimationFrame stubbed to a no-op that never calls back, i.e.
// ZERO painted frames — the same condition the headless browser pane reports. Everything
// asserted here therefore comes from the timestamp maths, not from a frame having run. If a
// test in this file only passes when frames paint, the capture is reading the DOM instead of
// the clock, which is exactly the bug spec §6.4 calls out.
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { CONFIG } from '../src/config.js';
import { makeRng } from '../src/rng.js';
import { sweetCenter } from '../src/ui/timing.js';
import { formatGold } from '../src/ui/format.js';

const SEED_ROLL = 0.4242; // what Math.random is pinned to below
const SEED = Math.floor(SEED_ROLL * 1e9); // …and the run seed main.js derives from it

let clock = 0; // the whole file's notion of performance.now()
let t0 = 0; // clock reading at the last render, i.e. the sweep's origin
let raf;
let caf;
// [type, listener, options] for every document-level listener the module under test binds.
// Deliberately not filtered by type: the moment a later task binds anything else on the
// document, a type filter would leave the previous module instance's listener attached and
// two detached games would answer the same event.
let docListeners = [];

const PERIOD = CONFIG.combat.meterPeriodMs.base; // opponent 0 sweeps at the base duration
const BAND = CONFIG.combat.sweetCenter;
// What createCombat seeds before the run's rng gets a turn (src/combat.js).
const DEFAULT_SWEET = (BAND.min + BAND.max) / 2;

const app = () => document.getElementById('app');
const q = (sel) => app().querySelector(sel);

function press(key, init = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  document.dispatchEvent(event);
  return event;
}

// A key that resolves the turn: the re-render restarts the sweep at "now".
function act(key, init = {}) {
  const event = press(key, init);
  t0 = clock;
  return event;
}

function click(sel) {
  q(sel).click();
  t0 = clock;
}

// Read this turn's sweet spot back out of the meter's own rendered geometry, so the test
// never has to replay the run's rng to know where the bright band landed.
function renderedCenter() {
  const style = q('.meter__zone--crit').getAttribute('style');
  const start = Number(style.match(/left:([\d.]+)%/)[1]) / 100;
  const size = Number(style.match(/width:([\d.]+)%/)[1]) / 100;
  // meterZones trims each band to the track, and a trimmed band's midpoint is no longer the
  // sweet spot. Every "capture at the centre" test below would then aim slightly off and the
  // crit assertions would go quietly soft, so refuse to infer a centre from a clamped band.
  expect(start).toBeGreaterThan(0);
  expect(start + size).toBeLessThan(1);
  return start + size / 2;
}

// Press Space at the instant the cursor sits at track position `p`.
function captureAt(p) {
  clock = t0 + p * PERIOD;
  press(' ');
}

// A track position comfortably outside every zone, whichever half of the band we seeded in.
const farFrom = (center) => (center > 0.5 ? center - 0.45 : center + 0.45);

const logText = () => q('.log').textContent;
// Where the cursor is actually drawn. jsdom lays nothing out, so tests that care about the
// cursor pin clientWidth on the meter first (see WIDTH).
const WIDTH = 400;
const pinWidth = () =>
  Object.defineProperty(q('[data-meter]'), 'clientWidth', { value: WIDTH, configurable: true });
const cursorX = () =>
  Number(q('.meter-cursor').style.transform.match(/translateX\(([-\d.e+]+)px\)/)[1]);

function enterFight() {
  clock = 1000;
  click('[data-action="next-fight"]');
}

beforeAll(() => {
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  // A fixed seed keeps enemy rolls and sweet spots reproducible across runs.
  vi.spyOn(Math, 'random').mockReturnValue(SEED_ROLL);
});

afterAll(() => vi.restoreAllMocks());

afterEach(() => vi.unstubAllGlobals());

// Load a fresh main.js over a fresh #app, collecting the document-level listeners it binds so
// the next test can detach them. A test that needs main.js built against a mocked module calls
// this again after `vi.doMock`; both instances' listeners end up in `docListeners`, so the next
// beforeEach still cleans up after every one of them.
async function loadMain() {
  const realAdd = document.addEventListener;
  document.addEventListener = function collect(type, fn, opts) {
    docListeners.push([type, fn, opts]);
    return realAdd.call(this, type, fn, opts);
  };
  try {
    document.body.innerHTML = '<div id="app"></div>';
    clock = 0;
    t0 = 0;
    vi.resetModules();
    await import('../src/main.js');
  } finally {
    document.addEventListener = realAdd;
  }
}

beforeEach(async () => {
  // Each test gets a fresh module instance; the previous one's document-level listeners
  // would otherwise keep driving its own detached game.
  for (const [type, fn, opts] of docListeners) document.removeEventListener(type, fn, opts);
  docListeners = [];

  raf = vi.fn(() => 0);
  caf = vi.fn();
  vi.stubGlobal('requestAnimationFrame', raf);
  vi.stubGlobal('cancelAnimationFrame', caf);

  await loadMain();
});

describe('sweet-spot seeding', () => {
  it('seeds a centre inside the configured band for the first player turn', () => {
    enterFight();
    const center = renderedCenter();
    expect(center).toBeGreaterThanOrEqual(BAND.min);
    expect(center).toBeLessThanOrEqual(BAND.max);
  });

  // A first turn that is never re-seeded still renders a legal-looking meter — createCombat
  // gives every fight a mid-band sweet spot, which sits inside the band. Only pinning it to
  // the run's own rng separates "seeded" from "defaulted".
  it('takes the first turn from the run’s rng, not the fight’s default centre', () => {
    const expected = sweetCenter(makeRng(SEED)(), CONFIG);
    expect(expected).not.toBeCloseTo(DEFAULT_SWEET, 2); // the default cannot impersonate a seed
    enterFight();
    expect(renderedCenter()).toBeCloseTo(expected, 3);
  });

  // The press offer short-circuits the enemy's turn, so it is the one re-render that can hand
  // back an unchanged meter. Reusing the previous turn's sweet spot makes the timing free to
  // memorise at exactly the moment the player is pressing their advantage.
  it('re-seeds when the press is offered, so a press turn is not a memorised repeat', () => {
    enterFight();
    const first = renderedCenter();
    captureAt(first);
    act('1'); // a crit lands, the enemy survives → the press is offered, no enemy turn
    expect(q('[data-action="press"]')).not.toBeNull();
    const second = renderedCenter();
    expect(second).not.toBeCloseTo(first, 4);
    expect(second).toBeGreaterThanOrEqual(BAND.min);
    expect(second).toBeLessThanOrEqual(BAND.max);
  });

  it('re-seeds after the enemy answers, so the target moves every turn', () => {
    enterFight();
    const first = renderedCenter();
    act('1'); // strike with no capture: a miss, so the enemy answers and we re-render
    const second = renderedCenter();
    expect(second).not.toBeCloseTo(first, 4);
    expect(second).toBeGreaterThanOrEqual(BAND.min);
    expect(second).toBeLessThanOrEqual(BAND.max);
  });
});

describe('capture and freeze', () => {
  it('marks the meter captured and stops the sweep loop', () => {
    enterFight();
    expect(q('[data-meter]').classList.contains('is-captured')).toBe(false);
    captureAt(renderedCenter());
    expect(q('[data-meter]').classList.contains('is-captured')).toBe(true);
    expect(caf).toHaveBeenCalled();
  });

  it('resolves the captured timestamp against the sweet spot, with no frames painted', () => {
    enterFight();
    expect(raf).toHaveBeenCalled(); // the loop was started…
    expect(raf.mock.calls.length).toBe(1); // …and never got a frame back
    captureAt(renderedCenter());
    act('1');
    expect(logText()).toContain('You strike (crit)');
  });

  it('logs a miss when the cursor is captured far from the sweet spot', () => {
    enterFight();
    captureAt(farFrom(renderedCenter()));
    act('1');
    expect(logText()).toContain('You strike (miss) for 0 damage.');
  });

  it('treats an action with no capture at all as a miss', () => {
    enterFight();
    act('1');
    expect(logText()).toContain('You strike (miss) for 0 damage.');
  });

  // The freeze is the whole calibration mechanic: once the cursor stops, later time must not
  // leak into the captured position. Without the running guard the second press would
  // overwrite a crit with a miss.
  it('freezes: a second press cannot move the already-captured position', () => {
    enterFight();
    const center = renderedCenter();
    captureAt(center);
    captureAt(farFrom(center)); // a would-be miss, much later in the sweep — must be ignored
    act('1');
    expect(logText()).toContain('You strike (crit)');
  });

  // The frozen cursor is the player's only readout of what the game judged. Leaving it at the
  // last painted frame shows a position up to a frame's travel away from the one that resolved
  // — and in a tab that paints no frames at all, leaves it at the origin while a crit lands.
  it('parks the frozen cursor on the resolved position, not the last painted frame', () => {
    const frames = driveFrames();
    enterFight();
    pinWidth();
    const center = renderedCenter();
    clock = t0 + 0.1 * PERIOD;
    expect(frames.frame()).toBe(1); // the last frame paints the cursor early in the sweep…
    const painted = cursorX();
    expect(painted).toBeCloseTo(0.1 * WIDTH, 6);
    captureAt(center); // …but the press lands later, on the sweet spot
    expect(cursorX()).toBeCloseTo(center * WIDTH, 6);
    expect(cursorX()).not.toBeCloseTo(painted, 3);
    act('1');
    expect(logText()).toContain('You strike (crit)');
  });

  it('captures on a click on the meter as well as on Space', () => {
    enterFight();
    const center = renderedCenter();
    clock = t0 + center * PERIOD;
    q('[data-meter]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(q('[data-meter]').classList.contains('is-captured')).toBe(true);
    act('1');
    expect(logText()).toContain('You strike (crit)');
  });

  it('starts each turn with a fresh, uncaptured sweep', () => {
    enterFight();
    captureAt(renderedCenter());
    act('1'); // crit lands → press offered, meter re-rendered
    expect(q('[data-meter]').classList.contains('is-captured')).toBe(false);
  });
});

// Everything above runs with zero painted frames. These two need real frames, so they swap in
// a rAF stub that actually queues callbacks and hands them back on demand.
function driveFrames() {
  let nextId = 1;
  const pending = new Map();
  vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => {
    const id = nextId++;
    pending.set(id, cb);
    return id;
  }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id) => { pending.delete(id); }));
  return {
    // Run exactly one frame: every callback queued right now, none of their continuations.
    frame() {
      const due = [...pending.values()];
      pending.clear();
      for (const cb of due) cb();
      return due.length;
    },
    get queued() { return pending.size; },
  };
}

describe('the sweep loop (one at a time)', () => {
  // Every render during FIGHT calls startMeter. Without cancelling the outgoing loop each one
  // adds a rAF chain, all of them sharing one mutable meter object and stomping meter.raf, so
  // captureMeter's cancel reaches only the last writer and the rest run on forever.
  it('does not accumulate a loop per turn', () => {
    const frames = driveFrames();
    enterFight();
    expect(frames.queued).toBe(1);
    for (let turn = 0; turn < 4; turn += 1) {
      expect(frames.frame()).toBe(1); // one live loop stepped, and it rescheduled itself once
      act('1'); // a miss, so the enemy answers and the fight re-renders
      expect(frames.queued).toBe(1);
    }
  });

  it('stops every loop on capture, leaving nothing scheduled', () => {
    const frames = driveFrames();
    enterFight();
    for (let turn = 0; turn < 3; turn += 1) { frames.frame(); act('1'); }
    frames.frame();
    captureAt(renderedCenter());
    expect(frames.queued).toBe(0);
    expect(frames.frame()).toBe(0); // …and nothing revives on the next frame
  });
});

describe('keyboard parity (spec §8)', () => {
  it('maps 1-4 to strike, heavy, block and feint', () => {
    enterFight();
    act('1');
    expect(logText()).toContain('You strike (miss)');
    act('2');
    expect(logText()).toContain('You heavy (miss)');
    act('3');
    expect(logText()).toContain('You raise your guard');
    act('4');
    expect(logText()).toContain('You feint (miss)');
  });

  it('ignores auto-repeat, so a held key cannot capture or spam actions', () => {
    enterFight();
    captureAt(0.5);
    expect(q('[data-meter]').classList.contains('is-captured')).toBe(true);

    // Fresh turn, held key: nothing captures.
    act('1');
    clock = t0 + 0.5 * PERIOD;
    press(' ', { repeat: true });
    expect(q('[data-meter]').classList.contains('is-captured')).toBe(false);
    const before = logText();
    press('1', { repeat: true });
    expect(logText()).toBe(before);
  });

  it('does nothing outside the fight phase', () => {
    expect(q('[data-meter]')).toBeNull(); // we are on the hub
    // Without the phase guard the hub's `1` reaches applyPlayerAction with no combat state and
    // throws inside the listener, where jsdom swallows it — so the throw is captured here and
    // asserted on, rather than left to surface as an unattributed run error.
    const errors = [];
    const onError = (e) => { errors.push(e.error ?? e.message); e.preventDefault(); };
    window.addEventListener('error', onError);
    const before = app().innerHTML;
    press('1');
    press(' ');
    window.removeEventListener('error', onError);
    expect(errors).toEqual([]);
    expect(app().innerHTML).toBe(before);
    expect(q('[data-action="next-fight"]')).not.toBeNull();
  });

  // Space is a button's own activation key. Swallowing it during FIGHT leaves a keyboard user
  // parked on Strike unable to strike; the meter eats the press instead. Spec §8 is a floor.
  it('leaves Space to a focused action button', () => {
    enterFight();
    const strike = q('[data-action="strike"]');
    strike.focus();
    expect(document.activeElement).toBe(strike);
    clock = t0 + renderedCenter() * PERIOD; // a press here would otherwise capture a crit
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    strike.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false); // the browser may still activate the button
    expect(q('[data-meter]').classList.contains('is-captured')).toBe(false);
  });

  it('still takes Space when nothing interactive holds focus', () => {
    enterFight();
    const center = renderedCenter();
    clock = t0 + center * PERIOD;
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(q('[data-meter]').classList.contains('is-captured')).toBe(true);
  });

  // Spec 8 makes the meter a target in its own right and Enter the generic activation key.
  // A role="application" widget nothing can focus is unreachable for assistive tech, so the
  // tabindex and the Enter handler stand or fall together.
  it('is focusable and captures on Enter when it holds focus', () => {
    enterFight();
    const bar = q('[data-meter]');
    bar.focus();
    expect(document.activeElement).toBe(bar);
    clock = t0 + renderedCenter() * PERIOD;
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    bar.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(bar.classList.contains('is-captured')).toBe(true);
    act('1');
    expect(logText()).toContain('You strike (crit)');
  });

  it('claims the browser default only for the keys it owns', () => {
    enterFight();
    expect(press(' ').defaultPrevented).toBe(true);
    expect(press('3').defaultPrevented).toBe(true);
    expect(press('x').defaultPrevented).toBe(false);
    expect(press('5').defaultPrevented).toBe(false);
  });
});

// Spec §6.9 wants the newest entry "appended at bottom and auto-scrolled", and §8 wants a turn
// announced politely. Neither can live in the renderer: it emits strings and touches no DOM,
// and mount() replaces #app wholesale on every render — so the strip's scrollTop returns to 0
// and any live region inside it is a brand-new node that assistive tech has never seen.
describe('the combat log strip (spec §6.9 / §8)', () => {
  const live = () => document.getElementById('log-announcer');

  it('scrolls the strip to the newest entry after every render', () => {
    // jsdom performs no layout, so scrollHeight is 0 unless stubbed — and the <ul> is rebuilt
    // each render, so the stub has to sit on the prototype rather than on one node.
    const HEIGHT = 431;
    const real = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollHeight');
    Object.defineProperty(Element.prototype, 'scrollHeight', {
      configurable: true, get: () => HEIGHT });
    try {
      enterFight();
      expect(q('.log').scrollTop).toBe(HEIGHT);
      act('1'); // a turn resolves and the whole screen is rebuilt…
      expect(q('.log').scrollTop).toBe(HEIGHT); // …and the strip is back at the bottom
    } finally {
      Object.defineProperty(Element.prototype, 'scrollHeight', real);
    }
  });

  it('keeps one persistent live region outside the re-rendered screen', () => {
    enterFight();
    const region = live();
    expect(region).not.toBeNull();
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(app().contains(region)).toBe(false); // mount() cannot destroy it
    act('1');
    expect(live()).toBe(region); // same node, so the announcement is a real content change
  });

  it('announces the turn that just happened, not the whole strip', () => {
    enterFight();
    expect(live().textContent).toBe('');
    act('1'); // a miss, then the enemy's answer: one exchange, one utterance
    const spoken = live().textContent;
    expect(spoken).toContain('You strike (miss) for 0 damage.');
    expect(spoken).toContain('strikes ('); // the enemy's reply is in the same announcement
    expect(spoken).not.toContain('<'); // plain speech, never markup
    expect(spoken).not.toMatch(/T\d/); // and no turn stamps read out loud
    act('2');
    expect(live().textContent).toContain('You heavy (miss)');
    expect(live().textContent).not.toContain('You strike'); // the last turn is not repeated
  });

  // The Brute has 40 hp and a crit strike takes 28, so two crits end the bout — deterministic,
  // and the second one is thrown with a *different* verb so the last announcement cannot be
  // mistaken for a repeat of the one before it.
  function critTheBruteDown() {
    captureAt(renderedCenter());
    act('1'); // crit: the press is offered, so the enemy never answers
    captureAt(renderedCenter());
    act('2'); // a heavy crit finishes it
    expect(q('[data-meter]'), 'the fight did not end').toBeNull();
  }

  // The killing blow is pushed and then rendered as the *result* screen, so anything gated on
  // the FIGHT phase leaves every fight's last exchange unspoken.
  it('announces the blow that ends the fight', () => {
    enterFight();
    critTheBruteDown();
    expect(live().textContent).toContain('You heavy (crit)');
  });

  // The count of already-spoken lines has to be forgotten between fights, or the next fight —
  // whose log starts empty again — is silently never announced at all.
  it('starts announcing again in the next fight', () => {
    enterFight();
    critTheBruteDown();
    const lastFight = live().textContent;
    click('[data-action="to-hub"]');
    enterFight();
    // The region is not wiped on the way out — a stale string is never re-announced — but the
    // next turn must still overwrite it. Without the reset, `slice(announced)` on a log that
    // has restarted at zero is empty forever and the whole next bout goes unspoken.
    act('1');
    expect(live().textContent).not.toBe(lastFight);
    expect(live().textContent).toContain('You strike (miss) for 0 damage.');
  });
});

// Spec §6.6/§6.7: money is never allowed to teleport. The purse counts, a signed chip falls
// beside it, the ledger tallies one line at a time — and a rejected purchase says so out loud.
//
// Every assertion below runs with requestAnimationFrame stubbed to a no-op that never calls
// back, exactly like the rest of this file, so none of this theater can quietly come to depend
// on a painted frame. `performance.now` is already pinned to `clock`, and vitest's fake timers
// do not fake `performance`, so advancing the two together is what real time looks like here.
describe('money theater (spec §6.6 / §6.7)', () => {
  const purse = () => q('.hud__purse');
  const ticker = () => q('.hud__purse .ticker');
  const chips = () => [...app().querySelectorAll('.delta-chip')];
  const rows = () => [...app().querySelectorAll('.ledger__row')];
  const hiddenRows = () => rows().filter((r) => r.classList.contains('is-hidden'));

  // Fake timers, restored however the body exits — a leaked fake clock breaks every later file.
  function withTimers(body) {
    vi.useFakeTimers();
    try { body(); } finally { vi.useRealTimers(); }
  }
  const tick = (ms) => { clock += ms; vi.advanceTimersByTime(ms); };

  const TRAIN_COST = 80; // config: training.baseCost at level 0
  const START = CONFIG.startingGold;

  it('counts the purse down to its new value, painting no frames', () => {
    withTimers(() => {
      click('[data-action="train-power"]');
      expect(ticker().textContent).toBe(formatGold(START)); // opens on the old number
      tick(300);
      expect(ticker().textContent).toBe(formatGold(START - TRAIN_COST / 2));
      tick(300);
      expect(ticker().textContent).toBe(formatGold(START - TRAIN_COST));
      expect(raf).not.toHaveBeenCalled();
    });
  });

  // A render that moves no gold still replaces the purse, so the count in flight is aimed at a
  // detached node from that moment on. Retiring it has to happen above the no-change guard, or
  // the outgoing ticker keeps writing into a number nobody can see.
  it('retires the outgoing count even when the new render moves no gold', () => {
    withTimers(() => {
      click('[data-action="train-power"]');
      tick(120);
      const outgoing = ticker();
      expect(outgoing.textContent).not.toBe(formatGold(START - TRAIN_COST)); // mid-count
      click('[data-action="next-fight"]'); // a render that changes no gold at all
      expect(app().contains(outgoing)).toBe(false); // …and detaches the node being counted
      expect(outgoing.textContent).toBe(formatGold(START - TRAIN_COST));
    });
  });

  it('drops a signed chip beside the purse on every gold change', () => {
    withTimers(() => {
      expect(chips()).toEqual([]); // …but not on the first render of a run
      click('[data-action="train-power"]');
      expect(chips().map((c) => c.textContent))
        .toEqual([formatGold(-TRAIN_COST, { signed: true })]);
      expect(chips()[0].className).toContain('delta-chip--neg');
      expect(purse().contains(chips()[0])).toBe(true);
    });
  });

  it('spends the whole fight purse in one chip when the ledger pays out', () => {
    withTimers(() => {
      enterFight();
      captureAt(renderedCenter());
      act('1');
      captureAt(renderedCenter());
      act('2'); // the Brute goes down; the result screen opens on a fatter purse
      const won = CONFIG.opponents[0].purse - Math.round(CONFIG.opponents[0].purse * CONFIG.arena.taxRate);
      expect(chips().map((c) => c.textContent)).toEqual([formatGold(won, { signed: true })]);
      expect(chips()[0].className).toContain('delta-chip--pos');
    });
  });

  // Spec §6.2 keeps the unaffordable button clickable on purpose. The click must therefore do
  // something: before this, the handler recomputed an identical state and the game sat there.
  it('shakes the purse and states the gap when a purchase is rejected', () => {
    withTimers(() => {
      click('[data-action="train-power"]'); // 100 -> 20, next level costs 128
      tick(1000); // let the successful purchase's chip and count expire
      const before = purse();
      const button = q('[data-action="train-power"]');
      expect(button.getAttribute('data-missing')).toBeTruthy();
      button.click();
      expect(purse()).toBe(before); // nothing re-rendered: the state genuinely did not change
      expect(purse().classList.contains('is-shaking')).toBe(true);
      // The gap the button was already carrying, spoken by the purse. The sign is pinned by
      // codepoint rather than compared against a pasted glyph — U+2212 and a hyphen are
      // indistinguishable in source, so that comparison passes when both sides are wrong.
      expect(chips().length).toBe(1);
      expect(chips()[0].textContent)
        .toContain(`need ${button.getAttribute('data-missing')} more`);
      expect(chips()[0].textContent.codePointAt(0)).toBe(0x2212);
      expect(chips()[0].className).toContain('delta-chip--neg');
      tick(300);
      expect(purse().classList.contains('is-shaking')).toBe(false);
    });
  });

  // game.js refuses a purchase by returning the *identical* state object, so object identity is
  // the only honest test of refusal. Inferring it from an unchanged purse means any spend that
  // moves the model without moving gold — a zero-cost action, a non-monetary one — is applied
  // and then never drawn, and the player is shown a shake for a purchase that went through.
  it('draws a spend that changes state without changing gold', async () => {
    vi.doMock('../src/game.js', async () => {
      const actual = await vi.importActual('../src/game.js');
      return { ...actual, bribeOfficial: (s) => ({ ...s, bribedThisFight: true }) };
    });
    try {
      await loadMain();
      expect(q('[data-action="bribe"]')).not.toBeNull();
      const gold = q('.hud__purse .ticker').getAttribute('data-value');
      q('[data-action="bribe"]').click();
      expect(q('.hud__purse .ticker').getAttribute('data-value')).toBe(gold); // no money moved…
      // …but the hub redrew: the bribe slot is now the inert "Bribed ✓" button.
      expect(q('[data-action="bribe"]')).toBeNull();
      expect(app().textContent).toContain('Bribed');
      expect(q('.hud__purse').classList.contains('is-shaking')).toBe(false);
      expect(chips()).toEqual([]); // and nothing told the player they were broke
    } finally {
      vi.doUnmock('../src/game.js');
    }
  });

  it('leaves an affordable purchase unshaken', () => {
    withTimers(() => {
      click('[data-action="train-power"]');
      expect(purse().classList.contains('is-shaking')).toBe(false);
      expect(q('[data-action="train-power"]').getAttribute('data-missing')).toBeTruthy();
    });
  });

  it('tallies the result ledger one beat at a time, and a click skips it', () => {
    withTimers(() => {
      enterFight();
      captureAt(renderedCenter());
      act('1');
      captureAt(renderedCenter());
      act('2'); // …and the result screen renders, mid-theater
      expect(rows().length).toBeGreaterThan(3);
      expect(hiddenRows().length).toBe(rows().length);
      tick(350);
      expect(hiddenRows().length).toBe(rows().length - 1);
      // A click anywhere on the screen, not only on the card, finishes the sequence (§6.6).
      q('.screen--result').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(hiddenRows()).toEqual([]);
      expect(raf.mock.calls.length).toBe(2); // the two fight renders' sweeps, and nothing since
    });
  });

  // Spec §8's accessibility floor, measured against the running theater rather than the markup:
  // the ledger tallies ~6 writes per money cell over 2.5s, so a live region anywhere above
  // those cells is roughly thirty polite utterances and a screen reader hears the counting
  // instead of the ledger. Nothing that speaks may change while the numbers move.
  it('never floods a live region while the ledger tallies (spec §8)', () => {
    withTimers(() => {
      enterFight();
      captureAt(renderedCenter());
      act('1');
      captureAt(renderedCenter());
      act('2'); // the result screen opens, mid-theater
      const speaking = () =>
        [...document.querySelectorAll('[aria-live], [role="status"], [role="alert"]')];
      expect(app().querySelectorAll('.amount[data-unit]').length).toBeGreaterThan(2);
      expect(speaking().filter((el) => el.querySelector('.amount[data-unit]'))).toEqual([]);
      const before = speaking().map((el) => el.textContent);
      expect(before.join('')).not.toBe(''); // something does speak, so this is not vacuous
      tick(5000); // the whole sequence, counters included
      expect(speaking().map((el) => el.textContent)).toEqual(before);
    });
  });

  // The ledger theater hands back a finish function. Discarding it leaves its timers writing to
  // rows the next render has already detached, and leaves two theaters able to run at once.
  // Both tests below reach the seam through a control that is *outside* `.screen--result`, so
  // §6.6's click-to-skip (which any click inside the card would trip) is out of the picture:
  // what is under test is the render, not the click. Task 9's game-over ledger is a second call
  // site of exactly this shape.
  function winTheBout() {
    enterFight();
    captureAt(renderedCenter());
    act('1');
    captureAt(renderedCenter());
    act('2');
    expect(q('.screen--result'), 'the fight did not end').not.toBeNull();
  }
  const counters = () => [...app().querySelectorAll('.ledger__row .amount[data-unit]')];

  it('retires the ledger theater when the screen navigates away', () => {
    withTimers(() => {
      winTheBout();
      const posted = counters();
      const finals = posted.map((c) => c.textContent);
      expect(finals.length).toBeGreaterThan(2);
      tick(400); // the first row has landed and is counting; the rest are still pending
      const leave = q('[data-action="to-hub"]');
      app().appendChild(leave); // out of the card, so the click cannot skip the theater
      leave.click();
      expect(q('.screen--hub')).not.toBeNull();
      tick(400); // the next beat would have fired here, on rows nothing can see any more
      expect(posted.map((c) => c.textContent)).toEqual(finals);
    });
  });

  it('lets only one ledger theater drive the ledger at a time', () => {
    withTimers(() => {
      winTheBout();
      const posted = counters();
      const finals = posted.map((c) => c.textContent);
      tick(400);
      // A render that lands while the theater still runs, without leaving the result phase.
      const spend = document.createElement('button');
      spend.setAttribute('data-action', 'train-power');
      app().appendChild(spend);
      spend.click();
      const fresh = counters();
      expect(q('.screen--result')).not.toBeNull(); // still the result screen…
      expect(fresh[0]).not.toBe(posted[0]); // …on a brand-new ledger
      const freshFinals = fresh.map((c) => c.textContent);
      tick(400);
      expect(posted.map((c) => c.textContent)).toEqual(finals); // the superseded one is mute
      tick(5000);
      expect(fresh.map((c) => c.textContent)).toEqual(freshFinals);
      expect(hiddenRows()).toEqual([]);
    });
  });

  it('lands every ledger counter on the figure the renderer already wrote', () => {
    withTimers(() => {
      enterFight();
      captureAt(renderedCenter());
      act('1');
      captureAt(renderedCenter());
      act('2');
      const cells = [...app().querySelectorAll('.amount[data-unit]')];
      const posted = cells.map((c) => c.textContent);
      expect(posted.length).toBeGreaterThan(2);
      tick(5000); // run the whole sequence out
      expect(cells.map((c) => c.textContent)).toEqual(posted);
      expect(hiddenRows()).toEqual([]);
    });
  });
});

// Spec 6.5: the beam and the player poster show one quantity, so they must read one field.
// Measured before the fix, in this very harness: after three exchanges the screen carried
// HUD 100/100 beside poster 80/100 - two numbers for one fighter, side by side.
describe('one health number on screen (spec 6.5)', () => {
  const valueOf = (sel) => Number(q(sel).getAttribute('aria-valuenow'));
  const hudHealth = () => valueOf('.hud [aria-label="Health"]');
  const posterHealth = () => valueOf('.poster--tilt-1 [aria-label="You health"]');

  it('keeps the beam and the poster in step across three exchanges of real damage', () => {
    enterFight();
    const start = hudHealth();
    expect(hudHealth()).toBe(posterHealth());
    for (let exchange = 1; exchange <= 3; exchange += 1) {
      act('1'); // no capture: a miss, so the enemy answers and lands a blow
      expect(hudHealth(), `exchange ${exchange}`).toBe(posterHealth());
    }
    expect(hudHealth()).toBeLessThan(start); // the enemy really did connect
  });

  // The damage the beam now shows live must not also be charged at the end of the bout. If a
  // future change mirrored combat damage into state.health each turn, resolveFightOutcome would
  // write it back a second time and the result screen would open on a lower number than the
  // last frame of the fight.
  it('carries the last fight number onto the result screen unchanged', () => {
    enterFight();
    act('1');
    act('1'); // two exchanges of enemy damage
    const wounded = hudHealth();
    expect(wounded).toBeLessThan(CONFIG.player.maxHealth);
    // Two crits end the Brute (40 hp) and the enemy never answers between them, so no further
    // damage can reach the player before the result screen renders.
    captureAt(renderedCenter());
    act('1');
    captureAt(renderedCenter());
    act('2');
    expect(q('[data-meter]'), 'the fight did not end').toBeNull();
    expect(hudHealth()).toBe(wounded);
  });
});
