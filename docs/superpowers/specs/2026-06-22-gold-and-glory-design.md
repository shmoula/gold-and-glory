# Gold & Glory — Game Design Document (MVP)

**Date:** 2026-06-22
**Status:** Approved concept → MVP spec
**Genre:** Turn-based arena fighter with a faucet/sink economy
**Platform:** Web (HTML5 / JavaScript) — instant click-to-play, optimized for sharing
**One-liner:** *Death or glory, and a small administrative fee.*

---

## 1. Vision

You are a nobody gladiator clawing up a corrupt fight circuit. **The blood is real; the
business is a joke.** Fights are tense and lethal; everything wrapped around them — sponsors
hawking absurd products, officials you bribe, a commentator who mocks your death — is dark
comedy. Grounded stakes make players care; the satirical meta makes them screenshot.

**Design pillars:**
1. **The Squeeze** — you can never hoard. Costs scale with you; standing still means losing.
2. **Readable risk** — every choice (which fight, press the attack, bribe or not) is a clear gamble.
3. **Screenshot comedy** — the economy generates shareable absurdity (sponsors, death recaps).

---

## 2. Core Loop

```
Pick a fight (choose risk tier)
   → Fight it (turn-based: timing + push-your-luck)
      → WIN: gold + sponsor heat + loot   |   LOSE: injury, lost wager, maybe death
         → Spend gold to stay competitive (training, repair, heal, gear, bribes)
            → Opponents scale up → you MUST fight again
```

The **squeeze** is the engine: each fight earns gold but degrades weapon + body, while
opponents keep scaling. Sitting on gold = falling behind. Faucet/sink tension made physical.

---

## 3. Economy — Faucets & Sinks

### Faucets (gold in)
| Faucet | How it works | Design role |
|---|---|---|
| **Win a fight** | Payout scales with chosen risk tier (safe purse → death-match jackpot) | Primary income; player-controlled risk |
| **Sponsors** | Once "hot," a sponsor offers a recurring stipend + bonus objective ("win without blocking") | Steady income + comedy + behavior nudges |
| **Loot** | Occasional gear/scrap from tough wins | Variable reward; spikes excitement |

### Sinks (gold out)
| Sink | How it works | Design role |
|---|---|---|
| **Training** | Raise a stat; escalating cost per level | Long-term power; main gold drain |
| **Weapon repair** | Weapons lose durability each fight; broken = damage penalty | Recurring forced cost |
| **Healing (medicus)** | Injuries persist between fights unless paid off | Recurring forced cost; punishes reckless play |
| **Gear shop** | Buy weapons/armor to keep pace | Burst spending; power spikes |
| **Bribe the official** | Reduce arena tax on purse, lower opponent's opening advantage, or buy out a death-match clause | Signature comedic + strategic sink |

**Economic intent:** tuned to a deliberate *slight squeeze* — a skilled player progresses;
a greedy or careless one goes broke or dies. Net income should be positive but thin, so
every gold decision matters.

---

## 4. Combat — Turn-based + Timing/Risk

Each turn the player picks an action:
- **Strike** — reliable moderate damage
- **Heavy** — high damage, slower (enemy may interrupt)
- **Block** — reduce incoming damage, build a counter
- **Feint** — bait the enemy's block, set up a follow-up

A **timing meter** sweeps across a bar; clicking in the sweet spot upgrades the hit
(miss → graze → hit → crit).

**Push-your-luck:** after a successful strike, the player may **Press the Attack** for bonus
damage — but it drops their guard, giving the enemy an upgraded next turn. Every fight becomes
a string of small risk decisions that rhyme with the macro economy.

**Stats:**
- **Power** — outgoing damage
- **Guard** — incoming damage reduction + block effectiveness
- **Speed** — timing-window size + initiative (who hits first)

---

## 5. MVP Scope

**In scope (ship-able slice):**
- 1 arena, **4 opponents** escalating: tutorial brute → journeyman → veteran → boss champion
- Combat loop with timing + push-your-luck
- **Gold wallet HUD** (coin counter, always visible)
- **Training** — 3 stats (Power, Guard, Speed), escalating cost
- **Weapon durability + repair** sink
- **Gear shop** — ~3 buyable items (e.g., better blade, shield, lucky charm)
- **1 sponsor** faucet + **bribe-the-official** sink
- Injury/heal between fights
- End-states: **win the circuit**, **retire rich** (cash out early), or **die**
- Starter **balance table** (below)

**Out of scope for MVP (post-MVP roadmap):**
- Multiple arenas / world tour
- Multiplayer / async ghost-fights
- Real monetization (cosmetics, season pass) — hooks noted, not built
- Deep gear trees / crafting
- Narrative campaign / branching story

---

## 6. Starter Balance Table (first-pass, for tuning)

Currency: **gold (g)**. Numbers are starting points to playtest, not final.

**Fight payouts (faucet):**
| Opponent | Risk tier | Win purse | Death risk | Notes |
|---|---|---|---|---|
| Brute (tutorial) | Safe | 50g | None | Teaches loop |
| Journeyman | Standard | 120g | Low | Introduces durability pressure |
| Veteran | Hard | 280g | Medium | Gear check |
| Champion (boss) | Death-match | 700g | High | Circuit finale |

**Sinks (per use / per level):**
| Sink | Cost | Scaling |
|---|---|---|
| Train a stat | 80g (lvl 1) | ×1.6 per level |
| Weapon repair | 15g per durability point | flat |
| Heal injury | 40g per injury | flat |
| Gear: Shield | 200g | one-time |
| Gear: Better blade | 350g | one-time |
| Gear: Lucky charm | 150g | one-time |
| Bribe (reduce arena tax 20%→5%) | 60g | per fight |

**Sponsor (faucet):** unlocks after 2 wins → 30g stipend per fight + 50g bonus on objective.

**Squeeze check:** Arena tax = 20% of purse (5% if bribed). Weapon loses ~3 durability/fight
(~45g repair). With healing + training, a careful player nets ~+40–80g/fight early — enough
to climb, thin enough to hurt mistakes. Tune tax %, durability loss, and training scaling first.

---

## 7. Game UI (MVP)

- **Persistent HUD:** gold counter (animated tick on change), health, weapon durability bar.
- **Fight screen:** two combatants (side silhouettes / simple 2D), action buttons, timing meter,
  Press-the-Attack prompt, deadpan commentator text feed.
- **Hub/management screen between fights:** Train / Repair / Heal / Shop / Bribe / Next Fight,
  each showing cost vs. current gold so the squeeze is legible.
- **Result cards:** designed to be screenshotted (win recap, death recap with absurd cause-of-death line).

---

## 8. Tech Notes (for the eventual build)

- Vanilla JS or a light framework; single-page, no backend required for MVP.
- All balance values in one config object/JSON for fast tuning.
- State machine: `HUB → FIGHT → RESULT → HUB` (+ `GAMEOVER`).
- Deterministic-enough combat with seeded randomness for shareable runs (future: "share your seed").

---

## 9. Post-MVP / Monetization Hooks (noted, not built)

- **Cosmetic gladiator skins + arena themes** (ethical, non-pay-to-win).
- **"Sponsor pack" cosmetic tie-ins** — leans into the satire.
- **Seasonal circuits / leaderboards** for retention.
- **Shareable seeded runs + daily challenge** for viral loop (see marketing strategy doc).

---

## 10. Success Criteria (MVP)

- A new player understands the loop within the first (tutorial) fight, unprompted.
- Median session reaches at least the Veteran fight (loop is compelling enough to continue).
- At least one "screenshot moment" per run (death recap, absurd sponsor, big bribe gamble).
- Balance produces real tension: playtesters report going broke or dying at least once.
```
