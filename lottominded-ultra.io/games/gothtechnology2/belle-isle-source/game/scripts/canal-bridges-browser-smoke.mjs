/** Scoped GPU geometry review of actual mapped crossings and production scene builders.
 * Not a replacement for the existing real-game startup/polish/package gates. */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {build} from 'esbuild';
const game=resolve(import.meta.dirname,'..'),require=createRequire(resolve(game,'../../package.json'));
const {chromium}=require('@playwright/test');
const device=process.env.BELLE_BRIDGE_DEVICE??'desktop';assert(['desktop','phone'].includes(device));
const out=resolve(game,'output/canal-bridges',device);await mkdir(out,{recursive:true});
const report={source:process.env.BRIDGE_SOURCE_SHA??null,head:process.env.GITHUB_SHA??null,device,passed:false,scope:'Actual bridge/pavement/marking modules rendered with the map; isolated geometry fixture, NOT a full-world gameplay/FPS certification.',errors:[],warnings:[],cases:[]};
const entry="\nimport * as T from 'three';\nimport {addSmallBridges} from './src/belle/smallBridgeScene.ts';\nimport {makeSmallBridgePlan} from './src/belle/smallBridges.ts';\nimport {makePavementPlan} from '../tools/pavement-plan.mjs';\nimport {createStreetPlan} from './src/belle/streetPlan.ts';\nimport {addStreetDetails} from './src/belle/streetDetails.ts';\nconst map=window.MAP;\nconst scene=new T.Scene();scene.background=new T.Color('#c8dde7');\nconst renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});\nrenderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;\nrenderer.domElement.id='bridge-review';document.body.append(renderer.domElement);\nscene.add(new T.HemisphereLight(0xe6f5ff,0x5c6146,2.6));const sun=new T.DirectionalLight(0xffefce,2.2);sun.position.set(400,550,300);scene.add(sun);\nconst grass=new T.MeshStandardMaterial({color:0x526844,roughness:1}),water=new T.MeshStandardMaterial({color:0x527e89,roughness:.42,metalness:.05});\nfunction polygon(points,holes,y,material){const shape=new T.Shape(points.map(p=>new T.Vector2(p[0],-p[1])));for(const ring of holes)shape.holes.push(new T.Path(ring.map(p=>new T.Vector2(p[0],-p[1]))));const g=new T.ShapeGeometry(shape);g.rotateX(-Math.PI/2);g.translate(0,y,0);const mesh=new T.Mesh(g,material);scene.add(mesh);}\nconst w=new T.Mesh(new T.PlaneGeometry(14000,11000),water);w.rotation.x=-Math.PI/2;scene.add(w);\nfor(const p of map.landPolygons??[[map.island]])polygon(p[0],p.slice(1),2,grass);\nconst mat={asphalt:new T.MeshStandardMaterial({color:0x555954,roughness:1}),concrete:new T.MeshStandardMaterial({color:0xa6a59b,roughness:.95}),wood:new T.MeshStandardMaterial({color:0x837054,roughness:1}),gravel:new T.MeshStandardMaterial({color:0x8c8066,roughness:1}),pavers:new T.MeshStandardMaterial({color:0x989487,roughness:1})};\nfor(const group of makePavementPlan(map,{bridge:()=>({active:false})}))for(const rings of group.polygons)polygon(rings[0],rings.slice(1),2.065,mat[group.kind]);\nconst plan=makeSmallBridgePlan(map),structure=addSmallBridges(scene,plan),markings=createStreetPlan(map),paint=new T.MeshStandardMaterial({color:0xeee9c9,roughness:.9});\nconst streetDetails=addStreetDetails(scene,markings);\nconst camera=new T.PerspectiveCamera(48,innerWidth/innerHeight,.1,10000);\nwindow.renderBridge=(id,enabled=true)=>{const r=map.roads.find(r=>r.id===id);const a=r.points[0],b=r.points.at(-1),len=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/len,uz=(b[1]-a[1])/len,mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;structure.root.visible=enabled;streetDetails.update(mx,mz);\n const scale=Math.max(24,len*.95);camera.position.set(mx-ux*scale+uz*scale*.64,2+scale*.56,mz-uz*scale-ux*scale*.64);camera.lookAt(mx,2,mz);camera.updateMatrixWorld();renderer.render(scene,camera);const gl=renderer.getContext();return {id,name:r.name,enabled,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,webgl2:gl instanceof WebGL2RenderingContext,renderer:gl.getParameter(gl.RENDERER),structure:structure.stats};};\nwindow.renderCrossing=()=>{structure.root.visible=true;streetDetails.update(2089.14,426.66);camera.position.set(2089.14-26,24,426.66-26);camera.lookAt(2089.14,2,426.66);renderer.render(scene,camera);return {drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};};\nwindow.READY=true;\n";
const bundle=await build({stdin:{contents:entry,resolveDir:game,loader:'ts'},bundle:true,format:'iife',target:'es2022',write:false,logLevel:'error'});
const data=JSON.parse(await readFile(resolve(game,'public/belle/map.json'),'utf8'));
const viewport=device==='phone'?{width:390,height:844}:{width:1280,height:800};
let browser,page;
const deadline=(promise,ms,name)=>{let id;return Promise.race([promise,new Promise((_,reject)=>{id=setTimeout(()=>reject(Error(name+' timed out')),ms);})]).finally(()=>clearTimeout(id));};
try{
 browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 page=await browser.newPage({viewport,deviceScaleFactor:1});
 page.on('pageerror',error=>report.errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());if(message.type()==='warning')report.warnings.push(message.text());});
 await page.setContent('<!doctype html><html><head><title>Belle Isle crossing geometry review</title><style>body{margin:0;overflow:hidden}canvas{display:block}aside{position:absolute;left:12px;top:12px;padding:10px 14px;max-width:80vw;background:#132729e8;color:#eef4eb;font:14px/1.4 system-ui;border-radius:7px;pointer-events:none}</style></head><body><aside id="label">Mapped geometry review—not the complete game</aside></body></html>');
 assert.equal(await page.title(),'Belle Isle crossing geometry review');
 assert(await page.evaluate(()=>!!document.createElement('canvas').getContext('webgl2')),'WebGL2 is required; no placeholder renderer');
 await page.evaluate(data=>window.MAP=data,data);
 await deadline(page.addScriptTag({content:bundle.outputFiles[0].text}),90000,'Geometry preparation');
 await page.waitForFunction(()=>window.READY===true,{},{timeout:90000});
 const snapshot=async(name,result)=>{
  assert.equal(report.errors.length,0,report.errors.join('\n'));
  const pixels=await page.evaluate(()=>{const c=document.querySelector('#bridge-review'),g=c.getContext('webgl2'),pixels=new Uint8Array(c.width*c.height*4);g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,pixels);const colors=new Set();for(let i=0;i<pixels.length;i+=64)colors.add((pixels[i]<<16)|(pixels[i+1]<<8)|pixels[i+2]);return {colors:colors.size,width:c.width,height:c.height};});
  assert(pixels.colors>16,'Nonblank rendered scene required');
  await page.screenshot({path:resolve(out,name+'.png'),timeout:90000});report.cases.push({name,...result,pixels});
 };
 for(const [id,name] of [['107196454','central-loop'],['42986453','picnic-way'],['42986439','woodside'],['509207545','wildwood']]){
  for(const on of (device==='desktop'&&id==='107196454'?[false,true]:[true])){
   const label=name+' · '+(on?'repaired structural geometry':'before structural repair')+' · isolated review';await page.locator('#label').evaluate((e,label)=>e.textContent=label,label);
   const result=await page.evaluate(([id,on])=>window.renderBridge(id,on),[id,on]);assert(result.webgl2);assert(result.structure.triangles<20000);
   await snapshot(name+'-'+(on?'after':'before'),result);
  }
 }
 await page.locator('#label').evaluate(e=>e.textContent='Central Avenue marked crossing · isolated geometry review');
 await snapshot('central-crosswalk',await page.evaluate(()=>window.renderCrossing()));
 assert.equal(report.errors.length,0,report.errors.join('\n'));report.passed=true;
}catch(error){report.failure=String(error);process.exitCode=1;}
finally{
 if(browser)try{await deadline(browser.close(),30000,'Browser cleanup');}catch(error){report.passed=false;report.cleanupFailure=String(error);process.exitCode=1;}
 await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
