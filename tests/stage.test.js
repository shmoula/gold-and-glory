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

  // §6.17: the backdrop sits behind everything (z-backdrop), and the body's own padding — not
  // z-order — is what keeps regular (non-positioned) content clear of the frame's border, with
  // #app's min-height compensating so that padding doesn't force a permanent scrollbar. The
  // cascade correctness of the ≤640px --frame-w override itself (8px vs 14px) is a resolved-value
  // question, not a text-presence one, and is covered by tests/grid-areas.test.js's winner().
  it('wires the backdrop z-index and the body/#app frame-clearance padding', () => {
    expect(css).toMatch(/\.stage-backdrop\s*{[^}]*z-index:\s*var\(--z-backdrop\)/);
    expect(css).toMatch(/body\s*{[^}]*padding:\s*var\(--frame-w\)/);
    expect(css).toMatch(/#app\s*{[^}]*min-height:\s*calc\(100dvh - 2 \* var\(--frame-w\)\)/);
  });
});
