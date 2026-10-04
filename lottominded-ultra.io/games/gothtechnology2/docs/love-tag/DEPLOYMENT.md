# LOVE TAG — local run and authorized staging procedure

Not deployed. `internet_staging_tested=false`. No hosted endpoint, authorized credentials, paid provisioning, or separate-network test devices have been supplied. The Docker/proxy examples are prepared, not executed.

## Local Windows commands

Use PowerShell and Node 24.16.0. These commands retain the normal published game folders and create a separate review package.

```powershell
Set-Location C:\Users\digit\Documents\phone\_goth_swoop_release_20260916\lottominded-ultra.io\games\gothtechnology2\ride-core
npm ci
npm run build
node --experimental-transform-types --test tests/tag.test.ts

Set-Location C:\Users\digit\Documents\phone\_goth_swoop_release_20260916\lottominded-ultra.io\games\gothtechnology2\love-tag-server
npm ci
npm run build
npm start
```

In a second terminal:

```powershell
Set-Location C:\Users\digit\Documents\phone\_goth_swoop_release_20260916\lottominded-ultra.io\games\gothtechnology2
node scripts/build-love-tag-preview.mjs
node scripts/serve-love-tag-preview.mjs
```

In a third terminal, with the real service running:

```powershell
Set-Location C:\Users\digit\Documents\phone\_goth_swoop_release_20260916\lottominded-ultra.io\games\gothtechnology2\love-tag-server
npm run test:online
```

Review entries:
- http://127.0.0.1:8212/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/arcade/swoop-detroit/
- http://127.0.0.1:8212/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/arcade/elmwood-explorer/elmwood.html

Open LOVE TAG, choose Classic or Spread, then Play offline or Create online room. The host copies the invitation. The second player opens the matching product's invitation, opens LOVE TAG, and joins with its code. Ready is sent after the verified arena loads. Only the host starts/rematches. Back to game exits the session and restores normal riding.

The server listens on port 8211 and supports both products in isolated private rooms. HTTP health/code lookup and Colyseus matchmaking share the WebSocket port. Guest sessions have no permanent account identity. The reconnect token owns the existing seat for 20 seconds; do not publish it. Room codes expire after two hours. Private codes are invitations, not passwords or public discovery.

## Authorized internet staging

1. Complete remaining local/browser gates in STATUS.md before release. Capture source hashes and the two stage receipts; archive the last-good static packages and server image tag outside the live path.
2. From `lottominded-ultra.io/games/gothtechnology2`, build the portable snapshot using `docker build -f love-tag-server/Dockerfile -t love-tag:REVIEW-REVISION .`. This requires Docker and its image pull and has NOT RUN here.
3. Supply environment values based on `.env.example` through the hosting provider's secret store. Set exact HTTPS client origins and a random metrics secret. Never put the metrics secret or reconnect tokens in public runtime JSON, invitations, logs, or Git.
4. Terminate TLS with a valid certificate and configure the persistent proxy using `proxy.example.conf`. Proxy all matchmaking paths and WebSocket upgrade requests. Do not deploy to an ordinary short-lived HTTP function without persistent-room support. Retain 3-second ping / 2-missed-ping handling and at least 75-second idle proxy timeouts.
5. Update EACH game's `love-tag/config.json` with `{"serverUrl":"https://YOUR-AUTHORIZED-MATCH-HOST","version":"heart-rush-1"}`. It is fetched at launch, not baked into JavaScript. Invite parameters cannot override it. An empty production endpoint explains that Online is unavailable; offline play remains explicit. Localhost fallback is limited to a locally hosted page.
6. Publish authorized staging static packages under their existing nested arcade paths. Serve runtime config with `Cache-Control: no-store`. Change package revision/cache keys when rolling a client build. Keep the fixture hash/build version aligned with the server; incompatible builds are rejected with an update message.
7. Verify GET `/health`, actual HTTPS-to-WSS room creation/join, origins, heartbeat and reconnect. `/ops/metrics` requires `Authorization: Bearer ...`; also restrict it by an operations-network proxy rule. Never expose operational metrics publicly.
8. From separate devices/networks complete Classic and Spread on BOTH entries, including human input, tags, results, rematch, five-second reconnect, expired grace, and unavailable-service recovery. Record H01–H04 and screenshots. Until then do not claim internet availability.

## Draining / rollback

Stop new matchmaking at the proxy, wait for active rooms to finish, then send SIGTERM (graceful Colyseus shutdown). A restart loses in-memory private rooms; the UI explains session loss and permits a fresh room or explicit offline play. This is a single-process reference host; horizontal scaling/persistent room migration/public matchmaking are separate work.

Rollback both game packages and the matching fixture-compatible server image together. Restore the previous public runtime config, invalidate changed asset/cache revisions, verify health plus create/join, and retain the failed staging receipts/logs. The user subsequently authorized static GitHub Pages publication. That does not provision or verify the dedicated server.
