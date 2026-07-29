# Games Page Return And News + Events HUD Review

## Scope

- Branch: `upgrade-redesign`
- Implementation commits: `f9eaf51`, `9ab9d20`, `6a044e1`
- Staging URL: `http://127.0.0.1:8295/`
- Routes reviewed: `/features-app.html` and the shared News + Events dialog opened from `/arcade.html`
- Viewports: `1440x900`, `768x1024`, and `390x844`

## Production Baseline

- [Features desktop](../visual-baseline/v1/features-app--desktop.png)
- [Features tablet](../visual-baseline/v1/features-app--tablet.png)
- [Features mobile](../visual-baseline/v1/features-app--mobile.png)

The v1 captures show the original Guardian commercial at page entry. The restored staging page keeps that commercial and adds the complete post-entry Games destination.

## Staging Captures

- [Games hero desktop](features-return-hud-assets/features-app-top-1440x900.png)
- [Games hero tablet](features-return-hud-assets/features-app-top-768x1024.png)
- [Games hero mobile](features-return-hud-assets/features-app-top-390x844.png)
- [Games directory desktop](features-return-hud-assets/features-app-1440x900.png)
- [Games directory tablet](features-return-hud-assets/features-app-768x1024.png)
- [Games directory mobile](features-return-hud-assets/features-app-390x844.png)
- [News + Events HUD desktop](features-return-hud-assets/news-events-hud-1440x900.png)
- [News + Events HUD tablet](features-return-hud-assets/news-events-hud-768x1024.png)
- [News + Events HUD mobile](features-return-hud-assets/news-events-hud-390x844.png)

## Improvements

- Restored `/features-app.html` as a complete Games destination instead of redirecting it to the Arcade overview.
- Kept App and Arcade as distinct overview pages and added Games as a first-class generated route.
- Restored the Guardian hero film, particle figure, searchable and swipeable seven-game directory, filtering, sorting, game controls, and responsible-entertainment language.
- Expanded News + Events from a small route picker into a clear two-channel HUD with stronger hierarchy, descriptions, and a visible close control.
- Preserved the black/navy foundation with gold, cyan, and violet accents, original game art, Guardian identity, and Detroit music-technology character.

## Regressions

- None found in the reviewed captures.
- No horizontal overflow, console errors, page errors, or broken same-origin assets were observed.
- A mobile HUD rail initially crossed the heading and was corrected before this review.

## Features Intentionally Removed

- None in this task.

## Features Unintentionally Lost

- None found.

## Accessibility Findings

- The News + Events surface remains a labeled native dialog.
- Both destination cards are links with descriptive accessible names.
- The close control has an explicit accessible label.
- Keyboard focus styling remains visible, and mobile content fits within the viewport.

## Performance Findings

- The restored hero film retains metadata-only preload and managed playback behavior.
- Directory artwork remains lazy-loaded.
- The HUD adds no media or third-party dependency.

## Recommended Corrections

- No blocking corrections.
- A future media pass can produce a smaller hero-film encode without changing the restored composition.

## Approval Status

Ready for next phase.

Production remains unchanged and is not approved by this review.
