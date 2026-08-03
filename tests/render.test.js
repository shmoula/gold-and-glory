// tests/render.test.js
import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';
import { createGameState } from '../src/state.js';
import {
  btn,
  meter,
  bar,
  poster,
  shopItem,
  renderHud,
  renderHub,
  renderResult,
  ledgerSummary,
  renderGameOver,
  gameoverSummary,
  renderFight,
  escapeHtml,
  titlePlaque,
  iconWell,
  meterDistance,
  meterPosition,
  meterPeriod,
  meterZones,
  sweetCenter,
  URGENT_FRACTION,
  logEntry,
  logEntryText,
} from '../src/ui/render.js';
import { formatGold } from '../src/ui/format.js';
import { startFight, effectiveStats, resolveFightOutcome } from '../src/game.js';
import { makeRng } from '../src/rng.js';
import { resolveTiming, timingWindowWidth } from '../src/combat.js';

// Match classes as a set, never as a literal class string: adding or reordering a class is a
// harmless refactor and must not turn a passing suite red.
const classesOf = (tag) =>
  tag
    .match(/class="([^"]*)"/)[1]
    .trim()
    .split(/\s+/);
// Articles never nest, so each match is exactly one whole poster.
const posterCards = (html) => html.match(/<article[\s\S]*?<\/article>/g) || [];
// Parse to DOM rather than matching markup: an added class, a reordered attribute or a
// reformatted tag is a no-op refactor and must not turn the suite red. Structure and text are
// the behaviour; the byte layout of the tag is not.
const dom = (html) => {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
};
// A log strip's entries as { turn, text }: the turn stamp read from `.log__turn`, and the rest
// of the entry's text with that stamp removed. Fails loudly if an entry has no stamp.
const logRows = (html) =>
  [...dom(html).querySelectorAll('.log__entry')].map((li) => {
    const stamp = li.querySelector('.log__turn');
    return {
      turn: stamp?.textContent ?? null,
      text: li.textContent.replace(stamp?.textContent ?? '', '').trim(),
    };
  });

// A minimal `lastResult`/`ended` pair, hoisted to module scope so the `renderResult` and
// `renderGameOver` describes below and the cross-screen title-plaque check further down share
// one copy each — a required field added to either shape only has to be updated here, not
// re-typed by hand in two unlinked fixtures that quietly drift apart.
const RESULT_WIN = {
  won: true,
  died: false,
  opponentName: 'The Brute',
  purse: 50,
  tax: 10,
  sponsorIncome: 0,
  netGold: 40,
  durabilityLost: 3,
  injuriesGained: 0,
  causeOfDeath: null,
  commentary: 'The Brute falls.',
};
const GAMEOVER_DEATH = {
  died: true,
  won: false,
  opponentName: 'The Champion',
  causeOfDeath: 'Tripped on a turnip.',
};
// Ended states as the game actually leaves them: dead means health 0 (§6.1's fatal state).
const gameOverState = (ended, over = {}) => ({
  ...createGameState(1, CONFIG),
  phase: 'GAMEOVER',
  ended,
  ...(ended === 'dead' ? { health: 0, lastResult: GAMEOVER_DEATH } : {}),
  ...over,
});

describe('btn', () => {
  it('throws when a priced button is built without the purse', () => {
    // Regression guard: with a `gold = 0` default this rendered a full-price button as
    // unaffordable — wrong pixels, no error, green suite. Omission must be loud.
    expect(() => btn('buy-thing', 'Thing', { cost: 150 })).toThrow(TypeError);
    expect(() => btn('buy-thing', 'Thing', { cost: 150 })).toThrow(/gold/);
    expect(() => btn('buy-thing', 'Thing', { cost: 150, gold: undefined })).toThrow(TypeError);
    expect(() => btn('buy-thing', 'Thing', { cost: 150, gold: NaN })).toThrow(TypeError);
  });

  it('still renders priced buttons when the purse is supplied, including zero', () => {
    expect(btn('buy-thing', 'Thing', { cost: 150, gold: 0 })).toContain('is-unaffordable');
    expect(btn('buy-thing', 'Thing', { cost: 150, gold: 150 })).not.toContain('is-unaffordable');
  });

  it('needs no purse for an unpriced button', () => {
    const html = btn('retire', 'Retire Rich', { variant: 'commit' });
    expect(html).toContain('btn--commit');
    expect(html).not.toContain('btn__price');
    expect(html).not.toContain('is-unaffordable');
  });

  it('renders actionless inert planks with no data-action', () => {
    const owned = btn(null, '✓ Shield — OWNED', { owned: true });
    expect(owned).not.toContain('data-action');
    expect(owned).toContain('is-owned');
    expect(owned).toContain('aria-disabled="true"');

    const spent = btn(null, 'Bribed ✓', { disabled: true });
    expect(spent).not.toContain('data-action');
    expect(spent).toMatch(/<button class="btn"[^>]*disabled/);
  });

  it('escapes the label of a hand-passed inert plank', () => {
    expect(btn(null, '✓ <Blade> — OWNED', { owned: true })).toContain('&lt;Blade&gt;');
  });

  // §6.2 amendment: buttons may carry a leading `.icon-well` (the sinks), emitted by
  // `btn({ icon })`. Default-sized, not `--sm` — a button is not the HUD's cramped context.
  // Parsed to DOM per this file's own rule, not matched against a literal markup string.
  it('prepends a default-size icon well when opts.icon is given (§6.2 amendment)', () => {
    const html = btn('repair', 'Repair Weapon', { icon: 'repair' });
    const button = dom(html).querySelector('button');
    const well = button.querySelector('[data-icon="repair"]');
    expect(well, 'no icon well').not.toBeNull();
    expect([...well.classList]).toEqual(['icon-well']); // default size, no --sm
    expect(well.getAttribute('aria-hidden')).toBe('true');
    // Leads the button: label, price and snark all come after it (spec §6.2's anatomy).
    expect(button.firstChild).toBe(well);
  });

  it('omits the well entirely when no icon is given', () => {
    expect(dom(btn('heal', 'Heal')).querySelector('.icon-well')).toBeNull();
  });
});

describe('renderHud', () => {
  it('shows gold, health, and durability', () => {
    const s = createGameState(1, CONFIG);
    const html = renderHud(s, CONFIG);
    expect(html).toContain('100'); // gold
    expect(html).toContain('Health');
    expect(html).toContain('Durability');
  });

  it('renders bars with fill widths and injury pips', () => {
    const s = createGameState(1, CONFIG);
    s.health = 65;
    s.injuries = 3;
    s.weaponDurability = 15;
    const html = renderHud(s, CONFIG);
    expect(html).toContain('class="hud"');
    expect(html).toContain('width:65%'); // health fill
    expect(html).toContain('width:50%'); // durability 15/30
    expect((html.match(/pip pip--filled/g) || []).length).toBe(3);
    expect((html.match(/class="pip[" ]/g) || []).length).toBe(5); // 5 slots at 3 injuries
    expect(html).toContain('65/100');
  });

  it('renders max(injuries, 5) pip slots once injuries pass five', () => {
    const s = createGameState(1, CONFIG);
    s.injuries = 7;
    const html = renderHud(s, CONFIG);
    expect((html.match(/class="pip[" ]/g) || []).length).toBe(7);
    expect((html.match(/pip pip--filled/g) || []).length).toBe(7);
  });

  it('fills the leading pips, not the trailing ones', () => {
    const s = createGameState(1, CONFIG);
    s.injuries = 2;
    const pips = renderHud(s, CONFIG).match(/<i class="pip[^"]*"><\/i>/g);
    expect(pips.map((p) => p.includes('pip--filled'))).toEqual([true, true, false, false, false]);
  });

  it('marks the health bar urgent strictly below a third, not at it', () => {
    const s = createGameState(1, CONFIG);
    // Derived from maxHealth so the pair stays astride the threshold if that value changes:
    // atThreshold is the smallest health with health/maxHealth >= 0.33.
    const atThreshold = Math.ceil(s.maxHealth * 0.33);
    s.health = atThreshold - 1;
    expect(renderHud(s, CONFIG)).toContain('is-urgent');
    s.health = atThreshold;
    expect(renderHud(s, CONFIG)).not.toContain('is-urgent');
  });

  it('leaves a healthy bar unmarked', () => {
    const s = createGameState(1, CONFIG);
    s.health = s.maxHealth;
    expect(renderHud(s, CONFIG)).not.toContain('is-urgent');
  });

  it('clamps an over-max bar to 100% and to a valid aria-valuenow', () => {
    const s = createGameState(1, CONFIG);
    s.health = 65;
    s.weaponDurability = CONFIG.weapon.maxDurability + 12; // 42/30
    const html = renderHud(s, CONFIG);
    expect(html).toContain('width:100%');
    expect(html).not.toMatch(/width:1[1-9]\d%/);
    expect(html).toContain(`aria-valuenow="${CONFIG.weapon.maxDurability}"`);
    expect(html).not.toContain('aria-valuenow="42"');
  });

  it('shows the clamped numeral, so the visible text matches aria-valuenow', () => {
    const s = createGameState(1, CONFIG);
    const max = CONFIG.weapon.maxDurability;
    s.weaponDurability = max + 12;
    const html = renderHud(s, CONFIG);
    expect(html).toContain(`${max}/${max}`);
    expect(html).not.toContain(`${max + 12}/${max}`);
  });

  it('uses a singular aria-label for exactly one injury', () => {
    const s = createGameState(1, CONFIG);
    s.injuries = 1;
    expect(renderHud(s, CONFIG)).toContain('aria-label="1 injury"');
    s.injuries = 2;
    expect(renderHud(s, CONFIG)).toContain('aria-label="2 injuries"');
  });

  it('formats gold through formatGold and exposes the raw value on the ticker', () => {
    const s = createGameState(1, CONFIG);
    s.gold = 2450;
    const html = renderHud(s, CONFIG);
    expect(html).toContain('2,450\u00A0G');
    expect(html).toContain('data-value="2450"');
    expect(html).not.toContain('data-gold');
  });

  // Spec \u00A76.18 / the \u00A76.1 amendment: each stat gains a leading small icon well, keyed by
  // data-icon so Phase 2 can paint a glyph into it. Parsed to DOM per this file's own rule
  // above `dom()`, not matched against a literal markup string.
  it('gives each HUD stat an empty icon well with a data-icon hook (\u00A76.18)', () => {
    const s = createGameState(1, CONFIG);
    const html = renderHud(s, CONFIG);
    const host = dom(html);
    for (const name of ['health', 'durability', 'injuries']) {
      const well = host.querySelector(`[data-icon="${name}"]`);
      expect(well, `no well for ${name}`).not.toBeNull();
      expect([...well.classList]).toEqual(expect.arrayContaining(['icon-well', 'icon-well--sm']));
      expect(well.getAttribute('aria-hidden')).toBe('true');
      // Never carries meaning of its own: the adjacent label/numeral does (spec \u00A76.18).
      expect(well.textContent).toBe('');
    }
  });

  // Decision 3: numeral + pips announce once, through a single wrapper aria-label, rather than
  // as two separate accessible facts about the same count.
  it('shows the injuries numeral beside the pips, announced exactly once (decision 3)', () => {
    const s = createGameState(1, CONFIG);
    s.injuries = 3;
    const html = renderHud(s, CONFIG);
    const host = dom(html);
    const wrapper = host.querySelector('[role="img"][aria-label="3 injuries"]');
    expect(wrapper, 'no injuries wrapper').not.toBeNull();
    const count = wrapper.querySelector('.hud__count');
    expect(count, 'no .hud__count numeral').not.toBeNull();
    expect(count.textContent).toBe('3');
    expect(count.getAttribute('aria-hidden')).toBe('true');
    const pips = wrapper.querySelector('.pips');
    expect(pips, 'no .pips inside the wrapper').not.toBeNull();
    expect(pips.getAttribute('aria-hidden')).toBe('true');
    // One announcement: no other element restates the injury count as its own aria-label.
    expect(host.querySelectorAll('[aria-label$="injuries"], [aria-label$="injury"]')).toHaveLength(
      1
    );
  });
});

describe('iconWell', () => {
  it('renders a default-size well as an empty, decorative, named slot (\u00A76.18)', () => {
    const html = iconWell('health');
    const host = dom(html);
    const well = host.firstElementChild;
    expect(well.tagName).toBe('SPAN');
    expect([...well.classList]).toEqual(['icon-well']);
    expect(well.getAttribute('aria-hidden')).toBe('true');
    expect(well.getAttribute('data-icon')).toBe('health');
    expect(well.textContent).toBe('');
  });

  it('adds the small modifier for the HUD without dropping the base class', () => {
    const html = iconWell('durability', { small: true });
    expect([...dom(html).firstElementChild.classList]).toEqual(
      expect.arrayContaining(['icon-well', 'icon-well--sm'])
    );
  });

  it('escapes a hostile name so it cannot break out of the data-icon attribute', () => {
    const hostile = '"><script>alert(1)</script>';
    const html = iconWell(hostile);
    const host = dom(html);
    // A broken-out attribute would parse as more than one element, or mint a live <script>.
    expect(host.children).toHaveLength(1);
    expect(host.querySelector('script')).toBeNull();
    expect(host.firstElementChild.getAttribute('data-icon')).toBe(hostile);
  });
});

describe('bar', () => {
  // Every current call site (renderHud) passes `well`, so this path is otherwise unexercised:
  // a regression that made bar() always emit a well would leave one showing wherever a caller
  // deliberately omits it, and nothing would catch it.
  it('emits no icon well when opts.well is not supplied', () => {
    const html = bar('Health', 3, 10);
    expect(dom(html).querySelectorAll('.icon-well')).toHaveLength(0);
  });
});

// Spec 6.5: "Player poster and HUD may both show HP; they must read from the same state field."
// They did not. `renderHud` read `state.health`, which combat never touches until
// `resolveFightOutcome` writes it back at the end of the bout, while the poster read the live
// `state.combat.player.health` - so mid-fight the screen showed 100/100 beside 80/100, and the
// HUD's urgency flash was computed from the stale field and therefore never fired during the
// one screen where it matters. Both now go through `playerHealth(state)`, the single answer to
// "what is the player's health right now".
describe('the HUD beam and the player poster read one health field (spec 6.5)', () => {
  const plate = (el) => ({
    value: Number(el.getAttribute('aria-valuenow')),
    max: Number(el.getAttribute('aria-valuemax')),
    urgent: el.classList.contains('is-urgent'),
  });
  // Both readings come from the ARIA the player's assistive tech is given, not from markup
  // substrings: these are the two numbers shown side by side.
  const hudPlate = (html) => plate(dom(html).querySelector('.hud [aria-label="Health"]'));
  const posterPlate = (html) =>
    plate(dom(html).querySelector('.poster--tilt-1 [aria-label="You health"]'));

  it('agrees at fight start', () => {
    const s = startFight(createGameState(1, CONFIG), CONFIG);
    const html = renderFight(s, CONFIG);
    expect(hudPlate(html)).toEqual(posterPlate(html));
    expect(hudPlate(html).value).toBe(s.combat.player.health);
    expect(hudPlate(html).max).toBe(s.combat.player.maxHealth);
  });

  it('agrees mid-fight, once the enemy has landed blows', () => {
    const s = startFight(createGameState(1, CONFIG), CONFIG);
    s.combat.player.health = 80;
    // The stale field is exactly the trap: it still reads full while the fighter is at 80.
    expect(s.health).toBe(100);
    const html = renderFight(s, CONFIG);
    expect(hudPlate(html)).toEqual(posterPlate(html));
    expect(hudPlate(html).value).toBe(80);
    expect(html).toContain('80/100');
    expect(html).not.toContain('100/100');
  });

  it('agrees again after the fight ends and the hub renders', () => {
    const s = startFight(createGameState(1, CONFIG), CONFIG);
    s.combat.player.health = 80;
    const next = resolveFightOutcome(s, true, makeRng(1), CONFIG);
    expect(next.combat).toBeNull(); // no live fight left to read from
    const html = renderHub(next, CONFIG);
    expect(hudPlate(html)).toEqual(posterPlate(html));
    expect(hudPlate(html).value).toBe(next.health);
    expect(hudPlate(html).value).toBe(80);
  });

  // The consequence that actually costs a player the run: the beam's URGENT_FRACTION flash was
  // computed from the stale field, so it could not fire while the fight was being lost.
  it('flashes the HUD beam urgent mid-fight, off the live fight health', () => {
    const s = startFight(createGameState(1, CONFIG), CONFIG);
    const max = s.combat.player.maxHealth;
    // Derived from maxHealth, as the existing urgency tests do: the smallest health that is
    // still at or above the threshold, and the largest one below it.
    const atThreshold = Math.ceil(max * URGENT_FRACTION);
    expect((atThreshold - 1) / max).toBeLessThan(URGENT_FRACTION);
    expect(atThreshold / max).toBeGreaterThanOrEqual(URGENT_FRACTION);

    s.combat.player.health = atThreshold - 1;
    expect(s.health).toBe(max); // stale field says "untouched"; the beam must not believe it
    const hurt = renderFight(s, CONFIG);
    expect(hudPlate(hurt).urgent).toBe(true);
    expect(posterPlate(hurt).urgent).toBe(true);

    s.combat.player.health = atThreshold;
    const steady = renderFight(s, CONFIG);
    expect(hudPlate(steady).urgent).toBe(false);
    expect(posterPlate(steady).urgent).toBe(false);
  });
});

describe('title plaques (§6.16)', () => {
  // Parsed to DOM rather than matched against markup, per this file's own rule above `dom()`:
  // adding or reordering a class, or reformatting the tag, must stay a harmless refactor.
  const plaqueText = (html) => dom(html).querySelector('.title-plaque h1')?.textContent ?? null;
  const fightHtml = () => renderFight(startFight(createGameState(1, CONFIG), CONFIG), CONFIG);
  // Reuses the module-scope fixtures the `renderResult`/`renderGameOver` describes below share,
  // rather than a third hand-typed copy of the same shape.
  const resultHtml = () =>
    renderResult({ ...createGameState(1, CONFIG), lastResult: RESULT_WIN }, CONFIG);
  const gameoverHtml = () => renderGameOver(gameOverState('dead'), CONFIG);

  it('gives every screen exactly one h1, inside a parchment-and-tape plaque', () => {
    const s = createGameState(1, CONFIG);
    for (const html of [renderHub(s, CONFIG), fightHtml(), resultHtml(), gameoverHtml()]) {
      const host = dom(html);
      expect(host.querySelectorAll('h1')).toHaveLength(1);
      const plaque = host.querySelector('.title-plaque');
      expect(plaque, 'no .title-plaque found').not.toBeNull();
      expect(plaque.querySelector('h1'), 'the plaque carries no h1').not.toBeNull();
      // A set check, not a literal class string: order and any extra class are a no-op refactor.
      expect([...plaque.classList]).toEqual(
        expect.arrayContaining(['title-plaque', 'parchment', 'tape'])
      );
    }
  });

  it('titles the hub with the win count and the other screens with their names', () => {
    const s = createGameState(1, CONFIG);
    s.wins = 2;
    expect(plaqueText(renderHub(s, CONFIG))).toBe('Current wins: 2');
    expect(plaqueText(fightHtml())).toBe('Fight');
    expect(plaqueText(resultHtml())).toBe('Result');
    expect(plaqueText(gameoverHtml())).toBe('Game over');
  });
});

describe('titlePlaque', () => {
  it('wraps sentence-case text in a parchment, taped plaque with one h1', () => {
    const html = titlePlaque('Fight');
    expect(classesOf(html)).toEqual(expect.arrayContaining(['title-plaque', 'parchment', 'tape']));
    expect(html).toContain('<h1>Fight</h1>');
  });

  it('escapes hostile text exactly once', () => {
    const html = titlePlaque('<script>alert(1)</script> & "Boss"');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;Boss&quot;');
    // ...and not twice over: a second pass would spell these `&amp;lt;` etc.
    expect(html).not.toContain('&amp;lt;');
    expect(html).not.toContain('&amp;gt;');
    expect(html).not.toContain('&amp;quot;');
    expect(html).not.toContain('&amp;amp;');
  });
});

describe('renderHub', () => {
  it('lists management actions with costs and a Next Fight button', () => {
    const s = createGameState(1, CONFIG);
    const html = renderHub(s, CONFIG);
    expect(html).toContain('Train');
    expect(html).toContain('Repair');
    expect(html).toContain('Heal');
    expect(html).toContain('Bribe');
    expect(html).toContain('data-action="next-fight"');
    expect(html).toContain('The Brute'); // next opponent named
  });

  it('marks unaffordable buttons instead of disabling them', () => {
    const s = createGameState(1, CONFIG);
    s.gold = 0;
    const html = renderHub(s, CONFIG);
    expect(html).toContain('is-unaffordable');
    expect(html).toContain('data-missing=');
  });

  it('puts prices in the price slot, not in parentheses', () => {
    const s = createGameState(1, CONFIG);
    const html = renderHub(s, CONFIG);
    expect(html).toContain('btn__price');
    expect(html).not.toMatch(/\(\d+g\)/);
  });

  it('flags urgent sinks from state thresholds', () => {
    const s = createGameState(1, CONFIG);
    s.weaponDurability = 10; // < 50% of 30
    s.injuries = 2;
    const html = renderHub(s, CONFIG);
    // Anchored to the buttons: a global is-urgent count also matches urgent HUD bars,
    // so it could pass for entirely the wrong reason.
    expect(html).toMatch(/data-action="repair"[^>]*is-urgent/);
    expect(html).toMatch(/data-action="heal"[^>]*is-urgent/);
  });

  it('leaves non-urgent sinks unpulsed', () => {
    const s = createGameState(1, CONFIG);
    s.weaponDurability = CONFIG.weapon.maxDurability - 1; // ~97%, well above 50%
    s.injuries = 0;
    const html = renderHub(s, CONFIG);
    expect(html).not.toMatch(/data-action="repair"[^>]*is-urgent/);
    expect(html).not.toMatch(/data-action="heal"[^>]*is-urgent/);
  });

  it('carries the formatted shortfall in data-missing', () => {
    const s = createGameState(1, CONFIG);
    s.gold = 25; // Lucky Charm costs 150 → 125 short
    const html = renderHub(s, CONFIG);
    // U+00A0 written as an escape (spec §2); pasting the literal hides regressions.
    expect(html).toContain(`data-missing="125\u00A0G"`);
    expect(html.match(/data-missing="125(.)G"/)[1].codePointAt(0)).toBe(0x00a0);
    // Mirrored onto the snark span: spec §6.2 renders the shortfall via
    // .btn__snark::after { content: … attr(data-missing) … }, and attr() resolves against
    // the pseudo-element own originating element, not the enclosing button.
    // Assert the classes present, not the literal attribute text, so adding or reordering
    // a class stays a harmless refactor.
    const span = html.match(/<span class="([^"]*)"[^>]*\sdata-missing="125\u00A0G"/);
    expect(span, 'no snark span carries the shortfall').not.toBeNull();
    expect(span[1].split(/\s+/)).toEqual(expect.arrayContaining(['btn__snark', 'snark']));
    // \u2026and the same gap is stated as real, `.sr-only`-clipped text, not only as the CSS
    // `::after` (generated content is not reliably in the accessibility tree, and is gone with
    // CSS off). Same formatted amount as `data-missing`, so the spoken and painted gaps agree.
    expect(html).toContain(`<span class="sr-only"> (need 125\u00A0G more)</span>`);
  });

  // Backlog item 3. Spec §6.2 renders the shortfall through `.btn__snark::after`, an *optional*
  // slot — so a priced button with no aside used to show a red price and no shortfall text at
  // all. The three Train buttons are the game's only such controls, so they were the three
  // buttons that never told you how short you were. Derived from the rendered markup rather
  // than asserted per action, so a fourth snark-less priced button is covered on arrival.
  it('gives even a snark-less priced button somewhere to state the shortfall', () => {
    const s = createGameState(1, CONFIG);
    s.gold = 0; // short on everything, Train included
    const html = renderHub(s, CONFIG);
    const unaffordable = [
      ...html.matchAll(/<button[^>]*\bis-unaffordable\b[\s\S]*?<\/button>/g),
    ].map((m) => m[0]);
    expect(unaffordable.length, 'nothing rendered unaffordable').toBeGreaterThan(0);
    const trainButtons = unaffordable.filter((b) => /data-action="train-/.test(b));
    expect(trainButtons.length, 'no unaffordable Train button').toBe(3);
    for (const button of unaffordable) {
      const action = button.match(/data-action="([^"]*)"/)?.[1];
      expect(button, `${action} states no shortfall`).toMatch(
        /<span class="btn__snark snark"[^>]*\sdata-missing="[^"]+"/
      );
    }
  });

  it('keeps true no-ops disabled rather than unaffordable', () => {
    const s = createGameState(1, CONFIG);
    s.gold = 100000;
    s.weaponDurability = CONFIG.weapon.maxDurability; // nothing to repair
    s.injuries = 0; // nothing to heal
    const html = renderHub(s, CONFIG);
    expect(html).toMatch(/data-action="repair"[^>]*disabled/);
    expect(html).toMatch(/data-action="heal"[^>]*disabled/);
    expect(html).not.toContain('is-unaffordable');
  });

  it('renders snark asides from the config table, parenthesized by the markup', () => {
    const s = createGameState(1, CONFIG);
    s.injuries = 1;
    const html = renderHub(s, CONFIG);
    expect(html).toContain('class="btn__snark snark"');
    expect(html).toContain(`(${CONFIG.snark.heal})`);
  });

  it('gives irreversible choices the commit variant', () => {
    const s = createGameState(1, CONFIG);
    const html = renderHub(s, CONFIG);
    expect(html).toMatch(/data-action="next-fight"[^>]*btn--commit/);
    expect(html).toMatch(/data-action="retire"[^>]*btn--commit/);
  });

  it('renders owned gear as an owned plank with no buy action', () => {
    const s = createGameState(1, CONFIG);
    s.gear = ['shield'];
    const html = renderHub(s, CONFIG);
    expect(html).toContain('is-owned');
    expect(html).not.toContain('data-action="buy-shield"');
  });

  // §6.2 amendment / §6.18: each sink button gets a named icon well so Phase 2 has a hook to
  // paint a glyph into. Parsed to DOM per this file's own rule, not matched against raw markup.
  it('gives each sink button a leading icon well named for its action', () => {
    const s = createGameState(1, CONFIG);
    const host = dom(renderHub(s, CONFIG));
    for (const name of ['repair', 'heal', 'bribe']) {
      const well = host.querySelector(`[data-icon="${name}"]`);
      expect(well, `no well for ${name}`).not.toBeNull();
      expect([...well.classList]).toEqual(['icon-well']);
    }
  });

  // The bribe well must not vanish once the bribe is spent for the fight — the slot names the
  // action, not its remaining availability, so the inert "Bribed ✓" plank still carries it.
  it('keeps the bribe well once bribed-out, rather than dropping the slot when spent', () => {
    const s = createGameState(1, CONFIG);
    s.bribedThisFight = true;
    const html = renderHub(s, CONFIG);
    expect(html).toContain('Bribed');
    expect(dom(html).querySelector('[data-icon="bribe"]')).not.toBeNull();
  });
});

describe('meter', () => {
  it('escapes a hostile label exactly once', () => {
    // Escaping used to be the caller's job, which held only while every label was a literal.
    // Task 7 feeds enemy names in, so meter() owns it now.
    const html = meter('<img src=x onerror=alert(1)> & "Boss"', 5, 10);
    expect(html).toContain(
      'aria-label="&lt;img src=x onerror=alert(1)&gt; &amp; &quot;Boss&quot;"'
    );
    // No raw markup survives into the attribute...
    expect(html).not.toContain('<img');
    expect(html).not.toContain('"Boss"');
    // ...and it is escaped exactly once: a second pass would spell these `&amp;lt;` etc.
    expect(html).not.toContain('&amp;lt;');
    expect(html).not.toContain('&amp;gt;');
    expect(html).not.toContain('&amp;quot;');
    expect(html).not.toContain('&amp;amp;');
  });
});

describe('poster', () => {
  it('renders a tilted named card with a portrait well', () => {
    const html = poster({ name: 'The Brute', tilt: 2 });
    expect(classesOf(html)).toEqual(expect.arrayContaining(['poster', 'tape', 'poster--tilt-2']));
    expect(html).toContain('>The Brute<');
    expect(html).toContain('poster__portrait');
    // The portrait well is decorative until Task 10 drops in the art asset.
    expect(html).toMatch(/poster__portrait[^>]*aria-hidden="true"/);
  });

  it('escapes the combatant name in both the heading and the bar label', () => {
    const html = poster({ name: '<Brute> & "Co"', hp: { value: 10, max: 20 } });
    expect(html).not.toContain('<Brute>');
    expect(html).toContain('&lt;Brute&gt; &amp; &quot;Co&quot;');
    expect(html).toContain('aria-label="&lt;Brute&gt; &amp; &quot;Co&quot; health"');
    // meter() escapes its own label, so poster must hand it the raw name: escaping on both
    // sides would spell the label `&amp;lt;Brute&amp;gt;`.
    expect(html).not.toContain('&amp;lt;');
    expect(html).not.toContain('&amp;quot;');
  });

  it('omits the HP plate when no hp is given', () => {
    expect(poster({ name: 'The Brute' })).not.toContain('class="bar');
  });

  it('mounts exactly one HP bar, clamped and ARIA-valid (spec 6.5)', () => {
    const html = poster({ name: 'Foe', hp: { value: 30, max: 40 } });
    expect((html.match(/class="bar[" ]/g) || []).length).toBe(1);
    expect(html).toContain('width:75%');
    expect(html).toContain('aria-valuenow="30"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="40"');
    expect(html).toContain('30/40');
  });

  it('clamps an overkilled or overhealed HP plate', () => {
    const dead = poster({ name: 'Foe', hp: { value: -7, max: 40 } });
    expect(dead).toContain('width:0%');
    expect(dead).toContain('aria-valuenow="0"');
    expect(dead).toContain('0/40');
    expect(dead).not.toContain('-7');

    const over = poster({ name: 'Foe', hp: { value: 55, max: 40 } });
    expect(over).toContain('width:100%');
    expect(over).toContain('aria-valuenow="40"');
    expect(over).not.toContain('55');
  });

  // The HUD health bar and the player poster read the same field (spec 6.5), so they must not
  // disagree about when that number is alarming. Derived inside poster() from URGENT_FRACTION
  // rather than passed in, because a call site that forgets the flag shows a calm plate over a
  // flashing beam. Thresholds are computed from the constant, never restated as 0.33.
  const hpPlate = (html) => html.match(/<span class="bar[^"]*"/)[0];
  it('flashes the HP plate below the same fraction the HUD bar flashes at', () => {
    const max = 60;
    const under = Math.floor(max * URGENT_FRACTION) - 1;
    const over = Math.ceil(max * URGENT_FRACTION) + 1;
    expect(under / max).toBeLessThan(URGENT_FRACTION);
    expect(over / max).toBeGreaterThan(URGENT_FRACTION);
    expect(classesOf(hpPlate(poster({ name: 'Foe', hp: { value: under, max } })))).toContain(
      'is-urgent'
    );
    expect(classesOf(hpPlate(poster({ name: 'Foe', hp: { value: over, max } })))).not.toContain(
      'is-urgent'
    );
  });

  // The derivation is the *default*, not a law: Tasks 8 and 9 mount 0-HP plates on the result
  // and game-over screens, where an infinitely pulsing plate on a corpse is noise. An explicit
  // flag must therefore win over the derived one in both directions.
  it('lets a call site override the derived urgency without losing the default', () => {
    const max = 60;
    const dead = { value: 0, max };
    const healthy = { value: max, max };
    expect(classesOf(hpPlate(poster({ name: 'Foe', hp: dead })))).toContain('is-urgent');
    expect(classesOf(hpPlate(poster({ name: 'Foe', hp: dead, urgent: false })))).not.toContain(
      'is-urgent'
    );
    expect(classesOf(hpPlate(poster({ name: 'Foe', hp: healthy, urgent: true })))).toContain(
      'is-urgent'
    );
    // Omitted — not merely falsy — is what re-arms the derivation.
    expect(classesOf(hpPlate(poster({ name: 'Foe', hp: dead, urgent: undefined })))).toContain(
      'is-urgent'
    );
  });

  it('takes sub as markup and parenthesizes the snark', () => {
    const html = poster({
      name: 'Foe',
      sub: 'Purse: <span class="amount">50</span>',
      snark: 'A big lad',
    });
    expect(html).toContain('<p class="poster__sub">Purse: <span class="amount">50</span></p>');
    expect(html).toContain('<span class="snark">(A big lad)</span>');
  });
});

describe('renderHub layout', () => {
  it('renders the screen grid with sinks, development, and fight areas', () => {
    const s = createGameState(1, CONFIG);
    const html = renderHub(s, CONFIG);
    expect(html).toContain('screen--hub');
    expect(html).toContain('hub__sinks');
    expect(html).toContain('hub__develop');
    expect(html).toContain('hub__fight');
    expect(html).toContain('hub__retire');
    expect(html).toContain('commit-bar');
  });

  it('names the next opponent exactly once', () => {
    const s = createGameState(1, CONFIG);
    const html = renderHub(s, CONFIG);
    expect((html.match(/The Brute/g) || []).length).toBe(1);
  });

  it('bills the next bout on a poster with tier and formatted purse', () => {
    const s = createGameState(1, CONFIG);
    const foe = CONFIG.opponents[s.currentOpponentIndex];
    const html = renderHub(s, CONFIG);
    const card = posterCards(html).find((p) => classesOf(p).includes('poster--tilt-2'));
    expect(card, 'no opponent poster').toBeDefined();
    expect(classesOf(card)).toEqual(expect.arrayContaining(['poster', 'tape']));
    expect(card).toContain(`Tier: ${foe.tier}`);
    expect(card).toContain(`<span class="amount">${formatGold(foe.purse)}</span>`);
  });

  it('bills the player next to the bout, on the other tilt (spec 7 + 6.5)', () => {
    const s = createGameState(1, CONFIG);
    const html = renderHub(s, CONFIG);
    // Spec 7: the `fight` area is "YOU poster + NEXT BOUT poster (once!)".
    const cards = posterCards(html);
    expect(cards).toHaveLength(2);
    // Spec 6.5: tilt-1 is the player, tilt-2 the opponent; neighbours never share a tilt.
    // Source order is reading order (spec 7), so the player card comes first.
    expect(classesOf(cards[0])).toContain('poster--tilt-1');
    expect(classesOf(cards[1])).toContain('poster--tilt-2');
    expect(cards[0]).toContain('<h3 class="poster__name">You</h3>');
  });

  it('gives the player poster an HP plate off the same field as the HUD (spec 6.5)', () => {
    const s = createGameState(1, CONFIG);
    s.health = 65;
    const you = posterCards(renderHub(s, CONFIG)).find((p) =>
      classesOf(p).includes('poster--tilt-1')
    );
    expect(you).toContain('aria-label="You health"');
    expect(you).toContain('aria-valuenow="65"');
    expect(you).toContain(`aria-valuemax="${s.maxHealth}"`);
    expect(you).toContain(`65/${s.maxHealth}`);
    expect(you).toContain('width:65%');
  });

  it('clamps the player HP plate like every other meter', () => {
    const s = createGameState(1, CONFIG);
    s.health = s.maxHealth + 40;
    const you = posterCards(renderHub(s, CONFIG)).find((p) =>
      classesOf(p).includes('poster--tilt-1')
    );
    expect(you).toContain('width:100%');
    expect(you).toContain(`aria-valuenow="${s.maxHealth}"`);
    expect(you).not.toContain(String(s.maxHealth + 40));
  });

  it('shows the sponsor card only when unlocked', () => {
    const s = createGameState(1, CONFIG);
    expect(renderHub(s, CONFIG)).not.toContain('sponsor-card');
    s.sponsorUnlocked = true;
    expect(renderHub(s, CONFIG)).toContain('sponsor-card');
  });

  it('states the sponsor reward as signed income through formatGold', () => {
    const s = createGameState(1, CONFIG);
    s.sponsorUnlocked = true;
    const html = renderHub(s, CONFIG);
    const total = CONFIG.sponsor.stipendPerFight + CONFIG.sponsor.objectiveBonus;
    expect(html).toContain(`<span class="amount amount--pos">+${total}\u00A0G</span>`);
    expect(html).toContain(CONFIG.sponsor.objective);
  });

  it('lays out one training row per stat, each with a meter and a priced button', () => {
    const s = createGameState(1, CONFIG);
    const html = renderHub(s, CONFIG);
    expect((html.match(/class="train-row"/g) || []).length).toBe(3);
    expect((html.match(/train-row__meter/g) || []).length).toBe(3);
    for (const stat of ['power', 'guard', 'speed']) {
      expect(html).toMatch(new RegExp(`data-action="train-${stat}"[^>]*class="btn`));
    }
    // Label carries the current effective stat, button carries the increment.
    expect(html).toContain('Power 5');
    expect(html).toContain(`Train +${CONFIG.training.statPerLevel}`);
    // Meter fill is the stat against the display cap: 5 of 50.
    expect((html.match(/width:10%/g) || []).length).toBe(3);
    // ...and that cap is a drawing denominator, not a real maximum, so the bar is decorative:
    // no role, no aria values, no numeral. Spec 6.11 puts the true number in the row label.
    const rows = html.match(/<div class="train-row">[\s\S]*?<\/div>/g) || [];
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row).toContain('train-row__meter');
      expect(row).not.toContain('role="meter"');
      expect(row).not.toContain('aria-value');
      expect(row).not.toContain('bar__num');
    }
  });

  // §6.11 amendment / §6.18: the icon column widens to 34px, carrying a default-size icon well
  // named for the stat it trains. Parsed to DOM, and anchored per-row (not just "3 wells
  // somewhere") so a well drifting onto the wrong stat's row would fail.
  it('gives each training row a leading, default-size icon well named for its stat', () => {
    const s = createGameState(1, CONFIG);
    const rowEls = [...dom(renderHub(s, CONFIG)).querySelectorAll('.train-row')];
    expect(rowEls).toHaveLength(3);
    for (const [i, stat] of ['power', 'guard', 'speed'].entries()) {
      const well = rowEls[i].querySelector(`[data-icon="${stat}"]`);
      expect(well, `no well for ${stat}`).not.toBeNull();
      expect([...well.classList]).toEqual(['icon-well']); // default size, not --sm
      expect(rowEls[i].firstElementChild).toBe(well); // leads the row
    }
  });

  it('renders gear as shop cards in the available / unaffordable / owned triad', () => {
    const s = createGameState(1, CONFIG);
    const { shield, blade, charm } = CONFIG.gear;
    const shortfall = 100;
    s.gold = blade.cost - shortfall; // blade out of reach by exactly `shortfall`
    s.gear = [charm.id]; // charm owned
    // A precondition, not an assumption: a config edit that put the shield out of reach too
    // would otherwise silently delete the "available" third of the triad from this test.
    expect(s.gold).toBeGreaterThanOrEqual(shield.cost);
    const html = renderHub(s, CONFIG);
    // Card roots only — `shop-item__name` and friends must not inflate the count.
    expect((html.match(/class="shop-item[" ]/g) || []).length).toBe(
      Object.keys(CONFIG.gear).length
    );

    expect(html).toMatch(
      new RegExp(`data-action="buy-${shield.id}"[^>]*class="shop-item parchment"`)
    );
    expect(html).not.toMatch(
      new RegExp(`data-action="buy-${shield.id}"[^>]*is-(unaffordable|owned)`)
    );

    expect(html).toContain(`<span class="btn__price">${formatGold(blade.cost)}</span>`);
    expect(html).toMatch(new RegExp(`data-action="buy-${blade.id}"[^>]*is-unaffordable`));
    expect(html).toMatch(
      new RegExp(`data-action="buy-${blade.id}"[^>]*data-missing="${formatGold(shortfall)}"`)
    );

    expect(html).not.toContain(`data-action="buy-${charm.id}"`);
    // Exactly one card is in the owned state; its anatomy is pinned by the shopItem tests.
    expect((html.match(/class="[^"]*\bis-owned\b/g) || []).length).toBe(1);
  });
});

describe('shopItem', () => {
  it('replaces the price row on an owned card instead of dimming it (spec 6.12)', () => {
    const card = shopItem(CONFIG.gear.charm, { owned: true, gold: 0 });
    expect(classesOf(card)).toEqual(expect.arrayContaining(['shop-item', 'is-owned']));
    expect(card).toContain('Owned');
    expect(card).not.toContain('btn__price');
    expect(card).not.toContain('data-action');
    // No aria-disabled: the card is a role-less <div>, where assistive tech ignores the
    // attribute outright. The visible checkmark is what carries the state.
    expect(card).not.toContain('aria-disabled');
  });

  it('prices a buyable card and flags the shortfall', () => {
    const { blade } = CONFIG.gear;
    const rich = shopItem(blade, { gold: blade.cost });
    expect(rich).toContain(`data-action="buy-${blade.id}"`);
    expect(rich).toContain(`<span class="btn__price">${formatGold(blade.cost)}</span>`);
    expect(rich).not.toContain('is-unaffordable');

    const broke = shopItem(blade, { gold: blade.cost - 25, snark: 'Blunt' });
    expect(classesOf(broke)).toContain('is-unaffordable');
    expect(broke).toContain(`data-missing="${formatGold(25)}"`);
    expect(broke).toContain('(Blunt)');
  });

  it('throws when a buyable card is built without the purse', () => {
    // Same guard as btn(): canAfford(undefined, cost) is false, so a forgotten purse would
    // render a full-price card as unaffordable: wrong pixels, no error, green suite.
    expect(() => shopItem(CONFIG.gear.blade, {})).toThrow(TypeError);
    expect(() => shopItem(CONFIG.gear.blade, { gold: NaN })).toThrow(/gold/);
    // An owned card carries no price, so it needs no purse.
    expect(() => shopItem(CONFIG.gear.blade, { owned: true })).not.toThrow();
  });

  // §6.18: the shop slot is the icon well generalized, keeping its own class for §6.12's layout
  // selectors while getting the well's treatment and Phase 2's data-icon mask hook. Both branches
  // render the icon column, so a regression in either would otherwise ship silently.
  it('gives the owned branch an icon well keyed by the item id (§6.18)', () => {
    const { charm } = CONFIG.gear;
    const card = shopItem(charm, { owned: true, gold: 0 });
    const well = dom(card).querySelector(`[data-icon="${charm.id}"]`);
    expect(well, 'no well on the owned card').not.toBeNull();
    expect([...well.classList]).toEqual(expect.arrayContaining(['shop-item__icon', 'icon-well']));
    expect(well.getAttribute('aria-hidden')).toBe('true');
  });

  it('gives the buyable branch an icon well keyed by the item id (§6.18)', () => {
    const { blade } = CONFIG.gear;
    const card = shopItem(blade, { gold: blade.cost });
    const well = dom(card).querySelector(`[data-icon="${blade.id}"]`);
    expect(well, 'no well on the buyable card').not.toBeNull();
    expect([...well.classList]).toEqual(expect.arrayContaining(['shop-item__icon', 'icon-well']));
    expect(well.getAttribute('aria-hidden')).toBe('true');
  });
});

// Spec §6.6: the ledger IS the product. Every line states an amount the same way, every money
// line carries the data the theater counts it from, and nothing on this screen formats money
// by hand. §6.13 stamps the title, §7 lays out recap / ledger / cta, §8 announces both.
describe('renderResult (spec §6.6 / §6.13 / §7)', () => {
  // Hoisted to module scope (above) so the cross-screen title-plaque check can reuse it without
  // hand-typing a second copy of the same shape.
  const WIN = RESULT_WIN;
  const LOSS = {
    won: false,
    died: false,
    opponentName: 'The Brute',
    purse: 0,
    tax: 0,
    sponsorIncome: 0,
    netGold: 0,
    durabilityLost: 3,
    injuriesGained: 1,
    causeOfDeath: null,
    commentary: 'You crawl out of the arena.',
  };
  const stateOf = (lastResult, over = {}) => ({
    ...createGameState(1, CONFIG),
    ...over,
    lastResult,
  });
  const resultOf = (lastResult, over = {}) => renderResult(stateOf(lastResult, over), CONFIG);
  // A ledger row's label text: the snark aside stripped off, and — since Task 5 — tolerant of an
  // optional leading `.icon-well` sharing the `<dt>`. Reading `firstChild` (the old approach)
  // broke the moment a row gained a leading element node, so this reads by content, not
  // position — a clone-and-remove rather than a string subtraction, so it stays correct even if
  // a label ever happened to contain its own aside's text, or the row carried more than one.
  const dtLabel = (dt) => {
    const clone = dt.cloneNode(true);
    clone.querySelector('.snark')?.remove();
    return clone.textContent.trim();
  };
  // Rows as { label, amount } with the snark aside stripped off the term.
  const ledgerRows = (html) =>
    [...dom(html).querySelectorAll('.ledger__row')].map((row) => ({
      label: dtLabel(row.querySelector('dt')),
      amount: row.querySelector('dd').textContent,
      classes: [...row.classList],
      tone: [...row.querySelector('dd').classList],
    }));
  const rowFor = (html, label) => ledgerRows(html).find((r) => r.label === label);
  // The same lookup, by label, but keeping the element — so nothing has to know a row's index.
  const rowElFor = (html, label) =>
    [...dom(html).querySelectorAll('.ledger__row')].find(
      (row) => dtLabel(row.querySelector('dt')) === label
    );

  it('renders a win recap card', () => {
    const html = resultOf(WIN);
    expect(html).toContain('The Brute');
    expect(html).toContain('ledger');
    expect(html).toContain('New balance');
    expect(html).toContain('data-action="to-hub"');
  });

  // §7 gives the screen three grid children, in this order, each holding the content it names.
  // Asserted as regions-plus-contents rather than as a literal className string: adding a class
  // to any of them is a harmless refactor, putting the ledger in the recap slot is not.
  it('lays the screen out as spec §7 recap / ledger / cta', () => {
    const section = dom(resultOf(WIN)).querySelector('section.screen');
    expect([...section.classList]).toContain('screen--result');
    const regions = [...section.children];
    expect(regions.map((r) => [...r.classList].find((c) => c.startsWith('result__')))).toEqual([
      'result__recap',
      'result__ledger',
      'result__cta',
    ]);
    expect(regions[0].querySelector('.banner-stamp')).not.toBeNull();
    expect(regions[0].querySelector('.poster')).not.toBeNull();
    expect(regions[1].querySelector('.ledger')).not.toBeNull();
    expect(regions[2].querySelector('[data-action="to-hub"]')).not.toBeNull();
    // §7 puts the one forward action in a commit bar, wherever the grid ends up placing it.
    expect([...regions[2].classList]).toContain('commit-bar');
  });

  it('stamps the title, drawn with no role — the spoken half lives in the persistent region (§6.13/§8)', () => {
    const win = dom(resultOf(WIN)).querySelector('.banner-stamp');
    expect(win.textContent).toBe('VICTORY!'); // §9: victory gets the exclamation
    expect([...win.classList]).toContain('banner-stamp--victory');
    expect(win.getAttribute('role')).toBeNull();
    const loss = dom(resultOf(LOSS)).querySelector('.banner-stamp');
    expect(loss.textContent).toBe('DEFEAT.'); // …defeat the deadpan period
    expect([...loss.classList]).toContain('banner-stamp--defeat');
    expect(loss.getAttribute('role')).toBeNull();
  });

  // §8 wants the ledger announced politely, but §6.6's theater rewrites every money cell about
  // six times as it counts — inside a live region that is one utterance per write, roughly
  // thirty of them over 2.5s, and the screen reader reads the counting instead of the ledger.
  // A once-written `role="status"` line inside the card is no better: mount() rebuilds #app on
  // every render, so the line is a brand-new node carrying its text already inside it, and a
  // live region inserted already-populated announces nothing at all.
  //
  // So the renderer emits the summary as a *string* and the card as plain, complete markup with
  // nothing on it that speaks; main.js writes the string into the persistent region outside #app
  // (tests/main.test.js holds that end of the contract).
  it('emits the ledger summary as a string, on a card that never speaks (§6.6/§8)', () => {
    const state = stateOf(WIN, { gold: 100 });
    const html = renderResult(state, CONFIG);
    const card = dom(html).querySelector('.ledger');
    expect([...card.classList]).toContain('tape');
    expect(card.querySelector('.wordmark').textContent).toBe('GOLD & GLORY');
    expect(card.getAttribute('aria-live')).toBeNull();
    expect(card.getAttribute('role')).toBeNull();
    expect(card.querySelector('[aria-live], [role="status"], .ledger__summary')).toBeNull();
    // No stamp anywhere on the screen carries a role either — the drawn stamp is mute by
    // design; the verdict is spoken by the string below, through main.js's persistent region.
    expect(dom(html).querySelector('.banner-stamp[role]')).toBeNull();
    // One utterance stating every line the visible ledger states, in the same order and in the
    // same words — derived from the rendered rows, so the two can never drift apart — opening
    // with the same verdict the drawn stamp carries (item 29's lesson: one spelling, not two).
    expect(ledgerSummary(state, CONFIG)).toBe(
      `VICTORY! ${ledgerRows(html)
        .map((r) => `${r.label}: ${r.amount}`)
        .join('. ')}.`
    );
  });

  // The flood guard: nothing the theater rewrites may sit inside a live region — and, since the
  // stamp no longer carries a role at all, the drawn screen speaks through nothing (the verdict
  // is spoken from main.js's persistent region instead; see tests/main.test.js).
  it('puts no counting cell inside a live region (§8)', () => {
    const announced = [
      ...dom(resultOf(WIN)).querySelectorAll('[aria-live], [role="status"], [role="alert"]'),
    ];
    expect(announced).toEqual([]);
  });

  it('starts every row hidden, so the theater has something to reveal', () => {
    const rows = ledgerRows(resultOf(WIN));
    expect(rows.length).toBeGreaterThan(3);
    expect(rows.every((r) => r.classes.includes('is-hidden'))).toBe(true);
  });

  it('bills a win: purse in, tax out, net and the resulting balance', () => {
    const html = resultOf(WIN, { gold: 100 });
    expect(rowFor(html, 'Purse').amount).toBe(formatGold(50, { signed: true }));
    expect(rowFor(html, 'Arena tax').amount).toBe(formatGold(-10, { signed: true }));
    expect(rowFor(html, 'Net gold').amount).toBe(formatGold(40, { signed: true }));
    expect(rowFor(html, 'Net gold').classes).toContain('ledger__row--net');
    expect(rowFor(html, 'New balance').amount).toBe(formatGold(100));
    expect(rowFor(html, 'New balance').classes).toContain('ledger__row--balance');
  });

  it('colours income green, expense red, and a zero line neither (§6.6)', () => {
    const html = resultOf(WIN);
    expect(rowFor(html, 'Purse').tone).toContain('amount--pos');
    expect(rowFor(html, 'Arena tax').tone).toContain('amount--neg');
    // "Injuries gained: 0" is good news — a zero line is muted ink, never red.
    expect(rowFor(html, 'Injuries gained').amount).toBe('0');
    expect(rowFor(html, 'Injuries gained').tone).toEqual(['amount']);
    // …and a zero *money* line is muted for the same reason, not painted as income.
    expect(rowFor(resultOf(LOSS), 'Purse').tone).toEqual(['amount']);
  });

  it('bills a defeat on the same ledger, with the injury and the wear', () => {
    const html = resultOf(LOSS);
    expect(rowFor(html, 'Purse').amount).toBe(formatGold(0, { signed: true }));
    expect(rowFor(html, 'Purse').tone).toEqual(['amount']);
    expect(rowFor(html, 'Injuries gained').amount).toBe('1');
    expect(rowFor(html, 'Injuries gained').tone).toContain('amount--neg');
    expect(rowFor(html, 'Weapon wear').amount).toBe('\u22123 durability');
    expect(rowFor(html, 'Weapon wear').amount.codePointAt(0)).toBe(0x2212); // never a hyphen
    // Wear is not money, so it never takes the gold treatment (Law 2).
    expect(rowFor(html, 'Weapon wear').amount).not.toContain('G');
  });

  it('shows the sponsor line only when a sponsor paid', () => {
    expect(rowFor(resultOf(WIN), 'Sponsor')).toBeUndefined();
    const paid = resultOf({ ...WIN, sponsorIncome: 80, netGold: 120 });
    expect(rowFor(paid, 'Sponsor').amount).toBe(formatGold(80, { signed: true }));
    expect(paid).toContain(CONFIG.snark.sponsorReward);
  });

  // §6.18: the money rows that name a *source* (purse, tax, sponsor) get a small icon well;
  // the rows that sum or tally (net gold, injuries, wear, balance) stay well-less — they are
  // sums, not sources. Reuses the sponsor fixture above so `sponsorIncome > 0` puts all three
  // source rows on the card at once.
  it('gives the purse, tax and sponsor rows a small icon well named for the source', () => {
    const paid = resultOf({ ...WIN, sponsorIncome: 80, netGold: 120 });
    for (const [label, icon] of [
      ['Purse', 'purse'],
      ['Arena tax', 'tax'],
      ['Sponsor', 'sponsor'],
    ]) {
      const row = rowElFor(paid, label);
      expect(row, `no ${label} row`).not.toBeUndefined();
      const well = row.querySelector(`[data-icon="${icon}"]`);
      expect(well, `${label} row has no ${icon} well`).not.toBeNull();
      expect([...well.classList]).toEqual(expect.arrayContaining(['icon-well', 'icon-well--sm']));
    }
    // Sums and tallies carry no well at all.
    for (const label of ['Net gold', 'Injuries gained', 'Weapon wear', 'New balance']) {
      const row = rowElFor(paid, label);
      expect(row.querySelector('.icon-well'), `${label} row should have no well`).toBeNull();
    }
  });

  it('hangs the §6.8 aside off the tax line from the config string table', () => {
    const aside = dom(resultOf(WIN)).querySelector('.ledger__row .snark');
    expect(aside.textContent).toBe(`(${CONFIG.snark.tax})`);
  });

  // The theater rewrites these cells from `data-value` using the formatter `data-unit` names.
  // If the two ever disagree with the rendered text, the count ends on a different string than
  // the one the server sent — the number would change after the animation for no reason.
  it('agrees with the counters it hands the theater', () => {
    const html = resultOf(WIN, { gold: 1234 });
    const cells = [...dom(html).querySelectorAll('.amount[data-unit]')];
    // Which lines are money is the behaviour — naming them beats counting them, because a count
    // is satisfied by any four rows and says nothing about *which* four the theater will tally.
    expect(
      [...dom(html).querySelectorAll('.ledger__row')]
        .filter((row) => row.querySelector('.amount[data-unit]'))
        .map((row) => dtLabel(row.querySelector('dt')))
    ).toEqual(['Purse', 'Arena tax', 'Net gold', 'New balance']);
    for (const dd of cells) {
      const value = Number(dd.getAttribute('data-value'));
      const unit = dd.getAttribute('data-unit');
      expect(Number.isFinite(value)).toBe(true);
      expect(dd.textContent).toBe(formatGold(value, { signed: unit === 'gold-signed' }));
    }
    // Lines that are not money carry no counter at all — found by label, because a row index
    // silently points at a different line the moment the sponsor row appears or a line moves.
    for (const label of ['Injuries gained', 'Weapon wear']) {
      const row = rowElFor(html, label);
      expect(row, label).not.toBeUndefined();
      expect(row.querySelector('.amount').hasAttribute('data-unit'), label).toBe(false);
    }
  });

  it('formats every gold figure through formatGold (spec §2)', () => {
    const html = resultOf(WIN, { gold: 4500 });
    // The old screen hand-rolled `${n}g` strings. Nothing may do that again.
    expect(html).not.toMatch(/\d\s*g\b/);
    expect(html).toContain(formatGold(4500));
  });

  it('crosses out a beaten opponent and shows their plate at zero', () => {
    const won = dom(resultOf(WIN));
    expect(won.querySelector('.result__cross')).not.toBeNull();
    expect(won.querySelector('.result__cross').getAttribute('aria-hidden')).toBe('true');
    const plate = won.querySelector('.poster .bar');
    expect(plate.getAttribute('aria-valuenow')).toBe('0');
    expect(plate.getAttribute('aria-valuemax')).toBe(
      String(CONFIG.opponents.find((o) => o.name === 'The Brute').health)
    );
    // A corpse's plate must not pulse forever — the override, not the derived default.
    expect([...plate.classList]).not.toContain('is-urgent');
  });

  it('does not cross out, or invent a number for, an opponent still standing', () => {
    const lost = dom(resultOf(LOSS));
    expect(lost.querySelector('.result__cross')).toBeNull();
    expect(lost.querySelector('.poster .bar')).toBeNull();
    expect(lost.querySelector('.poster__sub').textContent).toContain(formatGold(50));
  });

  it('puts the resulting balance in the CTA price slot, never in its label (§6.6/§9)', () => {
    const cta = dom(resultOf(WIN, { gold: 3110 })).querySelector('[data-action="to-hub"]');
    expect([...cta.classList]).toEqual(expect.arrayContaining(['btn', 'btn--commit']));
    expect(cta.querySelector('.btn__price').textContent).toBe(formatGold(3110));
    expect(cta.firstChild.textContent).toBe('Return to Ludus'); // no money in the label
    expect([...cta.classList]).not.toContain('is-unaffordable'); // a balance is never a cost
  });

  it('escapes the opponent name and the commentary', () => {
    const html = resultOf({ ...WIN, opponentName: '<script>x</script>', commentary: '"&"' });
    expect(dom(html).querySelector('script')).toBeNull();
    expect(html).toContain('&lt;script&gt;');
    expect(dom(html).querySelector('.result__flavor').textContent).toBe('"&"');
  });

  it('reports a real resolved fight, not just hand-built fixtures', () => {
    const fought = resolveFightOutcome(
      startFight(createGameState(1, CONFIG), CONFIG),
      true,
      makeRng(1),
      CONFIG
    );
    const html = renderResult(fought, CONFIG);
    expect(rowFor(html, 'New balance').amount).toBe(formatGold(fought.gold));
    expect(rowFor(html, 'Net gold').amount).toBe(
      formatGold(fought.lastResult.netGold, { signed: true })
    );
    expect(rowFor(html, 'Weapon wear').amount).toBe(
      `\u2212${fought.lastResult.durabilityLost} durability`
    );
  });
});

// Spec §6.14: the endings gallery shows all three endings at once — the one you reached in the
// centre, full colour, the two you did not greyed out and mocking you. §6.13 stamps the verdict,
// §6.1 keeps the HUD on screen showing the fatal state, §7 lays the trio out, §2 formats the
// purse. The screen is the screenshot payload, so every one of those has to be true at once.
describe('renderGameOver (spec §6.14)', () => {
  // Hoisted to module scope (above) so the cross-screen title-plaque check can build the same
  // "dead" shape without a second hand-rolled copy.
  const overOf = gameOverState;
  const gameOver = (ended, over = {}) => renderGameOver(overOf(ended, over), CONFIG);
  const cardsIn = (html) => [...dom(html).querySelectorAll('.ending-card')];
  const titleOf = (card) => card.querySelector('.poster__name').textContent;
  // Derived, never restated: tests/config.test.js already proves these keys are exactly the
  // terminal states game.js can write, so reading them back off the config makes every
  // assertion below scale with the gallery. A hand-listed trio let a fourth ending render two
  // cards, no stamp and no failure.
  const ENDINGS = Object.keys(CONFIG.endings);

  it('shows the death cause when dead', () => {
    const s = createGameState(1, CONFIG);
    s.ended = 'dead';
    s.lastResult = { died: true, causeOfDeath: 'Tripped on a turnip.', opponentName: 'X' };
    const html = renderGameOver(s, CONFIG);
    expect(html).toContain('Tripped on a turnip.');
    expect(html).toContain('data-action="restart"');
  });

  it('shows a victory message when the circuit is won', () => {
    const s = createGameState(1, CONFIG);
    s.ended = 'win-circuit';
    expect(renderGameOver(s, CONFIG)).toMatch(/champion|circuit/i);
  });

  // The gallery, from every ending. Locked-ness is read off the cards rather than counted in
  // the markup: `ending-card--locked` contains the string `ending-card`, so a regex tally of
  // the two class names passes just as happily with two cards as with three.
  it('shows every ending, only the achieved one unlocked and centred', () => {
    for (const ended of ENDINGS) {
      // One parse: `dom()` builds a fresh tree per call, so node identity below needs one host.
      const host = dom(gameOver(ended));
      const cards = [...host.querySelectorAll('.ending-card')];
      expect(cards.length, `${ended} gallery`).toBe(ENDINGS.length);
      const locked = cards.filter((c) => c.classList.contains('ending-card--locked'));
      expect(locked.length, `${ended} locked count`).toBe(ENDINGS.length - 1);
      const open = cards.find((c) => !c.classList.contains('ending-card--locked'));
      expect(titleOf(open)).toBe(CONFIG.endings[ended].title);
      // …and it is the middle cell, not one of the flanks (spec §7's `stamp` area).
      expect(host.querySelector('.gameover__stamp .ending-card')).toBe(open);
      // Every ending appears exactly once, whichever one was reached.
      expect(
        cards
          .map(titleOf)
          .map((t) => t.replace(/\?$/, ''))
          .sort()
      ).toEqual(ENDINGS.map((k) => CONFIG.endings[k].title).sort());
    }
  });

  it('locks the endings you did not reach as aria-disabled info cards', () => {
    const html = gameOver('dead');
    for (const card of cardsIn(html)) {
      const locked = card.classList.contains('ending-card--locked');
      expect(card.tagName, 'a locked ending is an info card, never a button').toBe('ARTICLE');
      expect([...card.classList], 'tape stays intact when locked').toContain('tape');
      expect(card.getAttribute('aria-disabled')).toBe(locked ? 'true' : null);
      // The mocking question mark: "Champion? You got a belt. It doesn't fit."
      expect(titleOf(card).endsWith('?'), `${titleOf(card)} lock mark`).toBe(locked);
    }
  });

  it('gives every ending its own epitaph, parenthesised by the renderer (§6.8)', () => {
    for (const ended of ENDINGS) {
      const asides = cardsIn(gameOver(ended)).map((c) => c.querySelector('.snark').textContent);
      expect(asides.sort()).toEqual(ENDINGS.map((k) => `(${CONFIG.endings[k].epitaph})`).sort());
    }
  });

  // §6.13's three stamps and their copy: the modifier and the words travel together, so no
  // screen can pair "YOU DIED" with the victory colour. §9: death gets neither irony nor
  // softening, a win gets its exclamation.
  it('stamps the verdict with the §6.13 modifier that matches its copy', () => {
    for (const ended of ENDINGS) {
      // Read off the ending, not off a second table: the copy and the modifier live together
      // in config.endings, so no screen can pair "YOU DIED" with the victory colour and no
      // ending can reach this screen without copy (tests/config.test.js pins the punctuation).
      const { variant, text } = CONFIG.endings[ended].stamp;
      const stamps = [...dom(gameOver(ended)).querySelectorAll('.banner-stamp')];
      expect(stamps.length, `${ended} stamp count`).toBe(1);
      expect([...stamps[0].classList], ended).toContain(`banner-stamp--${variant}`);
      expect(stamps[0].textContent, ended).toBe(text);
    }
  });

  // gameoverSummary is the spoken twin of this whole screen (design 2026-08-01 §4d, items
  // 26+28): main.js writes its return value into the persistent #ledger-announcer region on
  // GAMEOVER. It must state the same stamp and the same lead-in the drawn screen states, or the
  // drawn and spoken halves drift apart exactly the way item 29 already warned about once.
  describe('gameoverSummary (design 2026-08-01 §4d)', () => {
    // Verified against src/config.js: endings.dead.stamp.text is 'YOU DIED' (no trailing
    // punctuation of its own — the period below is gameoverSummary supplying the sentence
    // break the bare stamp lacks).
    it('speaks the cause of death when one was recorded', () => {
      const s = overOf('dead');
      expect(s.lastResult.causeOfDeath).toBe('Tripped on a turnip.'); // the fixture's real cause
      expect(gameoverSummary(s, CONFIG)).toBe('YOU DIED. Cause of Death: Tripped on a turnip.');
    });

    // The renderer's own UNRECORDED_CAUSE fallback (src/ui/render.js), exercised the same way
    // the "survives a death with no recorded result" renderGameOver test below builds its
    // fixture: ended 'dead' with no lastResult at all.
    it('falls back to the unrecorded-cause copy when no result was captured', () => {
      const s = { ...createGameState(1, CONFIG), phase: 'GAMEOVER', ended: 'dead', health: 0 };
      expect(s.lastResult, 'the fixture must actually be missing its result').toBeNull();
      expect(gameoverSummary(s, CONFIG)).toBe('YOU DIED. Cause of Death: Unrecorded.');
    });

    // A non-death achieved ending: the stamp prefix and the purse payload, formatted through
    // formatGold like every other money line on this screen (spec §2). This stamp ends in its
    // own exclamation, so gameoverSummary adds only the space — never a second terminal mark,
    // which a screen reader would speak as "CHAMPION! period".
    it('speaks the stamp and the final purse for a survivor ending', () => {
      const s = overOf('win-circuit');
      expect(CONFIG.endings['win-circuit'].stamp.text).toBe('CHAMPION!'); // the real config copy
      expect(gameoverSummary(s, CONFIG)).toBe(`CHAMPION! Final purse: ${formatGold(s.gold)}`);
    });

    // `achieved` falls back to null for an `ended` the config does not know — the same guard
    // renderGameOver's own "tells one story when the ending is not one the config knows" test
    // exercises on the drawn screen. No stamp prefix, and the purse branch (never the cause
    // branch, since `achieved` is null and not `'dead'`).
    it('speaks no stamp and the final purse when the ending is not one the config knows', () => {
      const s = overOf('some-ending-the-config-does-not-have');
      expect(gameoverSummary(s, CONFIG)).toBe(`Final purse: ${formatGold(s.gold)}`);
    });
  });

  // §6.1: "On GAMEOVER the HUD persists showing the fatal state (0/100) — deliberate
  // storytelling." It used to render no HUD at all, so the run's final figures vanished with it.
  it('keeps the HUD on screen showing the fatal state (§6.1)', () => {
    const hud = dom(gameOver('dead')).querySelector('.hud');
    expect(hud).not.toBeNull();
    const health = hud.querySelector('[aria-label="Health"]');
    expect(health.getAttribute('aria-valuenow')).toBe('0');
    expect(health.getAttribute('aria-valuemax')).toBe(String(CONFIG.player.maxHealth));
    expect(health.querySelector('.bar__num').textContent).toBe(`0/${CONFIG.player.maxHealth}`);
    expect(hud.querySelector('.hud__purse').textContent).toContain(formatGold(CONFIG.startingGold));
  });

  // §6.14: below the trio, the lead-in and the absurd line, with the wordmark in frame.
  it('prints the cause of death below the trio, with the wordmark in frame', () => {
    const cause = dom(gameOver('dead')).querySelector('.cause-of-death');
    // §6.14's fence spells the lead-in "Cause of Death:".
    expect(cause.querySelector('strong').textContent).toBe('Cause of Death:');
    expect(cause.textContent).toContain('Tripped on a turnip.');
    // Law 4: the wordmark is text, so it stands on the parchment the cause line carries rather
    // than on the bare stone slot. tests/styles.test.js proves the ground; this proves it is
    // still in frame for the screenshot (§6.14).
    expect(cause.querySelector('.wordmark')).not.toBeNull();
    expect(cause.closest('.gameover__cause').querySelector('.wordmark')).not.toBeNull();
  });

  // §5: "nothing exceeds 400ms". `bar-urgent` is an `infinite` pulse, so the corpse's 0/100
  // beam would throb for as long as the screen is up — exactly why `poster()` takes
  // `urgent: false` for the defeated plate on the result screen. The run is over here; a
  // flashing alarm points at nothing the player can still do.
  it('does not pulse the HUD beam once the run is over (§5)', () => {
    const fatal = overOf('dead');
    const live = dom(renderHud(fatal, CONFIG)).querySelector('[aria-label="Health"]');
    expect([...live.classList], 'the fixture is urgent while the run is live').toContain(
      'is-urgent'
    );
    for (const ended of ENDINGS) {
      const beam = dom(gameOver(ended)).querySelector('[aria-label="Health"]');
      expect([...beam.classList], ended).not.toContain('is-urgent');
    }
  });

  // Spec §2: nothing formats money by hand. Both survivor endings used to print `${gold}g`.
  it('formats the final purse through formatGold (§2)', () => {
    for (const ended of ['win-circuit', 'retired']) {
      const gold = 2450;
      const html = gameOver(ended, { gold });
      const line = dom(html).querySelector('.cause-of-death');
      expect(line.querySelector('.amount').textContent, ended).toBe(formatGold(gold));
      expect(html, `${ended} hand-formatted gold`).not.toContain(`${gold}g`);
      expect(html, `${ended} hand-formatted gold`).not.toContain('2,450g');
    }
  });

  it('escapes ending copy from config', () => {
    const hostile = {
      ...CONFIG,
      endings: {
        ...CONFIG.endings,
        retired: { title: '<b>Rich</b>', epitaph: '"&" <i>gone</i>' },
      },
    };
    const html = renderGameOver(overOf('retired'), hostile);
    expect(html).not.toContain('<b>Rich</b>');
    expect(html).not.toContain('<i>gone</i>');
    const card = dom(html).querySelector('.gameover__stamp .ending-card');
    expect(titleOf(card)).toBe('<b>Rich</b>');
    expect(card.querySelector('.snark').textContent).toBe('("&" <i>gone</i>)');
  });

  // A new ending must either reach the screen or fail a test — it must never just vanish. The
  // renderer used to hold its own hand-written trio and lift the flanks out of it with
  // `const [left, right] = …`, so a fourth ending rendered two cards of four, no stamp, and
  // never appeared at all, with the whole suite green.
  //
  // Five, not four, and deliberately: with four endings the achieved one leaves three, the
  // flanks split 2/1, and a truncation of the one-card flank is a no-op that no assertion can
  // see. Five leaves four, both flanks hold two, and dropping a card from *either* side fails.
  it('renders new endings rather than silently dropping one', () => {
    const extra = {
      exiled: {
        title: 'Exiled',
        epitaph: 'The gate shut behind you.',
        stamp: { variant: 'defeat', text: 'EXILED.' },
      },
      enslaved: {
        title: 'Sold On',
        epitaph: 'A new owner. Same sand.',
        stamp: { variant: 'defeat', text: 'SOLD ON.' },
      },
    };
    const five = { ...CONFIG, endings: { ...CONFIG.endings, ...extra } };
    const host = dom(renderGameOver(overOf('exiled'), five));
    const cards = [...host.querySelectorAll('.ending-card')];
    expect(cards.length).toBe(5);
    expect(
      cards
        .map(titleOf)
        .map((t) => t.replace(/\?$/, ''))
        .sort()
    ).toEqual(
      Object.values(five.endings)
        .map((e) => e.title)
        .sort()
    );
    // Both flanks carry cards, so neither slice can be truncated unnoticed.
    expect(host.querySelectorAll('.gameover__left .ending-card').length).toBe(2);
    expect(host.querySelectorAll('.gameover__right .ending-card').length).toBe(2);
    const open = cards.filter((c) => !c.classList.contains('ending-card--locked'));
    expect(open.length).toBe(1);
    expect(host.querySelector('.gameover__stamp .ending-card')).toBe(open[0]);
    expect(host.querySelector('.banner-stamp').textContent).toBe('EXILED.');
  });

  // One validated value decides the whole screen. `achieved` is checked against
  // `config.endings`; the cause line used to branch on the raw `state.ended` instead, so a
  // config that does not know 'dead' produced a half-recognised screen — every card locked and
  // no stamp, with a cause of death printed underneath them anyway.
  it('tells one story when the ending is not one the config knows', () => {
    const noDeath = { ...CONFIG, endings: { 'win-circuit': CONFIG.endings['win-circuit'] } };
    const host = dom(renderGameOver(overOf('dead'), noDeath));
    expect(host.querySelector('.banner-stamp')).toBeNull();
    expect(host.querySelectorAll('.ending-card--locked').length).toBe(
      host.querySelectorAll('.ending-card').length
    );
    const cause = host.querySelector('.cause-of-death');
    expect(cause.querySelector('strong').textContent).toBe('Final purse:');
    expect(cause.textContent).not.toContain('turnip');
  });

  // The renderer deliberately refuses to throw inside mount(): an ending it does not recognise
  // empties the centre cell rather than taking the screen down. The cause line was the last
  // place that still dereferenced `state.lastResult` unguarded, so a death carrying no recorded
  // result threw on the way in — on the one path built not to.
  it('survives a death with no recorded result', () => {
    const s = { ...createGameState(1, CONFIG), phase: 'GAMEOVER', ended: 'dead', health: 0 };
    expect(s.lastResult, 'the fixture must actually be missing its result').toBeNull();
    let html;
    expect(() => {
      html = renderGameOver(s, CONFIG);
    }).not.toThrow();
    const cause = dom(html).querySelector('.cause-of-death');
    expect(cause.querySelector('strong').textContent).toBe('Cause of Death:');
    expect(cause.textContent).not.toContain('undefined');
  });

  // The cause line comes from `config.deathRecaps` today, but it is the one string on this
  // screen that arrives through `state` rather than through `config` — the same channel a
  // future recap keyed on an opponent's name would use. Escaped once, like everything else.
  it('escapes the cause of death', () => {
    const html = gameOver('dead', {
      lastResult: { ...GAMEOVER_DEATH, causeOfDeath: 'Felled by <script>alert("x")</script>.' },
    });
    expect(html).not.toContain('<script>');
    expect(dom(html).querySelector('.cause-of-death').textContent).toContain(
      'Felled by <script>alert("x")</script>.'
    );
  });

  // §6.14: "Fight Again is the lone .btn--commit". §9: prices live in the price slot, and this
  // button has no price at all — a label carrying money would fail both.
  it("offers Fight Again as the screen's lone commit button", () => {
    const screen = dom(gameOver('dead')).querySelector('.screen--gameover');
    const commits = [...screen.querySelectorAll('.btn--commit')];
    expect(commits.length).toBe(1);
    expect(commits[0].getAttribute('data-action')).toBe('restart');
    expect(commits[0].textContent).not.toMatch(/\d/);
    expect(commits[0].querySelector('.btn__price')).toBeNull();
    expect(commits[0].closest('.commit-bar')).not.toBeNull();
  });

  // §7 gives the screen five placed children in reading order. Asserted as regions plus their
  // contents: adding a class is a harmless refactor, putting the CTA in the cause slot is not.
  it('lays the screen out as spec §7 endL / stamp / endR / cause / cta', () => {
    const section = dom(gameOver('dead')).querySelector('section.screen');
    expect([...section.classList]).toContain('screen--gameover');
    expect([...section.children].map((c) => c.className.split(' ')[0])).toEqual([
      'gameover__left',
      'gameover__stamp',
      'gameover__right',
      'gameover__cause',
      'gameover__cta',
    ]);
  });

  // The whole screen, driven off a real death instead of a fixture: the cause line comes from
  // config.deathRecaps and the HUD reads the state game.js actually wrote.
  it('renders a game over the game really produced', () => {
    const champion = { ...createGameState(1, CONFIG), currentOpponentIndex: 3 };
    const dead = resolveFightOutcome(startFight(champion, CONFIG), false, () => 0, CONFIG);
    expect(dead.ended).toBe('dead');
    const html = renderGameOver(dead, CONFIG);
    expect(html).toContain(escapeHtml(dead.lastResult.causeOfDeath));
    expect(dom(html).querySelector('[aria-label="Health"]').getAttribute('aria-valuenow')).toBe(
      '0'
    );
  });
});

// Spec §6.9 gives the entry a typographic grammar, not a sentence: `.log__turn`, then the
// mechanics clause with blood-ink bold damage dealt, a sword glyph on damage taken, gold-ink
// money and italic status, then an optional snark. combat.js emits the clause as a trusted
// template plus separate values; everything that could carry content (a name) is escaped here.
describe('logEntry (spec §6.9)', () => {
  const SWORD = 0x2694; // ⚔ CROSSED SWORDS, pinned by codepoint, never by a pasted glyph
  const entry = (over = {}) => ({ turn: 1, kind: 'attack', text: 'You swing.', ...over });
  const swordCount = (html) =>
    (html.match(new RegExp(String.fromCodePoint(SWORD), 'g')) || []).length;

  it('wraps the clause in a numbered log entry', () => {
    const html = logEntry(entry({ turn: 7 }));
    const li = dom(html).firstElementChild;
    expect(li.tagName).toBe('LI');
    expect(classesOf(html)).toContain('log__entry');
    expect(li.querySelector('.log__turn').textContent).toBe('T7');
    expect(li.textContent).toContain('You swing.');
  });

  it('paints damage dealt as a bold value (--blood-ink via .log__entry b)', () => {
    const html = logEntry(entry({ text: 'You strike (crit) for {dmg} damage.', dmg: 21 }));
    expect(html).toContain('You strike (crit) for <b>21</b> damage.');
    expect(swordCount(html)).toBe(0); // dealing damage is not taking it
  });

  it('marks damage taken with a sword glyph that assistive tech does not read', () => {
    const html = logEntry(
      entry({ text: '{who} strikes (hit) for {taken}.', who: 'The Brute', taken: 9 })
    );
    const glyph = html.match(/<span aria-hidden="true">(.)<\/span>/)[1];
    expect(glyph.codePointAt(0)).toBe(SWORD);
    expect(html).toContain('The Brute strikes (hit) for ');
    expect(html).toContain('9.');
    expect(html).not.toContain('<b>'); // taken damage is plain ink, not the blood-ink value
    // A line break between glyph and number would orphan the sword, so they are joined by
    // U+00A0 — pinned by codepoint, because a plain space here is invisible in review.
    const joiner = html.match(/<\/span>(.)9\./)[1];
    expect(joiner.codePointAt(0)).toBe(0x00a0);
  });

  it('italicises a status clause and leaves an attack clause upright', () => {
    expect(logEntry(entry({ kind: 'status', text: 'You raise your guard.' }))).toContain(
      '<em>You raise your guard.</em>'
    );
    expect(logEntry(entry({ kind: 'attack', text: 'You raise your guard.' }))).not.toContain(
      '<em>'
    );
  });

  it('formats money through formatGold in a gold-ink amount slot', () => {
    const html = logEntry(entry({ text: 'The crowd throws {gold}.', gold: 1234 }));
    expect(html).toContain(`<span class="amount">${formatGold(1234)}</span>`);
    expect(html).not.toContain('1234'); // never hand-formatted (spec §2)
  });

  it('escapes the clause and its values exactly once', () => {
    const html = logEntry(
      entry({
        text: '{who} jeers & <spits> at "you".',
        who: '<img src=x onerror="alert(1)">',
      })
    );
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<spits>');
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(html).toContain('&amp; &lt;spits&gt; at &quot;you&quot;.');
    expect(html).not.toContain('&amp;lt;');
    expect(html).not.toContain('&amp;quot;');
  });

  // Substitution must be a single pass. If the filled-in values were rescanned, an enemy
  // named "{taken}" would mint a second damage figure out of nothing.
  it('does not rescan a substituted value for further placeholders', () => {
    const html = logEntry(
      entry({
        text: '{who} strikes for {taken}.',
        who: '{taken}{dmg}',
        taken: 4,
        dmg: 99,
      })
    );
    expect(swordCount(html)).toBe(1);
    expect(html).toContain('{taken}{dmg} strikes for ');
    expect(html).not.toContain('99');
  });

  it('leaves a placeholder alone when the entry carries no such value', () => {
    expect(logEntry(entry({ text: 'You hit for {dmg}.' }))).toContain('You hit for {dmg}.');
  });

  it('parenthesises an optional snark aside and escapes it', () => {
    expect(logEntry(entry({ snark: 'The crowd studies its sandals' }))).toContain(
      '<span class="snark">(The crowd studies its sandals)</span>'
    );
    expect(logEntry(entry({ snark: '<b>no</b>' }))).toContain('(&lt;b&gt;no&lt;/b&gt;)');
    expect(logEntry(entry())).not.toContain('class="snark"');
  });

  // The live region (main.js) speaks this string, so it must be plain text with no markup and
  // no decorative glyph — and it must not drift from the visible clause.
  it('renders a speakable plain-text twin with no markup', () => {
    const e = entry({
      text: '{who} strikes (hit) for {taken}, taking {gold}.',
      who: 'The <Brute>',
      taken: 9,
      gold: 50,
      snark: 'Rude',
    });
    const text = logEntryText(e);
    expect(text).toBe(`The <Brute> strikes (hit) for 9, taking ${formatGold(50)}. (Rude)`);
    expect(text).not.toContain('<span'); // no markup…
    expect(swordCount(text)).toBe(0); // …and no glyph to read out as "crossed swords"
  });
});

describe('renderFight', () => {
  it('shows both combatants and the four action buttons', () => {
    const s = startFight(createGameState(1, CONFIG), CONFIG);
    const html = renderFight(s, CONFIG);
    expect(html).toContain('The Brute');
    expect(html).toContain('data-action="strike"');
    expect(html).toContain('data-action="heavy"');
    expect(html).toContain('data-action="block"');
    expect(html).toContain('data-action="feint"');
    // Task 6 renamed the track to `.meter` (spec §6.4/§6.0); Task 7 Step 3 drops the legacy
    // class, which is the only thing left holding `:where(.timing-meter)` in legacy.css alive.
    expect(classesOf(meterTag(html))).toContain('meter');
    expect(classesOf(meterTag(html))).not.toContain('timing-meter');
  });

  it('renders the combat log', () => {
    const s = startFight(createGameState(1, CONFIG), CONFIG);
    s.combat.log = [
      { turn: 1, kind: 'attack', text: 'You strike (hit) for {dmg} damage.', dmg: 13 },
    ];
    expect(renderFight(s, CONFIG)).toContain('You strike (hit) for <b>13</b> damage.');
  });

  it('renders posters for both fighters and turn-numbered log entries', () => {
    const s = startFight(createGameState(1, CONFIG), CONFIG);
    // One exchange: the player's blow and the answer share a turn number (spec §6.9).
    s.combat.log = [
      { turn: 1, kind: 'attack', text: 'You strike.' },
      { turn: 1, kind: 'attack', text: 'The Brute hits back.' },
      { turn: 2, kind: 'status', text: 'You raise your guard.' },
    ];
    const html = renderFight(s, CONFIG);
    const cards = posterCards(html);
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      expect(classesOf(card)).toEqual(expect.arrayContaining(['poster', 'tape']));
    }
    expect(classesOf(html.match(/<section [^>]*>/)[0])).toContain('screen--fight');
    // Spec 6.9: turn numbers, not fake timestamps, and the newest entry sits at the bottom —
    // so source order is the assertion, not a substring index.
    expect(logRows(html)).toEqual([
      { turn: 'T1', text: 'You strike.' },
      { turn: 'T1', text: 'The Brute hits back.' },
      { turn: 'T2', text: 'You raise your guard.' },
    ]);
    // …and the status clause is the italic one (spec 6.9's fourth typographic channel).
    const entries = [...dom(html).querySelectorAll('.log__entry')];
    expect(entries.map((li) => li.querySelector('em')?.textContent ?? null)).toEqual([
      null,
      null,
      'You raise your guard.',
    ]);
  });

  // Spec 6.9's strip is a fixed-height *scroller*, and that CSS is the only truncation: the
  // renderer emits the whole bout so the player can scroll back through it, and each entry
  // keeps its own turn stamp. A second, entry-count truncation here would silently discard
  // history that the strip's scrollbar implies is still reachable.
  it('renders the whole history in order, keeping each entry its own turn number', () => {
    const s = startFight(createGameState(1, CONFIG), CONFIG);
    // Ten entries over five exchanges: two lines per turn, exactly as a real fight pushes them.
    s.combat.log = Array.from({ length: 10 }, (_, i) => ({
      turn: Math.floor(i / 2) + 1,
      kind: 'attack',
      text: `line ${i + 1}`,
    }));
    expect(logRows(renderFight(s, CONFIG))).toEqual(
      s.combat.log.map((e, i) => ({ turn: `T${e.turn}`, text: `line ${i + 1}` }))
    );
  });

  // Log lines interpolate the opponent's name, which comes from config and one day from a mod.
  // The entry carries markup now, so a hostile name must still escape exactly once.
  it('escapes log entries exactly once', () => {
    const s = startFight(createGameState(1, CONFIG), CONFIG);
    s.combat.log = [
      {
        turn: 1,
        kind: 'attack',
        text: '{who} & co',
        who: '<script>alert("x")</script>',
      },
    ];
    const html = renderFight(s, CONFIG);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; co');
    expect(html).not.toContain('&amp;lt;');
  });

  // The strip carries NO aria-live (design 2026-08-01 §4c, item 23): inside #app it is
  // re-created already-populated every render, so it can never speak — while AT that does
  // voice fresh insertions would read the entire bout as a duplicate of #log-announcer.
  // The persistent #log-announcer region (src/main.js) is the one announcement channel.
  it('the log strip carries no aria-live (spec 6.9/8)', () => {
    const html = renderFight(startFight(createGameState(1, CONFIG), CONFIG), CONFIG);
    const strips = [...dom(html).querySelectorAll('.log')];
    expect(strips).toHaveLength(1);
    expect(strips[0].tagName).toBe('UL'); // a list of entries, not a blob of text
    expect(strips[0].getAttribute('aria-live')).toBeNull();
  });

  it('flanks the stage with one HP-plated poster per fighter, on opposite tilts', () => {
    const s = startFight(createGameState(1, CONFIG), CONFIG);
    s.combat.player.health = 40;
    s.combat.enemy.health = 7;
    const cards = posterCards(renderFight(s, CONFIG));
    expect(cards).toHaveLength(2);
    // Source order is reading order (spec 7): you, then the stage, then the foe.
    expect(classesOf(cards[0])).toContain('poster--tilt-1');
    expect(classesOf(cards[1])).toContain('poster--tilt-2');
    expect(cards[0]).toContain('aria-label="You health"');
    expect(cards[0]).toContain('aria-valuenow="40"');
    expect(cards[0]).toContain(`aria-valuemax="${s.combat.player.maxHealth}"`);
    expect(cards[1]).toContain(`aria-label="${s.combat.enemy.name} health"`);
    expect(cards[1]).toContain('aria-valuenow="7"');
    expect(cards[1]).toContain(`aria-valuemax="${s.combat.enemy.maxHealth}"`);
    // 7 of 40-odd is deep inside URGENT_FRACTION: the foe's plate flashes, the player's does not.
    expect(s.combat.enemy.health / s.combat.enemy.maxHealth).toBeLessThan(URGENT_FRACTION);
    expect(s.combat.player.health / s.combat.player.maxHealth).toBeGreaterThan(URGENT_FRACTION);
    expect(cards[1]).toContain('class="bar is-urgent"');
    expect(cards[0]).not.toContain('is-urgent');
  });

  // Spec §6.5's poster anatomy is name / portrait / HP plate / sub / snark — the fight screen
  // shipped the first three and stopped. The sub is the only place the bout's stakes are
  // stated during the fight, and the money in it must come from formatGold (spec §2).
  it('bills both fight posters with a §6.5 sub line and a snark', () => {
    const s = startFight(createGameState(1, CONFIG), CONFIG);
    s.gold = 1234;
    s.wins = 2;
    const opp = CONFIG.opponents[s.currentOpponentIndex];
    const [you, foe] = posterCards(renderFight(s, CONFIG));
    for (const card of [you, foe]) {
      expect(card).toContain('<p class="poster__sub">');
      expect(card).toMatch(/<span class="snark">\(.+\)<\/span>/);
    }
    expect(foe).toContain(`Tier: ${opp.tier}`);
    expect(foe).toContain(`<span class="amount">${formatGold(opp.purse)}</span>`);
    expect(foe).toContain(`<span class="snark">(${CONFIG.snark[opp.id]})</span>`);
    expect(you).toContain('Wins: 2');
    expect(you).toContain(`<span class="amount">${formatGold(1234)}</span>`);
    expect(you).toContain(`<span class="snark">(${CONFIG.snark.player})</span>`);
  });

  // Overkill takes health negative; the plate must read 0, not -6, and must not print the
  // raw number anywhere (meter() clamps, so this is really a "poster still routes through it").
  it('clamps an overkilled fighter’s plate to an empty bar', () => {
    const s = startFight(createGameState(1, CONFIG), CONFIG);
    s.combat.enemy.health = -6;
    const foe = posterCards(renderFight(s, CONFIG))[1];
    expect(foe).toContain('aria-valuenow="0"');
    expect(foe).toContain('width:0%');
    expect(foe).not.toContain('-6');
  });

  it('renders Press the Attack as a commit banner only when pressable', () => {
    const s = startFight(createGameState(1, CONFIG), CONFIG);
    expect(renderFight(s, CONFIG)).not.toContain('data-action="press"');
    s.combat.canPress = true;
    const html = renderFight(s, CONFIG);
    expect(html).toContain('data-action="press"');
    expect(html).toContain('btn--commit');
    // A banner above the 2x2 grid, not a fifth cell in it.
    expect(html.indexOf('data-action="press"')).toBeLessThan(html.indexOf('fight__grid'));
  });

  it('wraps each grid area of the spec 7 fight layout', () => {
    const html = renderFight(startFight(createGameState(1, CONFIG), CONFIG), CONFIG);
    for (const cls of [
      'fight__you',
      'fight__stage',
      'fight__foe',
      'fight__log',
      'fight__actions',
    ]) {
      expect(html, `missing wrapper ${cls}`).toContain(`class="${cls}"`);
    }
    // The meter is the stage, not a stray sibling of it.
    expect(html.indexOf('fight__stage')).toBeLessThan(html.indexOf('data-meter'));
    expect(html.indexOf('data-meter')).toBeLessThan(html.indexOf('fight__foe'));
  });
});

// The opening `<div ...>` of the timing meter — the element carrying data-meter.
const meterTag = (html) => html.match(/<div[^>]*data-meter="1"[^>]*>/)[0];
// Inline geometry of one rendered zone, as the fractions meterZones() produced.
const zoneGeometry = (html, name) => {
  const tag = html.match(new RegExp(`<div class="meter__zone meter__zone--${name}"[^>]*>`))[0];
  const style = tag.match(/style="([^"]*)"/)[1];
  return {
    start: Number(style.match(/left:([\d.]+)%/)[1]) / 100,
    size: Number(style.match(/width:([\d.]+)%/)[1]) / 100,
  };
};

describe('renderFight timing meter (spec §6.4)', () => {
  const fightState = (over = {}) => {
    const s = startFight(createGameState(1, CONFIG), CONFIG);
    return { ...s, ...over, combat: { ...s.combat, ...(over.combat || {}) } };
  };

  it('announces itself and draws the three nested zones plus a cursor', () => {
    const html = renderFight(fightState(), CONFIG);
    // role="button" (design 2026-08-01 §4b, item 16): announced usefully ("button"),
    // activation semantics for free, and browse mode is not suppressed for a control whose
    // only children are presentational divs. tabindex stays — a div button is not natively
    // focusable.
    expect(meterTag(html)).toContain('role="button"');
    expect(meterTag(html)).toContain('tabindex="0"');
    const label = meterTag(html).match(/aria-label="([^"]*)"/)[1];
    expect(label).toMatch(/^Timing meter .* press Space or click to strike$/);
    // Pinned by codepoint, never by comparison against a pasted glyph: an em dash flattened
    // to a hyphen in transit compares equal to itself on both sides of the assertion.
    expect(label.codePointAt('Timing meter '.length)).toBe(0x2014);
    for (const name of ['graze', 'hit', 'crit']) {
      expect(html).toContain(`class="meter__zone meter__zone--${name}"`);
    }
    expect(html).toContain('class="meter-cursor"');
    // Painted weakest-first: crit must be the last of the three, or the wide graze band
    // covers the bright one it is supposed to nest around.
    expect(html.indexOf('meter__zone--graze')).toBeLessThan(html.indexOf('meter__zone--hit'));
    expect(html.indexOf('meter__zone--hit')).toBeLessThan(html.indexOf('meter__zone--crit'));
  });

  it('positions the zones from this turn’s sweet spot and the player’s own window', () => {
    const s = fightState({ combat: { sweet: 0.42 } });
    const width = timingWindowWidth(effectiveStats(s, CONFIG).speed, CONFIG);
    const expected = meterZones(0.42, width, CONFIG);
    const html = renderFight(s, CONFIG);
    for (const name of ['graze', 'hit', 'crit']) {
      expect(zoneGeometry(html, name).start).toBeCloseTo(expected[name].start, 4);
      expect(zoneGeometry(html, name).size).toBeCloseTo(expected[name].size, 4);
    }
  });

  it('widens every zone when the fighter is faster (readable risk, spec §6.4)', () => {
    const slow = fightState({ combat: { sweet: 0.5 } });
    const fast = { ...slow, trainingLevels: { ...slow.trainingLevels, speed: 6 } };
    expect(effectiveStats(fast, CONFIG).speed).toBeGreaterThan(effectiveStats(slow, CONFIG).speed);
    for (const name of ['graze', 'hit', 'crit']) {
      expect(zoneGeometry(renderFight(fast, CONFIG), name).size).toBeGreaterThan(
        zoneGeometry(renderFight(slow, CONFIG), name).size
      );
    }
  });

  // The 150g Lucky Charm buys a wider crit window. If renderMeter does not pass the player's
  // critWindowMult down, the charm changes not one pixel of the meter while still paying 2.0x,
  // so a slice of the track paints as plain HIT and resolves as a crit.
  it('widens the drawn crit band with the Lucky Charm, and the resolver agrees', () => {
    const plain = fightState({ combat: { sweet: 0.5 } });
    const charmed = { ...plain, gear: ['charm'] };
    const eff = effectiveStats(charmed, CONFIG);
    expect(eff.critWindowMult).toBeGreaterThan(1);
    const width = timingWindowWidth(eff.speed, CONFIG);
    const center = plain.combat.sweet;
    const drawnHalf = (s) => zoneGeometry(renderFight(s, CONFIG), 'crit').size / 2;

    // The charm has to move a real pixel, not just pay out wider: the drawn band widens.
    expect(drawnHalf(charmed)).toBeGreaterThan(drawnHalf(plain));

    // The boundary the resolver is tested against comes from meterZones — the same unrounded
    // source renderMeter draws from — not from the toFixed(2) markup. The markup's 0.01% percent
    // resolution rounds a crit half-width by up to ~2.5e-5, which is wider than any nudge worth
    // testing at, so reading `half` back out of the markup would let these tier assertions flip
    // after a change to baseTimingWidth, speedTimingBonus, or timingTierRatios. Deriving `half`
    // keeps the 1e-9 nudge meaningful; the drawn↔source agreement is the tolerance check below.
    for (const [state, critWindowMult] of [
      [charmed, eff.critWindowMult],
      [plain, 1],
    ]) {
      const half = meterZones(center, width, CONFIG, critWindowMult).crit.size / 2;
      expect(resolveTiming(half * (1 - 1e-9), width, CONFIG, critWindowMult)).toBe('crit');
      expect(resolveTiming(half * (1 + 1e-9), width, CONFIG, critWindowMult)).toBe('hit');
      // …and the band the player actually sees is that same band, to the markup's 0.01% grid.
      expect(drawnHalf(state)).toBeCloseTo(half, 4);
    }
  });

  // createCombat seeds `sweet` at fight creation, so neither the renderer nor main.js's rAF
  // loop carries a mid-track fallback. Two hand-written fallbacks are one edit away from
  // disagreeing, and a disagreement paints the bright band somewhere the resolver does not pay.
  it('takes its centre from the sweet spot every fight is born with', () => {
    const s = fightState();
    expect(s.combat.sweet).toBeGreaterThanOrEqual(CONFIG.combat.sweetCenter.min);
    expect(s.combat.sweet).toBeLessThanOrEqual(CONFIG.combat.sweetCenter.max);
    const crit = zoneGeometry(renderFight(s, CONFIG), 'crit');
    expect(crit.start + crit.size / 2).toBeCloseTo(s.combat.sweet, 4);
  });

  it('shows the first-fight taunt once and never again (tutorial decay)', () => {
    expect(renderFight(fightState({ wins: 0 }), CONFIG)).toContain(CONFIG.snark.taunt);
    expect(renderFight(fightState({ wins: 1 }), CONFIG)).not.toContain(CONFIG.snark.taunt);
  });

  // Spec 6.4 hangs the first-fight helper line above the track. Below it, the sentence the
  // player is meant to read before their first swing sits under the thing it is explaining.
  it('places the taunt above the meter', () => {
    const html = renderFight(fightState({ wins: 0 }), CONFIG);
    expect(html.indexOf('meter__taunt')).toBeGreaterThan(-1);
    expect(html.indexOf('meter__taunt')).toBeLessThan(html.indexOf('data-meter'));
  });
});

describe('meterZones', () => {
  const zones = meterZones(0.5, 0.18, CONFIG);

  it('nests crit inside hit inside graze around the center', () => {
    expect(zones.crit.start).toBeCloseTo(0.5 - 0.18 * 0.3);
    expect(zones.crit.size).toBeCloseTo(2 * 0.18 * 0.3);
    expect(zones.hit.start).toBeCloseTo(0.5 - 0.18 * 1.0);
    expect(zones.graze.size).toBeCloseTo(2 * 0.18 * 1.6);
  });

  it('clamps zones to the track', () => {
    const edge = meterZones(0.05, 0.18, CONFIG);
    expect(edge.graze.start).toBe(0);
    expect(edge.graze.start + edge.graze.size).toBeLessThanOrEqual(1);
  });

  it('clamps at the far edge too', () => {
    const edge = meterZones(0.95, 0.18, CONFIG);
    expect(edge.graze.start).toBeGreaterThanOrEqual(0);
    expect(edge.graze.start + edge.graze.size).toBeCloseTo(1, 10);
    // Clamping trims the band; it must never slide it back inside the track.
    expect(edge.graze.start).toBeCloseTo(0.95 - 0.18 * 1.6, 10);
  });

  // The drawn edge and the resolver must be the same edge, or the bar shows gold where the
  // fight logs a miss. Both sides are *derived*, never restated: the half-width is read back
  // out of the band meterZones drew, and the tier comes from resolveTiming, which is the
  // authority. Neither assertion names a ratio, so a wrong formula in either place surfaces as
  // a disagreement instead of two matching mistakes. Run for a plain fighter and for one
  // wearing the Lucky Charm, whose critWindowMult widens the resolver's crit test.
  it.each([1, CONFIG.gear.charm.critWindowMult])(
    'draws each zone edge exactly where resolveTiming switches tier (critWindowMult %s)',
    (critWindowMult) => {
      const center = 0.5;
      const width = 0.18;
      const z = meterZones(center, width, CONFIG, critWindowMult);
      const weaker = { crit: 'hit', hit: 'graze', graze: 'miss' };
      for (const tier of ['crit', 'hit', 'graze']) {
        // Half-width read back out of the drawn band, and the band must be symmetric about
        // the centre for that to mean anything.
        const half = z[tier].size / 2;
        expect(z[tier].start).toBeCloseTo(center - half, 12);
        expect(z[tier].start + z[tier].size).toBeCloseTo(center + half, 12);
        // Bracketed, not claimed inclusive: recovering the half-width by subtracting two
        // floats moves it by ~1e-17, which would otherwise decide a boundary-exact test. The
        // 1e-9 window is still ~8 orders of magnitude tighter than any tier gap here.
        expect(resolveTiming(half * (1 - 1e-9), width, CONFIG, critWindowMult)).toBe(tier);
        expect(resolveTiming(half * (1 + 1e-9), width, CONFIG, critWindowMult)).toBe(weaker[tier]);
      }
    }
  );

  it('defaults to an unwidened crit band when no multiplier is supplied', () => {
    const plain = meterZones(0.5, 0.18, CONFIG);
    expect(plain.crit.size).toBeCloseTo(meterZones(0.5, 0.18, CONFIG, 1).crit.size, 12);
  });
});

describe('sweetCenter', () => {
  it('maps a [0,1) roll across the configured band, endpoints included', () => {
    const { min, max } = CONFIG.combat.sweetCenter;
    expect(sweetCenter(0, CONFIG)).toBeCloseTo(min);
    expect(sweetCenter(1, CONFIG)).toBeCloseTo(max);
    expect(sweetCenter(0.5, CONFIG)).toBeCloseTo((min + max) / 2);
  });

  it('never seeds outside the band, so a zone is always reachable mid-sweep', () => {
    const { min, max } = CONFIG.combat.sweetCenter;
    for (const roll of [0, 0.01, 0.37, 0.5, 0.99, 0.999999]) {
      expect(sweetCenter(roll, CONFIG)).toBeGreaterThanOrEqual(min);
      expect(sweetCenter(roll, CONFIG)).toBeLessThanOrEqual(max);
    }
  });
});

describe('meterDistance', () => {
  it('is 0 at the sweet-spot center and grows toward the edges', () => {
    expect(meterDistance(0.5, 0.5)).toBeCloseTo(0);
    expect(meterDistance(0.75, 0.5)).toBeCloseTo(0.25);
    expect(meterDistance(0.0, 0.5)).toBeCloseTo(0.5);
  });
});

describe('meterPosition', () => {
  it('sweeps 0 → 1 over one period and back down (triangle wave)', () => {
    expect(meterPosition(0, 1400)).toBeCloseTo(0);
    expect(meterPosition(700, 1400)).toBeCloseTo(0.5);
    expect(meterPosition(1400, 1400)).toBeCloseTo(1);
    expect(meterPosition(2100, 1400)).toBeCloseTo(0.5);
    expect(meterPosition(2800, 1400)).toBeCloseTo(0);
  });

  it('mirrors around the turn point — the return sweep retraces the outbound one', () => {
    for (const dt of [100, 333, 700, 1250]) {
      expect(meterPosition(1400 - dt, 1400)).toBeCloseTo(meterPosition(1400 + dt, 1400));
    }
  });

  it('stays within [0,1] and keeps ping-ponging across many periods', () => {
    for (const t of [0, 350, 1401, 3500, 140000, 987654]) {
      const p = meterPosition(t, 1400);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
    expect(meterPosition(1400 * 10, 1400)).toBeCloseTo(0); // even sweeps end at the start
    expect(meterPosition(1400 * 11, 1400)).toBeCloseTo(1); // odd sweeps end at the far edge
  });
});

describe('meterPeriod', () => {
  it('starts at the base sweep duration and speeds up per opponent tier', () => {
    expect(meterPeriod(0, CONFIG)).toBe(CONFIG.combat.meterPeriodMs.base);
    expect(meterPeriod(1, CONFIG)).toBe(
      CONFIG.combat.meterPeriodMs.base + CONFIG.combat.meterPeriodMs.perTier
    );
  });

  it('never drops below the configured minimum', () => {
    expect(meterPeriod(100, CONFIG)).toBe(CONFIG.combat.meterPeriodMs.min);
  });
});
