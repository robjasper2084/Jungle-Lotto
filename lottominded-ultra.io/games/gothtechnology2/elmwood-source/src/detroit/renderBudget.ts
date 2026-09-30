import type * as T from 'three';

// Bound total pixels as well as DPR: a large tablet should not overwhelm Low mode.
export function budgetPixelRatio(dpr:number,limit:number,width:number,height:number,maxPixels:number){
 return Math.min(dpr,limit,Math.sqrt(maxPixels/Math.max(1,width*height)));
}
export function makeTextureBudget(){
 // Texture clones may share a Source. Keep the original by Source so switching
 // back to High always restores detail, regardless of traversal order.
 const originals=new WeakMap<T.Source<unknown>,CanvasImageSource>();
 const sizes=new WeakMap<T.Source<unknown>,number>();
 return (scene:T.Scene,maxSize:number)=>{
  const changed=new Set<T.Source<unknown>>();
  scene.traverse(o=>{
   const mesh=o as T.Mesh;if(!mesh.isMesh)return;
   for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
    for(const value of Object.values(mat)){
     const texture=value as T.Texture;
     if(!texture?.isTexture||texture.isRenderTargetTexture)continue;
     const source=texture.source;
     if(sizes.get(source)===maxSize){if(changed.has(source))texture.needsUpdate=true;continue;}
     const original=originals.get(source)??texture.image;
     const supported=(typeof HTMLImageElement!=='undefined'&&original instanceof HTMLImageElement)
       ||(typeof ImageBitmap!=='undefined'&&original instanceof ImageBitmap);
     if(!supported)continue;
     const width='naturalWidth' in original?original.naturalWidth:original.width,height='naturalHeight' in original?original.naturalHeight:original.height;
     if(!width||!height)continue;
     originals.set(source,original);
     const ratio=Math.min(1,maxSize/Math.max(width,height));
     if(ratio<1){
      const target=document.createElement('canvas');target.width=Math.max(1,Math.round(width*ratio));target.height=Math.max(1,Math.round(height*ratio));
      const ctx=target.getContext('2d');if(!ctx)continue;
      ctx.drawImage(original,0,0,target.width,target.height);texture.image=target;
     }else texture.image=original;
     sizes.set(source,maxSize);changed.add(source);texture.needsUpdate=true;
    }
   }
  });
 };
}

