# Swoop playtest polish — 2026-09-23

Implemented: heading-relative checkpoint guidance in solo challenges and both race layouts; taller gate silhouettes; compact mobile challenge text; collapsed store catalog with truthful availability; direct Learn to ride and park entry; flat park spawn; smoothed park mesh; skateboard kick tails, push-foot response and landing pitch; no seated or incompatible EUC tricks on skateboard; preserve board selection when swapping riders; shorter split-view render range; dog obstacle escape from the preceding local work; grounded, correctly rotated landmark sign supports and Freight Yard sign posts.

Campbell Terrace: Google Maps satellite and place pin checked at 42.3406046, -83.0315474, west side of the Cut just north of Lafayette. Existing placement matches the pin. Curved canopy, timber ribs, rear wall and three curved grass terraces use the supplied photographs. Generic terrain and retaining wall are opened at the stage frontage. Dimensions are reference-informed approximations, not a survey.
Sources: https://www.google.com/maps/search/Campbell+Terrace+Detroit/ and https://www.detroitriverfront.org/plan-your-visit/parks-greenways/dequindre-cut

Validation: TypeScript check passes; all 347 automated tests pass (release-tests-final.log); production game packaging succeeds. The four earlier failures were two instant-recovery expectations superseded by get-up animation and two fall tests measuring hidden skateboard geometry. Tests now verify the animated recovery and rendered geometry without loosening visible mesh clearance thresholds.

Browser audit covered menus, a full AI rival finish to Mack, missed-gate recovery, split-screen startup/pause, challenge start, responsive phone controls, park vehicle switch and destination entry. This is not a claim that every challenge was manually completed. Physical Android/iPhone, Quest/Vive and controller hardware remain untested; universal 60 FPS is not certified. Full skateboard grind/flip physics and free walking around shop racks remain future feature work, not completed by this stabilization pass.

Preserved production storefront return link, gallery URL, rewards/payment contracts, and unrelated local About/CSS edits.
