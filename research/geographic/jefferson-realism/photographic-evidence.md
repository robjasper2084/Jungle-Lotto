# Jefferson photographic evidence

Reviewed 2026-11-27. This document records the references used to interpret the
mapped East Jefferson corridor. It contains source links, observations and
attribution; no third-party image pixels are included in the repository by this
document. The game models use original geometry and procedural materials.

## I-375 / Chrysler interchange: dated operator imagery

The original [Esri World Imagery service](https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer)
was queried for the interchange. Its photographic content visibly corroborates
both the curved southern Jefferson route and the straighter northern surface
carriageway present in the City centerline dataset. The original shortest-path
route selected only the southern branch.

- [Reproducible image export](https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=-83.0395%2C42.3300%2C-83.0320%2C42.3348&bboxSR=4326&imageSR=3857&size=1400%2C1200&format=png&f=image)
- [Export extent and scale](https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=-83.0395%2C42.3300%2C-83.0320%2C42.3348&bboxSR=4326&imageSR=3857&size=1400%2C1200&format=png&f=json)
- [Operator acquisition/source metadata at the west-service junction](https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/identify?geometry=-83.0361958802728%2C42.3323271845424&geometryType=esriGeometryPoint&sr=4326&layers=all%3A8%2C9%2C10%2C11&tolerance=2&mapExtent=-83.0395%2C42.3300%2C-83.0320%2C42.3348&imageDisplay=1400%2C1200%2C96&returnGeometry=false&f=json)

The identify response, retrieved 2026-11-27, reported the following for its
30 cm, 60 cm and 1.2 m metadata layers at the queried location:

| Operator field | Returned value |
|---|---|
| `SRC_DATE` | `20250607` |
| `SRC_DATE2` | `6/7/2025` — June 7, 2025 |
| `NICE_NAME` | `Vivid Advanced` |
| `NICE_DESC` | `Vantor` |
| `SRC_DESC` | `GE01` |
| `BlockName` | `DYNAMIC_ESRI_Detroit_25Q3` |
| `ReleaseName` | `Raster Basemaps 2025.R11` |
| `OBJECTID` | `959406` |

This date describes the operator's source record at that location. It does not
establish November 2026 street conditions or the capture date of every pixel in
a wider mosaic. The current service attribution is **Esri, Vantor, Earthstar
Geographics, and the GIS User Community**. The source operator's terms govern
the imagery; it was inspected as reference, not installed as a game texture.

The returned export was 1400 by 1200 pixels, EPSG:3857, scale
`2276.5452344884984`. Its actual extent was:

```json
{
  "xmin": -9243919.043629477,
  "ymin": 5210540.7406982,
  "xmax": -9243075.771645658,
  "ymax": 5211263.545255759,
  "spatialReference": {"wkid": 102100, "latestWkid": 3857}
}
```

The review overlay used this returned extent, not an assumed mapping of the
requested geographic bounds. Its red and cyan lines were exact source
centerlines; yellow points were City signal inventory locations. No road was
traced or invented from the photograph. Scratch-review hashes retained for
reproducibility:

| Download | SHA-256 |
|---|---|
| Original Esri PNG | `b76a584135853a93f158ac5c749acd49c9e846a8f06ba3d980ca6a0016c8cef0` |
| Operator identify JSON, saved with two-space indentation | `25cb1274f891a0141cb0f8b78b067645f8e17729cc8aa41013c43a8a3c5ba0c7` |
| Expanded City centerline GeoJSON | `bb697f91f8026450abfbba4a31cefbe2eb39fe0319518c5027b0b316c3818eb8` |

### Northern carriageway geometry acceptance

The [City Detroit Street Centerline Map layer](https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Detroit_Street_Centerline_Map/FeatureServer/0)
contains this continuous east-to-west sequence, all named `Jefferson`, type
`Ave`:

```text
32465 → 31966 → 32385 → 32702 → 32633 → 32076
      → 32085 → 32903 → 32175 → 31927 → 33430 → 33738
```

After orienting the source records east to west, every adjacent endpoint agrees
exactly at the generator's five-decimal coordinate precision. The chain begins
on the already selected source node `[-2710.75917, 1530.64263]` and ends at the
northern Woodward source node `[-3519.99311, 1997.36114]`. These are local game
coordinates, not longitude/latitude.

On the pre-append integrated terrain, 499 samples spaced no more than two metres
apart found dry land at the centerline and at offsets of nine metres on both
sides. The sampled centerline encountered no existing obstruction at a 0.1 m
margin. This validates source-chain continuity and existing game land coverage;
it does not survey road widths or the missing freeway's vertical geometry.

The City's west-service signal location is only 13.07 m from FID 32702, compared
with 44.29 m from the nearest selected southern Jefferson segment. This explains
the earlier missing signal support without moving the inventory point or
relaxing the planner's distance limit. Street widths and individual fixture
placements remain documented modeling choices; this centerline source has no
width or lane-count attributes.

## Building photographs and architectural sources

Dates below are capture dates only where the source explicitly identifies them.
Page update dates, file names and URL timestamps are not treated as capture
dates. Primary photographs and official architectural documents have different
roles: photographs support appearance, while mapped footprints establish the
horizontal geometry.

| Building | Reference and attribution | Capture date / use |
|---|---|---|
| Garden Court, 2900 E Jefferson | [Andrew Petrov / Detroit Photography](https://www.detroitphotography.com/architecture/building/garden-court-apartments) | Capture date not established. Nine-level facade, two limestone base levels, brick above, projecting window bays and roof balustrade inspected. Photographs are credited to Andrew Petrov and marked all rights reserved. |
| Bagley House, 2921 E Jefferson | [Owner's exterior photo](https://www.bagleymansion.com/contact.php) | Capture date and individual photographer not stated. Red masonry, turret, steep roof and black fence inspected. Site/photographer rights are not transferred by public access. |
| Wells House, 2931 E Jefferson | [Andrew Petrov / Detroit Photography](https://www.detroitphotography.com/architecture/building/william-h-wells-house) | Capture date not established. Rough stone, red tile roof, copper trim, curved projections and large chimneys inspected. |
| Stearns / Lofts at Rivertown, 6533 E Jefferson | [Displayed Google Street View reference](https://www.detroitphotography.com/architecture/building/the-lofts) | Capture date not displayed. Four-story brick frontage and taller industrial addition inspected. Google imagery attribution retained; no original Petrov photo is claimed. |
| Pasadena, 2170 E Jefferson | [Andrew Petrov / Detroit Photography](https://www.detroitphotography.com/architecture/building/pasadena-apartments) | Capture date not established. Buff facade, tall projecting bays and roofline inspected. |
| Palms, 1001 E Jefferson | [Helmut Ziewers / HistoricDetroit.org exterior gallery](https://www.historicdetroit.org/galleries/palms-apartment-house-photos-exterior) | Front: June 28, 2025; courtyard: September 2, 2025; entrance: September 17, 2025. Copyright attributed to Helmut Ziewers / HistoricDetroit.org. Limestone frontage, balustrade and red-brick courtyard inspected. |
| Joseph Campau House, 2910 E Jefferson | [Andrew Petrov / Detroit Photography](https://www.detroitphotography.com/architecture/building/joseph-campau-house) | Capture date not established. Reference gathered; no completed bespoke model is implied here. |
| Christ Church, 960 E Jefferson | [NPS filing image presented by Detroit Photography](https://www.detroitphotography.com/architecture/building/christ-church-detroit) | Historic photograph, precise capture date not established. Gothic stone frontage, bell tower and roof form inspected; no current-condition or completed-model claim. |

The [City East Riverfront appendix](https://detroitmi.gov/sites/detroitmi.localhost/files/2024-08/2017-04-14_Detroit%20East%20Riverfront_Report_Appendix.pdf)
independently supports Garden Court's nine floors and facade organization. The
[Wells NPS nomination](https://nara-media.s3.amazonaws.com/electronic-records/rg-079/NPS_MI/85002949.pdf)
specifies two-and-a-half stories; roof living space is not three full wall floors.
The [NPS/LOC East Riverfront survey, HAER MI-415](https://tile.loc.gov/storage-services/master/pnp/habshaer/mi/mi0700/mi0746/data/mi0746data.pdf)
documents Stearns' four- and eight-story portions on printed page 44. Its Palms
entry on printed page 43 / PDF page 44 reports 70 feet overall height. That is
21.336 m using 0.3048 m/ft; it is not a newly surveyed cornice elevation. Other
bespoke metric wall/roof dimensions are explicit model estimates, and no
conversion of the undocumented GIS `median_hgt` unit was accepted.

### Stearns upper addition: aerial placement check

The [operator aerial export for 6533 East Jefferson](https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=-83.0085%2C42.3449%2C-83.0055%2C42.3471&bboxSR=4326&imageSR=3857&size=1200%2C1000&format=png&f=image)
shows the broad raised rectangular roof near the center of the original
`detroit-89989` footprint, between two interior open areas. This agrees with the
upper industrial block visible behind the four-story frontage in the street
photograph. The rear notch in the outline is open space, not a separate tower
footprint.

[Metadata queried separately at the Stearns site](https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/identify?geometry=-83.007%2C42.3458&geometryType=esriGeometryPoint&sr=4326&layers=all%3A8%2C9%2C10%2C11&tolerance=2&mapExtent=-83.0085%2C42.3449%2C-83.0055%2C42.3471&imageDisplay=1200%2C1000%2C96&returnGeometry=false&f=json)
reports June 7, 2025, Vivid Advanced / Vantor, GE01, block
`DYNAMIC_ESRI_Detroit_25Q3`, release `Raster Basemaps 2025.R11`, object 959406.
The same mosaic-date qualifications and attribution above apply.

The returned 1200 × 1000 pixel export extent is EPSG:3857
`[-9240495.78652583, 5212784.6267012535, -9240098.158028685, 5213115.9837822085]`.
Visually selected roof pixels `(562,616), (645,585), (686,682), (603,715)`
convert through this extent to local game points approximately
`[-441.247,117.464], [-420.921,109.872], [-410.880,133.628], [-431.206,141.709]`.
Their centroid is approximately `[-426.086,125.697]`. These are image-derived
roof observations, affected by relief displacement and pixel selection; they
are not surveyed wall corners.

The authored 21 × 24 m upper block is aligned to the established facade axes,
centered on the building plan center `[-425.649,125.772]`, and entirely inside
the original mapped footprint. Its dimensions are conservative modeling
estimates. The source outline remains unchanged. The four/eight-story division
comes from the architectural record; the aerial supplies placement evidence.

### Wells curved wing: photographic height division

The Petrov photograph shows a broad, one-story curved wing with a flat dark
roof on the viewer's right, distinct from the main two-story stone body and its
steep tiled roof. In the source `955779335` ring, this broad side lobe follows
zero-based vertices 3 through 12. An internal chord from vertex 12 to vertex 3
separates it from the main volume without changing any exterior source edge.
The smaller forward round bays remain part of the taller house/turret form.
This is an appearance-based height interpretation; the source does not provide
surveyed sub-building heights.

### Exact photo URLs used for key visual comparisons

- [Garden Court — Petrov](https://qjxuiljsgrmymeayoqzi.supabase.co/storage/v1/object/public/building-photos/7b41d649-0ec3-4272-a66e-e1641c5978b1/1778204919-3595.jpg)
- [Bagley — owner exterior](https://www.bagleymansion.com/resources/Exterior%20_%20new.jpg.opt840x472o0%2C0s840x472.jpg)
- [Wells — Petrov](https://qjxuiljsgrmymeayoqzi.supabase.co/storage/v1/object/public/building-photos/83fc080d-b6a4-48a0-882c-7066f161067d/1778204961-3662.jpg)
- [Stearns — displayed Street View](https://qjxuiljsgrmymeayoqzi.supabase.co/storage/v1/object/public/building-photos/street-views/17f42c3d-150c-4e52-8d38-db4dbbffb037.jpg)
- [Pasadena — Petrov](https://qjxuiljsgrmymeayoqzi.supabase.co/storage/v1/object/public/building-photos/ad9448fd-34c2-4f44-8afd-4ea9d16fccd2/1778204965-3648.jpg)
- [Palms front — June 28, 2025](https://storage.googleapis.com/historic-detroit-prod/uploads/photo/photo/25096/S8000808-Pano.jpg)
- [Palms courtyard — September 2, 2025](https://storage.googleapis.com/historic-detroit-prod/uploads/photo/photo/25099/H4030793.jpg)
- [Palms entrance — September 17, 2025](https://storage.googleapis.com/historic-detroit-prod/uploads/photo/photo/25638/H6020040.jpg)

An automatically selected Street View on a separate Palms page faced away from
the building. It was rejected as facade evidence. The 2025 photographer images
above were used instead.

## Traffic-light appearance and dating

The Garden Court and Bagley photos visibly show yellow vertical three-lens
signal heads suspended on span wires at Jefferson / Joseph Campau. This supports
using suspended fixtures there. Other junctions need their own evidence or
clearly identified approximate fixture details.

The [Michigan DNR Belle Isle mobility study, existing-conditions chapter](https://www.michigan.gov/dnr/-/media/Project/Websites/dnr/Documents/PRD/BI-archive/Belle-multimodal/BelleIsleMobilityStudy2024-Ch2-Existing-Conditions.pdf?rev=8b5df3b04a2047d8bcbfbb88125b88b2&hash=3D7AF93CD5ACDB6B62293B32BD5B3203)
contains the Grand Boulevard / Jefferson aerial as Figure 2.12, printed page 19
/ PDF page 4. The 2024 report supports the divided junction and crossing layout;
the underlying image's capture date was not established. It is not a pole
survey or signal-controller plan.

The [City Traffic Signals inventory](https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Traffic_Signals/FeatureServer/0)
was retrieved 2026-11-27; its service edit timestamp was October 2022. Its points
locate signalized intersections. The game cycle, counts of heads, and exact pole
offsets do not represent a live City signal feed or surveyed installation plan.

Public KartaView metadata near Jefferson / Grand supplied examples dated August
and September 2018. Image downloads from the returned storage URLs were blocked
with HTTP 403, so those unavailable photographs were not accepted as visual
evidence or described as inspected.
