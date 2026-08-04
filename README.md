# Gold & Glory

_Death or glory, and a small administrative fee._

Gold & Glory is a browser-based, turn-based arena fighter with a faucet/sink economy. You're a fighter clawing your way up a corrupt fight circuit: win purses, but every fight wears down your weapon and your body, officials tax your winnings, and each new opponent hits harder than the last. Train, repair, heal, gear up, and bribe your way to the top — or go broke, or die trying.

There's no save file and no persistence between runs — every game is a single, self-contained climb that ends when you retire rich, get crowned champion, or die in the ring.

Third-party asset attributions: see [CREDITS.md](CREDITS.md).

## Gameplay Overview

- Between fights, you manage a single character from the Ludus (your hub): train stats, repair your weapon, heal injuries, buy gear, and optionally bribe the arena official to cut your tax rate for the next bout.
- Fights are resolved turn-by-turn with a timing-based meter: time your click to land a **crit**, **hit**, or **graze** — miss the window and your strike whiffs entirely.
- Four opponent tiers escalate in difficulty and payout, from the Brute up to the Champion, each with its own health, damage, and a real (if small) death risk at the higher tiers.
- A run ends one of three ways: you die in the ring, you become **Champion of the Circuit**, or you choose to retire with whatever gold you've banked.

## Key Features

- **Faucet/sink economy** — every purse is taxed by the arena, and every fight costs weapon durability and risks injury; training, gear, healing, and repairs all compete for the same gold.
- **Timing-based combat** — a sweeping meter and four actions (strike, heavy, block, feint) plus a press-the-attack follow-up window reward reading the fight, not just clicking fast.
- **Escalating opponents** — Brute → Journeyman → Veteran → Champion, each tier raising the stakes and the death risk.
- **Gear and training** — permanent stat training plus three gear pieces (Shield, Better Blade, Lucky Charm) that change how favorable the odds are.
- **Sponsorship** — win two fights and unlock a per-fight stipend, with a bonus for hitting a side objective.
- **Deterministic, seeded runs** — combat and RNG-driven events are seeded, so the same seed reproduces the same run.
- **Accessible by design** — keyboard-operable combat meter, ARIA-labeled HUD, and full reduced-motion support (see `docs/superpowers/specs`).

## Run it

```bash
npm install
npm run dev      # play locally
npm test         # run the logic test suite
npm run build    # production bundle in dist/
```

Other useful scripts: `npm run lint`, `npm run format`, `npm run test:coverage`. See [CI](.github/workflows/ci.yml) for the full quality-gate list.

## Architecture

- `src/config.js` — all balance values (single tuning surface).
- `src/rng.js` — seeded RNG for reproducible runs.
- `src/economy.js` — pure faucet/sink math.
- `src/combat.js` — pure combat resolution (timing, damage, turns, enemy AI).
- `src/state.js` — game-state factory + `HUB → FIGHT → RESULT → HUB (+ GAMEOVER)` state machine.
- `src/game.js` — orchestrator: effective stats, purchases, fight start/resolve, end states.
- `src/ui/` — render-to-string functions + DOM event wiring.
- `src/main.js` — bootstrap and game loop.

All game rules live in the pure core (tested with Vitest); the UI only reads
state and calls into the core.

## License

[PolyForm Noncommercial 1.0.0](LICENSE) — free for personal, educational, and other noncommercial use.
