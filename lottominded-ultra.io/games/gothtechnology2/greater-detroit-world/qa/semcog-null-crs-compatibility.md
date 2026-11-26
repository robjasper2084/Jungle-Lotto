# SEMCOG GeoJSON null-CRS compatibility review

Review date: 2026-11-24.

## Failed acquisition retained

The first complete SEMCOG acquisition attempt was rejected because a returned geometry contained the literal legacy member `crs: null`. That failed attempt is not an accepted dataset. A separate one-feature diagnostic request confirmed the response shape; the diagnostic is not a replacement for a complete acquisition.

The original diagnostic bytes remain unchanged in the accompanying reference snapshot's `diagnostics` directory. Their identities are recorded here so a later successful acquisition cannot erase the failed result's provenance.

| Diagnostic file | Bytes | SHA-256 |
| --- | ---: | --- |
| semcog-partial-crs-request.json | 558 | 0c250fde13db3c0a3516bb0db64287c0b104ee755a4eb04288e379362d1dad77 |
| semcog-partial-crs-response.json | 601 | 08ac2534d57d05aaa21139e71156f54238b0f48f5530866c0ef4ddfd74952493 |
| semcog-layer-metadata-null-crs-review.json | 12030 | f19f5407f0a9b7c2f0aee121d059cccdcadc8754d9ef4a9b486e6feb8899e8a0 |

## Verified protocol basis

A fresh read of the registered SEMCOG Buildings_2024 layer returned `currentVersion: 11.5`, `objectIdField: objectid`, polygon geometry, and native spatial reference EPSG:2253. The exact metadata response was saved as the third diagnostic above.

Esri's [Feature Service layer query documentation](https://developers.arcgis.com/rest/services-reference/enterprise/query-feature-service-layer/) states that, from version 10.8, requesting `f=geojson` with `outSR=4326` produces RFC7946 output. This explicit request/version contract is the basis for the compatibility correction. Coordinate ranges are only an additional geographic-bound check and do not establish CRS meaning.

## Narrow correction

The collector may remove literal `crs: null` only when all three conditions hold: the query targets a registered and catalog-matched source, the submitted query explicitly requests `f=geojson` and `outSR=4326`, and the returned numeric service version is at least 10.8. Each removal records the full JSON path, original null value, reason, documentation URL, service version, and exact query URL. Exact original response bytes and hashes remain retained.

Unknown or non-WGS84 non-null declarations still fail. Ambiguous `spatialReference` still fails. Old, absent, null, or nonnumeric versions cannot activate this compatibility path. The separate intake validator remains unchanged.

New acquisitions also record SHA-256 hashes of the collector and georeference module alongside the catalog hash. Earlier City acquisition files and their manifests were not rewritten. The collector hash retained for that earlier capture is `37f040cb453766e33a387e1f8500c23d209b5d156ef461f2a95f3cbca275957f`.

## Focused verification

`node --test tests/geographicFetch.test.mjs` passed 58 tests with zero failures after this correction. Cases include literal null at collection, feature, and geometry levels; the 10.8 boundary and observed 11.5 version; old or unknown version rejection; non-null invalid CRS rejection; ambiguous spatial-reference rejection; original-byte preservation; and collector-hash verification. `git diff --check` passed for the changed implementation and tests.

Collector SHA-256 after this correction: `c810f7aff2a09206b12642041451113368ba83c1d00a8e67e66cb690756e9e4b`.

This note records the compatibility repair and mocked-network verification. The subsequent complete 160-record SEMCOG acquisition and successful intake are recorded separately in `geographic-source-acquisition-20261124.json`. Geographic alignment review and production acceptance remain outstanding.
