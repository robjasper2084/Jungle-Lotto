Opening the homepage with the old `#current-drop` fragment skipped the cinematic hero. Fresh loads now start at the hero, and New Drop navigation opens the homepage; the explicit Explore the Drop action still scrolls to the drop section.

Disconnected launch-alert forms also remain disabled after programmatic submission, closing the client-side path that could re-enable a submit button. No subscription request is transmitted. Both regressions are included in the desktop/mobile Pages checks.

Validation: TypeScript, all 59 store tests, JavaScript syntax and asset validation, Astro production build, and desktop/mobile browser regressions covering first load, newsletter controls, loadout, music, and reduced-motion hero behavior.
