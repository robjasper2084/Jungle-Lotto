# Render Free test service

This is an authoritative LOVE TAG test host for the real Swoop Detroit and separately packaged Elmwood Explorer maps. It does not deploy the storefront, replace GitHub Pages builds, or enable unrelated multiplayer transports.

Create a Docker Web Service from the public Jungle-Lotto repository, branch `upgrade-redesign`. Select **Free ($0)**, root directory `lottominded-ultra.io/games/gothtechnology2`, Dockerfile `love-tag-server/Dockerfile`, Docker context `.`. Health check: `/health`.

Set `ALLOWED_ORIGINS` to the exact game origins, comma separated, e.g. `https://robjasper2084.github.io,http://127.0.0.1:8224`. Do not use a wildcard or put private tokens in a game config. Render supplies the listening port. Docker's production entry is `dist/render.js`, excluding other game servers.

The image uses a 192 MiB JavaScript heap and `TAG_MAX_ROOMS=1`. One room supports the existing human/bot player options; a second room receives a clear busy error. These are test capacity limits, not production-scale hosting claims. All canonical physics bytes, map hashes, navigation and heights are retained through build-time binary extraction. Generated binary/metadata files are not checked in.

Local preparation: `npm ci` and `npm run build` in `../ride-core`; then `npm ci`, `npx tsc -p tsconfig.render.json`, and `node scripts/prepare-host-fixtures.mjs` here. Run `node tests/host-fixture.mjs`, `node --max-old-space-size=192 tests/host-memory.mjs`. Start with `PORT`, `ALLOWED_ORIGINS` and `TAG_MAX_ROOMS=1`, then `node --max-old-space-size=192 dist/render.js`.

For actual hosted SDK checks set `TAG_ENDPOINT` to the HTTPS Render URL and run `node tests/free-host-online.mjs`. It runs sequential full-length Classic and Spread rounds for both products, using independent SDK clients, validated tags, reconnect and rematch. `TAG_QUICK=1` runs Classic for both products, still with the canonical round length. This does not replace browser or separate-device checks. Evidence goes to `../docs/love-tag/evidence/free-host-online.json`.

Point only an isolated review package's `love-tag-config.json` at the endpoint until hosted browser verification passes. Free services may sleep/restart; rooms are in memory and do not survive process restarts. No paid plan or payment method is required by this setup. See current Render free-tier terms and limits before any production decision: https://render.com/docs/free.
