// tests/stage.test.js — the stage backdrop (design-system §6.17). Static markup in index.html,
// so this is a file-text check like tests/grid-areas.test.js's sheet reads: jsdom never loads
// index.html, and the layer is deliberately outside #app (mount() must never wipe it).
//
// The stone frame that used to be the second stage layer was removed in phase 4 — the masonry
// ring read as clutter and spent 14px of playfield on every side — so this file now also
// guards against its remains: no `.stage-frame` markup or rules, and no `--frame-w` consumers
// left dangling after the token went.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const css = readFileSync('src/styles/base.css', 'utf8');

describe('stage backdrop', () => {
  it('declares the decorative layer before the app mount, aria-hidden', () => {
    const backdrop = html.indexOf('<div class="stage-backdrop" aria-hidden="true"></div>');
    const app = html.indexOf('id="app"');
    expect(backdrop).toBeGreaterThan(-1);
    expect(app).toBeGreaterThan(backdrop);
  });

  it('sits behind everything and fills the viewport it decorates', () => {
    expect(css).toMatch(/\.stage-backdrop\s*{[^}]*z-index:\s*var\(--z-backdrop\)/);
    expect(css).toMatch(/\.stage-backdrop\s*{[^}]*position:\s*fixed/);
    // With the frame gone, the body reserves no ring: #app owns the full viewport height.
    expect(css).toMatch(/#app\s*{[^}]*min-height:\s*100dvh/);
    expect(css).not.toMatch(/body\s*{[^}]*padding/);
  });

  it('leaves no remains of the removed stone frame', () => {
    expect(html).not.toContain('stage-frame');
    const sheets = readdirSync('src/styles').map((f) => readFileSync(`src/styles/${f}`, 'utf8'));
    for (const sheet of sheets) {
      expect(sheet).not.toMatch(/\.stage-frame/);
      // The token is gone, so a consumer would resolve to nothing and silently collapse.
      expect(sheet).not.toMatch(/var\(--frame-w\)/);
      expect(sheet).not.toMatch(/var\(--z-frame\)/);
    }
  });
});
