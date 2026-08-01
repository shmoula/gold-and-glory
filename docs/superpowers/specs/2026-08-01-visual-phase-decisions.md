# Gold & Glory — Visual Phase: Decisions Locked Ahead of the Spec

**Date:** 2026-08-01
**Status:** Decisions record — input to the (not yet written) visual-upgrade spec
**Context:** The 2026-08-01 session reviewed four reference images (Fight, Result, Game Over,
Hub — hand-drawn cartoon arena style) and locked the following directions so the visual-phase
brainstorming starts from answers, not questions. The cleanup work that precedes the visual
phase is specified separately in `2026-08-01-cleanup-decisions-design.md`.

1. **Laws win over references.** Where reference art conflicts with the design system's Laws
   (rainbow color-only meter, text floating on the backdrop), adapt the reference into the
   system: gold-ramp zones get crayon-scribble *texture*, floating labels get small
   parchment/wood plates. The §8 accessibility floor stays ship-blocking.
2. **Adopt the reference fight composition.** Meter → actions → log flow top-to-bottom in the
   center column; PRESS THE ATTACK becomes the big blue commit arrow bottom-right. DOM order
   stays reading-order-clean; the grid test guards the breakpoints.
3. **Injuries HUD: icons + numeral + pips.** Blood-drop icon, pips, and the numeral together.
4. **Asset scope: full pack.** Chicken, player portrait, 4 opponent portraits, arena backdrop +
   stone-brick frame treatment, HUD/sink/shop/training/ledger icons, ending illustrations,
   death-screen dressing (sandal/socks/confetti), plus §6.4's full freeze feedback
   (PROGRESS items 17 and 27 resolve here — the assets get made, not cut).
5. **Asset acquisition is Claude's job, free assets only.** CC0 preferred; CC-BY acceptable with
   a credits file; no GPL/NC/ND. Where stock cannot match the hand-drawn register, hand-authored
   SVG in a consistent house style is the fallback. **The sourcing spike is the first task of the
   visual phase** — survey game-icons.net, Kenney, OpenGameArt, openclipart; pin real files and
   license obligations into the visual spec before implementation.
6. **§10's zero-asset rule survives:** every asset remains swappable content with a structural
   fallback (silhouette wells, ink cursor, empty icon wells).

Gap analysis from the session (current game vs. references), for the future spec's use: the
shipped system has the right skeleton (parchment posters + tape, wood planks, commit-blue,
gold-ramp meter, deadpan snark); the distance is (1) the illustrated arena-with-crowd stage and
stone-brick frame, (2) per-screen parchment title plaques overlapping the HUD beam, (3)
iconography everywhere, (4) character/scene art, (5) hand-drawn texture on surfaces, (6) the
fight-screen composition.
