// tests/styles.test.js — every var(--x) the sheets use must be a token they define.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

const SHEETS = ['src/styles.css', ...readdirSync('src/styles').map((f) => `src/styles/${f}`)];
const css = SHEETS.map((f) => readFileSync(f, 'utf8')).join('\n');

describe('css custom properties', () => {
  it('references only tokens that are defined', () => {
    const defined = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
    expect([...used].filter((t) => !defined.has(t))).toEqual([]);
  });
});
