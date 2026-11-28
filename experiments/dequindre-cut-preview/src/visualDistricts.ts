import * as T from 'three';
import clipping from 'polygon-clipping';
import {districts as originalDistricts} from '../../../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/src/belle/detroitGround.ts';
import {MACK_STUDIO} from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/mackStudioSite.ts';
import {LOTTO_SHOP} from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/lottoShopSite.ts';
import {PENNY_SHOP} from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/pennyShopSite.ts';
import {ARETHA} from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/waterfrontSite.ts';
import {JAZZ_CLUBS} from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/jazzSites.ts';
import {fromSourceMap} from './geo.ts';
import type {ParkTerrain} from './terrain.ts';

type Point=[number,number];
type Polygon=Point[][];
type MultiPolygon=Polygon[];

/** Only the isolated compilation redirects visual consumers to this data.
 * Navigation and the production terrain module retain their original data.
 * We subtract the actual imported tiles, never an arbitrary city rectangle. */
export let districts=originalDistricts;
let footprint:MultiPolygon=[];
let footprintFailure:{operation:string;sourceMapPolygons:MultiPolygon;message:string}|null=null;
let bounds={minX:Infinity,minZ:Infinity,maxX:-Infinity,maxZ:-Infinity};
export const overlapReceipt={configured:false,sourceTiles:0,sourceFootprintInputs:0,sourcePolygons:0,replacedBuildingIds:[] as string[],retainedBoundaryBuildingIds:[] as string[],oldCutReplaced:false,clippedMeshes:0,removedTriangles:0,splitTriangles:0};

function closed(ring:Point[]):Point[]{
  if(!ring.length)return [];
  const first=ring[0],last=ring.at(-1)!;
  return first[0]===last[0]&&first[1]===last[1]?ring:[...ring,first];
}

export function configureVisualDistricts(terrain:ParkTerrain){
  if(overlapReceipt.configured)throw Error('Preview mainland overlap has already been configured.');
  const pieces:Polygon[]=terrain.swoopCoverage.mapFootprintPolygons().map(polygon=>polygon.map(closed));
  if(!pieces.length)throw Error('Cannot replace mainland surfaces without source terrain.');
  // Resolve shared tile/triangle edges in their original coordinate frame.
  // Projecting thousands of coincident input edges independently introduces
  // rounding differences. One affine transform of the final boundary preserves
  // the same footprint without snapping, enlarging or removing any surface.
  let sourceUnion:MultiPolygon;
  try{sourceUnion=clipping.union(pieces[0],...pieces.slice(1)) as MultiPolygon;}
  catch(error){footprintFailure={operation:'source-map footprint union',sourceMapPolygons:pieces,message:error instanceof Error?error.message:String(error)};throw error;}
  footprint=sourceUnion.map(polygon=>polygon.map(ring=>ring.map(([x,z])=>{const p=fromSourceMap(x,0,z);return [p.x,p.z] as Point;})));
  for(const polygon of footprint)for(const ring of polygon)for(const [x,z]of ring){bounds.minX=Math.min(bounds.minX,x);bounds.maxX=Math.max(bounds.maxX,x);bounds.minZ=Math.min(bounds.minZ,z);bounds.maxZ=Math.max(bounds.maxZ,z);}
  const replacementIds=new Set([
    ...terrain.sourceWorld.buildingMeshes.map(b=>b.data.id),
    MACK_STUDIO.osmId,LOTTO_SHOP.osmId,PENNY_SHOP.osmId,ARETHA.osmId,
    '105519122','777936147',...JAZZ_CLUBS.map(s=>s.osmId),
  ]);
  const buildings=originalDistricts.buildings.filter(b=>{
    if(replacementIds.has(b.id)){overlapReceipt.replacedBuildingIds.push(b.id);return false;}
    // Never delete an unmatched building merely because its bounding box
    // overlaps a new tile. Keep it visible and record it for the source audit.
    if(clipping.intersection([closed(b.points)],footprint).length)overlapReceipt.retainedBoundaryBuildingIds.push(b.id);
    return true;
  });
  terrain.configureReplacedHostBuildings(new Set(overlapReceipt.replacedBuildingIds));
  districts={...originalDistricts,
    flat:originalDistricts.flat.flatMap(p=>clipping.difference(p.map(closed),footprint)) as typeof originalDistricts.flat,
    buildings,
    // Source scenery and its exact physics replace every old simplified Cut
    // bank, trail and overpass. Other districts and mainland roads are retained.
    greenway:[],bridges:[],
  };
  Object.assign(overlapReceipt,{configured:true,sourceTiles:terrain.swoopCoverage.cellCount,sourceFootprintInputs:pieces.length,sourcePolygons:footprint.length,oldCutReplaced:true});
}

export function sourceFootprint():MultiPolygon{return footprint;}
export function sourceFootprintFailure(){return footprintFailure;}
export function resetVisualDistrictsForTest(){districts=originalDistricts;footprint=[];footprintFailure=null;bounds={minX:Infinity,minZ:Infinity,maxX:-Infinity,maxZ:-Infinity};Object.assign(overlapReceipt,{configured:false,sourceTiles:0,sourceFootprintInputs:0,sourcePolygons:0,replacedBuildingIds:[],retainedBoundaryBuildingIds:[],oldCutReplaced:false,clippedMeshes:0,removedTriangles:0,splitTriangles:0});}

/** Exact triangle/footprint difference for existing road ribbons and flat
 * surfaces. Outside triangles retain the original attribute values. New edge
 * vertices interpolate every original attribute, keeping the same material,
 * height, normals, UVs and road coordinates. This runs once during loading. */
export function clipHostSurface(geometry:T.BufferGeometry):T.BufferGeometry{
  if(!overlapReceipt.configured)throw Error('Source footprint must be prepared before mainland geometry.');
  const position=geometry.getAttribute('position');
  if(!position||position.count===0)return geometry;
  geometry.computeBoundingBox();const box=geometry.boundingBox!;
  if(box.max.x<bounds.minX||box.min.x>bounds.maxX||box.max.z<bounds.minZ||box.min.z>bounds.maxZ)return geometry;
  const attributes=Object.entries(geometry.attributes);
  if(attributes.some(([,a])=>a instanceof T.InterleavedBufferAttribute))throw Error('Unexpected interleaved mainland road attribute.');
  const arrays=new Map(attributes.map(([name])=>[name,[] as number[]]));
  const groups:{start:number;count:number;materialIndex:number}[]=[];
  const index=geometry.index;
  let outputCount=0,changed=false;
  function append(indices:number[],weights:number[],material:number){
    for(const [name,attribute]of attributes){
      const a=attribute as T.BufferAttribute,target=arrays.get(name)!;
      for(let c=0;c<a.itemSize;c++){
        let value=0;for(let j=0;j<indices.length;j++)value+=a.getComponent(indices[j],c)*weights[j];
        target.push(value);
      }
    }
    const previous=groups.at(-1);
    if(previous?.materialIndex===material)previous.count++;
    else groups.push({start:outputCount,count:1,materialIndex:material});
    outputCount++;
  }
  const count=index?.count??position.count;
  for(let offset=0;offset+2<count;offset+=3){
    const ids=[0,1,2].map(k=>index?index.getX(offset+k):offset+k);
    const p=ids.map(i=>[position.getX(i),position.getZ(i)] as Point);
    const material=geometry.groups.find(g=>offset>=g.start&&offset<g.start+g.count)?.materialIndex??0;
    const area=(p[1][0]-p[0][0])*(p[2][1]-p[0][1])-(p[1][1]-p[0][1])*(p[2][0]-p[0][0]);
    if(Math.abs(area)<1e-12||Math.max(...p.map(v=>v[0]))<bounds.minX||Math.min(...p.map(v=>v[0]))>bounds.maxX||Math.max(...p.map(v=>v[1]))<bounds.minZ||Math.min(...p.map(v=>v[1]))>bounds.maxZ){
      for(const id of ids)append([id],[1],material);continue;
    }
    const triangle=[closed(p)];
    const intersection=clipping.intersection(triangle,footprint);
    if(!intersection.length){for(const id of ids)append([id],[1],material);continue;}
    changed=true;
    const remainder=clipping.difference(triangle,footprint) as MultiPolygon;
    if(!remainder.length){overlapReceipt.removedTriangles++;continue;}
    overlapReceipt.splitTriangles++;
    for(const [outer,...holes]of remainder){
      const open=(r:Point[])=>r.slice(0,-1).map(([x,z])=>new T.Vector2(x,z));
      const contour=open(outer),cutouts=holes.map(open),vertices=[...contour,...cutouts.flat()];
      const faces=T.ShapeUtils.triangulateShape(contour,cutouts);
      for(const face of faces){
        const a=vertices[face[0]],b=vertices[face[1]],c=vertices[face[2]];
        if(((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))*area<0)[face[1],face[2]]=[face[2],face[1]];
        for(const v of face){
          const q=vertices[v];
          const w1=((q.x-p[0][0])*(p[2][1]-p[0][1])-(q.y-p[0][1])*(p[2][0]-p[0][0]))/area;
          const w2=((p[1][0]-p[0][0])*(q.y-p[0][1])-(p[1][1]-p[0][1])*(q.x-p[0][0]))/area;
          append(ids,[1-w1-w2,w1,w2],material);
        }
      }
    }
  }
  if(!changed)return geometry;
  const clipped=new T.BufferGeometry();
  for(const [name,attribute]of attributes){
    // Geometry coordinates and interpolated UVs remain floats even when an
    // original normalized attribute used integers.
    const a=attribute as T.BufferAttribute;
    clipped.setAttribute(name,new T.Float32BufferAttribute(arrays.get(name)!,a.itemSize));
  }
  for(const g of groups)clipped.addGroup(g.start,g.count,g.materialIndex);
  clipped.name=geometry.name;clipped.userData={...geometry.userData,dequindreOverlapClipped:true};
  clipped.computeBoundingBox();clipped.computeBoundingSphere();
  overlapReceipt.clippedMeshes++;
  geometry.dispose();return clipped;
}
