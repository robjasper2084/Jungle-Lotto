# East Jefferson sidewalk source and derived walking geometry

This addition prepares walking surfaces from East Grand Boulevard through
Woodward. It does not change the original road, land, building, or collision
records. The runtime renderer and pedestrian support use the same prepared
surface polygons; source crossing lines remain distinct from raised pavement.

## Source and date

The primary source is [SEMCOG Sidewalks and Crosswalks, layer 24](https://gis.semcog.org/server/rest/services/Hosted/Sidewalks_and_Crosswalks_2019/FeatureServer/24),
published by the **Southeast Michigan Council of Governments**. The layer
describes aerial-image digitization begun in 2019 for the regional bicycle and
mobility plan. It is not a new field survey.

The frozen download was retrieved on **2026-11-28 UTC**. Its service edit
timestamp is **2025-11-01T20:00:26.840Z**. The selected records themselves have
2019 creation/edit dates and 2020-02-27 secondary edit dates. A service edit date
does not establish the image capture date or current condition of every walk.

The compressed source snapshot contains all **5,247** records intersecting
WGS84 bounds `[-83.0465,42.3268,-82.9990,42.3491]`. The returned object-ID set
was fetched completely in 500-record pages. Exact query URLs, retrieval dates,
byte counts and hashes are in `sources/semcog-sidewalks-source-provenance.json`.
Decompression reproduces the saved source geometry byte-for-byte. No coordinates
in this archive are snapped, moved, joined, or invented.

`catetitle` distinguishes `sidewalk`, `independent path`, `crosswalk`, and
`crosswalk_painted`. The builder uses **`width_ft × 0.3048`** for metric width.
All 588 scope candidates have positive `width_ft` values. Four candidates have
zero in the separate, undocumented `width` field despite a populated
`width_ft`; that raw field is therefore not used. These are source-recorded,
aerial-derived widths, not claimed surveyed clear pedestrian widths.

## Why the previous treatment was insufficient

The original map's 23 East Jefferson road records carry `sidewalk:false`.
That game flag is not evidence that real sidewalks are absent. City-derived
district roads have no sidewalk-width field. Their previous generic underlay
was 3.6 m wider than the authored road ribbon, leaving nominal 1.8 m side strips
at terrain +0.035 m under asphalt at +0.07 m. Those strips neither reproduce
the separate mapped walk alignments nor provide the new shared walking surface.

## Geometry and qualifications

- Selection uses a 55 m buffer of retained Jefferson centerlines, bounded 45 m
  beyond the Grand/Woodward endpoints. This is an authored work boundary.
- Sidewalk/path lines are buffered by their source widths and unioned. The
  resulting slabs are clipped to existing land, outside building solids with
  a 0.025 m numerical clearance, and away from vehicle centerlines by at least
  0.5 m. Building holes remain holes in the obstacle geometry.
- The independent path `892360` follows the existing Dequindre Cut, beneath
  mapped road bridges. Its original source record and clipped walking guide
  remain, but it is excluded from the new raised slabs. The existing Cut
  renderer/support remains responsible for that route. This prevents a 2D
  polygon union from joining different grades; no elevated plane is invented.
- Broad **authored asphalt widths are not an exclusion mask**. A mapped walk
  can correctly occupy the edge of an over-wide game road ribbon. Through-lane
  centerlines remain clear without erasing those source walks.
- Pavement top is terrain +0.22 m; road/toe is terrain +0.07 m. The resulting
  0.15 m rise is an authored visual/gameplay dimension, not a curb survey.
- Ramps are derived only where a source crossing endpoint attaches to retained
  sidewalk within 0.25 m and has sufficient interior space. Authored runs are
  2.1 m or 1.8 m, at most 2 m wide. Ramps are partitioned out of flat slabs;
  their tops do not overlap. This is not an accessibility certification.
- Curbs follow only original strip side boundaries. Crossing/ramp openings,
  source strip endcaps, and artificial land/building/scope/tile cut edges do
  not generate curb walls. The dataset supplies no complete driveway inventory
  or surveyed curb-edge/ramp geometry.
- Derived polygons are divided into 320 m cells. A topology-preserving 1 mm
  grid removes numerical degeneracies; final shared slab/ramp intersections
  retain exact serialized coordinates to prevent overlapping tops. Source
  coordinates remain untouched in the archive. Sub-0.01 m² derived fragments
  and individual conflicts are recorded in `sidewalk-exclusions.json`.
- `walkingCorridors` contains source centerline guides clipped to scope, land
  and building solids for pedestrian clearance. Crossing guides do not create
  raised slabs or imply paint. This builder generates no crossing stripes.

The official [2025 DDOT boarding-platform notice](https://detroitmi.gov/news/ddot-installing-new-boarding-platforms-east-jefferson-part-pilot-program-improve-transit-experience)
documents newer work at Chene and Mount Elliott within this corridor. The older
SEMCOG snapshot does not establish those platforms' completed geometry. Existing
building photographs in `photographic-evidence.md` corroborate paved frontage
walks, curb/driveway interruptions and crossings, but do not measure their widths.

## Reproduce and verify

Run from `lottominded-ultra.io/games/gothtechnology2/belle-isle-source` with
Python and Shapely available. The preparation was validated using **Shapely
2.2.0**; no network access is needed after the source snapshot is present.

```sh
python3 tools/build-jefferson-sidewalks.py
```

An isolated dependency target may be selected with `PYTHONPATH`; no global
package installation is required. `--source /path/to/snapshot.geojson.gz` can
select another explicit input for investigation.

The generator verifies serialized polygon validity, source IDs, preserved
input hashes, nonoverlapping slabs/ramps, exclusion of building solids and
water, vehicle-centerline clearance, and curb openings. Exact counts, precision
effects, exclusions and the runtime JSON hash are in `sidewalk-integrity.json`.
These are geography checks; native rendering, movement and timing acceptance
are separate checks of the integrated candidate.
