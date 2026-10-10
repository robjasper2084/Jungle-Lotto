# Combat, Rigging & Selected-Wheel Acceptance Matrix — V2

Prepared October 9, 2026. Every requirement below starts NOT TESTED for this revision.
These are tests for Codex to implement and run in the real projects, not passed results.
Keep the earlier isolated bridge evidence separate.

For each row record target, wheel/rider/weapon/profile IDs, source revision, tool/browser/device, scenario, status (PASS / FAIL / BLOCKED / NOT TESTED), evidence path and next step. Numeric tolerances are proposed QA criteria and must be documented if adjusted.

## A. Source and asset discovery

| ID | Scenario | Required result |
|---|---|---|
| D01 | Resolve source roots | Actual Swoop, separate Explorer and RideCore paths/revisions; no substitute internal map |
| D02 | Identify bridge capability | Source/ABI/hash verified; input-only proof not reported as full engine |
| D03 | Inventory local assets | Relevant actual files, clips and licenses; unavailable add-ons not assumed present |
| D04 | Unknown/restricted license | Candidate excluded or flagged; no unapproved external character upload or raw-pack redistribution |
| D05 | Missing clip | Original fitted fallback recorded; no walking animation applied to EUC feet |
| D06 | Export processing | Imported GLB has intended skeleton/actions/sockets; target build supports texture dependencies |

## B. Weapon fit and animation

| ID | Scenario | Required result |
|---|---|---|
| R01 | Low-ready and ADS front/side/rear closeups | Correct dominant grip, support grip, stock/eye alignment, wrists/fingers, no floating gun |
| R02 | Accelerate/brake/carve at 25/50/100% selected speed | Hands stay within proposed 2 cm locked-phase contact tolerance; feet stay on pedals |
| R03 | Aim limits and Q/E lean | No impossible torso twist, arm stretch, muzzle through wall or lateral teleport |
| R04 | Recoil during both carve directions | No one-frame off-hand lag, double recoil or detached weapon |
| R05 | Reload while moving and aiming | Support hand releases deliberately and returns smoothly; magazine/socket behavior coherent |
| R06 | Reload cancellation before/after ammo transfer | Ammunition conserved; no duplicates; valid recovery to a stable pose |
| R07 | Fire/reload/swap during hop, landing and crash | Documented state priority, no root motion slip or stuck hand constraint |
| R08 | Rig dependency | No cyclic gun/hand constraint; deterministic evaluated ordering |
| R09 | Local vs remote animation | Same weapon and phase appear at correct tick; no full-bone network spam |
| R10 | Every selectable combat rider | Fit checked or unsupported combination hidden/labeled; original hero retained |
| R11 | Exported browser runtime | Unity/Blender preview plus both actual target renderers checked; baked pose not mistaken for runtime IK |
| R12 | LOD/animation quality changes | Essential hand/foot and hit-volume consistency preserved |

## C. Input behavior

| ID | Scenario | Required result |
|---|---|---|
| C01 | Simultaneous steering and aiming | Independent axes through actual compiled input path |
| C02 | Right mouse tap / hold / release | Tap toggles ADS once; hold shoulder-aim release never toggles accidentally |
| C03 | Hold ADS alternative | Clearly selectable and independent from classic preset |
| C04 | R and K context behavior | R reloads, K combat-recovers; normal riding bindings restored on exit |
| C05 | Free look while aiming | Alt look does not secretly move weapon aim; bounded recenter |
| C06 | Mouse wheel / 1 / 2 / B | Valid selection/fire modes only; no instant swap/recoil reset exploit |
| C07 | Tab/chat/Escape/focus loss | Held fire and movement clear, input not captured from text fields; online room continues |
| C08 | Touch multi-pointer use | Steering, aim, fire, reload, brake/hop can overlap without pointer theft |
| C09 | Touch customization/orientation | Existing saved editor layout survives updates and rotation |
| C10 | Gamepad dead zone/disconnect/remapping | No stuck throttle/fire; labels agree with actual mapping |
| C11 | Browser gestures | No selection/context popup over gameplay, normal forms accessible |
| C12 | XR/split-screen preservation | Existing features regress-tested; new unsupported combinations not falsely claimed |

## D. Ballistics and weapon authority

| ID | Scenario | Required result |
|---|---|---|
| B01 | Shots at multiple measured distances | Actual travel time and drop match configured integration; not hitscan plus tracer |
| B02 | Highest relative wheel/projectile speed | Thin obstacle and moving rider are not tunneled through |
| B03 | Curved path near cover | Subdivision covers arc, first physical obstruction wins |
| B04 | Camera sees target but muzzle is blocked | Shot blocked; neither remote nor local player fires from camera |
| B05 | Shooter velocity inheritance | Identical documented launch model for prediction/authority |
| B06 | Semi/burst/auto across frame rates | Correct edges, cadence and charge conservation |
| B07 | Malformed/double fire messages | Rate/sequence/state validation; no extra projectile/ammo credit |
| B08 | Recoil replay and counter-aim | Shared seed/counter response; wheel steering unaffected |
| B09 | Lean/roughness modifiers | Bounded stable effect; no gravity rotation with rider lean |
| B10 | Reload animation speed modified locally | Server ammo/reload timestamps unchanged |
| B11 | Hip/shoulder/ADS transitions | Sight/aim direction agree; precision and sway according to profile |
| B12 | LOVE TAG vs Royale Heartbreaker | Tag transition only in Tag, shield/integrity damage only in Royale |
| B13 | Simultaneous lethal projectiles | One stable outcome or documented draw; no duplicate elimination |
| B14 | Latency | Predicted shot handoff and server confirmation tested; no unjustified hitscan rewind for traveling shots |

## E. Selected-wheel performance

| ID | Scenario | Required result |
|---|---|---|
| W01 | Wheel catalog audit | Exact selected model/variant, source, speed basis, units, status recorded |
| W02 | Unknown or free-spin-only specification | No falsely verified road/riding maximum; explicit fallback or eligibility block |
| W03 | Unit fixtures | km/h / 3.6 and mph * .44704 conversions correct exactly once |
| W04 | Every enabled wheel in level speed test | Achieved max within documented tolerance (initial target +/-2%) after settling under specified conditions |
| W05 | Choose a faster/slower wheel | Real world motion changes, not only UI/FOV; no legacy universal cap |
| W06 | Profile target vs limiting reason | Honest HUD/telemetry for slope, intentional mode constraint or verified physical limit |
| W07 | Tamper with client maxSpeed/radius | Authority uses allowed wheel ID/catalog, rejects tampering |
| W08 | Burst at maximum | Profile maximum not exceeded unless explicitly approved overdrive exists |
| W09 | Model selection during ready/active/reconnect | Locked policy; no boost/health/ammo reset |
| W10 | Fastest wheel near barriers/curbs/ramps | Ground/collision/clearance stable; no ghosting or explosive corrections |
| W11 | Speedometer/wheel animation | Measured motion and circumference-based rotation match units |
| W12 | Catalog/rules mismatch | Room handshake rejects inconsistent profiles |
| W13 | Saves and other vehicles | Existing ghosts versioned; bicycle/dog physics not changed |
| W14 | Gameplay fairness | Wheel choice explicitly functional, rider cosmetics not; eligible models not sold as speed advantages |

## F. Engine, networking and both products

| ID | Scenario | Required result |
|---|---|---|
| N01 | Runtime call trace | Actual compiled upstream code used plus meaningful engine-backed rules/lifecycle |
| N02 | Slot/snapshot/context isolation | No cross-room mutation; hidden controller and weapon state restore correctly |
| N03 | Six independent human clients | Same authoritative movement/weapon/zone/elimination result, not bots substituted |
| N04 | Mixed rooms and seventh combatant | Human/bot total six; spectators separately bounded; seventh refused |
| N05 | Create/join/code/ready/start/end/rematch | Complete flow without debug-console commands |
| N06 | Disconnect/rejoin during reload/fire/zone | Same wheel, ammo, phase, health and alive state; no protection/reset exploit |
| N07 | Admin/owner departure and menu | Server persists; local menu does not stop match |
| N08 | Online bots | Same actual weapon/vehicle limits with bounded perception/decision delay |
| N09 | Stale/wrong versions | Engine/ABI/protocol/weapon/wheel/map/physics/collision mismatch handled clearly |
| N10 | Unavailable external source/hosting | Target specifically marked blocked, not silently replaced or claimed complete |
| N11 | Two real launch paths | Swoop and actual Explorer enter canonical downtown and return with settings intact |
| N12 | Safe field contraction | Final safe area connected and navigable by supported wheels |
| N13 | Noncombat regression | Free ride, racing, peaceful Explorer, community rides and LOVE TAG preserve own rules |
| N14 | Hosted internet match | Separate devices/networks via authorized service; distinguished from local automated clients |
| N15 | Packaging and rollback | Missing assets cannot erase working build; no unauthorized production change |
| N16 | Performance matrix | Record device/browser, GPU/frame times, network conditions, correction rate, CPU and memory; no claimed FPS from a clip |

## Required captures

Create an offline rig-test scenario and capture front/side/over-shoulder/ADS views; idle, acceleration, max-speed left/right carve, braking, hopping, recoil and partial/empty reload; then repeat core checks for a remote rider in a real room. Capture Swoop and the actual Explorer separately. Numerical socket tests supplement rather than replace visual inspection.

Current package revision provides no new game-test results. Fill this matrix only from implementation evidence.
