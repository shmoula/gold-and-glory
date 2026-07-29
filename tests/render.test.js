// tests/render.test.js
import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';
import { createGameState } from '../src/state.js';
import {
  btn, meter, poster, shopItem, renderHud, renderHub, renderResult, renderGameOver, renderFight,
  meterDistance, meterPosition, meterPeriod, meterZones, sweetCenter,
} from '../src/ui/render.js';
import { formatGold } from '../src/ui/format.js';
import { startFight, effectiveStats } from '../src/game.js';
import { resolveTiming, timingWindowWidth } from '../src/combat.js';

// Match classes as a set, never as a literal class string: adding or reordering a class is a
// harmless refactor and must not turn a passing suite red.
const classesOf = (tag) => tag.match(/class="([^"]*)"/)[1].trim().split(/\s+/);
// Articles never nest, so each match is exactly one whole poster.
const posterCards = (html) => html.match(/<article[\s\S]*?<\/article>/g) || [];

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
    expect(btn(null, '✓ <Blade> — OWNED', { owned: true }))
      .toContain('&lt;Blade&gt;');
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
    s.health = 65; s.injuries = 3; s.weaponDurability = 15;
    const html = renderHud(s, CONFIG);
    expect(html).toContain('class="hud"');
    expect(html).toContain('width:65%');                       // health fill
    expect(html).toContain('width:50%');                       // durability 15/30
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
    expect(pips.map((p) => p.includes('pip--filled')))
      .toEqual([true, true, false, false, false]);
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
  });

  it('keeps true no-ops disabled rather than unaffordable', () => {
    const s = createGameState(1, CONFIG);
    s.gold = 100000;
    s.weaponDurability = CONFIG.weapon.maxDurability; // nothing to repair
    s.injuries = 0;                                   // nothing to heal
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
});

describe('meter', () => {
  it('escapes a hostile label exactly once', () => {
    // Escaping used to be the caller's job, which held only while every label was a literal.
    // Task 7 feeds enemy names in, so meter() owns it now.
    const html = meter('<img src=x onerror=alert(1)> & "Boss"', 5, 10);
    expect(html).toContain('aria-label="&lt;img src=x onerror=alert(1)&gt; &amp; &quot;Boss&quot;"');
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

  it('takes sub as markup and parenthesizes the snark', () => {
    const html = poster({ name: 'Foe', sub: 'Purse: <span class="amount">50</span>', snark: 'A big lad' });
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
    const you = posterCards(renderHub(s, CONFIG))
      .find((p) => classesOf(p).includes('poster--tilt-1'));
    expect(you).toContain('aria-label="You health"');
    expect(you).toContain('aria-valuenow="65"');
    expect(you).toContain(`aria-valuemax="${s.maxHealth}"`);
    expect(you).toContain(`65/${s.maxHealth}`);
    expect(you).toContain('width:65%');
  });

  it('clamps the player HP plate like every other meter', () => {
    const s = createGameState(1, CONFIG);
    s.health = s.maxHealth + 40;
    const you = posterCards(renderHub(s, CONFIG))
      .find((p) => classesOf(p).includes('poster--tilt-1'));
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

  it('renders gear as shop cards in the available / unaffordable / owned triad', () => {
    const s = createGameState(1, CONFIG);
    const { shield, blade, charm } = CONFIG.gear;
    const shortfall = 100;
    s.gold = blade.cost - shortfall; // blade out of reach by exactly `shortfall`
    s.gear = [charm.id];             // charm owned
    // A precondition, not an assumption: a config edit that put the shield out of reach too
    // would otherwise silently delete the "available" third of the triad from this test.
    expect(s.gold).toBeGreaterThanOrEqual(shield.cost);
    const html = renderHub(s, CONFIG);
    // Card roots only — `shop-item__name` and friends must not inflate the count.
    expect((html.match(/class="shop-item[" ]/g) || []).length)
      .toBe(Object.keys(CONFIG.gear).length);

    expect(html).toMatch(new RegExp(`data-action="buy-${shield.id}"[^>]*class="shop-item"`));
    expect(html).not.toMatch(
      new RegExp(`data-action="buy-${shield.id}"[^>]*is-(unaffordable|owned)`));

    expect(html).toContain(`<span class="btn__price">${formatGold(blade.cost)}</span>`);
    expect(html).toMatch(new RegExp(`data-action="buy-${blade.id}"[^>]*is-unaffordable`));
    expect(html).toMatch(
      new RegExp(`data-action="buy-${blade.id}"[^>]*data-missing="${formatGold(shortfall)}"`));

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
});

describe('renderResult', () => {
  it('renders a win recap card', () => {
    const s = createGameState(1, CONFIG);
    s.lastResult = {
      won: true, died: false, opponentName: 'The Brute',
      purse: 50, tax: 10, sponsorIncome: 0, netGold: 40,
      durabilityLost: 3, injuriesGained: 0, causeOfDeath: null,
      commentary: 'The Brute falls.',
    };
    const html = renderResult(s, CONFIG);
    expect(html).toContain('The Brute');
    expect(html).toContain('40');
    expect(html).toContain('data-action="to-hub"');
  });
});

describe('renderGameOver', () => {
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
    // Task 6 renamed the track to `.meter` (spec §6.4/§6.0) and keeps the legacy class only
    // until Task 7 Step 3 drops it. Matched as a set so that removal is a one-line change.
    expect(classesOf(meterTag(html))).toEqual(expect.arrayContaining(['meter', 'timing-meter']));
  });

  it('renders the combat log', () => {
    const s = startFight(createGameState(1, CONFIG), CONFIG);
    s.combat.log = ['You strike (hit) for 13 damage.'];
    expect(renderFight(s, CONFIG)).toContain('You strike (hit) for 13 damage.');
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
    // role="application" tells assistive tech to stop intercepting keys and hand them to the
    // widget — which is only reachable, and only meaningful, if the widget can hold focus.
    // Without tabindex the role is unreachable AND suppresses browse mode for nothing, and
    // spec 8's focus-visible + 44px-target floor never applies to the meter at all.
    expect(meterTag(html)).toContain('role="application"');
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
    expect(html.indexOf('meter__zone--graze'))
      .toBeLessThan(html.indexOf('meter__zone--hit'));
    expect(html.indexOf('meter__zone--hit'))
      .toBeLessThan(html.indexOf('meter__zone--crit'));
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
      expect(zoneGeometry(renderFight(fast, CONFIG), name).size)
        .toBeGreaterThan(zoneGeometry(renderFight(slow, CONFIG), name).size);
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
    const drawnHalf = (s) => zoneGeometry(renderFight(s, CONFIG), 'crit').size / 2;

    expect(drawnHalf(charmed)).toBeGreaterThan(drawnHalf(plain));
    // The band the player sees is the band the fight pays out on. The 1e-4 nudge clears both
    // the 2-decimal percent rounding in the markup and float wobble, and is far narrower than
    // the gap to the hit edge, so only a genuinely misplaced edge can satisfy it.
    const half = drawnHalf(charmed);
    expect(resolveTiming(half * (1 - 1e-4), width, CONFIG, eff.critWindowMult)).toBe('crit');
    expect(resolveTiming(half * (1 + 1e-4), width, CONFIG, eff.critWindowMult)).toBe('hit');
    // …and the unequipped fighter's narrower band still matches their own resolver.
    const plainHalf = drawnHalf(plain);
    expect(resolveTiming(plainHalf * (1 - 1e-4), width, CONFIG, 1)).toBe('crit');
    expect(resolveTiming(plainHalf * (1 + 1e-4), width, CONFIG, 1)).toBe('hit');
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
        expect(resolveTiming(half * (1 + 1e-9), width, CONFIG, critWindowMult))
          .toBe(weaker[tier]);
      }
    });

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
      CONFIG.combat.meterPeriodMs.base + CONFIG.combat.meterPeriodMs.perTier,
    );
  });

  it('never drops below the configured minimum', () => {
    expect(meterPeriod(100, CONFIG)).toBe(CONFIG.combat.meterPeriodMs.min);
  });
});
