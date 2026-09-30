import * as T from 'three';
import {GEO,cutWidth,profileLevel,BRIDGE_LEVELS} from '../src/detroit/geo-profile.ts';
import {completeBridges} from '../src/detroit/bridges.ts';
import {heightAt} from '../src/detroit/world.ts';
import {pointOnCut,nearestCut} from '../src/detroit/geography.ts';
import {writeFileSync} from 'node:fs';
const parts=completeBridges(heightAt),material=new T.MeshBasicMaterial({side:T.DoubleSide});
const results=GEO.bridges.map(b=>{
 const group=new T.Group();for(const part of parts.filter(m=>m.bridge===b.name))group.add(new T.Mesh(part.geometry,material));group.updateMatrixWorld(true);
 const ds=b.points.map(p=>nearestCut(p[0],p[1]).d),start=Math.min(...ds)-5,end=Math.max(...ds)+5;
 let lowest={clearance:Infinity,at:0,u:0,part:''},samples=0;
 for(let at=start;at<=end;at+=.5)for(let u=-cutWidth(at)/2;u<=cutWidth(at)/2+.01;u+=cutWidth(at)/8){
  const p=pointOnCut(at,u),ground=heightAt(p.x,p.z),hit=new T.Raycaster(new T.Vector3(p.x,ground+.1,p.z),new T.Vector3(0,1,0),0,20).intersectObject(group,true)[0];
  if(!hit)continue;samples++;const clearance=hit.distance+.1;
  if(clearance<lowest.clearance)lowest={clearance,at,u,part:parts.find(m=>m.geometry===(hit.object as T.Mesh).geometry)?.kind??''};
 }
 const level=BRIDGE_LEVELS.find(l=>l.name===b.name)!;
 return{name:b.name,crossingAt:b.at,samples,streetToTrail:profileLevel(b.at,'street')-profileLevel(b.at,'floor'),required:level.minClearance,raise:level.raise,...lowest,passed:lowest.clearance>=level.minClearance};
});
console.table(results);
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify({units:'metres',spacing:.5,results},null,2)+'\n');
