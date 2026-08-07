// tests/assets.test.js — the asset pipeline's contracts (visual-upgrade design §2.1/§6).
// Rule-level like tests/grid-areas.test.js: jsdom can't paint a mask, but the failure modes
// worth guarding are all textual — a missing file, a background rect that would mask a solid
// square, an uncredited CC-BY file, a busted budget.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { mountAll } from './support/screens.js';

const ICON_DIR = 'src/assets/icons';
const CREDITS = 'CREDITS.md';

const iconFiles = () => readdirSync(ICON_DIR).filter((f) => f.endsWith('.svg'));
const allScreensHtml = () => Object.values(mountAll()).map((host) => host.innerHTML);

describe('icon assets (§4.1/§4.2)', () => {
  it('commits all 15 pinned primaries, no more, no less', () => {
    expect(iconFiles().sort()).toEqual(
      [
        'anvil-impact.svg',
        'anvil.svg',
        'biceps.svg',
        'boots.svg',
        'bordered-shield.svg',
        'broadsword.svg',
        'clover.svg',
        'coins-pile.svg',
        'drop.svg',
        'hearts.svg',
        'scales.svg',
        'shaking-hands.svg',
        'shield.svg',
        'sticking-plaster.svg',
        'swap-bag.svg',
      ].sort()
    );
  });

  it('every icon is mask-safe: 512 viewBox, no canvas-filling background', () => {
    for (const f of iconFiles()) {
      const svg = readFileSync(join(ICON_DIR, f), 'utf8');
      expect(svg, `${f} viewBox`).toContain('viewBox="0 0 512 512"');
      // A full-canvas path/rect would make the alpha mask a solid tile — the well would paint
      // a 24px square instead of a glyph. game-icons ships these when the background color in
      // the download URL is not "transparent".
      expect(svg, `${f} background path`).not.toMatch(/M0 0h512v512H0z/i);
      expect(svg, `${f} background rect`).not.toMatch(/<rect[^>]*(width="512"|height="512")/);
    }
  });

  it('every committed icon has its CC BY 3.0 line in CREDITS.md', () => {
    const credits = readFileSync(CREDITS, 'utf8');
    const titles = {
      'anvil-impact.svg': 'Anvil impact',
      'anvil.svg': 'Anvil',
      'biceps.svg': 'Biceps',
      'boots.svg': 'Boots',
      'bordered-shield.svg': 'Bordered shield',
      'broadsword.svg': 'Broadsword',
      'clover.svg': 'Clover',
      'coins-pile.svg': 'Coins pile',
      'drop.svg': 'Drop',
      'hearts.svg': 'Hearts',
      'scales.svg': 'Scales',
      'shaking-hands.svg': 'Shaking hands',
      'sticking-plaster.svg': 'Sticking plaster',
      'swap-bag.svg': 'Swap bag',
      'shield.svg': 'Shield',
    };
    for (const f of iconFiles()) {
      expect(credits, `credit line for ${f}`).toContain(`"${titles[f]}" icon by`);
      expect(credits).toContain('game-icons.net, CC BY 3.0');
    }
  });
});

describe('glyph rules ↔ rendered names ↔ files (§4.2, one mapping, no drift)', () => {
  const css = readFileSync('src/styles/components.css', 'utf8');
  const ruleNames = [...css.matchAll(/\.icon-well\[data-icon='([^']+)'\]::after/g)].map(
    (m) => m[1]
  );
  const maskedFiles = [...css.matchAll(/mask-image:\s*url\('\.\.\/assets\/icons\/([^']+)'\)/g)].map(
    (m) => m[1]
  );

  it('paints every data-icon name the renderers emit', () => {
    // Collect every name from every screen the game can mount — mirror grid-areas.test.js's
    // use of mountAll (tests/support/screens.js) to render the full screen set.
    const rendered = new Set();
    for (const html of allScreensHtml()) {
      for (const m of html.matchAll(/data-icon="([^"]+)"/g)) rendered.add(m[1]);
    }
    expect(rendered.size).toBe(15);
    for (const name of rendered) {
      expect(ruleNames, `mask rule for data-icon="${name}"`).toContain(name);
    }
  });

  it('every mask rule points at a committed file', () => {
    const committed = iconFiles();
    for (const f of maskedFiles) expect(committed, `mask url ${f}`).toContain(f);
    expect(new Set(maskedFiles).size).toBe(15); // no icon means two things (manifest §1)
  });
});

describe('sheet urls resolve (§2.1 — a moved/deleted asset must fail in CI, not on screen)', () => {
  it('every url(../assets/…) in every sheet points at a committed file', () => {
    for (const sheet of [
      'src/styles/base.css',
      'src/styles/components.css',
      'src/styles/screens.css',
      'src/styles/tokens.css',
    ]) {
      const css = readFileSync(sheet, 'utf8');
      for (const m of css.matchAll(/url\('\.\.\/assets\/([^']+)'\)/g)) {
        expect(existsSync(join('src/assets', m[1])), `${sheet} → assets/${m[1]}`).toBe(true);
      }
    }
  });
});

describe('weight budget (§6: 300KB hard, fonts pre-date the budget)', () => {
  it('keeps everything the visual phases add under 300KB', () => {
    let total = 0;
    const walk = (dir) => {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else total += statSync(p).size;
      }
    };
    for (const dir of ['icons', 'props', 'art', 'textures']) walk(join('src/assets', dir));
    expect(total).toBeLessThan(300 * 1024);
  });
});
