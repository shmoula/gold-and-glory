# Gold & Glory

*Death or glory, and a small administrative fee.*

A turn-based arena fighter with a faucet/sink economy. Climb a corrupt fight
circuit: win gold, but every fight wears your weapon and body while opponents
scale up. Train, repair, heal, gear up, and bribe officials to stay ahead — or
go broke, or die.

## Run it

```bash
npm install
npm run dev      # play locally
npm test         # run the logic test suite
npm run build    # production bundle in dist/
```

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
