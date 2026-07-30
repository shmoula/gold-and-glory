// tests/styles.test.js — every var(--x) the sheets use must be a token they define, and every
// duration a JS animation restates must be the token the CSS animates on.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { BEAT_MS, CHIP_LIFE_MS, SHAKE_MS } from '../src/ui/effects.js';
import { CONFIG } from '../src/config.js';
import { createGameState } from '../src/state.js';
import { startFight, resolveFightOutcome } from '../src/game.js';
import { renderResult, renderGameOver } from '../src/ui/render.js';

const SHEETS = ['src/styles.css', ...readdirSync('src/styles').map((f) => `src/styles/${f}`)];
const css = SHEETS.map((f) => readFileSync(f, 'utf8')).join('\n');

// Plan Task 10 Step 4b. The vendored woff2 files are redistributed font software, in git and in
// dist/, so the OFL requires the license to travel with them — and to *attribute* somebody. The
// file that used to sit here was the canonical OFL 1.1 template, whose copyright line is still
// the unfilled `Copyright (c) <dates>, <Copyright Holder>`: a license, naming no one. Derived
// from the `@font-face` rules rather than from a hand-kept list, so a fourth family cannot be
// vendored without its own upstream OFL.txt arriving beside it (scripts/fetch-fonts.mjs).
describe('font attribution (OFL)', () => {
  const faces = [...readFileSync('src/styles/tokens.css', 'utf8')
    .matchAll(/@font-face\s*\{[^}]*font-family:\s*'([^']+)'[^}]*url\('\.\.\/assets\/([^']+)'/g)];

  it('finds every declared face', () => {
    expect(faces.length).toBe(4);
  });

  it('ships each family its own upstream license, naming a real holder', () => {
    const families = new Set(faces.map((m) => m[1]));
    expect(families.size).toBe(3);
    for (const family of families) {
      const path = `src/assets/fonts/OFL-${family.replace(/\s+/g, '')}.txt`;
      const text = readFileSync(path, 'utf8');
      expect(text, `${path} is not OFL 1.1`).toContain('SIL OPEN FONT LICENSE Version 1.1');
      // The placeholder is the whole point of the step: its absence is what separates an
      // attribution from a template that merely looks like one.
      expect(text, `${path} still carries the template placeholder`)
        .not.toMatch(/<Copyright Holder>|<dates>/);
      expect(text, `${path} names no copyright holder`).toMatch(/^Copyright \S+/m);
    }
    // The template must be gone, not merely joined: leaving it means the tree still ships a
    // notice attributing nobody, and a reader has no way to tell which file governs.
    expect(existsSync('src/assets/fonts/OFL.txt')).toBe(false);
  });

  it('ships every font file the sheet asks the browser to load', () => {
    for (const [, , asset] of faces) expect(existsSync(`src/assets/${asset}`), asset).toBe(true);
  });
});

describe('css custom properties', () => {
  it('references only tokens that are defined', () => {
    const defined = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
    expect([...used].filter((t) => !defined.has(t))).toEqual([]);
  });
});

// Task 9 deleted `src/styles/legacy.css`. Two of its rules were still the only declaration of
// their kind anywhere in the game and were moved into base.css; nothing re-declares either, so
// a careless tidy-up would silently unbound every screen on a wide monitor and hand every dead
// button a live-looking pointer. Text-level, deliberately: this guards the *presence* of rules
// no rendered-markup test in the suite covers (there is no selector-coverage net — see the
// progress file's deferred item 14).
describe('rules inherited from the deleted legacy sheet', () => {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');

  it('has no legacy sheet left to import', () => {
    expect(SHEETS).not.toContain('src/styles/legacy.css');
    expect(readFileSync('src/styles.css', 'utf8')).not.toMatch(/legacy/);
  });

  it('still caps the #app column and dims natively disabled buttons', () => {
    const app = bare.match(/#app\s*\{[^}]*\}/g) ?? [];
    expect(app.length, 'exactly one #app rule').toBe(1);
    expect(app[0]).toMatch(/max-width:\s*1180px/);
    expect(app[0]).toMatch(/margin:\s*0 auto/);
    // Pinned to the token, not merely to the property's presence: `padding:` on its own is
    // satisfied by `padding: 0`, so the gutter could be mutated away with the suite still green.
    expect(app[0]).toMatch(/padding:\s*var\(--space-4\)/);
    const disabled = bare.match(/button:disabled\s*\{[^}]*\}/g) ?? [];
    expect(disabled.length, 'exactly one button:disabled rule').toBe(1);
    expect(disabled[0]).toMatch(/opacity:/);
    expect(disabled[0]).toMatch(/cursor:\s*not-allowed/);
  });
});

// --- Spec Law 4: "Text only sits on paper or wood. Never directly on stone." ---
// The wordmark is the case that broke it: `.wordmark` is `--ink-soft` at `opacity: .7`, which
// on `--surface-page` stone computes to 1.54:1 against §8's 4.5:1 floor. Neither half of the
// codebase can catch that alone — the sheet does not know where the markup puts the span, and
// jsdom resolves no cascade — so both are read here. The grounds are *derived* from the sheets
// (every plain-class rule that paints a paper or wood background), and every `.wordmark` any
// screen renders must have one of them as an ancestor. Deriving them is the point: a new card
// that grows its own parchment is accepted automatically, while a wordmark dropped straight
// onto the page fails no matter which screen drops it.
//
// It asserts a *ground*, not a contrast ratio, and that is deliberate. `--ink-soft` at .7 over
// parchment (`--paper-3`, the darker gradient stop) is 2.80:1 — the wordmark does not clear
// §8's 4.5:1 floor on paper either. Pinning 4.5 here would fail the shipped result screen as
// well, so it would be a claim this code does not make. Law 4 is the line this fix is about.
describe('Law 4 — the wordmark never sits on stone', () => {
  const PAPER_OR_WOOD = /background(-color|-image)?\s*:[^;]*var\(--(grad-paper|grad-wood[\w-]*|grad-commit|paper-\d|wood-\d|surface-paper|surface-wood)\)/;
  // Only the plain class-chain spelling: those are the material rules, and anything else
  // (pseudo-elements, `50%` keyframe stops, at-rule preludes) is not an element to stand on.
  const PLAIN_CLASS = /^\.[\w-]+(\.[\w-]+)*$/;
  const grounds = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, , body]) => PAPER_OR_WOOD.test(body))
    .flatMap(([, prelude]) => prelude.split(',').map((s) => s.trim()))
    .filter((s) => PLAIN_CLASS.test(s));

  // The two screens that render a wordmark, from the state the game really writes.
  const start = createGameState(1, CONFIG);
  const fought = resolveFightOutcome(startFight(start, CONFIG), true, () => 1, CONFIG);
  const dead = {
    ...start, phase: 'GAMEOVER', ended: 'dead', health: 0,
    lastResult: { died: true, won: false, opponentName: 'The Brute', causeOfDeath: 'A turnip.' },
  };
  const SCREENS = {
    result: renderResult(fought, CONFIG),
    gameover: renderGameOver(dead, CONFIG),
  };

  it('derives the paper and wood grounds from the sheets', () => {
    // Guard against a vacuous pass: an empty ground list would make every wordmark below fail,
    // but a regex that accidentally matched everything would make them all pass.
    expect(grounds.length).toBeGreaterThan(3);
    expect(grounds).toContain('.ledger');
    expect(grounds).not.toContain('.screen');
  });

  it('gives every rendered wordmark a paper or wood ancestor', () => {
    const orphans = [];
    let checked = 0;
    for (const [name, html] of Object.entries(SCREENS)) {
      const host = document.createElement('div');
      host.innerHTML = html;
      const marks = [...host.querySelectorAll('.wordmark')];
      expect(marks.length, `${name} renders no wordmark`).toBeGreaterThan(0);
      for (const mark of marks) {
        checked += 1;
        const grounded = grounds.some((sel) => mark.closest(sel) !== null);
        if (!grounded) orphans.push(`${name}: .${[...mark.parentElement.classList].join('.')}`);
      }
    }
    expect(orphans).toEqual([]);
    expect(checked).toBe(2);
  });
});

// Spec §6.14 is normative about the locked card's treatment ("grayscale filter, 55% opacity"),
// and it is the only signal that separates the two endings you did not reach from the one you
// did. Text-level, deliberately: the sheet has no selector-coverage net (see the progress
// file's deferred item 14), so this guards the declarations' presence and their values.
describe('endings gallery (spec §6.14)', () => {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const ruleFor = (selector) => {
    const rule = bare.match(new RegExp(`\\${selector}\\s*\\{[^}]*\\}`));
    expect(rule, `no rule for ${selector}`).not.toBeNull();
    return rule[0];
  };

  it('greys out and fades the endings you did not reach', () => {
    const locked = ruleFor('.ending-card--locked');
    expect(locked).toMatch(/filter:\s*grayscale\(0\.8\)/);
    expect(locked).toMatch(/opacity:\s*0\.55/);
  });

  // The card owns its own transform and the slot only names the angle. A screen that overrode
  // `transform` outright would silently drop whatever else the component ever puts in it.
  it('lets the slot pick the tilt through a variable, not by overriding transform', () => {
    expect(ruleFor('.ending-card')).toMatch(/transform:\s*rotate\(var\(--card-tilt/);
    const screens = readFileSync('src/styles/screens.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(screens, 'a screen must not override a component transform')
      .not.toMatch(/\.ending-card\s*\{[^}]*transform:/);
    expect(screens).toMatch(/\.gameover__stamp\s*\{[^}]*--card-tilt:/);
    expect(screens).toMatch(/\.gameover__right\s*\{[^}]*--card-tilt:/);
  });
});

// Spec Law 6: one duration, one source. effects.js schedules the DOM work with a timer while the
// stylesheet fades, drops and shakes on its own clock, so a token edited on one side and not the
// other desynchronises the fade from the removal — silently, and only in a real browser. Read
// out of the token *source*: jsdom cannot resolve an imported custom property through
// getComputedStyle, so a runtime check here would compare two empty strings and always pass.
describe('animation durations (spec Law 6)', () => {
  const tokens = readFileSync('src/styles/tokens.css', 'utf8');
  const components = readFileSync('src/styles/components.css', 'utf8');
  const tokenMs = (name) => {
    const found = tokens.match(new RegExp(`${name}\\s*:\\s*(\\d+(?:\\.\\d+)?)ms`));
    expect(found, `${name} is not defined in tokens.css as a millisecond value`).not.toBeNull();
    return Number(found[1]);
  };

  it('binds each JS constant to the token its CSS counterpart animates on', () => {
    expect(BEAT_MS).toBe(tokenMs('--dur-tally'));
    expect(CHIP_LIFE_MS).toBe(tokenMs('--dur-chip'));
    expect(SHAKE_MS).toBe(tokenMs('--dur-shake'));
  });

  // …and each of those rules must actually reach for the token rather than restating the number,
  // which is how the purse shake came to hold a literal 300ms with nothing tying it to SHAKE_MS.
  it('states no duration literally in the rules those constants drive', () => {
    for (const [selector, token] of [
      ['.delta-chip', '--dur-chip'],
      ['.hud__purse.is-shaking', '--dur-shake'],
    ]) {
      const rule = components.match(new RegExp(`\\${selector}\\s*\\{[^}]*\\}`));
      expect(rule, `no rule for ${selector}`).not.toBeNull();
      expect(rule[0], selector).toContain(`var(${token})`);
      expect(rule[0], selector).not.toMatch(/\d+m?s\b/);
    }
  });
});
