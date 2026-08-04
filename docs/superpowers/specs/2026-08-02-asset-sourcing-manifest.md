# Gold & Glory — Asset Sourcing Spike: Manifest

**Date:** 2026-08-02
**Status:** Spike record — candidate manifest for the visual-upgrade spec's pinned asset list
**Method:** Four parallel research agents surveyed game-icons.net, kenney.nl, opengameart.org,
and openclipart.org per the sourcing rules in `2026-08-01-visual-phase-decisions.md` (CC0
preferred; plain CC-BY with credits file; GPL/SA/NC/ND rejected). License reads are from page
metadata; a human eyeball pass on each pinned file is still owed before implementation.

## Headline

Stock sources cover **glyphs and props**; everything with **personality** (characters, scenes,
the chicken) must be hand-authored SVG in house style — exactly the fallback the decisions doc
reserved. No license-dirty asset made the manifest.

| Domain                  | Verdict                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| UI icons (16 slots)     | **Pin-able.** Full coverage from game-icons.net, one monochrome family, CC BY 3.0 + credits file       |
| Character portraits (5) | **Hand-author.** No coherent free set exists; near-misses fail style or license                        |
| Arena backdrop          | **Hand-author.** Nothing in register; best hits are components needing full composition anyway         |
| Stone-brick frame       | **Hand-author (CSS/SVG).** One structural reference pinned; rendering register wrong everywhere        |
| Props & gags            | **Mostly pin-able.** CC0 openclipart hits; chicken/sandal/sock are base material needing house restyle |
| Championship belt       | **Hand-author.** Zero matches anywhere                                                                 |
| Wood plank texture      | **Optional pin.** One genuinely matching CC-BY hand-painted texture found                              |
| Parchment texture       | **Keep existing CSS.** No candidate beats the current gradient                                         |

## 1. UI icons — game-icons.net (all CC BY 3.0, SVG, 512×512 monochrome)

SVG URL pattern: `https://game-icons.net/icons/ffffff/000000/1x1/{author}/{icon-name}.svg`.
Primary pick first; alternate second. No file is reused across two slots (anvil vs. anvil-impact,
shiny-purse vs. swap-bag, shop shield vs. guard shield, tax scales vs. bribe pouch are all
deliberately distinct so no icon means two things on screen).

| Slot            | Primary                                                               | Alternate                                            |
| --------------- | --------------------------------------------------------------------- | ---------------------------------------------------- |
| HUD purse       | Shiny purse (Lorc) (superseded by the landed `.coin` — not committed) | Coins (Delapouite)                                   |
| HUD health      | Hearts (Skoll)                                                        | Health normal (sbed)                                 |
| HUD durability  | Anvil (Lorc)                                                          | Anvil impact (Lorc — reserved for repair)            |
| HUD injuries    | Drop (Lorc)                                                           | Blood (Skoll)                                        |
| Sink: repair    | Anvil impact (Lorc)                                                   | Claw hammer (Lorc)                                   |
| Sink: heal      | Sticking plaster (Lorc)                                               | Hand bandage (Delapouite)                            |
| Sink: bribe     | Swap bag (Lorc)                                                       | Receive money (Delapouite)                           |
| Shop: shield    | Shield (sbed)                                                         | Round shield (Willdabeast)                           |
| Shop: blade     | Broadsword (Lorc)                                                     | Sword array (Lorc)                                   |
| Shop: charm     | Clover (Lorc)                                                         | Sock lineart (openclipart, PD — the "(A sock?)" gag) |
| Train: power    | Biceps (Delapouite)                                                   | Muscle up (Lorc)                                     |
| Train: guard    | Bordered shield (Lorc)                                                | Spiked shield (Delapouite)                           |
| Train: speed    | Boots (Lorc)                                                          | Sprint (Lorc)                                        |
| Ledger: purse   | Coins pile (Delapouite)                                               | Gold stack (Delapouite)                              |
| Ledger: tax     | Scales (Lorc)                                                         | — (sole canonical scales icon)                       |
| Ledger: sponsor | Shaking hands (Delapouite)                                            | Crossed swords (Lorc)                                |

Icon pages live at `https://game-icons.net/1x1/{author}/{icon-name}.html`.

**Confirmed non-existent** (hand-author if the gag is wanted; substitutes above are safe):
leech icon (the "We have leeches!" joke), winged boot.

**Credits obligation:** every game-icons.net icon requires a credits-file line:
`"{Icon name}" icon by {Author}, from game-icons.net, CC BY 3.0
(https://creativecommons.org/licenses/by/3.0/)`.

## 2. Character portraits — hand-authored fallback (all 5)

Player, The Brute, The Journeyman, The Veteran, The Champion. Surveyed packs fail on set
coherence (zero packs cover more than one slot), style (pixel, painterly fantasy,
anime-adjacent, B&W sketch, engraving, flat-vector-modern), or license (the one comedic B&W
pack has a disputed CC-BY/CC-BY-SA conflict — rejected). Kenney has no gladiator/barbarian/Roman
content at all. **Verdict: five hand-authored SVG portraits in house style.**

## 3. Scene art

- **Arena backdrop (hand-author).** No cartoon Roman arena interior-with-crowd exists in any
  surveyed library. Raw components exist (openclipart `4079` exterior silhouette PD;
  `22519` abstract crowd CC0) but composing them equals hand-authoring effort.
- **Stone-brick frame (hand-author as CSS/SVG).** Structural reference only: "Carved Stone
  Border", openclipart.org/detail/234819, PD, Arvin61r58 — right composition, wrong (soft-shaded)
  rendering register.
- **Wood plank texture (optional pin):** "Handpainted Wood", opengameart.org/content/handpainted-wood,
  **CC-BY 3.0, credit "PamNawi"**, 1651×1651 seamless PNG. Visually verified: inked plank outlines
  - painterly grain, matches register; candidate upgrade for the HUD beam over the CSS gradient.
    Backup (unverified): "Simple Seamless Hand Painted Wooden Planks Texture" (kinnybean, CC-BY 3.0).
- **Parchment texture: keep existing CSS.** Best candidate has a baked-in photographic torn-edge
  vignette that fights the flat hand-drawn register.

## 4. Props & gags — openclipart (all CC0/Public Domain, SVG + PNG sizes)

| Slot                                  | Verdict                                    | Pick (detail page)                                                                    | Notes                                                                                                |
| ------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Rubber chicken (timing cursor, 40×48) | **Hand-author final; CC0 bases available** | Chicken Round Cartoon `26012` (bloodsong); alt Cartoon Chicken `336590` (rockefeller) | Neither is a _rubber_ chicken; legibility at 40×48 unverified. Hero asset — author it in house style |
| Roman sandal                          | Hand-author (base available)               | feet in sandals `36859` (jonadab)                                                     | All candidates read modern, not caligae                                                              |
| Sock(s)                               | Pin as base, distress in-house             | Long sock `334552` (Oltarus); alt Sock coloured `264100` (frankes)                    | Outline silhouette suits the hanging-banner use; add holes/stains in-house                           |
| Confetti                              | **Pin**                                    | organized confetti `148675` (10binary)                                                | Recolor via SVG to palette                                                                           |
| Championship belt                     | **Hand-author**                            | —                                                                                     | Zero matches on all sources                                                                          |
| Gold coin pile                        | **Pin**                                    | Pile of Golden Coins `43969` (J_Alves); alt Gold Coins Illustration `228358` (GDJ)    | Character composited separately                                                                      |
| Banana peel                           | **Pin**                                    | Banana Peel `2774` (Gerald_G)                                                         | Purpose-built slip gag                                                                               |
| Cactus (bonus)                        | **Pin**                                    | Cactus `169087` (Julianvb98)                                                          | Sole style-appropriate candidate                                                                     |

Detail pages: `https://openclipart.org/detail/{id}`; downloads: `https://openclipart.org/download/{id}`.

## License obligations rollup

- **CC BY 3.0 (credits file required):** all game-icons.net icons; "Handpainted Wood" (PamNawi)
  if pinned.
- **CC0/Public Domain (no obligation):** every openclipart pick.
- **Nothing GPL/SA/NC/ND** entered the manifest; one disputed-license portrait pack was rejected
  outright.

## Hand-authored SVG workload implied by this manifest

5 portraits, arena backdrop, stone-brick frame treatment, rubber chicken, championship belt,
Roman sandal, plus optional gag icons (leech, winged boot). Everything else is sourced stock +
in-house restyling (sock distressing, confetti recolor).
