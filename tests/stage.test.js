// tests/stage.test.js — stage layers (design-system §6.17). Static markup in index.html, so
// this is a file-text check like tests/grid-areas.test.js's sheet reads: jsdom never loads
// index.html, and the layers are deliberately outside #app (mount() must never wipe them).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const css = readFileSync('src/styles/base.css', 'utf8');
const tokens = readFileSync('src/styles/tokens.css', 'utf8');

describe('stage layers', () => {
  it('declares both decorative layers before the app mount, aria-hidden', () => {
    const backdrop = html.indexOf('<div class="stage-backdrop" aria-hidden="true"></div>');
    const frame = html.indexOf('<div class="stage-frame" aria-hidden="true"></div>');
    const app = html.indexOf('id="app"');
    expect(backdrop).toBeGreaterThan(-1);
    expect(frame).toBeGreaterThan(backdrop);
    expect(app).toBeGreaterThan(frame);
  });

  it('keeps the frame out of the input path and below interactive layers', () => {
    expect(css).toMatch(/\.stage-frame\s*{[^}]*pointer-events:\s*none/);
    expect(css).toMatch(/\.stage-frame\s*{[^}]*z-index:\s*var\(--z-frame\)/);
    expect(tokens).toMatch(/--z-frame:\s*5\b/);
    expect(tokens).toMatch(/--z-backdrop:\s*-1\b/);
    expect(tokens).toMatch(/--frame-w:\s*14px/);
  });
});
