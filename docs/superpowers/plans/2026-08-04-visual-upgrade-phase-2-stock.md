# Visual Upgrade Phase 2 — Stock Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land every _pinned stock asset_ — 15 UI icon glyphs, wood texture, meter hatch, openclipart props — into the wells and surfaces Phase 1 built, with `CREDITS.md` obligations satisfied in the same commits, per `docs/superpowers/specs/2026-08-02-visual-upgrade-design.md` §4.

**Architecture:** Assets are committed files under `src/assets/{icons,props,art,textures}/`, referenced only from CSS `url()` (Vite hashes them and fails the build loudly if one goes missing). Icon glyphs paint via CSS `mask-image` + `currentColor` on the well's `::after` — an unregistered `data-icon` name draws no pseudo-element at all, so the Phase 1 recessed well remains the §10 zero-asset fallback with no failure mode. No renderer emits an asset path; the only JS/markup diffs in this whole phase are the game-over props container and a `data-ending` attribute.

**Tech Stack:** Vite 5, vitest (jsdom) with rule-level CSS tests (grid-areas precedent), `curl` + `sips` (macOS) for acquisition, ESLint.

**Baseline at start:** 445 tests / 15 files passing, lint clean, Phase 1 merged on `main` (`cd6564d`).

**Rules that bind every task:**

- Doc-first: Task 1 amends the design-system doc and spec before any code/asset lands (§10).
- License hygiene: a file and its `CREDITS.md` line land in the SAME commit (§2.1/§4.1).
- Stock files are never edited in place; in-house derivatives are new files in `src/assets/art/` crediting the base (§2.1).
- Weight budget: everything this phase adds stays under **300KB total** (§6); the wood PNG is the first cut if it fails.
- Run `npm test && npm run lint` before every commit. Work lands on `main` (Phase 1's branch is merged; follow the repo's current convention if a branch is preferred — mirror Phase 1: `feat/visual-upgrade-phase-2-stock`).

**Phase 1 facts this plan builds on (verified against landed code, not the stale Phase 1 plan):**

- `iconWell(name, { small })` in `src/ui/components.js:68` is the ONLY emitter of wells; every well carries `data-icon="<name>"`, `aria-hidden="true"`.
- The 15 landed `data-icon` names: `health durability injuries repair heal bribe shield blade charm power guard speed purse tax sponsor` (registry documented in design-system §6.18). The HUD purse deliberately keeps `.coin` — it has NO well.
- `.icon-well` CSS lives at `src/styles/components.css:398` (34px, recessed paper radial), `.icon-well--sm` at `:412` (24px); `.btn .icon-well` (`:181`) and `.ledger__row dt .icon-well` (`:685`) handle layout contexts.
- Ending cards (`src/ui/render.js` `endingCard()`) reuse `.poster__portrait` + `.poster__silhouette` as their illustration well.
- `tests/support/screens.js` exports `mountAll` (see `tests/grid-areas.test.js` for its use) — the fixture that renders every screen.

**File structure (what changes where):**

| File                                                                       | Responsibility in this plan                                                          |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| design-system doc + visual-upgrade spec + manifest                         | doc-first amendments (Task 1)                                                        |
| `src/assets/icons/*.svg` (15, pristine)                                    | Task 2                                                                               |
| `CREDITS.md` (NEW, repo root)                                              | Tasks 2, 4, 5 (grows with each landing)                                              |
| `tests/assets.test.js` (NEW)                                               | asset presence, mask-safety, glyph-rule consistency, weight budget (Tasks 2–3)       |
| `src/styles/components.css`                                                | glyph base + 15 mask rules (Task 3); meter hatch (Task 4); retired-card art (Task 6) |
| `src/assets/textures/wood-planks.{png,jpg}`                                | Task 4                                                                               |
| `src/styles/tokens.css` / `.hud` rule in `components.css`                  | texture layering (Task 4)                                                            |
| `src/assets/props/*.svg` (pristine) + `src/assets/art/*.svg` (derivatives) | Task 5                                                                               |
| `src/ui/render.js` (`renderGameOver`, `endingCard`)                        | props container + `data-ending` (Task 6)                                             |
| `src/styles/screens.css`                                                   | game-over prop positioning (Task 6)                                                  |
| `tests/render.test.js`                                                     | props/endings assertions (Task 6)                                                    |

---

### Task 1: Doc-first amendments

**Files:**

- Modify: `docs/superpowers/specs/2026-07-23-gold-and-glory-design-system.md`
- Modify: `docs/superpowers/specs/2026-08-02-visual-upgrade-design.md`
- Modify: `docs/superpowers/specs/2026-08-02-asset-sourcing-manifest.md`

- [ ] **Step 1: §6.18 — the glyph layer**

Append to §6.18 (after the data-icon registry amendment):

```markdown
**Amendment (Phase 2) — the glyph layer.** The well's `::after` is the `.icon` treatment the
visual-upgrade design §2.2 names: `background-color: currentColor` masked by the icon SVG
(`mask-image` + `-webkit-mask-image`, `center / contain no-repeat`, `inset: 3px`). Per-name
rules in components.css are the only place `content` is set, so an unregistered name draws no
pseudo-element and the recessed well is the fallback — there is no solid-square failure mode,
and recoloring never touches an SVG file. Wells default to `color: var(--ink)` (ink on the
recessed paper); `health` and `injuries` carry the blood flag (`color: var(--blood)`). The
glyph sources are the manifest's 15 pinned game-icons.net primaries, committed pristine under
`src/assets/icons/` with their source names; the mask rules are the single name→file mapping
(tests/assets.test.js cross-checks rendered names ↔ rules ↔ files).
```

- [ ] **Step 2: §6.1 — HUD texture note**

Append to §6.1:

```markdown
**Amendment (Phase 2, visual-upgrade §4.3):** the beam's wood gradient gains a hand-painted
plank texture layer (`src/assets/textures/`, PamNawi's "Handpainted Wood", CC BY 3.0,
resized/compressed in-repo). The gradient stays declared beneath it as the no-asset fallback.
If bone-on-texture contrast dips below §3's floor anywhere, a darkening overlay gradient goes
over the texture — the texture is swappable, the floor is not.
```

- [ ] **Step 3: §6.4 — zone hatch note**

Append to §6.4:

```markdown
**Amendment (Phase 2, decision 1):** the gold-ramp zones carry a crayon-scribble hatch as a
small inline data-URI SVG `background-image` over their band colors — texture, not color, is
the extra channel (§3 stays the authority on the ramp). Static; nothing to reduce for motion.
```

- [ ] **Step 4: §6.14 + §6.0 — game-over dressing and endings art**

Append to §6.14:

```markdown
**Amendment (Phase 2, visual-upgrade §4.4):** ending cards carry `data-ending="<key>"`; the
Retired Rich card's `.poster__portrait` shows the gold-pile prop (silhouette hidden by the
same rule — locked cards keep the art: the reference's gallery teases its endings). The screen
gains one `aria-hidden` dressing layer, `.gameover__props` (`pointer-events: none`), holding
`.prop` elements: two distressed socks hung from the top edge, a confetti scatter, the sandal
base, the banana peel, the cactus. All decorative, all CSS-positioned, all invisible to AT.
```

In §6.0's closed class index, append: `gameover__props, prop, prop--sock-left, prop--sock-right, prop--confetti, prop--sandal, prop--banana, prop--cactus`.

- [ ] **Step 5: visual-upgrade spec corrections (three small ones)**

In `2026-08-02-visual-upgrade-design.md`:

1. §2.1's committed-files line: add `src/assets/props/` — "(pristine openclipart stock props)" — between icons and art. (The spec listed three directories; unmodified stock props are neither icons nor hand-authored art.)
2. §2.2: append "(Implemented as the well's `::after` pseudo-element — see design-system §6.18's Phase 2 amendment; 'element' below reads as 'rendered box'.)"
3. §4.1: change "The 16 primary icons" to "The 15 primary icons (the HUD purse's Shiny purse pick is superseded — Phase 1's landed §6.1 keeps the existing `.coin` for that slot, and no well exists there)".

- [ ] **Step 6: manifest note**

In the manifest's §1 table row "HUD purse", append to the Primary cell: "(superseded by the landed `.coin` — not committed)".

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/specs/
git commit -m "docs(design-system): phase 2 amendments — glyph layer, textures, gameover dressing"
```

---

### Task 2: Acquire the 15 icon SVGs + CREDITS.md

**Files:**

- Create: `src/assets/icons/` (15 files, pristine as downloaded)
- Create: `CREDITS.md`
- Create: `tests/assets.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/assets.test.js`:

```js
// tests/assets.test.js — the asset pipeline's contracts (visual-upgrade design §2.1/§6).
// Rule-level like tests/grid-areas.test.js: jsdom can't paint a mask, but the failure modes
// worth guarding are all textual — a missing file, a background rect that would mask a solid
// square, an uncredited CC-BY file, a busted budget.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ICON_DIR = 'src/assets/icons';
const CREDITS = 'CREDITS.md';

const iconFiles = () => readdirSync(ICON_DIR).filter((f) => f.endsWith('.svg'));

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
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/assets.test.js`
Expected: FAIL — `ENOENT` on `src/assets/icons` (directory doesn't exist yet).

- [ ] **Step 3: Download the 15 primaries (transparent background variant)**

```bash
mkdir -p src/assets/icons
base='https://game-icons.net/icons/000000/transparent/1x1'
while read -r author name; do
  curl -fsSL "$base/$author/$name.svg" -o "src/assets/icons/$name.svg" || echo "FAILED: $name"
done <<'EOF'
skoll hearts
lorc anvil
lorc drop
lorc anvil-impact
lorc sticking-plaster
lorc swap-bag
sbed shield
lorc broadsword
lorc clover
delapouite biceps
lorc bordered-shield
lorc boots
delapouite coins-pile
lorc scales
delapouite shaking-hands
EOF
ls -la src/assets/icons/ | wc -l
```

Expected: 15 files, no `FAILED:` lines, each a small (~1–6KB) SVG.
If the `transparent` URL form 404s, the fallback source is the project's GitHub mirror (same files, same CC BY 3.0): `https://raw.githubusercontent.com/game-icons/icons/master/{author}/{name}.svg` — then re-run Step 4's guards; if a fallback file carries a canvas background, do NOT strip it (pristine rule) — find the URL form that serves transparent instead.

- [ ] **Step 4: Mask-safety guards**

```bash
grep -L 'viewBox="0 0 512 512"' src/assets/icons/*.svg
grep -l 'M0 0h512v512H0z' src/assets/icons/*.svg
```

Expected: BOTH commands print nothing (every file has the viewBox; none has a background path).

- [ ] **Step 5: Write CREDITS.md**

Create `CREDITS.md` at the repo root:

```markdown
# Credits

Gold & Glory uses the third-party assets below. CC BY 3.0 items require this attribution
(license: https://creativecommons.org/licenses/by/3.0/); CC0/Public Domain items are credited
anyway — provenance beats amnesia. Source pages, alternates, and pinning rationale:
`docs/superpowers/specs/2026-08-02-asset-sourcing-manifest.md`.

## UI icons — game-icons.net (CC BY 3.0)

- "Hearts" icon by Skoll, from game-icons.net, CC BY 3.0
- "Anvil" icon by Lorc, from game-icons.net, CC BY 3.0
- "Drop" icon by Lorc, from game-icons.net, CC BY 3.0
- "Anvil impact" icon by Lorc, from game-icons.net, CC BY 3.0
- "Sticking plaster" icon by Lorc, from game-icons.net, CC BY 3.0
- "Swap bag" icon by Lorc, from game-icons.net, CC BY 3.0
- "Shield" icon by sbed, from game-icons.net, CC BY 3.0
- "Broadsword" icon by Lorc, from game-icons.net, CC BY 3.0
- "Clover" icon by Lorc, from game-icons.net, CC BY 3.0
- "Biceps" icon by Delapouite, from game-icons.net, CC BY 3.0
- "Bordered shield" icon by Lorc, from game-icons.net, CC BY 3.0
- "Boots" icon by Lorc, from game-icons.net, CC BY 3.0
- "Coins pile" icon by Delapouite, from game-icons.net, CC BY 3.0
- "Scales" icon by Lorc, from game-icons.net, CC BY 3.0
- "Shaking hands" icon by Delapouite, from game-icons.net, CC BY 3.0
```

(Textures and props sections are appended by Tasks 4 and 5 — a section lands in the same commit as its files, never earlier.)

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/assets.test.js`
Expected: PASS (all four tests — budget is trivially green at ~60KB of SVGs).

- [ ] **Step 7: Commit (files + credits together)**

```bash
git add src/assets/icons/ CREDITS.md tests/assets.test.js
git commit -m "feat(assets): 15 pinned game-icons primaries with CC BY credits"
```

---

### Task 3: Icons fill the wells (CSS mask wiring)

**Files:**

- Modify: `src/styles/components.css` (extend the `.icon-well` block at ~line 398)
- Modify: `tests/assets.test.js` (add the consistency suite)

- [ ] **Step 1: Write the failing tests**

Append to `tests/assets.test.js`:

```js
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
```

`allScreensHtml()` — implement at the top of the file the way `tests/grid-areas.test.js` builds its screen set with `mountAll`/`mount` (import from `./support/screens.js` and reuse its fixtures; if `mountAll` returns containers rather than strings, read `container.innerHTML`).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/assets.test.js -t "glyph rules"`
Expected: FAIL — zero mask rules found in the sheet.

- [ ] **Step 3: Extend the `.icon-well` block in components.css**

Directly after the existing `.icon-well--sm` rule (~line 412), add:

```css
/* §6.18's glyph layer (Phase 2): ::after IS the .icon treatment — currentColor through the
   icon's alpha mask, so recoloring never touches an SVG file (visual-upgrade §2.2). `content`
   is set ONLY in the per-name rules below: an unregistered name draws no pseudo-element and
   the recessed well above stays the §10 fallback — no solid-square failure mode. */
.icon-well {
  position: relative;
  color: var(--ink);
}
.icon-well::after {
  position: absolute;
  inset: 3px;
  background-color: currentColor;
  -webkit-mask: center / contain no-repeat;
  mask: center / contain no-repeat;
}
/* §2.2's blood flag: the two wounds-and-vitals glyphs read red, everything else inks. */
.icon-well[data-icon='health'],
.icon-well[data-icon='injuries'] {
  color: var(--blood);
}
/* The registry, name → pinned primary (manifest §1). One rule per name; the assets test
   cross-checks this list against rendered markup and committed files. */
.icon-well[data-icon='health']::after {
  content: '';
  -webkit-mask-image: url('../assets/icons/hearts.svg');
  mask-image: url('../assets/icons/hearts.svg');
}
.icon-well[data-icon='durability']::after {
  content: '';
  -webkit-mask-image: url('../assets/icons/anvil.svg');
  mask-image: url('../assets/icons/anvil.svg');
}
.icon-well[data-icon='injuries']::after {
  content: '';
  -webkit-mask-image: url('../assets/icons/drop.svg');
  mask-image: url('../assets/icons/drop.svg');
}
.icon-well[data-icon='repair']::after {
  content: '';
  -webkit-mask-image: url('../assets/icons/anvil-impact.svg');
  mask-image: url('../assets/icons/anvil-impact.svg');
}
.icon-well[data-icon='heal']::after {
  content: '';
  -webkit-mask-image: url('../assets/icons/sticking-plaster.svg');
  mask-image: url('../assets/icons/sticking-plaster.svg');
}
.icon-well[data-icon='bribe']::after {
  content: '';
  -webkit-mask-image: url('../assets/icons/swap-bag.svg');
  mask-image: url('../assets/icons/swap-bag.svg');
}
.icon-well[data-icon='shield']::after {
  content: '';
  -webkit-mask-image: url('../assets/icons/shield.svg');
  mask-image: url('../assets/icons/shield.svg');
}
.icon-well[data-icon='blade']::after {
  content: '';
  -webkit-mask-image: url('../assets/icons/broadsword.svg');
  mask-image: url('../assets/icons/broadsword.svg');
}
.icon-well[data-icon='charm']::after {
  content: '';
  -webkit-mask-image: url('../assets/icons/clover.svg');
  mask-image: url('../assets/icons/clover.svg');
}
.icon-well[data-icon='power']::after {
  content: '';
  -webkit-mask-image: url('../assets/icons/biceps.svg');
  mask-image: url('../assets/icons/biceps.svg');
}
.icon-well[data-icon='guard']::after {
  content: '';
  -webkit-mask-image: url('../assets/icons/bordered-shield.svg');
  mask-image: url('../assets/icons/bordered-shield.svg');
}
.icon-well[data-icon='speed']::after {
  content: '';
  -webkit-mask-image: url('../assets/icons/boots.svg');
  mask-image: url('../assets/icons/boots.svg');
}
.icon-well[data-icon='purse']::after {
  content: '';
  -webkit-mask-image: url('../assets/icons/coins-pile.svg');
  mask-image: url('../assets/icons/coins-pile.svg');
}
.icon-well[data-icon='tax']::after {
  content: '';
  -webkit-mask-image: url('../assets/icons/scales.svg');
  mask-image: url('../assets/icons/scales.svg');
}
.icon-well[data-icon='sponsor']::after {
  content: '';
  -webkit-mask-image: url('../assets/icons/shaking-hands.svg');
  mask-image: url('../assets/icons/shaking-hands.svg');
}
```

(The `mask:` shorthand in the base rule implicitly sets `mask-image: none`; the per-name longhand overrides it by specificity + source order. Both prefixed and unprefixed longhands are set because the shorthand/longhand pairing must match per prefix.)

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS — 445 baseline + Task 2's four + these two. `tests/styles.test.js`'s rule-level checks don't parse pseudo-elements for contrast; the glyphs are `aria-hidden` decoration next to already-verified labels, and ink-on-paper-4/5 (well interior) is a documented-verified pair.

- [ ] **Step 5: Visual verification**

Run: `npm run dev` — hub: repair/heal/bribe buttons show inked glyphs in their wells; training rows show biceps/shield/boots; shop cards show shield/sword/clover; HUD shows red heart + red drop, ink anvil; win a fight → ledger rows show coins-pile/scales/handshake. Zoom to 200% (§8): masks scale cleanly (vector). Fallback probe: temporarily rename one well's `data-icon` in devtools to `data-icon="nope"` → recessed empty well, no square.

- [ ] **Step 6: Commit**

```bash
git add src/styles/components.css tests/assets.test.js
git commit -m "feat(ui): icon glyphs fill every well via CSS mask + currentColor"
```

---

### Task 4: Texture pass (wood beam + meter hatch, once)

**Files:**

- Create: `src/assets/textures/wood-planks.png` (or `.jpg` — see Step 2)
- Modify: `src/styles/components.css` (`.hud` rule ~line 13; `.meter__zone` rules ~lines 480–494)
- Modify: `CREDITS.md`

- [ ] **Step 1: Download the texture**

The OGA asset page hosts the file; resolve the actual file URL from the page, then fetch (use the session scratchpad, NOT /tmp):

```bash
SCRATCH=<your scratchpad dir>
curl -fsSL https://opengameart.org/content/handpainted-wood \
  | grep -o 'https://opengameart.org/sites/default/files/[^"]*' | head -5
# pick the .png/.zip URL from the output (the page offers one primary file):
curl -fsSL '<file url>' -o "$SCRATCH/wood-src.png"   # unzip first if it is a .zip
sips -g pixelWidth -g pixelHeight "$SCRATCH/wood-src.png"
```

Expected: a 1651×1651 PNG (per the manifest).

- [ ] **Step 2: Resize/compress to rendered size (budget rule)**

The beam renders ~48–72px tall; a 512px tile is generous:

```bash
mkdir -p src/assets/textures
sips -Z 512 "$SCRATCH/wood-src.png" --out src/assets/textures/wood-planks.png
ls -la src/assets/textures/
```

If `wood-planks.png` exceeds **120KB**, convert instead (the beam is opaque — no alpha needed):

```bash
sips -Z 512 -s format jpeg -s formatOptions 70 "$SCRATCH/wood-src.png" --out src/assets/textures/wood-planks.jpg
```

and use the `.jpg` filename in Step 3. Expected final size: 40–120KB. Run `npx vitest run tests/assets.test.js -t budget` — must stay green.

- [ ] **Step 3: Layer it over the beam gradient**

In `src/styles/components.css`, in the `.hud` rule (~line 13), replace the existing `background: var(--grad-wood);` declaration with:

```css
/* §6.1 Phase 2 amendment: plank texture over the gradient; the gradient stays as the
     no-asset fallback and as the tone bed the texture multiplies into. */
background:
  url('../assets/textures/wood-planks.png') center / 288px auto repeat,
  var(--grad-wood);
background-blend-mode: multiply, normal;
```

(`--grad-wood` is a `linear-gradient()` token — tokens.css:121 — and works as a background layer; do NOT inline the wood stops, the token is their single owner.)

(Adjust the filename if Step 2 produced a `.jpg`. `288px` renders the 512px tile at ~0.56×, keeping plank strokes fine at beam height — tune in Step 5.)

- [ ] **Step 4: Meter zone hatch (decision 1 — texture channel on the gold ramp)**

The three zone modifiers (`components.css:485–494`) currently use the `background:` **shorthand** (`background: var(--gold-mid);` etc.), which resets `background-image` — a hatch on the base rule would be silently wiped by the very rules that color the bands. Two edits, together:

1. Convert the three modifiers to the longhand — `background-color: var(--gold-mid);`, `background-color: var(--gold);`, `background-color: var(--gold-hi);` (the crit rule keeps its `border-inline` and `box-shadow` untouched).
2. In the base `.meter__zone` rule (~line 480), add:

```css
/* §6.4 Phase 2 amendment: crayon-scribble hatch — texture as the redundant channel over the
     gold ramp (decision 1). Inline data-URI: generated texture, no asset file, static. The
     zone modifiers below MUST stay background-color longhands, or this layer is reset. */
background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18'%3E%3Cpath d='M-3 12 Q3 4 9 8 T21 2 M0 20 Q7 12 13 15 T24 10' stroke='%232f2318' stroke-opacity='.15' stroke-width='2.4' stroke-linecap='round' fill='none'/%3E%3C/svg%3E");
background-size: 18px 18px;
```

(The wobbly Q/T strokes read as crayon rather than engineering hatching; tune `stroke-opacity` .12–.20 in Step 5. If `tests/styles.test.js` pins the zones' `background` spelling, update the pinned spelling to the longhand.)

- [ ] **Step 5: Contrast re-verification (§4.3 — the floor is not swappable)**

`npm run dev`, then check with devtools eyedropper on a screenshot:

- Beam: `Gold:` label, bar labels, `.hud__count`, `.bar__num` over the darkest and lightest texture spots — the §3 table pins bone-on-wood at 10.06:1 against `--wood-4`; the texture must not lift the background enough to matter. If any text spot reads muddy, darken the texture layer: add `linear-gradient(rgba(31, 22, 12, 0.25), rgba(31, 22, 12, 0.25)),` as the FIRST background layer (over the texture) and re-check.
- Meter: zone bands still read as three distinct steps with the hatch on top; `.meter__labels` and the stamp are outside the bands and unaffected.
- Reduced-motion: nothing here animates — no check needed (statics).

- [ ] **Step 6: Append the credits line (same commit as the file)**

Append to `CREDITS.md`:

```markdown
## Textures

- "Handpainted Wood" by PamNawi, from opengameart.org (opengameart.org/content/handpainted-wood),
  CC BY 3.0 — resized and recompressed in-repo (src/assets/textures/).
```

- [ ] **Step 7: Run suite + commit**

Run: `npm test && npm run lint`
Expected: PASS (the budget test now counts the texture — must still be under 300KB).

```bash
git add src/assets/textures/ src/styles/components.css CREDITS.md
git commit -m "feat(ui): wood texture on the HUD beam and crayon hatch on the meter zones"
```

---

### Task 5: Acquire props + author the two in-house derivatives

**Files:**

- Create: `src/assets/props/gold-pile.svg`, `banana-peel.svg`, `cactus.svg`, `sandal-base.svg` (pristine)
- Create: `src/assets/art/sock-distressed.svg`, `src/assets/art/confetti.svg` (in-house derivatives)
- Modify: `CREDITS.md`

- [ ] **Step 1: Download (pristine picks straight to props/, derivative bases to scratchpad)**

```bash
mkdir -p src/assets/props src/assets/art
SCRATCH=<your scratchpad dir>
curl -fsSL https://openclipart.org/download/43969  -o src/assets/props/gold-pile.svg
curl -fsSL https://openclipart.org/download/2774   -o src/assets/props/banana-peel.svg
curl -fsSL https://openclipart.org/download/169087 -o src/assets/props/cactus.svg
curl -fsSL https://openclipart.org/download/36859  -o src/assets/props/sandal-base.svg
curl -fsSL https://openclipart.org/download/334552 -o "$SCRATCH/long-sock-base.svg"
curl -fsSL https://openclipart.org/download/148675 -o "$SCRATCH/confetti-base.svg"
head -c 200 src/assets/props/gold-pile.svg
```

Expected: six SVGs (`<svg` or `<?xml` heads). Guard: any file over **40KB** gets flagged — check whether the manifest's alternate is lighter or the SVG carries editor cruft (Inkscape metadata blocks are safe to leave; the budget test is the arbiter). The two bases are NOT committed — only their derivatives are (§2.1).

- [ ] **Step 2: Author `src/assets/art/sock-distressed.svg`**

Start from `$SCRATCH/long-sock-base.svg` (Oltarus's outline-only silhouette — made for filling). Save as a NEW file with these edits, using the house recipe (§2.3):

- Root: keep the base's viewBox; add nothing outside it.
- Body fill: `#e6d6ae` (`--paper-3`); outline stroke `#2f2318` (`--border-ink`) at the base's own stroke width (or 2.5 if the base has none).
- Heel + toe: one rough hole each — a cluster of 2–3 overlapping ellipses filled `#46301b` (`--wood-4`, reads as void) with a 1px `#2f2318` rim.
- Two stain blobs mid-body: irregular 4–6 point blobby paths, fill `#6b5638`, `fill-opacity=".25"`.
- One crayon hatch group over the body: 3–4 short curved strokes, `stroke="#2f2318" stroke-opacity=".12" stroke-width="2"`.

Check: `open src/assets/art/sock-distressed.svg` (or the dev server later) — must read as "sad old sock" at ~110px tall. Keep it under 10KB.

- [ ] **Step 3: Author `src/assets/art/confetti.svg`**

Start from `$SCRATCH/confetti-base.svg` (10binary's scattered pieces). Save as a NEW file:

- Recolor every piece's fill, cycling this palette: `#3e6fae` (`--commit`), `#d9a441` (`--gold`), `#b5402f` (`--blood`), `#3f6b35` (`--moss-ink`), `#f6ecd1` (`--paper-1`).
- Delete any background rect/canvas fill so the scatter sits on transparency.
- Keep it under 15KB (delete pieces if the base is dense — a dozen visible pieces suffice at 300px wide).

- [ ] **Step 4: Append the credits section (same commit as the files)**

Append to `CREDITS.md`:

```markdown
## Props — openclipart.org (CC0 / Public Domain, credited for provenance)

- "Pile of Golden Coins" by J_Alves (src/assets/props/gold-pile.svg)
- "Banana Peel" by Gerald_G (src/assets/props/banana-peel.svg)
- "Cactus" by Julianvb98 (src/assets/props/cactus.svg)
- "feet in sandals" by jonadab (src/assets/props/sandal-base.svg — Phase 3 redraws this Roman)
- "Long sock" by Oltarus — base for the in-house src/assets/art/sock-distressed.svg
- "organized confetti" by 10binary — base for the in-house recolor src/assets/art/confetti.svg
```

- [ ] **Step 5: Budget + commit**

Run: `npx vitest run tests/assets.test.js && npm run lint`
Expected: PASS — budget still under 300KB with icons + texture + props + art summed.

```bash
git add src/assets/props/ src/assets/art/ CREDITS.md
git commit -m "feat(assets): openclipart props and in-house sock/confetti derivatives with credits"
```

---

### Task 6: Props take their places (game-over dressing + endings art)

**Files:**

- Modify: `src/ui/render.js` (`renderGameOver` section markup; `endingCard()` ~line 368)
- Modify: `src/styles/screens.css` (game-over block)
- Modify: `src/styles/components.css` (ending-card art rule, near the `.ending-card` rules)
- Modify: `tests/render.test.js`

- [ ] **Step 1: Write the failing tests**

In `tests/render.test.js` (game-over describe area):

```js
it('dresses the death screen with aria-hidden props (§4.4)', () => {
  const html = gameoverHtml(); // the file's existing game-over fixture helper
  expect(html).toMatch(/<div class="gameover__props" aria-hidden="true">/);
  for (const prop of ['sock-left', 'sock-right', 'confetti', 'sandal', 'banana', 'cactus']) {
    expect(html).toContain(`prop--${prop}`);
  }
});

it('keys every ending card for its illustration (§4.4)', () => {
  const html = gameoverHtml();
  for (const key of Object.keys(CONFIG.endings)) {
    expect(html).toContain(`data-ending="${key}"`);
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/render.test.js -t "props"`
Expected: FAIL.

- [ ] **Step 3: Renderer changes**

In `src/ui/render.js`:

1. `endingCard()` — add the key to the article:

```js
  return `<article class="ending-card parchment tape${locked ? ' ending-card--locked' : ''}" data-ending="${escapeHtml(key)}"${
    locked ? ' aria-disabled="true"' : ''
  }>
```

2. `renderGameOver()` — add the dressing layer as the LAST child of `<section class="screen screen--gameover">` (after the cta div, so it follows all content in source order; it is `aria-hidden` and non-interactive, so reading/tab order are untouched):

```js
<div class="gameover__props" aria-hidden="true">
  <i class="prop prop--sock-left"></i>
  <i class="prop prop--sock-right"></i>
  <i class="prop prop--confetti"></i>
  <i class="prop prop--sandal"></i>
  <i class="prop prop--banana"></i>
  <i class="prop prop--cactus"></i>
</div>
```

- [ ] **Step 4: Position the props (screens.css) and fill the retired well (components.css)**

In `src/styles/screens.css`, after the `.gameover__cta` rule:

```css
/* §6.14 Phase 2 amendment: the death screen's dressing layer. Decorative, absolute, inert —
   grid-area: auto + position: absolute takes it out of track sizing entirely, so
   tests/grid-areas.test.js has nothing to learn. Positions are % of the screen so both
   breakpoints share them; the cramped bits hide at ≤640px instead of overlapping copy. */
.screen--gameover {
  position: relative;
}
.gameover__props {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}
.prop {
  position: absolute;
  background: center / contain no-repeat;
}
.prop--sock-left {
  top: -4px;
  left: 9%;
  width: 44px;
  height: 108px;
  transform: rotate(-5deg);
  background-image: url('../assets/art/sock-distressed.svg');
}
.prop--sock-right {
  top: -4px;
  right: 9%;
  width: 44px;
  height: 108px;
  transform: rotate(4deg) scaleX(-1);
  background-image: url('../assets/art/sock-distressed.svg');
}
.prop--confetti {
  top: 16%;
  left: 50%;
  width: 320px;
  height: 150px;
  transform: translateX(-50%);
  background-image: url('../assets/art/confetti.svg');
  opacity: 0.9;
}
.prop--sandal {
  bottom: 26%;
  left: 11%;
  width: 72px;
  height: 58px;
  transform: rotate(-22deg);
  background-image: url('../assets/props/sandal-base.svg');
}
.prop--banana {
  bottom: 24%;
  right: 15%;
  width: 62px;
  height: 46px;
  transform: rotate(8deg);
  background-image: url('../assets/props/banana-peel.svg');
}
.prop--cactus {
  bottom: 22%;
  right: 7%;
  width: 46px;
  height: 62px;
  background-image: url('../assets/props/cactus.svg');
}
@media (max-width: 640px) {
  .prop--confetti {
    width: 210px;
  }
  .prop--sandal,
  .prop--cactus {
    display: none;
  }
}
```

In `src/styles/components.css`, with the `.ending-card` rules:

```css
/* §4.4: the Retired Rich card's illustration well shows the gold pile — locked or not, the
   gallery teases its endings (the reference's right card). The pile layers over the well's
   own recession gradient (restated here because `background-image` is one property: the
   longhand replaces the shorthand's gradient, so both layers are declared together — keep
   the gradient stops in sync with `.poster__portrait`'s own rule). The silhouette hides only
   where art exists; every other card keeps the §10 fallback untouched. */
.ending-card[data-ending='retired'] .poster__portrait {
  background-image:
    url('../assets/props/gold-pile.svg'),
    radial-gradient(circle at 50% 42%, var(--paper-4), var(--paper-5));
  background-size:
    78% auto,
    100% 100%;
  background-position:
    center 68%,
    center;
  background-repeat: no-repeat;
}
.ending-card[data-ending='retired'] .poster__portrait .poster__silhouette {
  display: none;
}
```

**Before committing:** open `.poster__portrait`'s existing rule in components.css and mirror its actual background declaration into the radial-gradient layer above (the stops written here are §6.12's well recipe — if the portrait well differs, ITS values win).

- [ ] **Step 5: Run the suite**

Run: `npm test && npm run lint`
Expected: PASS. `tests/a11y.test.js` sees no new interactive/announced content (everything added is `aria-hidden`); `tests/grid-areas.test.js` ignores absolutely-positioned auto-placed children.

- [ ] **Step 6: Visual verification**

`npm run dev`, die (or `retire`) to reach game over, at 1280px and 375px:

- Socks hang from the top edge without covering the plaque or stamp; confetti scatters behind/around the center stamp without swallowing the "YOU DIED" text; sandal/banana/cactus sit in the lower third without touching the cause-of-death line or the CTA.
- Retired Rich card shows the gold pile (locked "?" state included); the other two cards keep their silhouettes.
- Nothing intercepts clicks: the Fight Again button works with props overlapping nearby.
- Tune the % positions/sizes in place if anything collides; they are dressing, copy is king.

- [ ] **Step 7: Commit**

```bash
git add src/ui/render.js src/styles/screens.css src/styles/components.css tests/render.test.js
git commit -m "feat(ui): death-screen prop dressing and Retired Rich gold-pile art"
```

---

### Task 7: Phase acceptance — budget, zero-asset check, breakpoints, proof

**Files:** none new — verification only, plus a README pointer.

- [ ] **Step 1: Full suite + lint + build**

Run: `npm test && npm run lint && npm run build`
Expected: all clean — the build proves every CSS `url()` resolves (a missing asset fails here loudly, per §2.1).

- [ ] **Step 2: Weight budget, stated with numbers**

```bash
du -sk src/assets/icons src/assets/props src/assets/art src/assets/textures | sort -k2
```

Expected: combined total < 300KB (the vitest budget test already enforces it; record the actual number in the phase report).

- [ ] **Step 3: Zero-asset acceptance (§6) — simulate, verify, restore**

Deleting files breaks the Vite build by design, so the check substitutes empty stand-ins instead:

```bash
find src/assets/icons src/assets/props src/assets/art -name '*.svg' \
  -exec sh -c 'printf "<svg xmlns=\"http://www.w3.org/2000/svg\"/>" > "$1"' _ {} \;
printf '\x89PNG\r\n\x1a\n' > src/assets/textures/wood-planks.png  # truncated stub (adjust extension if jpg)
```

`npm run dev` → every screen: wells show their recessed empty treatment (no squares, no broken-image chrome), beam falls back to its gradient (a broken bg-image layer paints nothing), game-over props simply absent, retired card shows… the well gradient (silhouette is display:none under the art rule — acceptable: the card still reads complete as an empty well; note it in the report). Then restore and re-verify:

```bash
git checkout -- src/assets
npm test
```

Expected: suite green again, working tree clean of asset stubs.

- [ ] **Step 4: Breakpoint + reference pass with screenshots**

Dev server: hub, fight, result, game over at 1280px and 375px, fight at 768px. Compare against the four reference images: iconography everywhere the references show it, textured beam, hatched meter zones, dressed death screen. Reduced-motion emulation: one pass over fight capture + game over (all Phase 2 additions are static — confirm nothing new moves). Attach screenshots to the phase report.

- [ ] **Step 5: Point README at CREDITS**

In `README.md`, add one line to the project description area: `Third-party asset attributions: see [CREDITS.md](CREDITS.md).`

- [ ] **Step 6: Final commit**

```bash
git add README.md
git commit -m "docs(readme): link asset credits"
```

---

## Phase exit criteria (spec §4 + §6)

- All 15 wells paint their pinned glyphs; unregistered names still fall back to the empty well.
- Beam textured with the gradient beneath as fallback; meter zones hatched; §3 contrast floor re-verified on both.
- Death screen dressed (socks/confetti/sandal/banana/cactus), Retired Rich shows the gold pile.
- `CREDITS.md` complete — every CC-BY file credited in the commit that added it.
- Budget < 300KB, suite + lint + build green, zero-asset simulation passes, screenshots at both breakpoints against the references.
- Phase 3 (hand-authored art) plan gets written against THIS landed code — chicken first (it locks the house stroke width, §2.3).
