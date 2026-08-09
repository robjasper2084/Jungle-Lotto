# Design QA - LottoMind Refined Arcade and Trivia

## Source truth

- User-supplied annotated browser screenshots for Arcade motion, Play + Learn, Quest Board, and dashboard Gear Drop.
- Requested direction: futuristic HUD treatment, clearer game artwork, repaired Quest Board, merchandise matching the Merch Store, native Trivia, and all Arcade games built into the app shell.

## Implementation comparison

- Arcade motion uses the existing video asset inside a cyan command-link HUD with status chips and a signal meter.
- Play + Learn keeps the LottoMind artwork and palette, increases artwork area and contrast, and uses a two-column narrow-screen grid.
- Quest Board is a stable two-by-two grid with four distinct real-art cards.
- Gear Drop renders products directly from `MERCH_ITEMS`, the same shared catalog and prices used by the Merch Store.
- Trivia Vault mounts its full five-mode engine directly at `/trivia-play`.
- All eight playable Arcade titles route through `/arcade/game` inside the persistent LottoMind shell. The selected title survives refresh.

## Interaction and safety checks

- Quick Play accepted keyboard number input, completed all ten questions, rendered results, saved a real local score, and unlocked the first-run badge.
- Signed-out Daily Vault loaded four choices per question, disabled pause, and remained score-only with a zero-credit wallet.
- GOTHTECHNOLOGY launched inside the in-app player, exposed accessible game controls, and remained selected after refresh.
- Server tests verify 5 completion credits, 10 credits at 80% accuracy, 20 credits for a perfect run, idempotency, and one claim per daily challenge.
- Clean console passes reported no errors on Trivia Vault and the in-app Arcade player.
- Reduced-motion rules preserve functionality without required animation.

## Intentional differences

- The old Quest Board subtitle was removed per the annotation.
- Earn-credit language was replaced with server-validation and single-claim language.
- Dashboard merch cards are catalog-backed so visible products and prices cannot drift from the Merch Store.
