import test from 'node:test';
import assert from 'node:assert/strict';
import {MACARTHUR,ELMWOOD_ANCHOR,macarthurAnchorPair,macarthurBridgePoint,elmwoodGateShared,geoFromShared,sharedFromGeo,fromShared,toShared,toGlobalGeo,fromGlobalGeo,transferAcrossVerifiedSeam,portalStates} from '../src/connectionMath.ts';
const close=(a,b,limit=.1)=>assert.ok(Math.abs(a-b)<limit,String(a)+' differs from '+String(b));
test('Belle Isle OSM bridge endpoints round trip to their geographic anchors',()=>{
 const a=macarthurAnchorPair(); const p=geoFromShared(a.island),q=geoFromShared(a.mainland);
 close(p.lat,MACARTHUR.island.lat,1e-8);close(p.lon,MACARTHUR.island.lon,1e-8);
 close(q.lat,MACARTHUR.mainland.lat,1e-8);close(q.lon,MACARTHUR.mainland.lon,1e-8);
 const middle=macarthurBridgePoint(.5);close(middle.x,(a.island.x+a.mainland.x)/2);
 close(middle.z,(a.island.z+a.mainland.z)/2);
});
test('bridge is nonzero length, lies between its endpoint latitudes and has no assumed height datum',()=>{
 const a=macarthurAnchorPair(),dist=Math.hypot(a.island.x-a.mainland.x,a.island.z-a.mainland.z);
 assert.ok(dist>400&&dist<900);assert.equal(typeof a.island.y,'undefined');
 assert.throws(()=>macarthurBridgePoint(-.01),RangeError);assert.throws(()=>macarthurBridgePoint(1.01),RangeError);
});
test('Swoop right-handed rotated frame preserves point and heading',()=>{
 const source={x:345.12,z:-612.18},geo=toGlobalGeo('swoop-detroit',source),back=fromGlobalGeo('swoop-detroit',geo);
 close(back.x,source.x,1e-7);close(back.z,source.z,1e-7);
});
test('All three district local meters round trip within 0.1 m',()=>{
 for(const d of ['belle-isle','swoop-detroit','elmwood']){
  const point=d==='elmwood'?{x:-153.6358,z:-468.1876}:{x:200,z:-1500};
  const back=fromShared(d,toShared(d,point));close(back.x,point.x,.1);close(back.z,point.z,.1);
 }
});
test('Elmwood gate is near its known single-control geodetic anchor, not the MacArthur landing',()=>{
 const gate=elmwoodGateShared(),latlon=geoFromShared(gate);
 assert.ok(latlon.lat>42.34&&latlon.lat<42.35);
 assert.ok(latlon.lon>-83.03&&latlon.lon<-83.01);
 assert.ok(Math.hypot(gate.x-macarthurAnchorPair().mainland.x,gate.z-macarthurAnchorPair().mainland.z)>1000);
});
test('Missing vertical datum, navigation or collision blocks a false travel handoff',()=>{
 const pose={position:{x:0,y:8,z:0},headingY:.3,speedMps:5},
 base={source:'belle-isle',destination:'swoop-detroit',sourceGroundY:2,destinationGroundY:0,geometryAligned:true,collisionContinuous:true,navLinkReady:true,assetPreloaded:true,verticalDatumVerified:true};
 for(const k of ['geometryAligned','collisionContinuous','navLinkReady','assetPreloaded','verticalDatumVerified']){
  assert.throws(()=>transferAcrossVerifiedSeam(pose,{...base,[k]:false}),/unverified/);
 }
 assert.throws(()=>transferAcrossVerifiedSeam(pose,{...base,sourceGroundY:NaN}),/unverified/);
});
test('Verified hypothetical pose transform conserves speed, world heading and ground-relative height',()=>{
 const pose={position:{x:95,y:4,z:180},headingY:1.12,speedMps:9.6};
 const a=transferAcrossVerifiedSeam(pose,{source:'belle-isle',destination:'swoop-detroit',sourceGroundY:2,destinationGroundY:5,geometryAligned:true,collisionContinuous:true,navLinkReady:true,assetPreloaded:true,verticalDatumVerified:true});
 const back=transferAcrossVerifiedSeam(a,{source:'swoop-detroit',destination:'belle-isle',sourceGroundY:5,destinationGroundY:2,geometryAligned:true,collisionContinuous:true,navLinkReady:true,assetPreloaded:true,verticalDatumVerified:true});
 close(back.position.x,pose.position.x,.1);close(back.position.z,pose.position.z,.1);close(back.position.y,pose.position.y,.000001);close(back.speedMps,pose.speedMps,.000001);
 close(Math.sin(back.headingY),Math.sin(pose.headingY),.00001);
 close(Math.cos(back.headingY),Math.cos(pose.headingY),.00001);
});
test('Neither corridor is labelled playable without real-world assets and collision',()=>{
 assert.equal(portalStates().length,2);
 assert.ok(portalStates().every(p=>!p.connected));
});
