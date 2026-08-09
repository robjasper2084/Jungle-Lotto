# Deployment instructions

1. From this folder, run `npm.cmd run build`, `npm.cmd test`, `npm.cmd run lint`, and `npm.cmd run typecheck`.
2. Serve the repository root and verify `/lotto%20mind%20refined/trivia-play`, all Arcade cards, and the `/arcade/game` in-app player.
3. Check narrow/mobile, desktop, keyboard-only, muted/unmuted, reduced-motion, exit confirmation, and all five modes.
4. Confirm the authoring route remains unlinked from player navigation and includes `noindex,nofollow`.
5. Confirm the artifact contains `data/manifest.json` and all seven category JSON files.
6. Run news-hub TypeScript and account tests. For secure Daily rewards, deploy the Supabase migration and Edge Function only after verifying authenticated and signed-out behavior in the target environment.
7. Deploy through the existing protected workflow only after explicit production approval.

Deploying static files alone does not enable credits. Without a reachable configured account API, Daily Vault automatically remains score-only. Global leaderboards and profile badge sync remain disabled.
