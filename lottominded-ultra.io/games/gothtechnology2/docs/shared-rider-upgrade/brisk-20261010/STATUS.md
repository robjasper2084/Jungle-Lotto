# Reviewed game release — 2026-10-10

This record describes the completed release candidate, not every item in the conversation. Live deployment must be confirmed by its workflow and public game routes.

## Included

- Original Swoop Detroit, separately packaged Elmwood Explorer, and the shared downtown Static Royale arena.
- Six- or ten-rider rooms; optional AI fill and a separate chasing-AI toggle. Solo online fill produces nine bots in ten-rider mode; four network clients produce six bots.
- Weapons, ammunition, repair packs, shields, dog whistles, and 72 scope sites across reachable downtown navigation nodes.
- Server-owned dog charges, radar, route checks, contact damage, wheel knockoff, cooldowns, and per-rider companion colors. Actual Blender-authored Dog_Radar and Dog_Pounce clips are included in the runtime model.
- Faster walking/running, shared anatomical arm mechanics, walking/running combat lean, crouch, and prone/crawl for all five supplied heroes.
- Saved gyro settings, customizable mobile controls, transparent HUD panels/buttons, Hide/Show map, and collapsed dog/ride options.
- Longer heart projectile travel and instanced heart/sparkle trails, using authoritative projectile snapshots.
- Faster immediate community rides, continuous ambient rider circuits, and improved NPC recovery on their own routes.
- Current food trucks/carts, signs, water/atmosphere, Jazz club shells, and packaged actual Unity stage assets. Stage assets load after choosing a seat; end-to-end club entry/performance/return remains a separate uncompleted browser check.
- Host fixture caches now carry the canonical compressed-map fingerprint. A stale cache falls back to the current canonical map instead of serving old collision geometry.

## Evidence

- Compiled C++ module SHA256: `6229a7803cb5c39bba08f9db90f47ea9b44efbaeee2e47d4f41578a1820b975e`. Pinned upstream: `6b4d4e1f10dee9b1c8932db95f91b92e3eceb7db`; bridge ABI 4. The integration uses upstream PlayerInput and original compiled match rules with existing RideCore physics and Three.js rendering. It is not a claim that the unfinished upstream engine was fully merged.
- 21 engine/ten-rider/dog/combat tests passed against this module. Additional rig/equipment/touch suite: 30 passed; all tested touch targets fit the tested portrait/landscape sizes.
- Actual Blender and Unity import review: five original heroes, 15 clips each, 735 sampled poses each; 75 clips and 3,675 poses total. See `blender-review.json`, `unity-review.txt`, and retained editable Blender/FBX exports. Runtime grip checks passed; minor floor penetration still occurs on some skins.
- Network evidence: `../../../love-tag-server/evidence/royale-ten-20261010.json`; ten independent automated network clients moved, an eleventh combatant was rejected, the tenth reconnected with retained inventory, and one-/four-client AI fill passed. Physical humans: zero. Internet-hosted test: false.
- Actual downtown ten-AI simulation reached results at tick 21,504: 183 shots, 91 hits. This is automated simulation evidence, not a human playtest.
- Browser: ten-rider practice ran with opponents, scope loot, differently shaded dogs, stable crouch/prone weapon grips, and no new errors in a fresh QA tab. Browser-created room on the corrected local host `127.0.0.1:8230` started successfully with AI fill. The earlier compatibility failure was a stale prepared host fixture and is corrected.
- Both source builds/type checks succeeded. The 4191 preview and release packages use the current local RideCore, not an older node_modules junction.

## Pending follow-up requested after this candidate

- Visible health meter and explicit health-pack labeling/use feedback.
- Numeric bot-count selector beyond the current AI fill and chase toggles.
- Knockdown/death replay, and authoritative visible bullet impacts on self/opponents.
- At least 12 clustered/randomized downtown spawn nodes; one confirmed safe re-entry, ten-second protection cancelled by combat, server tracking, and interpolation reset/broadcast.
- Real six-/ten-human acceptance test, poor-connection tests, cross-network voice, and actual older iPad/Android/gyroscope testing. The prior microphone pass was local.
- Re-test the Supabase relay with the updated local match worker before claiming public online hosting works with this new module.
- Finish proper finger-joint rigging, broader building/container/door placement checks, and the actual Jazz performance visit/return test.

Keep these items pending until genuine evidence exists. Passing automated clients does not satisfy the requested real-player test.
