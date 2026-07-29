// tests/styles.test.js — every var(--x) the sheets use must be a token they define, and every
// duration a JS animation restates must be the token the CSS animates on.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { BEAT_MS, CHIP_LIFE_MS, SHAKE_MS } from '../src/ui/effects.js';

const SHEETS = ['src/styles.css', ...readdirSync('src/styles').map((f) => `src/styles/${f}`)];
const css = SHEETS.map((f) => readFileSync(f, 'utf8')).join('\n');

describe('css custom properties', () => {
  it('references only tokens that are defined', () => {
    const defined = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
    expect([...used].filter((t) => !defined.has(t))).toEqual([]);
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
