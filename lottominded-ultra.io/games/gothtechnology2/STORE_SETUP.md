# GOTHTECHNOLOGY // The Armory

Local cinematic store preview on branch feature/gothtechnology-cinematic-store. The original game remains intact. Payments, account creation, monetary rewards, and email delivery are not enabled by default.

## Run locally

Requires Node 24.15+ (verified with 24.16.0) and npm.

```powershell
npm.cmd ci
npm.cmd run dev
```

Open http://127.0.0.1:4180/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/ . Astro 7 starts a background dev service; use its dev status, dev logs and dev stop commands to manage it. Do not start a second server on an occupied port.

```powershell
npm.cmd run check:store
npm.cmd run test:store
npm.cmd run build
npm.cmd run test:store:browser
```

The production build is dist/. The original game entry remains index.html in the source checkout; the built dist/index.html is the store. The preserved game is served at legacy-game/index.html and embedded lazily by play/.

## Structure

- store/pages: home, shop, nine demo product pages, seven collections, lookbook, about, support, and play.
- store/commerce: demo cart and Shopify Storefront Cart API adapters.
- store/ui: dialogs, catalog filtering, cart, opt-in media, preferences.
- store/three: lazy atmosphere and optional model/image viewers.
- store/game: strict game/store message validation and cosmetic badges.
- store/content: editable demo catalog, original fighter associations, draft support copy.
- store/styles/armory.css: selected screenshot's typography and compact horizontal layout.
- store/public/media: optimized owner references and labeled campaign concepts.

## Defaults

Copy .env.example to .env only when configuring an integration. Keep credentials out of source control. Demo mode reprices saved carts from the catalog, supports variants and quantities, and never creates an order. A live provider must not silently fall back to demo data.

The 313 hoodie, LottoMind charm and Detroit embroidery remain the product references. Fashion portraits represent collection concepts, not newly added playable fighters. The final hoodie reverse side has not been supplied; no generated reverse is represented as verified product photography.

## Owner approval still required

Final products, photos, materials, sizing, inventory, shipping and returns terms, contact details, image permissions, commerce credentials, checkout domain, email service, and launch approval. Optional GLB product models are not supplied. This is a working local demo, not a completed merchant launch.
