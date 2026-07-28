// tests/main.test.js — the fight-screen wiring: sweet-spot seeding, timestamp capture,
// the freeze, and keyboard parity (spec §6.4 interaction, §8 keyboard floor).
//
// Deliberately runs with requestAnimationFrame stubbed to a no-op that never calls back, i.e.
// ZERO painted frames — the same condition the headless browser pane reports. Everything
// asserted here therefore comes from the timestamp maths, not from a frame having run. If a
// test in this file only passes when frames paint, the capture is reading the DOM instead of
// the clock, which is exactly the bug spec §6.4 calls out.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { CONFIG } from '../src/config.js';
import { makeRng } from '../src/rng.js';
import { sweetCenter } from '../src/ui/timing.js';

const SEED_ROLL = 0.4242; // what Math.random is pinned to below
const SEED = Math.floor(SEED_ROLL * 1e9); // …and the run seed main.js derives from it

let clock = 0; // the whole file's notion of performance.now()
let t0 = 0; // clock reading at the last render, i.e. the sweep's origin
let raf;
let caf;
let keydownListeners = [];

const PERIOD = CONFIG.combat.meterPeriodMs.base; // opponent 0 sweeps at the base duration
const BAND = CONFIG.combat.sweetCenter;

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

beforeEach(async () => {
  // Each test gets a fresh module instance; the previous one's document-level keydown
  // listener would otherwise keep driving its own detached game.
  for (const fn of keydownListeners) document.removeEventListener('keydown', fn);
  keydownListeners = [];
  const realAdd = document.addEventListener;
  document.addEventListener = function collect(type, fn, opts) {
    if (type === 'keydown') keydownListeners.push(fn);
    return realAdd.call(this, type, fn, opts);
  };

  raf = vi.fn(() => 0);
  caf = vi.fn();
  vi.stubGlobal('requestAnimationFrame', raf);
  vi.stubGlobal('cancelAnimationFrame', caf);

  document.body.innerHTML = '<div id="app"></div>';
  clock = 0;
  t0 = 0;
  vi.resetModules();
  await import('../src/main.js');
  document.addEventListener = realAdd;
});

describe('sweet-spot seeding', () => {
  it('seeds a centre inside the configured band for the first player turn', () => {
    enterFight();
    const center = renderedCenter();
    expect(center).toBeGreaterThanOrEqual(BAND.min);
    expect(center).toBeLessThanOrEqual(BAND.max);
  });

  // A first turn that is never seeded still renders a legal-looking meter — renderFight falls
  // back to mid-track, which sits inside the band. Only pinning it to the run's own rng
  // separates "seeded" from "defaulted".
  it('takes the first turn from the run’s rng, not the mid-track fallback', () => {
    const expected = sweetCenter(makeRng(SEED)(), CONFIG);
    expect(expected).not.toBeCloseTo(0.5, 2); // the fallback cannot impersonate a seed
    enterFight();
    expect(renderedCenter()).toBeCloseTo(expected, 3);
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

  it('claims the browser default only for the keys it owns', () => {
    enterFight();
    expect(press(' ').defaultPrevented).toBe(true);
    expect(press('3').defaultPrevented).toBe(true);
    expect(press('x').defaultPrevented).toBe(false);
    expect(press('5').defaultPrevented).toBe(false);
  });
});
