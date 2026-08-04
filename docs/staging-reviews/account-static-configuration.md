# Static Account Configuration Review

## Scope

- Upgrade branch: `upgrade-redesign`
- Affected route: `/redeem.html`
- Staging URL: Local only (`http://127.0.0.1:8321/redeem.html`)
- Production URL: unchanged (`https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/`)

## Visual Comparison

- Current staging desktop: [redeem--desktop.png](account-static-config-assets/redeem--desktop.png)
- Current staging mobile: [redeem--mobile.png](account-static-config-assets/redeem--mobile.png)
- v1 desktop baseline: [redeem--desktop.png](../visual-baseline/v1/redeem--desktop.png)
- v1 mobile baseline: [redeem--mobile.png](../visual-baseline/v1/redeem--mobile.png)

The Redemption layout, typography, controls, and black, gold, and cyan identity are unchanged. Staging adds its required noindex safety banners and now accurately says that production account services are configured but disabled in the preview. That copy change is intentional.

## Functional Review

- All static account clients load the public runtime configuration before the account service.
- The Redemption route now boots with the same configured Supabase client as Account and Memberships.
- No secret or service-role credential is present in the browser configuration.
- Staging continues to block production account writes and real redemptions.
- Production-origin CORS and the signed-out account snapshot were verified without mutating account data.

## Verification

- Collector Access and recovery tests: 7/7 passed.
- Site validation: 17 HTML files passed.
- Release audit: 7/7 groups passed.
- Staging safety: 12/12 passed; 26 noindex pages and 592 same-origin references verified.
- Source/staging route matrix: 156/156 passed at desktop, mobile, and tablet sizes using fresh local ports.

## Approval Status

Ready for next phase. Production approval remains **Not approved**.
