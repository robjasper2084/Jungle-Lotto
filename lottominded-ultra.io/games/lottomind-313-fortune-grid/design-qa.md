# Design QA — Illustrated Detroit Board Restoration

## Comparison target

- Source visual truth: `C:\Users\digit\AppData\Local\Temp\codex-clipboard-38b63202-8f72-49a5-8e22-1675db3caf02.png`
- Browser implementation: `output/design-qa/restored-final-1440x939.png`
- Full comparison: `output/design-qa/reference-vs-restored-final.png`
- Focused comparison: `output/design-qa/focused-reference-vs-restored.png`
- Mobile evidence: `output/design-qa/restored-mobile-390x844.png`

## Normalization

- Reference pixels: 1440 × 939.
- Browser CSS viewport: 1440 × 936 at the desktop comparison breakpoint.
- The in-app browser screenshot backend returned a tiled 1893 × 1248 capture. Its 1080 × 702 rendered tile was isolated and normalized to 1440 × 939 for equal-size visual comparison.
- Mobile CSS viewport: 390 × 844; its 293 × 633 rendered tile was normalized to 390 × 844.
- Reference state: Player 1 at Rippleworks Lab with Signal 7.
- Implementation state: Player 1 at Transit Junction with Signal 8 and a matched-cube bonus.
- The deterministic roll changes content, but not the map composition or HUD layout being evaluated.

## Evidence

### Full view

The implementation matches the selected composition: illustrated nighttime Detroit artwork, rounded gold-and-cyan circuit, venture spaces, special gateways, LottoMind mascot, street and landmark labels, top navigation, camera buttons, and right-side property HUD. Major region proportions and crop match after density normalization.

### Focused regions

`focused-reference-vs-restored.png` compares the map and HUD separately. Typography, spacing, purple/gold tokens, panel borders, artwork crop, route geometry, label treatment, and control styling match. HUD values and destination content differ only because the captured roll is different.

## Required fidelity surfaces

- Fonts and typography: matching serif display headings and compact sans-serif UI hierarchy; no actionable wrapping or truncation drift.
- Spacing and layout rhythm: matching desktop playfield/HUD split, panel spacing, route scale, label density, and control placement.
- Colors and visual tokens: matching near-black, purple, gold, cyan, white, and district accent treatments.
- Image quality and asset fidelity: the exact existing Detroit artwork, mascot, gateway, token, and venture assets are used; no placeholders or approximate redraws.
- Copy and content: matching game title, safety language, camera controls, player resources, Signal Strip, and property-action structure. Random match values differ as expected.

## Findings

- No actionable P0, P1, or P2 visual differences remain.
- P3: the browser capture shows a vertical scrollbar while the supplied reference crop does not. This is expected from the live scrollable HUD and does not change the layout or controls.

## Comparison history

1. Initial restored comparison matched the layout but exposed mis-encoded separators in three canvas labels.
2. Replaced the affected characters, rebuilt, reloaded the local route, resumed the saved match, and captured the corrected implementation.
3. Final full-view and focused comparisons found no remaining P0/P1/P2 issues.

## Interaction and browser checks

- Setup and launch: passed.
- Two-cube roll and animated movement: passed.
- Player/Overview camera controls: passed.
- Save/reload/resume: passed.
- Four local players: passed.
- Mobile 390 × 844 stacked layout: passed without horizontal overflow.
- Browser console warnings/errors: none.

final result: passed
