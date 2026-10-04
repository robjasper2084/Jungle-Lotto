# 2000 Mack production studio and retail interiors

Local implementation, October 3, 2026. Open the latest Swoop preview at http://127.0.0.1:4181/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/arcade/swoop-detroit/ and choose **GothTech Studio · 2000 Mack** in Free ride. Both ports use the same package. This starts on the green stage and opens the camera/capture panel. The existing riding runtime remains Three.js, Rapier and Digital Static RideCore.

## Spaces

- **Studio:** a continuous curved green cyclorama and talent marks; eight overhead LED units on a suspension grid; two cinema cameras with lenses, matte boxes, field monitors and weighted tripods; two softboxes; boom microphone; V-flats; director chair; edit/color/audio desk with dual monitors, keyboard, speakers and workstation; illuminated makeup mirror and vanity; spare backdrop rolls; rolling equipment cases and a cable protector.
- **GothTechnology:** an open central doorway and glazed display windows, dressed mannequins, hanging garments, folded apparel, cap shelves, fragrance/accessory island, staffed-counter furniture and POS model, original official catalog concept images and ceiling track lighting. The existing online catalog and checkout links retain their concept/availability status.
- **Serengeti:** framed original supplied artwork, illuminated window exhibitions, print browser cabinets, archival sleeves, reading books, lounge furniture, packing tubes, plants and a service counter. Original images retain their aspect ratios.

The mapped shell, 2000 Mack exterior identity and shared loading entrance are retained. Interior fixtures have matching collision proxies. The loading entrance, central riding aisle, talent marks and both existing dismount/walk paths stay clear. The new rooms are an original fictional conversion, not a claim about the actual building's tenancy or equipment.

## Capture

The studio panel supplies Ride camera, Studio wide, Green screen stage, Editing + sound desk, Makeup + wardrobe, GothTech storefront/showroom and Serengeti storefront/print shop views. **Take studio photo** creates a PNG preview with a persistent download link. **Record studio video** captures the current rendered camera, silently, for up to 30 seconds or 32 MiB, and provides a download link. Recording stops on leaving the studio, opening a menu or pausing. No external camera, microphone, upload or account connection is needed. Canvas export resolution follows the current game rendering resolution.

## Reference and provenance

Google Images was directly browsed for green-screen cyclorama studios and streetwear boutique interiors. Reference directions were drawn from:

- [Giggster: 25 ft green-screen cyc wall](https://giggster.com/listing/25ft-green-screen-cyc-wall-great-for-music-video): green sweep, suspended fixtures, weighted light stands and director seating.
- [Peerspace studio reference](https://www.peerspace.com/pages/listings/61f04b80bdb172000d3b9e5a): studio equipment spacing and camera/softbox arrangement.
- [APB Jersey City](https://www.apbstore.com/pages/apb-jersey-city): hanging streetwear, timber fixtures, clear customer aisle and display density.
- [KROFT retail displays](https://www.kroft.co/products/ceiling-clothing-racks-displays): minimal metal rails and merchandise presentation.

These references are for layout/modeling ideas; no Google image is embedded or redistributed. Geometry, lettering and furniture were authored in Blender. Catalog photos come from the existing GothTech catalog. Serengeti images come from the existing `art/route-gallery` sources. Editing monitors reuse the original Higgsfield Detroit cover, job `730c61ee-411c-491a-9ed6-f4d4dd4dd1f0`. The subsequent texture pass used two new atlases within the user's explicitly approved 0.5-credit allowance.

## Authoring and reproduction

Editable, texture-packed masters: `Mack_Production_Studio.blend`, `GothTech_Retail.blend`, `Serengeti_Retail.blend`. Original incoming GLBs are retained in `originals/`, and the earlier `art/atwater/Mack_GothTech_Studio.blend` master is unchanged. Authoring GLBs are retained beside the masters. The independent generator `../../scripts/build_production_interiors.py` uses Blender 5.2.1 LTS's built-in modeling, text, material and glTF exporter features. It rebuilds the warehouse shell with the dummy work tables omitted, without saving over the original master.

Run Blender in background mode with `--python scripts/build_production_interiors.py` from `swoop-source`, then run `node scripts/optimize_interiors.mjs <asset-tools-directory>`. The optimizer uses the already installed free glTF Transform 4.5.1 and sharp 0.35.5 tools; it reads authoring exports, welds/prunes redundant data and resizes embedded original images to at most 768 pixels. The shipping GLBs need no additional compressed-geometry decoder.

Unity 6000.3.24f1 and the free [Unity glTFast 6.20.0 importer](https://docs.unity3d.com/Packages/com.unity.cloud.gltfast@6.20/manual/index.html) were used for independent content/scale/texture validation. The existing free Animation Rigging 1.4.1 package remains available in the same review project for the previously improved companion animations. The browser game has not been ported to Unity.

Review assets and scene: `../animation-polish/Unity/Assets/Studio/ProductionStudioReview.unity`. Run **Swoop → Review production studio and stores**, or batch `-executeMethod SwoopStudioReview.Build`. The script imports each shipping GLB, requires geometry and original-image materials, measures physical bounds and saves `Unity/studio-review.json`.

Build the local package with `node scripts/build-swoop-detroit.mjs` from `gothtechnology2`. Stop the loopback preview before package promotion on Windows, then restart `node scripts/serve-swoop-preview.mjs` from the same directory. The packager preserves the previous package in `.game-builds`.

## Verification

- TypeScript and local packaging passed.
- The existing regression suite passed 418 tests. Final focused layout/destination checks passed four tests after the additional camera, microphone and chair collision proxies. They sample the actual shared dismount routes, rider/dog aisle clearance, interior spawns and camera locations in the mapped coordinate transform.
- Unity successfully imported all finalized shipping GLBs, verified metre-scale bounds and retained the studio monitor, 19 merchandise texture materials and six gallery artwork textures. Its process exited successfully. The review is headless content validation.
- The four packaged GLBs match their source-export SHA-256 hashes.
- Browser render, capture, layout and screenshot evidence is saved in the checkout's `output/studio-retail-20261003/` folder.

This is a local build. No commit, push or production deployment was performed. Physical phone, gamepad and VR testing is outside this interior pass.

## Screens, flooring and LottoMind

Stone lobby floors, a walnut promenade, brass borders and charcoal work-bay concrete use metre-scaled skins. The curved green sweep retains its chroma flooring. Two 8 × 4.5 metre screens face one another. Open **Wall screens · movies + live** and press Play. Both start muted. Programs include the original 12-second GothTech promo, supplied Detroit commercial and [Big Buck Bunny](https://peach.blender.org/about/), with its CC BY 3.0 attribution and full credits. You can play a local MP4/WebM without uploading it.

The default live wall uses the [official hls.js public Mux demo](https://github.com/video-dev/hls.js/blob/master/tests/test-streams.js): a rolling movie-and-clock broadcast. It is labeled a demo. LIVE appears only while playing a playlist marked live; paused content reads PAUSED. Custom direct HTTPS HLS/MP4/WebM sources require cross-origin permission. Leaving the room or hiding the page pauses decoding/buffering. Free hls.js 1.7.3 is vendored with its license; the downloaded npm archive's SHA-512 integrity was verified.

The fictional **LottoMind Mack Avenue store**, mapped building OSM 379485650, has brick upper storeys, a lit fascia, glazed windows, entrance canopy, stone/walnut floors, app kiosks, POS counter, receipt printers, card readers, practice-number wall, writing desks, slips, pens, plants, lighting and an arcade cabinet. Google Images references included [Somerville lottery kiosks](https://experiencesomerville.com/lottery/lottery-kiosks/). The central entrance aisle stays clear. The store links to the existing LottoMind web app and official Michigan Lottery. Its six-of-47 practice picker/draw has no wagers, real tickets or prizes and makes no prediction claim.

## Photo-referenced 1980s cabinets

The six user-supplied images are retained in `cabinets/references/`: TRON, Phoenix, Tapper, Nintendo-style and other classic uprights. They informed the side profile, overhanging marquee, recessed CRT, angled control deck, continuous colored T-molding, twin coin slots, screws, reject buttons, toe plate and service feet. Reference photographs are not used as flat cabinet skins. Neon-grid/robot vinyl and marquees are original artwork for the assigned games.

Complete editable, texture-packed standalone Blender masters and GLBs:

- `Arcade_2084_Static_Wave.blend`: cyan trim and twin joysticks.
- `Arcade_Robot_Rahbe.blend`: orange trim and one joystick.
- `Arcade_Underground.blend`: lime trim and one joystick.

These include chrome shafts, ball tops and spring buttons. Room exports include bodies and sockets; animated Three.js hardware supplies moving sticks/buttons during play. The two studio cabinets run the original **2084 Static Wave** and **Robot RAHBE: Vault Rush**. The store cabinet runs the original **ROBOT RAHBE: Underground**, inside same-origin screen iframes. The first stick moves, climbs or jumps using each game's original input map. The second 2084 stick aims with I/J/K/L. Physical buttons send fire and jump/bomb. Keyboard and accessible console buttons are available. Escape/Leave cabinet stops the embedded game and returns to riding. Query-scoped embedded mode allows parent joystick focus without pausing; standalone game behavior remains intact.

Free ride shortcuts: **Studio arcade · 3D joysticks**, **LottoMind store · app + play**, **LottoMind arcade · Underground**. Cabinet games are DOM iframes: parent studio PNG/video capture includes the body but does not composite embedded gameplay. Wall movies use real WebGL VideoTextures and can be captured when the media host permits it.

## Higgsfield and reproduction

Completed gpt_image_2_5 jobs `85ee3f5e-7072-45c9-8ded-12276335c381` and `6cbd9464-03bd-4aa3-991e-d5ed32a6187a`, each estimated at 0.25 credits within the approved 0.5 total. Saved atlases, cropped 768px tiles and provenance are in `higgsfield/`. Skins: walnut, concrete, plaster, cotton, travertine, brass, green linen and Detroit brick. Normal maps are lightweight image-gradient approximations, not measured scans.

Run `prepare_studio_media.mjs`, then `prepare_cabinet_art.mjs` with the isolated asset-tools directory. Run Blender with `--python-exit-code 1 --python scripts/build_production_interiors.py`, then `optimize_interiors.mjs`. `render_cabinet_preview.py` renders the actual standalone masters. The generator additionally saves `LottoMind_Store.blend`. Local scripts reuse saved approved images and do not trigger paid generation.

## Shared preview and final evidence

`scripts/serve-swoop-preview.mjs` uses one handler/package folder on loopback ports 4180 and 4181, with the original Static Wave sibling-game mount, video MIME types and byte ranges. The older 4181 Astro process from a different checkout was stopped after its command was verified. Both ports return identical page/model/media bytes. Browser storage remains origin-specific, so saved local preferences/progress can differ between ports despite identical code/assets.

TypeScript and packaging passed. The final complete regression suite passed 424 tests. Seven focused studio/shop/media tests also passed, including entry and walking-route clearance. Unity glTFast imported all four final interiors, validating geometry, metre bounds and original/generated image materials. On 4181, browser evidence confirms advancing promo, licensed movie and genuine live video; valid practice picks/draw; all three original games starting; and 3D joystick drag and keyboard control events. Evidence is in the checkout's `output/studio-retail-20261003/`. Local only; no production publication.
# LottoMind second street entry, 2026-10-03

`scripts/build_lotto_street_entry.py` updates the blank navy rear facade of the
existing mapped LottoMind building. The original editable master and shipping
model are preserved in `before-street-entry/`. The current editable master is
`LottoMind_Store.blend`; the shipping model is
`public/exports/atwater/lottomind-store.glb`.

The second portal is 2.6 m wide, at local (u=-4.35, v=-9.35), beside the service
counter's clear aisle. The practice-ticket display was relocated intact to the
right indoor wall. New authored assets include masonry openings, display
glazing, brass window framing, interior-facing counter signage, an entrance mat,
and upper factory windows. Existing original LottoMind artwork and Higgsfield
retail materials are reused. Three.js supplies the open glass door leaves,
canopy, branded sign hardware, lighting, planters, bike rack, and sidewalk.
`scripts/optimize_lotto_street_entry.mjs` packages only this store, preserving
the other room exports. Provenance and optimization reports are adjacent to
this README. Both entrances connect to the same local app tools.
