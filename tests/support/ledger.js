// tests/support/ledger.js — DOM readers for the §6.6 ledger, shared by the two suites that read it.
//
// `dtLabel` was defined verbatim in both tests/render.test.js and tests/main.test.js: one to read
// the rendered card, one to hold the live-region announcement to the card's own words. Two copies
// of the same reader is the exact duplication `FOCUSABLE` moved into this directory to prevent —
// and a divergence here is worse than most, because both copies would still pass while describing
// different rows.
//
// A module of its own rather than an export from `./screens.js`: that file builds the whole
// 11-screen fixture matrix at import time (config, state machine, seeded RNG, four played-out
// combat turns), and tests/main.test.js deliberately runs with `requestAnimationFrame` stubbed and
// `Math.random` pinned. Pulling the matrix in for a four-line DOM reader would import a game's
// worth of module-level side effects into that setup.

// A ledger row's label: the snark aside stripped off, and — since Task 5 — tolerant of the optional
// leading `.icon-well` the purse/tax/sponsor rows carry (§6.6's amendment). Reading `firstChild`
// (the old approach) broke the moment a row gained a leading element node, so this reads by
// content, not position — and it is a clone-and-remove rather than a string subtraction, so it
// stays correct even if a label ever happened to contain its own aside's text, or the row carried
// more than one aside.
export const dtLabel = (dt) => {
  const clone = dt.cloneNode(true);
  clone.querySelector('.snark')?.remove();
  return clone.textContent.trim();
};
