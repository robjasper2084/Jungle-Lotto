import * as T from 'three';

/** Each bridge finish spans the whole crossing in one mesh. Keep that single
 * draw but order its opaque triangles by span, so a camera halfway across can
 * skip spans behind it. A span's bounds include all three triangle vertices. */
export function cullMacArthurSpans(root:T.Object3D){
 const clip=new T.Matrix4(),frustum=new T.Frustum();
 root.traverse(object=>{
  if(!(object instanceof T.Mesh)||!/^MacArthur[ _]/.test(object.name))return;
  const mesh:T.Mesh=object,source=mesh.geometry,index=source.index,material=mesh.material;
  if(!index||Array.isArray(material)||material.transparent||source.groups.length||
   source.drawRange.start!==0||source.drawRange.count!==Infinity||source.morphAttributes.position||
   ('displacementMap' in material&&material.displacementMap))return;
  const pos=source.getAttribute('position');
  if(!source.boundingBox)source.computeBoundingBox();
  const {min,max}=source.boundingBox!,alongX=max.x-min.x>max.z-min.z;
  const start=alongX?min.x:min.z,length=alongX?max.x-min.x:max.z-min.z;
  if(length<100||!Number.isFinite(length))return;
  const spanCount=Math.min(64,Math.ceil(length/20));
  const spans=Array.from({length:spanCount},()=>({bounds:new T.Box3(),start:0,count:0}));
  const which=new Uint8Array(index.count/3),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
  for(let i=0;i<index.count;i+=3){
   a.fromBufferAttribute(pos,index.getX(i));b.fromBufferAttribute(pos,index.getX(i+1));c.fromBufferAttribute(pos,index.getX(i+2));
   const center=alongX?(a.x+b.x+c.x)/3:(a.z+b.z+c.z)/3;
   const slot=Math.max(0,Math.min(spanCount-1,Math.floor((center-start)*spanCount/length)));
   which[i/3]=slot;
   const span=spans[slot];span.bounds.expandByPoint(a).expandByPoint(b).expandByPoint(c);span.count+=3;
  }
  let offset=0;
  for(const span of spans){span.start=offset;offset+=span.count;span.bounds.expandByScalar(.01);}
  const next=spans.map(span=>span.start),ordered=index.array.slice();
  for(let i=0;i<index.count;i+=3){
   const slot=which[i/3],to=next[slot];next[slot]+=3;
   ordered[to]=index.getX(i);ordered[to+1]=index.getX(i+1);ordered[to+2]=index.getX(i+2);
  }
  const display=new T.BufferGeometry();
  for(const [name,attribute] of Object.entries(source.attributes))display.setAttribute(name,attribute);
  display.setIndex(new T.BufferAttribute(ordered,1));
  display.boundingSphere=source.boundingSphere;display.boundingBox=source.boundingBox;
  mesh.geometry=display;
  const raycast=mesh.raycast,before=mesh.onBeforeRender,after=mesh.onAfterRender;
  const beforeShadow=mesh.onBeforeShadow,afterShadow=mesh.onAfterShadow;
  mesh.raycast=function(ray,hits){
   const active=this.geometry;this.geometry=source;
   try{raycast.call(this,ray,hits);}finally{this.geometry=active;}
  };
  function selectSpans(camera:T.Camera){
   clip.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(mesh.matrixWorld);
   frustum.setFromProjectionMatrix(clip,camera.coordinateSystem,camera.reversedDepth);
   let first=0,last=spans.length-1;
   while(first<=last&&(!spans[first].count||!frustum.intersectsBox(spans[first].bounds)))first++;
   while(last>=first&&(!spans[last].count||!frustum.intersectsBox(spans[last].bounds)))last--;
   if(first>last)display.setDrawRange(0,0);
   else display.setDrawRange(spans[first].start,spans[last].start+spans[last].count-spans[first].start);
  }
  mesh.onBeforeRender=function(...args){
   before.apply(this,args);
   const [renderer,,camera,geometry]=args;
   if(geometry===display&&!renderer.xr.isPresenting&&!renderer.getRenderTarget())selectSpans(camera);
  };
  mesh.onAfterRender=function(...args){display.setDrawRange(0,Infinity);after.apply(this,args);};
  mesh.onBeforeShadow=function(...args){
   beforeShadow.apply(this,args);
   const [renderer,,,shadowCamera,geometry,depthMaterial]=args;
   // Use the light's view, which can include casters off-screen to the rider.
   // The authored bounds cannot account for vertex displacement.
   if(geometry===display&&!renderer.xr.isPresenting&&
      !('displacementMap' in depthMaterial&&depthMaterial.displacementMap)&&!this.customDepthMaterial&&!this.customDistanceMaterial)
    selectSpans(shadowCamera);
  };
  mesh.onAfterShadow=function(...args){display.setDrawRange(0,Infinity);afterShadow.apply(this,args);};
 });
}
