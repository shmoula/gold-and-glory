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
import { CHIP_LIFE_MS, REDUCED_CHIP_LIFE_MS, ENEMY_BEAT_MS, HIT_FLASH_MS } from '../src/ui/effects.js';
import { dtLabel } from './support/ledger.js';

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

// Phase 4 (D5): a fight action schedules the enemy's reply one ENEMY_BEAT_MS later. Most of
// this file asserts whole-exchange outcomes — the beat is presentation pacing, not the
// behaviour under test — so the helpers flush it before handing back, and the dedicated
// sequencing describe below drives the beat by hand instead of using them. The guard is the
// beat's own DOM signal (scheduleEnemy disables the four action planks), so a capture, a hub
// click or a fight-ending blow flushes nothing.
function flushBeat() {
  if (vi.isFakeTimers() && q('.fight__grid .btn[disabled]')) {
    vi.advanceTimersByTime(ENEMY_BEAT_MS);
  }
}

// A key that resolves the turn: the re-render restarts the sweep at "now".
function act(key, init = {}) {
  const event = press(key, init);
  flushBeat();
  t0 = clock;
  return event;
}

function click(sel) {
  q(sel).click();
  flushBeat();
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

  // Fake timers file-wide (phase 4 D5): the enemy's reply now rides a setTimeout, and a real
  // 550ms timer never fires inside a synchronous test. Same toFake list as the withTimers
  // helpers below — `performance` stays real so the `performance.now` spy keeps its clock.
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
  });

  await loadMain();
});

afterEach(() => vi.useRealTimers());

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

// Spec §6.4 steps 2–3. The freeze is how players calibrate their timing, so the verdict has to
// be readable AT the freeze — before any action key resolves the turn. Both signals are pure
// DOM work over the position that was just captured, so they live in main.js beside it.
describe('freeze feedback (spec §6.4 steps 2–3)', () => {
  const stampLeft = () => Number(/([\d.]+)%/.exec(q('.meter__stamp').style.left)[1]) / 100;
  // Band edges read back out of the rendered geometry, for the same reason renderedCenter does
  // it: the test never replays the run's rng or the stat maths to know where a tier begins.
  const zoneStart = (name) =>
    Number(
      q(`.meter__zone--${name}`)
        .getAttribute('style')
        .match(/left:([\d.]+)%/)[1]
    ) / 100;
  // A point strictly inside `outer`'s left arm and strictly outside the tighter band nested in
  // it — i.e. a capture that resolves as exactly `outer`.
  const insideOnly = (outer, inner) => (zoneStart(outer) + zoneStart(inner)) / 2;

  it('pops the verdict stamp at the frozen cursor and flashes the struck zone', () => {
    enterFight();
    const center = renderedCenter();
    captureAt(center); // dead centre → crit
    const stamp = q('.meter__stamp');
    expect(stamp).not.toBeNull();
    expect(stamp.textContent).toBe('CRIT!');
    // The log line and the announcer carry the verdict for AT; the stamp is the visual channel.
    expect(stamp.getAttribute('aria-hidden')).toBe('true');
    // "At the frozen cursor": the stamp is placed from the same captured position the cursor is
    // parked on, so it can never point somewhere the game did not judge.
    expect(stampLeft()).toBeCloseTo(center, 3);
    expect(q('.meter__zone--crit').classList.contains('is-flashing')).toBe(true);
    expect(q('.meter__zone--hit').classList.contains('is-flashing')).toBe(false);
  });

  // The three landing tiers each own a band, so each has a zone to flash. Only `graze` and `hit`
  // are asserted here; `crit` is the case above.
  it.each([
    ['graze', 'hit'],
    ['hit', 'crit'],
  ])('stamps %s! and flashes its own band', (tier, inner) => {
    enterFight();
    renderedCenter(); // guard: refuse to read edges off a band clamped by the track
    captureAt(insideOnly(tier, inner));
    expect(q('.meter__stamp').textContent).toBe(`${tier.toUpperCase()}!`);
    expect([...app().querySelectorAll('.is-flashing')].map((z) => z.className)).toEqual([
      `meter__zone meter__zone--${tier} is-flashing`,
    ]);
  });

  // The stamp is centred display type opening at 1.5×, so at the track's extremes it overhangs
  // past the page gutter and a glyph is clipped (measured at 375px: `MISS!` at position 0 opens
  // 1.2px off-screen left, `GRAZE!` at position 1 runs 8.1px past the right edge). It is nudged
  // inward for that reason alone — and the cursor is deliberately NOT, because it is the readout
  // of what the game judged. These two track each other everywhere except here, so pin the seam:
  // a clamp that leaked onto the cursor would make the freeze lie about the last 6% of the track.
  it.each([
    [0.01, 0.06],
    [0.99, 0.94],
  ])('nudges a stamp captured at %s inward without moving the cursor', (captured, drawn) => {
    enterFight();
    pinWidth();
    captureAt(captured);
    expect(stampLeft()).toBeCloseTo(drawn, 4);
    expect(cursorX()).toBeCloseTo(captured * WIDTH, 6);
  });

  it('stamps MISS! with no zone flash when captured far from the sweet spot', () => {
    enterFight();
    captureAt(farFrom(renderedCenter()));
    expect(q('.meter__stamp').textContent).toBe('MISS!');
    expect(q('.is-flashing')).toBeNull(); // a miss struck no zone
  });

  // No cleanup code backs this: every action re-renders the fight, and mount() rebuilds the
  // meter without a stamp. If that ever stops being true the stamp outlives its verdict.
  it('clears the stamp with the next render', () => {
    enterFight();
    captureAt(renderedCenter());
    act('1'); // resolve the action → re-render
    expect(q('.meter__stamp')).toBeNull();
    expect(q('.is-flashing')).toBeNull();
  });
});

// Everything above runs with zero painted frames. These two need real frames, so they swap in
// a rAF stub that actually queues callbacks and hands them back on demand.
function driveFrames() {
  let nextId = 1;
  const pending = new Map();
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((cb) => {
      const id = nextId++;
      pending.set(id, cb);
      return id;
    })
  );
  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn((id) => {
      pending.delete(id);
    })
  );
  return {
    // Run exactly one frame: every callback queued right now, none of their continuations.
    frame() {
      const due = [...pending.values()];
      pending.clear();
      for (const cb of due) cb();
      return due.length;
    },
    get queued() {
      return pending.size;
    },
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

  // The other two animation handles — purseTicker and ledgerTheater — are retired at the top of
  // render(), because their timers outlive the DOM they were aimed at. The sweep is the third,
  // and it was the one that did not: end a bout without ever capturing the meter (every press a
  // miss, so the enemy answers until the player drops) and the loop is still queued on the screen
  // that replaced the fight, rescheduling itself forever and painting a cursor nothing can see.
  // Only the *next* startMeter() ever killed it, so a run that ends on the game-over screen keeps
  // it alive for good. Asserted on the queue rather than on painted frames: the pane paints none.
  it('retires the sweep when the screen leaves the fight', () => {
    const frames = driveFrames();
    enterFight();
    expect(frames.queued).toBe(1);
    // No capture on any turn, so every strike misses and the enemy answers until the bout ends.
    for (let turn = 0; turn < 30 && q('[data-meter]'); turn += 1) act('1');
    expect(q('[data-meter]'), 'the fight never ended').toBeNull();
    expect(frames.queued, 'the sweep is still scheduled after the fight').toBe(0);
    expect(frames.frame()).toBe(0); // …and nothing revives it on the next frame
  });

  it('stops every loop on capture, leaving nothing scheduled', () => {
    const frames = driveFrames();
    enterFight();
    for (let turn = 0; turn < 3; turn += 1) {
      frames.frame();
      act('1');
    }
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
    const onError = (e) => {
      errors.push(e.error ?? e.message);
      e.preventDefault();
    };
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
  // A role="button" widget nothing can focus is unreachable for assistive tech, so the
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
      configurable: true,
      get: () => HEIGHT,
    });
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

  // Phase 4 (D5): the exchange lands in two renders, so it is spoken in two utterances — the
  // player's verdict with the stamp, the enemy's reply one beat later with its own render.
  // Better than the single utterance it replaced: the verdict is spoken the moment the sighted
  // player sees it, and the 550ms gap keeps the second write from clobbering the first
  // mid-speech (two same-tick writes to one atomic region speak only the last).
  it('announces each half of the exchange as its own utterance', () => {
    enterFight();
    expect(live().textContent).toBe('');
    press('1'); // the player's half renders and speaks immediately…
    expect(live().textContent).toContain('You strike (miss) for 0 damage.');
    expect(live().textContent).not.toContain('strikes ('); // …without the reply
    flushBeat(); // the enemy's answer arrives one beat later, as its own utterance
    t0 = clock;
    const spoken = live().textContent;
    expect(spoken).toContain('strikes (');
    expect(spoken).not.toContain('You strike'); // the previous utterance is not repeated
    expect(spoken).not.toContain('<'); // plain speech, never markup
    expect(spoken).not.toMatch(/T\d/); // and no turn stamps read out loud
    press('2');
    expect(live().textContent).toContain('You heavy (miss)');
    expect(live().textContent).not.toContain('strikes ('); // the last reply is not repeated
    flushBeat();
    t0 = clock;
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
    press('1'); // sampled before the beat: the reply's utterance would replace this one
    expect(live().textContent).not.toBe(lastFight);
    expect(live().textContent).toContain('You strike (miss) for 0 damage.');
    flushBeat(); // finish the exchange so its timer cannot leak into the next test
  });
});

// Phase 4 (D5): the exchange lands in two renders — the player's immediately, the enemy's one
// ENEMY_BEAT_MS later — so the reply reads as an event. Outcomes are untouched: the same pure
// calls run in the same order off the same rng; only when the second half is *drawn* moves.
describe('the exchange beat (phase 4 D5)', () => {
  it('renders the player’s half immediately and the enemy’s only after the beat', () => {
    enterFight();
    press('1');
    expect(logText()).toContain('You strike');
    expect(logText()).not.toContain('The Brute strikes');
    // The beat reads as a wind-up, not a dead screen: the four actions are dead planks…
    expect(q('.fight__grid .btn[disabled]')).not.toBeNull();
    vi.advanceTimersByTime(ENEMY_BEAT_MS);
    expect(logText()).toContain('The Brute strikes');
    // …and the reply's render re-arms everything.
    expect(q('.fight__grid .btn[disabled]')).toBeNull();
  });

  it('ignores the fight keys during the beat', () => {
    enterFight();
    press('1');
    press('2'); // smuggled into the beat: the guard must drop it
    vi.advanceTimersByTime(ENEMY_BEAT_MS);
    expect(logText()).not.toContain('You heavy');
    expect(logText()).toContain('The Brute strikes');
  });

  it('flashes the struck poster and floats the damage it took', () => {
    enterFight();
    press('1'); // a miss, so the enemy's answer lands real damage on the player
    vi.advanceTimersByTime(ENEMY_BEAT_MS);
    const you = q('.fight__you .poster');
    expect(you.classList.contains('is-hit')).toBe(true);
    const chip = you.querySelector('.damage-chip');
    expect(chip).not.toBeNull();
    expect(chip.textContent).toMatch(/^−\d+$/); // −N, the real figure, minus by codepoint
    vi.advanceTimersByTime(HIT_FLASH_MS);
    expect(you.classList.contains('is-hit')).toBe(false);
  });

  it('offers the press with no beat pending — the enemy is not owed a turn yet', () => {
    enterFight();
    captureAt(renderedCenter());
    act('1'); // crit → press offered; the enemy does not answer until the press resolves
    expect(q('[data-action="press"]')).not.toBeNull();
    expect(q('.fight__grid .btn[disabled]')).toBeNull();
  });

  it('collapses the beat to the next tick under reduced motion', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((media) => ({ media, matches: true }))
    );
    enterFight();
    press('1');
    vi.advanceTimersByTime(0);
    expect(logText()).toContain('The Brute strikes');
  });
});

// Spec §8 wants the ledger announced politely. §6.6's theater makes that impossible inside the
// card — it rewrites every money cell about six times as it counts, ~30 utterances over 2.5s —
// but moving the announcement to a once-written `role="status"` line *inside the card* does not
// fix it either: mount() replaces #app wholesale, so that line is a brand-new node carrying its
// text already inside it, and a live region inserted already-populated announces nothing at all.
// Silence and flood are two failure modes of the same design, and the fix for both is the same
// one #log-announcer already uses: a region built once, outside #app, written after insertion.
describe('the ledger announcement (spec §6.6 / §8)', () => {
  const live = () => document.getElementById('ledger-announcer');

  function winTheBout() {
    enterFight();
    captureAt(renderedCenter());
    act('1');
    captureAt(renderedCenter());
    act('2');
    expect(q('.screen--result'), 'the fight did not end').not.toBeNull();
  }

  // `dtLabel` comes from tests/support/ledger.js — the same reader tests/render.test.js uses on
  // the rendered card, so this file cannot hold the announcement to a differently-read label.
  // The rows as the card states them, so the announcement can be held to the card's own words.
  const cardLines = () =>
    [...app().querySelectorAll('.ledger__row')].map(
      (row) => `${dtLabel(row.querySelector('dt'))}: ${row.querySelector('dd').textContent}`
    );

  // The silence guard. Every assertion is about *when* the text lands relative to the region's
  // insertion: the region must pre-date the result screen and still be the same node once the
  // screen is up, or there is no content change for assistive tech to notice.
  it('speaks from a persistent region written after it was inserted', () => {
    const region = live();
    expect(region).not.toBeNull();
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(document.body.contains(region)).toBe(true);
    expect(app().contains(region)).toBe(false); // mount() cannot re-create it
    expect(region.textContent).toBe(''); // inserted empty, long before a ledger exists
    winTheBout();
    expect(live()).toBe(region); // the same node, so the write is a real content change
    // …and it states the visible ledger line for line, in the card's own words — opening with
    // the same verdict the (mute) drawn stamp carries.
    const lines = cardLines();
    expect(lines.length).toBeGreaterThan(3);
    expect(region.textContent).toBe(`VICTORY! ${lines.join('. ')}.`);
    // Nothing re-creates the summary inside the screen, where it would be mute.
    expect(app().querySelector('.ledger__summary')).toBeNull();
  });

  // §8 asks for one announcement, and a re-render of the same result screen is not new news.
  // Detected with a sentinel rather than by comparing strings: a second write of the same text
  // is still a second utterance, and would be invisible to an equality check.
  it('announces once per result screen, not once per render of it', () => {
    winTheBout();
    const region = live();
    expect(region.textContent).not.toBe('');
    region.textContent = 'SENTINEL';
    // A render that lands while the result screen stays up (the same seam the ledger theater
    // is retired through).
    const spend = document.createElement('button');
    spend.setAttribute('data-action', 'train-power');
    app().appendChild(spend);
    spend.click();
    expect(q('.screen--result')).not.toBeNull();
    expect(region.textContent).toBe('SENTINEL'); // nothing spoke a second time
  });

  // The flood guard, walked up the ancestor chain rather than checked on one element: putting
  // `aria-live` back on `.ledger`, on the `<dl>`, on `.result__ledger` or on `#app` all produce
  // the same thirty-utterance flood. And the amounts may not be hidden to buy the silence —
  // that leaves a browse-mode reader a column of labels with no numbers.
  it('keeps every counting cell out of a live region, without hiding it (§8)', () => {
    winTheBout();
    const cells = [...app().querySelectorAll('.ledger__row .amount[data-unit]')];
    expect(cells.length).toBeGreaterThan(2);
    for (const cell of cells) {
      for (let el = cell; el; el = el.parentElement) {
        expect(el.getAttribute('aria-live'), `${el.nodeName}.${el.className}`).toBeNull();
        expect(el.getAttribute('role'), `${el.nodeName}.${el.className}`).not.toBe('status');
        expect(el.getAttribute('aria-hidden'), `${el.nodeName}.${el.className}`).toBeNull();
      }
    }
  });

  // Task 9's game-over twin: the same region, the same "written once" contract, but on
  // GAMEOVER rather than RESULT. Driven the same way the money-theater describe block's own
  // GAMEOVER test reaches the screen — `retire` from the hub — since that is the only
  // game-over-reaching helper already in this file; forcing a death would need to fight the
  // run's own rng deterministically, which nothing here does.
  it('announces the ending once, stamp first, and not again on re-render (design §4d)', () => {
    click('[data-action="retire"]');
    expect(q('.screen--gameover'), 'retire did not reach GAMEOVER').not.toBeNull();
    const region = live();
    // Same lead-ins as the drawn screen (src/ui/render.js's CAUSE_LABEL/PURSE_LABEL and
    // config.endings.retired.stamp.text) — read off config rather than pasted, so the two
    // can never drift apart.
    const stampText = CONFIG.endings.retired.stamp.text;
    // This stamp ends in its own exclamation, so gameoverSummary contributes the space and no
    // second terminal mark. Asserted rather than assumed: if the copy ever loses its
    // punctuation the separator changes with it, and this test should say so out loud.
    expect(stampText, 'the retired stamp is expected to punctuate itself').toMatch(/[.!?]$/);
    expect(region.textContent).toBe(`${stampText} Final purse: ${formatGold(CONFIG.startingGold)}`);
    const spoken = region.textContent;
    // A render that lands while GAMEOVER stays up — same technique as the result screen's
    // "not again" test above: a real commerce control, appended and clicked directly, so the
    // click goes through main.js's one delegated listener on #app without navigating away.
    const spend = document.createElement('button');
    spend.setAttribute('data-action', 'train-power');
    app().appendChild(spend);
    spend.click();
    expect(q('.screen--gameover')).not.toBeNull();
    expect(region.textContent).toBe(spoken); // nothing spoke a second time
  });
});

// Spec §6.6/§6.7: money is never allowed to teleport. The purse counts, a signed chip falls
// beside it, the ledger tallies one line at a time — and a rejected purchase says so out loud.
//
// Every assertion below runs with requestAnimationFrame stubbed to a no-op that never calls
// back, exactly like the rest of this file, so none of this theater can quietly come to depend
// on a painted frame. `performance.now` is already pinned to `clock` via the module-level spy;
// vitest's fake timers otherwise also fake `performance.now` (masking that spy), so `withTimers`
// below excludes it from the faked set, and advancing the two together is what real time looks
// like here.
describe('money theater (spec §6.6 / §6.7)', () => {
  const purse = () => q('.hud__purse');
  const ticker = () => q('.hud__purse .ticker');
  const chips = () => [...app().querySelectorAll('.delta-chip')];
  const rows = () => [...app().querySelectorAll('.ledger__row')];
  const hiddenRows = () => rows().filter((r) => r.classList.contains('is-hidden'));

  // Fake timers, restored however the body exits — a leaked fake clock breaks every later file.
  function withTimers(body) {
    // Exclude `performance` from the faked set: vitest's fake timers otherwise stub it too,
    // clobbering the `performance.now` spy this file pins to `clock` (see the block comment
    // above) and freezing every capture at time 0.
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    });
    try {
      body();
    } finally {
      vi.useRealTimers();
    }
  }
  const tick = (ms) => {
    clock += ms;
    vi.advanceTimersByTime(ms);
  };

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

  // Spec §6.1: "On GAMEOVER the HUD persists showing the fatal state — deliberate
  // storytelling." It rendered no HUD at all until Task 9, which also made `moveTheMoney`'s
  // purse lookup return null on this screen; both halves are asserted here, because the
  // renderer's own test cannot see the wiring that mounts it.
  it('keeps the HUD on screen once the run has ended (§6.1)', () => {
    withTimers(() => {
      click('[data-action="retire"]');
      expect(q('.screen--gameover')).not.toBeNull();
      expect(purse(), 'the beam persists into GAMEOVER').not.toBeNull();
      expect(ticker().textContent).toBe(formatGold(START));
      expect(chips(), 'retiring moves no money').toEqual([]);
    });
  });

  it('drops a signed chip beside the purse on every gold change', () => {
    withTimers(() => {
      expect(chips()).toEqual([]); // …but not on the first render of a run
      click('[data-action="train-power"]');
      expect(chips().map((c) => c.textContent)).toEqual([
        formatGold(-TRAIN_COST, { signed: true }),
      ]);
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
      const won =
        CONFIG.opponents[0].purse - Math.round(CONFIG.opponents[0].purse * CONFIG.arena.taxRate);
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
      expect(chips()[0].textContent).toContain(`need ${button.getAttribute('data-missing')} more`);
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
      const speaking = () => [
        ...document.querySelectorAll('[aria-live], [role="status"], [role="alert"]'),
      ];
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

// ---------------------------------------------------------------------------
// Plan Task 10 Step 3, the wiring half. tests/effects.test.js already holds each animation to
// its reduced-motion contract in isolation, and tests/styles.test.js holds the stylesheet to
// its half; neither sees the assembled screen. What is asserted here is the thing a
// reduced-motion player actually gets: the *final* numbers, on the real markup, reached through
// main.js's own render — and nothing left ticking that could still move them afterwards.
//
// The distinction that matters is not "is the text right immediately" — the renderer writes
// every posted figure into the markup before any theater starts, so it is right immediately
// either way. It is whether the rows are *revealed* and whether the figures survive the beats
// that a counting reveal would have spent at zero.
describe('reduced motion, end to end (spec §5, plan Step 3)', () => {
  const purse = () => q('.hud__purse');
  const ticker = () => q('.hud__purse .ticker');
  const chips = () => [...app().querySelectorAll('.delta-chip')];
  const rows = () => [...app().querySelectorAll('.ledger__row')];
  const hiddenRows = () => rows().filter((r) => r.classList.contains('is-hidden'));
  const cells = () => [...app().querySelectorAll('.amount[data-unit]')];

  const reduceMotion = () =>
    vi.stubGlobal(
      'matchMedia',
      vi.fn((media) => ({ media, matches: true }))
    );

  function withTimers(body) {
    // Exclude `performance` from the faked set: vitest's fake timers otherwise stub it too,
    // clobbering the `performance.now` spy this file pins to `clock` (see the block comment
    // above) and freezing every capture at time 0.
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    });
    try {
      body();
    } finally {
      vi.useRealTimers();
    }
  }
  const tick = (ms) => {
    clock += ms;
    vi.advanceTimersByTime(ms);
  };

  const TRAIN_COST = 80; // config: training.baseCost at level 0
  const START = CONFIG.startingGold;

  // Win the opening bout, which is what puts a ledger on screen.
  function winTheBout() {
    enterFight();
    captureAt(renderedCenter());
    act('1');
    captureAt(renderedCenter());
    act('2');
  }

  it('opens the result ledger pre-tallied, with every figure already posted', () => {
    reduceMotion();
    withTimers(() => {
      winTheBout();
      expect(rows().length).toBeGreaterThan(3);
      // No counting reveal: every row is visible on the first frame of the screen.
      expect(hiddenRows()).toEqual([]);
      const posted = cells().map((c) => c.textContent);
      expect(posted.length).toBeGreaterThan(2);
      // Every cell agrees with the value it carries, so nothing is a frozen mid-count.
      for (const cell of cells()) expect(cell.getAttribute('data-value')).toBeTruthy();
      // A counting theater would be at or near zero here, and would still be moving at 2.5s.
      tick(350);
      expect(cells().map((c) => c.textContent)).toEqual(posted);
      tick(5000);
      expect(cells().map((c) => c.textContent)).toEqual(posted);
      expect(hiddenRows()).toEqual([]);
    });
  });

  it('writes the purse straight to its new value instead of counting toward it', () => {
    reduceMotion();
    withTimers(() => {
      click('[data-action="train-power"]');
      // Without the preference this opens on the *old* number and counts down over 600ms.
      expect(ticker().textContent).toBe(formatGold(START - TRAIN_COST));
      expect(ticker().getAttribute('data-value')).toBe(String(START - TRAIN_COST));
      tick(5000); // nothing is left scheduled that could move it again
      expect(ticker().textContent).toBe(formatGold(START - TRAIN_COST));
    });
  });

  // The regression 2883bd8 fixed, seen from the assembled screen: the chip must not travel, but
  // it must still be *there*. Its whole extended life was being spent on an invisible node.
  it('keeps the delta chip on screen past its travelling lifetime', () => {
    reduceMotion();
    withTimers(() => {
      click('[data-action="train-power"]');
      expect(chips().map((c) => c.textContent)).toEqual([
        formatGold(-TRAIN_COST, { signed: true }),
      ]);
      tick(CHIP_LIFE_MS + 10);
      expect(chips().length, 'the chip is gone before it could be read').toBe(1);
      tick(REDUCED_CHIP_LIFE_MS - CHIP_LIFE_MS);
      expect(chips()).toEqual([]);
    });
  });

  // A rejection loses its motion channel, so the channel that carries no motion has to survive:
  // the shortfall chip is the only thing left telling the player why nothing happened.
  it('drops the rejection shake but still states the shortfall', () => {
    reduceMotion();
    withTimers(() => {
      click('[data-action="train-power"]'); // 100 -> 20, next level costs 128
      tick(REDUCED_CHIP_LIFE_MS + 10); // let the successful purchase's chip expire
      expect(chips()).toEqual([]);
      const button = q('[data-action="train-power"]');
      button.click();
      expect(purse().classList.contains('is-shaking')).toBe(false);
      expect(chips().length).toBe(1);
      expect(chips()[0].textContent).toContain(`need ${button.getAttribute('data-missing')} more`);
      expect(chips()[0].textContent.codePointAt(0)).toBe(0x2212);
    });
  });

  // "…but the meter still sweeps." The sweep is gameplay, not decoration: it is the only way to
  // aim, so a reduced-motion run that froze it would be unplayable. Nothing in the capture path
  // consults the preference, and this is what would notice if something started to.
  it('still sweeps and still resolves a capture', () => {
    reduceMotion();
    enterFight();
    expect(raf).toHaveBeenCalled(); // the loop was started under the preference
    captureAt(renderedCenter());
    expect(q('[data-meter]').classList.contains('is-captured')).toBe(true);
    act('1');
    expect(logText()).toContain('You strike (crit)');
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
