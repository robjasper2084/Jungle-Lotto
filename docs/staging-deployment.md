# LottoMind Staging Deployment

## Current Status

No Vercel, Netlify, Cloudflare Pages, or other branch-preview project is configured in this repository. Step 0B therefore uses Mode C and records the staging URL as **Local only**.

The 2026-08-09 maintenance audit reconfirmed this as an explicit release blocker. A generated or uploaded artifact is not a hosted staging environment. Hosted staging may be marked `Pass` only after a separate preview URL is deployed, noindexed, visibly labeled, tested against isolated services, and recorded here and in `docs/upgrade-redesign-status.md`.

The focused maintenance artifact passed an 84/84 packaged-route smoke test and contains 1,589 files totaling 944.2 MiB under the 1,200 MiB Pages gate. That validates the package locally; it does not satisfy hosted staging.

The staging build is isolated from the GitHub Pages production workflow. It does not change `.github/workflows/pages.yml`, `main`, `gh-pages`, the production Pages project, or the production URL.

## Required Build Settings

Use these settings for any remote preview:

- Root directory: `lottominded-ultra.io`
- Build command: `node scripts/build-staging.mjs`
- Output directory: `dist-staging`
- Branch: `upgrade-redesign`

Do not assign the production domain to a staging project and do not promote a preview deployment to production.

## Mode A: Existing Branch Preview

Use an existing Vercel, Netlify, Cloudflare Pages, or equivalent integration only after confirming that its production project is not changed by preview configuration.

1. Enable branch previews for `upgrade-redesign` only.
2. Apply the required build settings above.
3. Leave every staging environment variable empty unless an isolated backend or Stripe test account has been provisioned and verified.
4. Confirm the generated preview has `noindex,nofollow,noarchive` before sharing its URL.
5. Record the preview URL in `docs/upgrade-redesign-status.md`; never record the production URL as staging.

## Mode B: Separate Preview Project

This is the preferred remote mode when an existing production integration cannot be isolated safely.

1. Create a new preview-only project in the selected provider.
2. Connect it to `robjasper2084/Jungle-Lotto` and allow deployments only from `upgrade-redesign`.
3. Set the project root, build command, and output directory exactly as documented above.
4. Do not attach production domains, production databases, production analytics destinations, live Stripe keys, or production webhooks.
5. If write testing is required, provision a separate staging backend and Stripe test-mode resources first.
6. Deploy, verify the banner and `noindex` metadata, exercise blocked-write tests, and then record the preview URL.

## Mode C: Local Preview

From `lottominded-ultra.io`:

```powershell
npm.cmd ci
npm.cmd run staging:build
npm.cmd run staging:test
npm.cmd run staging:serve
```

Open `http://127.0.0.1:8143/`. The local server serves only `dist-staging` with `Cache-Control: no-store`.

## Safety Configuration

The default artifact has all protected writes disabled:

- Live Stripe payments: disabled
- Production account mutations: disabled
- Real collectible redemptions: disabled
- Production analytics: disabled

Blocked operations reject with a staging-specific error and update an accessible live status. Read-only pages, games, local saves, prompt generation, local audio analysis, share-card previews, responsive testing, and accessibility testing remain available.

To enable limited test writes, copy only the variable names from `.env.staging.example` into the preview provider and supply values through its protected environment settings. Never commit an environment file.

An isolated backend is accepted only when `LOTTOMIND_STAGING_BACKEND_ISOLATED` is explicitly enabled and its URL is HTTPS, except for localhost. Stripe checkout remains blocked unless the build also receives a `pk_test_` publishable key and `LOTTOMIND_STAGING_STRIPE_TEST_MODE_VERIFIED` is explicitly enabled after checking the Stripe Dashboard is in test mode. The server behind that URL must create Checkout Sessions with Stripe test credentials and use test webhook endpoints.

Only Supabase publishable keys may be exposed to the browser. Never provide a Supabase service-role key, Stripe secret key, database password, private key, or other server credential to the staging build.

## Verification

Run `npm.cmd run staging:test`. It rebuilds the artifact, verifies the manifest, checks every injected page for the staging marker, banner, and robots metadata, checks same-origin asset references, starts the local server, visits every copied route, and proves protected writes are rejected before reaching production services.
