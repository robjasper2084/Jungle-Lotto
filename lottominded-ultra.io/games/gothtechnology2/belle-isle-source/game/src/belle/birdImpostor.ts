import * as T from 'three';

/** One tiny original 2D impostor per bird family, without an image request,
 * framebuffer or second renderer. All far birds in a family use one draw. */
export type BirdLook='swan'|'duck'|'goose'|'wader'|'gull';
export function createBirdImpostor(scene:T.Scene,kind:BirdLook,capacity:number){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=80;
 const ctx=canvas.getContext('2d')!;
 const palette={
  swan:{body:'#ecf0e7',head:'#e5eae2',bill:'#e39a52'},
  duck:{body:'#79826d',head:'#34483b',bill:'#ba9b4a'},
  goose:{body:'#8c8171',head:'#202b2a',bill:'#e5a361'},
  wader:{body:'#8c968f',head:'#555d5b',bill:'#cfb082'},
  gull:{body:'#dfe8e4',head:'#f0f0e8',bill:'#b7aa77'}
 }[kind];
 ctx.fillStyle=palette.body;
 ctx.beginPath();ctx.ellipse(40,49,22,11,-.08,0,Math.PI*2);ctx.fill();
 if(kind==='gull'){
  ctx.beginPath();ctx.moveTo(38,43);ctx.lineTo(5,35);ctx.lineTo(28,53);ctx.lineTo(39,49);ctx.lineTo(53,44);ctx.lineTo(77,34);ctx.lineTo(58,53);ctx.closePath();ctx.fill();
 }else{
  ctx.lineWidth=kind==='swan'?7:5;ctx.lineCap='round';ctx.strokeStyle=palette.head;
  ctx.beginPath();ctx.moveTo(50,48);ctx.quadraticCurveTo(kind==='swan'?56:53,23,kind==='swan'?52:55,22);ctx.stroke();
  ctx.beginPath();ctx.ellipse(53,22,5,4,0,0,Math.PI*2);ctx.fillStyle=palette.head;ctx.fill();
  ctx.beginPath();ctx.moveTo(57,23);ctx.lineTo(69,26);ctx.lineTo(57,28);ctx.fillStyle=palette.bill;ctx.closePath();ctx.fill();
  if(kind==='goose'){ctx.fillStyle='#e2e2db';ctx.fillRect(50,27,5,3);}
  if(kind==='wader'){ctx.lineWidth=2;ctx.strokeStyle='#a6947d';ctx.beginPath();ctx.moveTo(35,57);ctx.lineTo(33,74);ctx.moveTo(45,57);ctx.lineTo(48,74);ctx.stroke();}
 }
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=T.LinearFilter;
 const material=new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:T.DoubleSide,alphaTest:.06});
 const geometry=new T.PlaneGeometry(1,1),mesh=new T.InstancedMesh(geometry,material,capacity),dummy=new T.Object3D();
 mesh.name=kind+' distant bird impostors';mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;mesh.count=0;mesh.visible=false;
 mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(mesh);
 return{
  mesh,
  place(index:number,x:number,y:number,z:number,width:number,height:number,viewerX:number,viewerZ:number){
   if(index<0||index>=capacity)throw Error('Bird billboard capacity exceeded');
   dummy.position.set(x,y,z);dummy.rotation.set(0,Math.atan2(viewerX-x,viewerZ-z),0);dummy.scale.set(width,height,1);dummy.updateMatrix();
   mesh.setMatrixAt(index,dummy.matrix);
  },
  finish(count:number){mesh.count=Math.max(0,Math.min(capacity,count));mesh.visible=mesh.count>0;if(mesh.count)mesh.instanceMatrix.needsUpdate=true;},
  dispose(){scene.remove(mesh);geometry.dispose();material.dispose();texture.dispose();}
 };
}
