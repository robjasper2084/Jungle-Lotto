# Jefferson real-game crosswalk — source audit only

This isolated change runs a read-only correspondence check between the actual
Belle Isle map, the connected districts, and the 187 City building IDs acquired
for the Jefferson–MacArthur study area on November 24, 2026.

- Reads the checked-out game files, requires their exact previously reviewed SHA-256.
- Queries a bounded official City of Detroit ArcGIS endpoint with a pinned ID
  inventory and checks completeness; a changed live service fails closed.
- Uses polygon intersection-over-union with a review threshold of 0.80.
- Reports duplicate/ambiguous/unmatched buildings and Armory correspondence.
- Never changes the game, deletes existing batched buildings, replaces colliders,
  validates roof heights, publishes GIS geometry, or claims native FPS acceptance.

**Output is evidence for art review, not deployment authorization.** The City's
license field remains unspecified and SEMCOG median_hgt units are unverified.
Before the 186 massing studies or Armory model can be used in production, the
source terms, camera references, facade proportions, terrain datum, visual
acceptance and unchanged 90-second native performance must be verified.

The original offline 3D package remains unchanged. Existing PRs #211 and #213
remain separate and are not dependencies of this read-only audit.
