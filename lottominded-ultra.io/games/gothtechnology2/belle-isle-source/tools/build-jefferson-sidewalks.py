#!/usr/bin/env python3
"""Prepare additive Jefferson walking surfaces from the frozen SEMCOG snapshot.

Offline only; requires Shapely 2.x. Original map, road, and building records are
read-only. Source lines remain unchanged in the compressed research snapshot.
Rendered polygons are derived, clipped geometry, not surveyed curb/ramp plans.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

import shapely
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import transform, unary_union
from shapely.strtree import STRtree

BASE = Path(__file__).resolve().parents[1]
REPO = BASE.parents[3]
GAME = BASE / 'game'
RESEARCH = REPO / 'research/geographic/jefferson-realism'
SOURCES = RESEARCH / 'sources'
OUTPUT = GAME / 'src/belle/jeffersonSidewalks.json'
TOP_OFFSET = .22
ROAD_OFFSET = .07
TILE = 320
SCOPE_BUFFER = 55
TERMINAL_MARGIN = 45
CENTERLINE_GUARD = .5
BUILDING_CLEARANCE = .025
LAND_INSET = .02
MIN_AREA = .01
PRECISION = 3
RENDER_GRID = .001
EXISTING_GRADE_SEPARATED_PATH_IDS = {892360}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def polygons(g):
    if g.is_empty:
        return []
    if g.geom_type == 'Polygon':
        return [g]
    return [p for c in g.geoms for p in polygons(c)] if hasattr(g, 'geoms') else []


def lines(g):
    if g.is_empty:
        return []
    if g.geom_type == 'LineString':
        return [g]
    return [p for c in g.geoms for p in lines(c)] if hasattr(g, 'geoms') else []


def valid(g):
    return g if g.is_valid else shapely.make_valid(g)


def point(p):
    return [round(float(p[0]), PRECISION), round(float(p[1]), PRECISION)]


def rings(poly, round_coordinates=True):
    convert = point if round_coordinates else lambda p: [float(p[0]), float(p[1])]
    result = {'outer': [convert(p) for p in poly.exterior.coords]}
    holes = [[convert(p) for p in ring.coords] for ring in poly.interiors]
    if holes:
        result['holes'] = holes
    return result


def polygon_from_row(row):
    return Polygon(row['outer'], row.get('holes', []))


def write_json(path, value, pretty=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2 if pretty else None,
                               separators=None if pretty else (',', ':')) + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=SOURCES / 'semcog-sidewalks-20261128.geojson.gz')
    args = parser.parse_args()
    source_bytes = args.source.read_bytes()
    source_raw = gzip.decompress(source_bytes) if args.source.suffix == '.gz' else source_bytes
    source = json.loads(source_raw)
    provenance_path = SOURCES / 'semcog-sidewalks-source-provenance.json'
    source_receipt = json.loads(provenance_path.read_text())
    if args.source.resolve() == (SOURCES / 'semcog-sidewalks-20261128.geojson.gz').resolve():
        assert hashlib.sha256(source_raw).hexdigest() == source_receipt['archive']['decompressedSha256']

    input_paths = [GAME / 'public/belle/map.json', GAME / 'src/belle/detroitDistricts.json',
                   GAME / 'src/belle/jeffersonExtension.json']
    input_hashes = {str(p.relative_to(REPO)): digest(p) for p in input_paths}
    original, district, extension = [json.loads(p.read_text()) for p in input_paths]
    datasets = [('map', original), ('districts', district), ('extension', extension)]
    origin = original['origin']
    sy = 111320
    sx = sy * math.cos(math.radians(origin[1]))

    def project(lon, lat, z=None):
        return ((lon - origin[0]) * sx, -(lat - origin[1]) * sy)

    # Endpoints are the retained City signal-inventory locations. The scope is
    # an authored work boundary; it never invents a sidewalk connection.
    start = Point(project(-83.0015752696423, 42.3470310199068))
    end = Point(project(-83.0444360375074, 42.328507295221))
    dx, dz = end.x - start.x, end.y - start.y
    length = math.hypot(dx, dz)
    ux, uz = dx / length, dz / length
    nx, nz = -uz, ux
    scope_box = Polygon([
        (start.x - ux * TERMINAL_MARGIN + nx * 150, start.y - uz * TERMINAL_MARGIN + nz * 150),
        (start.x - ux * TERMINAL_MARGIN - nx * 150, start.y - uz * TERMINAL_MARGIN - nz * 150),
        (end.x + ux * TERMINAL_MARGIN - nx * 150, end.y + uz * TERMINAL_MARGIN - nz * 150),
        (end.x + ux * TERMINAL_MARGIN + nx * 150, end.y + uz * TERMINAL_MARGIN + nz * 150),
    ])
    roads = [(tag, r, LineString(r['points'])) for tag, data in datasets
             for r in data['roads'] if len(r['points']) > 1]
    jefferson = [g for _, r, g in roads if 'jefferson' in r.get('name', '').lower()
                 and g.intersects(scope_box)]
    scope = unary_union(jefferson).buffer(SCOPE_BUFFER).intersection(scope_box)
    vehicle_lines = [g for _, r, g in roads if not r.get('foot', False)
                     and g.intersects(scope.buffer(20))]
    vehicle_axis = unary_union(vehicle_lines)
    # Round endpoint caps protect junction/stub endpoints too. Two millimetres
    # of numerical padding retain the stated clearance after the mesh grid.
    centerline_guard = vehicle_axis.buffer(CENTERLINE_GUARD + .002, cap_style=1, join_style=2)
    land = unary_union([valid(Polygon(p[0], p[1:]))
                        for data, key in [(original, 'landPolygons'), (district, 'land'), (extension, 'land')]
                        for p in data[key]])
    land_safe = land.buffer(-LAND_INSET)
    building_rows = []
    for tag, data in datasets:
        for building in data['buildings']:
            poly = valid(Polygon(building['points'], building.get('holes', [])))
            if poly.intersects(scope.buffer(25)):
                building_rows.append((tag, building['id'], poly))
    building_solids = unary_union([p for _, _, p in building_rows])
    building_keepout = building_solids.buffer(BUILDING_CLEARANCE)
    allowed = scope.intersection(land_safe).difference(building_keepout).difference(centerline_guard)
    guide_allowed = scope.intersection(land_safe).difference(building_keepout)

    records = []
    for feature in source['features']:
        geom = transform(project, shape(feature['geometry']))
        if not geom.intersects(scope) or geom.intersection(scope).length < .01:
            continue
        props = feature['properties']
        width_ft = props.get('width_ft')
        assert isinstance(width_ft, (int, float)) and math.isfinite(width_ft) and width_ft > 0
        records.append({'id': props['objectid'], 'feature': feature, 'geom': geom,
                        'category': props['catetitle'], 'width': width_ft * .3048})
    records.sort(key=lambda r: r['id'])
    selected_ids = {r['id'] for r in records}
    # This source path follows the existing Dequindre Cut beneath mapped road
    # bridges. A 2D union with frontage walks would erase that grade separation.
    # Retain its unmodified source record and clipped guide, and leave its
    # existing renderer/support in charge; do not invent an elevated plane.
    walk_records = [r for r in records if r['category'] in ('sidewalk', 'independent path')
                    and r['id'] not in EXISTING_GRADE_SEPARATED_PATH_IDS]
    crossings = [r for r in records if r['category'] in ('crosswalk', 'crosswalk_painted')]
    strips = [r['geom'].buffer(r['width'] / 2, cap_style=2, join_style=2, mitre_limit=2)
              for r in walk_records]
    strip_tree = STRtree(strips)
    raw_walk = unary_union(strips)
    clipped_walk = valid(raw_walk.intersection(allowed))
    initial_slivers = [p for p in polygons(clipped_walk) if p.area < MIN_AREA]
    before_precision = unary_union([p for p in polygons(clipped_walk) if p.area >= MIN_AREA])
    walk = shapely.set_precision(before_precision, RENDER_GRID)

    def source_ids(geom):
        return sorted({walk_records[int(i)]['id'] for i in strip_tree.query(geom)
                       if strips[int(i)].intersection(geom).area > 1e-8})

    excluded = []
    for r, strip in zip(walk_records, strips):
        part = strip.intersection(scope)
        conflicts = [{'dataset': tag, 'id': bid,
                      'sourceCenterlineIntersectionM': r['geom'].intersection(poly).length,
                      'sourceWidthBufferIntersectionM2': part.intersection(poly).area}
                     for tag, bid, poly in building_rows if part.intersection(poly).area > .01]
        clipped = {'sourceId': r['id'], 'category': r['category'], 'widthM': r['width'],
                   'outsideScopeM2': strip.difference(scope).area,
                   'outsideSafeLandM2': part.difference(land_safe).area,
                   'buildingKeepoutM2': part.intersection(building_keepout).area,
                   'vehicleCenterlineGuardM2': part.intersection(centerline_guard).area,
                   'buildingConflicts': conflicts}
        if conflicts or clipped['outsideSafeLandM2'] > .01 or clipped['vehicleCenterlineGuardM2'] > .01:
            excluded.append(clipped)

    # A ramp is permitted only at an actual source crossing endpoint attached
    # to the retained walk. Its 1.8/2.1 m run and <=2 m width are authored.
    ramps = []
    ramp_decisions = []
    used_ramps = Polygon()
    for crossing in crossings:
        for part_index, line in enumerate(lines(crossing['geom'])):
            coords = list(line.coords)
            for endpoint_index, (p, toward) in enumerate([(coords[0], coords[1]), (coords[-1], coords[-2])]):
                endpoint = Point(p)
                decision = {'sourceId': crossing['id'], 'part': part_index, 'endpoint': endpoint_index,
                            'sourceEndpoint': point(p)}
                if endpoint.distance(walk) > .25:
                    decision['result'] = 'excluded: endpoint does not connect to retained sidewalk'
                    ramp_decisions.append(decision)
                    continue
                vx, vz = toward[0] - p[0], toward[1] - p[1]
                magnitude = math.hypot(vx, vz)
                if magnitude < .01:
                    decision['result'] = 'excluded: collapsed crossing direction'
                    ramp_decisions.append(decision)
                    continue
                vx, vz = vx / magnitude, vz / magnitude
                reach = min(12, line.length * .45)
                probe = LineString([(p[0] - vx * .26, p[1] - vz * .26),
                                    (p[0] + vx * reach, p[1] + vz * reach)])
                connections = [c for c in lines(probe.intersection(walk)) if c.distance(endpoint) <= .25]
                if not connections:
                    decision['result'] = 'excluded: no continuous endpoint-to-boundary connection'
                    ramp_decisions.append(decision)
                    continue
                connection = min(connections, key=lambda c: c.distance(endpoint))
                toe_t = max((q[0] - p[0]) * vx + (q[1] - p[1]) * vz for q in connection.coords)
                toe = (p[0] + vx * toe_t, p[1] + vz * toe_t)
                if toe_t >= reach - .01 or walk.covers(Point(toe[0] + vx * .08, toe[1] + vz * .08)):
                    decision['result'] = 'excluded: crossing direction has no nearby exposed boundary'
                    ramp_decisions.append(decision)
                    continue
                width = min(2, crossing['width'])
                lateral = (-vz, vx)
                accepted = False
                for depth in (2.1, 1.8):
                    crest = (toe[0] - vx * depth, toe[1] - vz * depth)
                    toe_edge = [(toe[0] + s * lateral[0] * width / 2,
                                 toe[1] + s * lateral[1] * width / 2) for s in (-1, 1)]
                    crest_edge = [(crest[0] + s * lateral[0] * width / 2,
                                   crest[1] + s * lateral[1] * width / 2) for s in (-1, 1)]
                    rectangle = Polygon([*toe_edge, *reversed(crest_edge)])
                    cut = valid(rectangle.intersection(walk))
                    pieces = [q for q in polygons(cut) if q.distance(Point(toe)) < .03]
                    if len(pieces) != 1 or pieces[0].area < rectangle.area * .72 or not walk.covers(Point(crest)):
                        continue
                    poly = shapely.set_precision(pieces[0], RENDER_GRID).intersection(walk)
                    if poly.geom_type != 'Polygon' or poly.area < MIN_AREA:
                        continue
                    if poly.intersection(used_ramps).area > .00001:
                        continue
                    ids = sorted(set(source_ids(poly) + [crossing['id']]))
                    ramps.append({'id': f'jefferson-ramp-{crossing["id"]}-{part_index}-{endpoint_index}',
                                  'geom': poly, 'sourceIds': ids,
                                  'ramp': {'toe': list(map(point, toe_edge)), 'crest': list(map(point, crest_edge))}})
                    used_ramps = unary_union([used_ramps, poly])
                    decision.update({'result': 'accepted', 'depthM': depth, 'widthM': width,
                                     'toe': point(toe), 'crest': point(crest)})
                    accepted = True
                    break
                if not accepted:
                    decision['result'] = 'excluded: insufficient retained depth/area or overlapping ramp'
                ramp_decisions.append(decision)
    flat = valid(walk.difference(used_ramps))

    tile_slivers = []

    def tiled(poly):
        x0, z0, x1, z1 = poly.bounds
        for tx in range(math.floor(x0 / TILE), math.floor(x1 / TILE) + 1):
            for tz in range(math.floor(z0 / TILE), math.floor(z1 / TILE) + 1):
                tile = shapely.set_precision(box(tx * TILE, tz * TILE, (tx + 1) * TILE, (tz + 1) * TILE), RENDER_GRID)
                clipped = valid(poly.intersection(tile))
                # Quantize the topology, rather than rounding independent rings
                # into touching/self-crossing slivers. Raw source lines remain
                # untouched; the derived mesh grid is an explicit 1 mm choice.
                for piece in polygons(shapely.set_precision(clipped, RENDER_GRID)):
                    if piece.area >= MIN_AREA:
                        yield tx, tz, piece
                    else:
                        tile_slivers.append({'areaM2': piece.area, 'bounds': list(piece.bounds),
                                             'sourceIds': source_ids(piece), 'reason': 'derived tile/partition fragment below 0.01 square metre'})

    surfaces = []
    for poly_index, poly in enumerate(polygons(flat)):
        for tx, tz, piece in tiled(poly):
            surfaces.append({'id': f'jefferson-walk-{poly_index}-{tx}-{tz}-{len(surfaces)}',
                             'sourceIds': source_ids(piece), 'kind': 'sidewalk', **rings(piece)})
    for ramp in ramps:
        for tx, tz, piece in tiled(ramp['geom']):
            surfaces.append({'id': f'{ramp["id"]}-{tx}-{tz}-{len(surfaces)}',
                             'sourceIds': ramp['sourceIds'], 'kind': 'ramp', **rings(piece), 'ramp': ramp['ramp']})

    # Independent grid snapping can create sub-millimetre wedges between a
    # long slab edge and a ramp edge with extra vertices. Partition the exact
    # serialized polygons once more, giving ramps exclusive ownership. Do not
    # round newly introduced intersection points back across that boundary.
    serialized_ramps = unary_union([polygon_from_row(r) for r in surfaces if r['kind'] == 'ramp'])
    exclusive = []
    for row in surfaces:
        if row['kind'] == 'ramp':
            exclusive.append(row)
            continue
        pieces = polygons(polygon_from_row(row).difference(serialized_ramps))
        for i, piece in enumerate(pieces):
            if piece.area < MIN_AREA:
                tile_slivers.append({'areaM2': piece.area, 'bounds': list(piece.bounds),
                                     'sourceIds': row['sourceIds'], 'reason': 'serialized ramp/slab partition fragment below 0.01 square metre'})
                continue
            exclusive.append({'id': row['id'] + f'-partition-{i}', 'sourceIds': row['sourceIds'],
                              'kind': 'sidewalk', **rings(piece, False)})
    surfaces = exclusive

    # Only source strip SIDE edges can become curb fascias. Flat endpoint caps,
    # building/water/ROI/centerline cuts, and tile boundaries never create curbs.
    side_edges, end_caps = [], []
    for record in walk_records:
        if record['category'] != 'sidewalk':
            continue
        for line in lines(record['geom']):
            for sign in (-1, 1):
                side_edges.extend(lines(line.offset_curve(sign * record['width'] / 2, join_style=2, mitre_limit=2)))
            coords = list(line.coords)
            for p, neighbor in [(coords[0], coords[1]), (coords[-1], coords[-2])]:
                vx, vz = neighbor[0] - p[0], neighbor[1] - p[1]
                length = math.hypot(vx, vz)
                if length:
                    ax, az = -vz / length * record['width'] / 2, vx / length * record['width'] / 2
                    end_caps.append(LineString([(p[0] - ax, p[1] - az), (p[0] + ax, p[1] + az)]))
    crossing_strips = unary_union([r['geom'].buffer(r['width'] / 2, cap_style=2, join_style=2)
                                   for r in crossings])
    natural_sides = unary_union(side_edges)
    artificial_edges = unary_union([scope.boundary, land_safe.boundary, building_keepout.boundary,
                                    centerline_guard.boundary, unary_union(end_caps)])
    curb_exclusions = unary_union([crossing_strips.buffer(.03), used_ramps.buffer(.03),
                                  artificial_edges.buffer(.03)])
    curb_geometry = walk.boundary.intersection(natural_sides.buffer(.002)).difference(curb_exclusions)
    curbs = []
    for line in lines(shapely.line_merge(curb_geometry)):
        if line.length < .1:
            continue
        x0, z0, x1, z1 = line.bounds
        for tx in range(math.floor(x0 / TILE), math.floor(x1 / TILE) + 1):
            for tz in range(math.floor(z0 / TILE), math.floor(z1 / TILE) + 1):
                for piece in lines(line.intersection(box(tx * TILE, tz * TILE, (tx + 1) * TILE, (tz + 1) * TILE))):
                    if piece.length >= .1:
                        curbs.append({'id': f'jefferson-curb-{len(curbs)}',
                                      'sourceIds': source_ids(piece.buffer(.006)),
                                      'points': list(map(point, piece.coords))})

    walking_corridors = []
    for record in records:
        for i, line in enumerate(lines(record['geom'].intersection(guide_allowed))):
            if line.length >= .1:
                walking_corridors.append({'id': f'jefferson-walking-guide-{record["id"]}-{i}',
                                         'sourceIds': [record['id']], 'points': list(map(point, line.coords)),
                                         'widthM': record['width'], 'category': record['category']})

    result = {'schema': 1, 'topOffsetM': TOP_OFFSET, 'roadOffsetM': ROAD_OFFSET, 'tileSizeM': TILE,
              'surfaces': surfaces, 'curbs': curbs, 'walkingCorridors': walking_corridors,
              'provenance': {
                  'source': source_receipt['source'], 'sourceAttribution': 'Southeast Michigan Council of Governments (SEMCOG)',
                  'snapshotRetrievedUtc': source_receipt['retrievedUtc'],
                  'serviceLastEditUtc': source_receipt['sourceLastEditUtc'],
                  'sourceGeometrySha256': hashlib.sha256(source_raw).hexdigest(),
                  'sourceFeatureCount': len(source['features']), 'selectedFeatureCount': len(records),
                  'selectedSourceIds': sorted(selected_ids), 'categories': dict(Counter(r['category'] for r in records)),
                  'widthSource': 'width_ft multiplied by 0.3048; aerial-derived source values, not a new field survey',
                  'sourceGeometryPreservedInResearchSnapshot': True,
                  'renderGeometry': 'Source-width buffers unioned and clipped; original map/road/building data are unchanged.',
                  'precisionPolicy': 'Derived topology uses a 1 mm grid; final shared ramp/slab intersection vertices retain their exact serialized coordinates to prevent overlapping tops.',
                  'scope': {'bufferM': SCOPE_BUFFER, 'terminalMarginM': TERMINAL_MARGIN},
                  'authoredDimensions': {'topOffsetM': TOP_OFFSET, 'roadOffsetM': ROAD_OFFSET,
                                         'centerlineGuardHalfWidthM': CENTERLINE_GUARD,
                                         'buildingClearanceM': BUILDING_CLEARANCE, 'landInsetM': LAND_INSET,
                                         'renderCoordinateGridM': RENDER_GRID,
                                         'rampDepthChoicesM': [2.1, 1.8], 'rampMaximumWidthM': 2},
                  'curbs': 'Source strip side boundaries only; no crossing/driveway endpoint caps, ramp openings or artificial cut edges.',
                  'crossings': 'Source crossing lines are walking guides and qualify ramp endpoints; no painted markings are generated.',
                  'existingGradeSeparatedPaths': [{'sourceId': 892360,
                                                    'disposition': 'Source snapshot and walking guide retained; excluded only from new raised slabs because existing Dequindre Cut renderer/support preserves its grade-separated route.'}],
                  'limitations': ['Source features were digitized in 2019 and have 2020 secondary edit fields; service edit time is not a photo date.',
                                  'No surveyed curb heights, crossfalls, ramp designs, driveway inventory, or grade-separated crossing elevations are supplied.',
                                  'Derived ramps are authored game geometry and are not accessibility certification.'],
                  'originalGameInputs': input_hashes,
              }}

    # Validate the serialized geometry, including its rounding, not merely the
    # intermediate unions. These checks do not rely on broad asphalt ribbons.
    final_polys = [polygon_from_row(r) for r in surfaces]
    assert all(p.is_valid and p.area > 0 for p in final_polys), 'Invalid serialized walking polygon'
    assert all(r['sourceIds'] and set(r['sourceIds']) <= selected_ids for r in surfaces + curbs + walking_corridors)
    final_union = unary_union(final_polys)
    final_flat = unary_union([p for r, p in zip(surfaces, final_polys) if r['kind'] == 'sidewalk'])
    final_ramps = unary_union([p for r, p in zip(surfaces, final_polys) if r['kind'] == 'ramp'])
    tree = STRtree(final_polys)
    overlap = 0.0
    for i, poly in enumerate(final_polys):
        for j in tree.query(poly):
            if int(j) > i:
                overlap += poly.intersection(final_polys[int(j)]).area
    curb_lines = [LineString(r['points']) for r in curbs]
    curb_union = unary_union(curb_lines)
    integrity = {
        'schema': 1, 'generator': str(Path(__file__).relative_to(REPO)), 'shapelyVersion': shapely.__version__,
        'counts': {'selectedSourceFeatures': len(records), 'surfaces': len(surfaces),
                   'flatSurfacePieces': sum(r['kind'] == 'sidewalk' for r in surfaces),
                   'rampSurfacePieces': sum(r['kind'] == 'ramp' for r in surfaces),
                   'qualifiedRampEndpoints': len(ramps), 'curbRuns': len(curbs),
                   'walkingCorridors': len(walking_corridors),
                   'holes': sum(len(r.get('holes', [])) for r in surfaces)},
        'areaM2': final_union.area, 'pairwiseSurfaceOverlapM2': overlap,
        'flatRampOverlapM2': final_flat.intersection(final_ramps).area,
        'buildingSolidOverlapM2': final_union.intersection(building_solids).area,
        'outsideMappedLandM2': final_union.difference(land).area,
        'vehicleCenterlineIntersectionM': final_union.intersection(vehicle_axis).length,
        'minimumVehicleCenterlineClearanceM': final_union.distance(vehicle_axis),
        'curbInsideCrossingOrRampLengthM': curb_union.intersection(unary_union([crossing_strips, final_ramps])).length,
        'curbInsideArtificialCutLengthM': curb_union.intersection(artificial_edges.buffer(.02)).length,
        'derivedWalkAreaDroppedM2': walk.difference(final_union).area,
        'initialDerivedSlivers': {'count': len(initial_slivers), 'areaM2': sum(p.area for p in initial_slivers)},
        'tiledDerivedSlivers': {'count': len(tile_slivers), 'areaM2': sum(p['areaM2'] for p in tile_slivers)},
        'renderGridSymmetricDifferenceM2': before_precision.symmetric_difference(walk).area,
        'validSourceIds': True, 'originalGameInputsUnchanged': all(digest(p) == input_hashes[str(p.relative_to(REPO))] for p in input_paths),
        'sourceSnapshotGeometrySha256': hashlib.sha256(source_raw).hexdigest(),
    }
    assert integrity['buildingSolidOverlapM2'] < .00001, integrity
    assert integrity['outsideMappedLandM2'] < .00001, integrity
    assert integrity['vehicleCenterlineIntersectionM'] < .00001, integrity
    assert integrity['minimumVehicleCenterlineClearanceM'] >= CENTERLINE_GUARD - .001, integrity
    assert integrity['pairwiseSurfaceOverlapM2'] < .000001, integrity
    assert integrity['flatRampOverlapM2'] < .000001, integrity
    assert integrity['curbInsideCrossingOrRampLengthM'] < .001, integrity
    assert integrity['curbInsideArtificialCutLengthM'] < .001, integrity
    assert integrity['originalGameInputsUnchanged']
    integrity['status'] = 'PASS'
    write_json(OUTPUT, result)
    integrity['runtimeJsonSha256'] = digest(OUTPUT)
    integrity['runtimeJsonBytes'] = OUTPUT.stat().st_size
    write_json(RESEARCH / 'sidewalk-integrity.json', integrity, True)
    rendered_ids = {source_id for row in surfaces for source_id in row['sourceIds']}
    write_json(RESEARCH / 'sidewalk-exclusions.json', {
        'sourceClipping': excluded, 'rampEndpointDecisions': ramp_decisions,
        'initialDerivedSlivers': [{'areaM2': p.area, 'bounds': list(p.bounds), 'sourceIds': source_ids(p)} for p in initial_slivers],
        'tiledDerivedSlivers': tile_slivers,
        'walkSourceIdsWithoutRenderedSurface': [r['id'] for r in walk_records if r['id'] not in rendered_ids],
        'existingGradeSeparatedPathExclusions': [{'sourceId': i, 'sourceAndGuideRetained': True,
                                                  'reason': 'Already-modeled Dequindre Cut route; 2D source has no grade field and must not be unioned into street-level raised pavement.'}
                                                 for i in sorted(EXISTING_GRADE_SEPARATED_PATH_IDS)],
        'note': 'No original source line is deleted from the archived snapshot. Derived fragments are excluded only at documented scope, land, building, centerline or sub-0.01-square-metre cuts.',
    }, True)
    write_json(RESEARCH / 'sidewalk-selected-source-ids.json', {'sourceIds': sorted(selected_ids)}, True)
    print(json.dumps(integrity, indent=2))


if __name__ == '__main__':
    main()
