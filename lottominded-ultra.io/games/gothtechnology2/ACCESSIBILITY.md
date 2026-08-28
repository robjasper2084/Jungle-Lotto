# Accessibility — conversion v2

Locally reviewed on 2026-08-28. This is implementation and browser-test evidence, not WCAG certification.

## Implemented

- Semantic landmarks, one page h1, descriptive titles, visible focus and Skip to content.
- Native search, menu, loadout, launch-alert, film and Experience Settings dialogs. Escape closes them; focus returns to the original trigger, including quick-view -> loadout -> alert transitions.
- Labeled radio/select/quantity controls; invalid variants cannot be saved. Status and error messages use live regions. Email consent is explicit.
- Desktop filters remain open and keyboard reachable. At 760px and below they become a native disclosure; removing a chip restores focus to its summary when the affected field is hidden.
- Shared 16px body text; 13–14px product metadata; generally 12–14px actions and 11–12px decorative diagnostics. Primary controls are at least 44px tall. Compact quantity buttons are narrower than 44px; further touch-device usability testing is recommended.
- Mobile product bar respects safe-area insets and hides while the option form or footer is visible. It moves focus to option selection.
- One Experience Settings dialog with background sound, reduced motion, decorative-motion pause and display quality/static image.
- System reduced motion and data-saving preferences take priority. Static artwork is immediately available; optional product viewers do not block shopping.
- Video posters/descriptions remain visible without playback. No automatic popup or initial film/audio request.
- Per the owner's later request, manually opened home/shop commercials start with sound. They have visible mute, pause, replay and close controls. Background ambience and inline films still begin muted; no sound starts on page load.
- Game wrapper retains ordinary navigation, standalone access and explicit Launch Game. No storefront scroll trap was introduced.

## Tested locally

The final 60-case storefront browser run had 57 passes, 0 failures and 3 deliberate duplicate-project skips. It covers keyboard skip navigation, dialog focus containment/restoration, Escape, search, mobile menu, filter disclosure/chips, product gallery/options, settings persistence, reduced motion, data-saving behavior, film controls and mobile sticky actions. A further two-test layout pass checked all nine widths and final captures.

The in-app browser was used to open a commercial, observe Pause/Mute and Replay states, toggle sound, close it and inspect an empty warning/error log. Automated Playwright separately verified actual media muted/paused/src state. Some in-app locator-evaluation calls timed out, and native screenshots had a scaling/clipping limitation; exact viewport evidence uses the requested Playwright suite.

Screenshots were inspected for readable copy, clipping, contrast, action hierarchy, media visibility and modal/footer overlap. See QA_REPORT.md for paths and the two unresolved original-game test failures.

## Still required

- NVDA with Firefox and Chrome on Windows.
- VoiceOver with Safari on macOS and iOS; TalkBack with Chrome on a physical Android device.
- Full contrast audit, 200%/400% zoom, forced colors, virtual-keyboard behavior and switch/voice input.
- Human review of final product alt text, film transcripts, captions for speech and audio description where needed. Current films have visible descriptions, not a certified caption track.
- Real assistive-technology testing of the original game, controller devices and final merchant checkout.

Do not interpret a passing browser test as a screen-reader audit or legal accessibility approval.
