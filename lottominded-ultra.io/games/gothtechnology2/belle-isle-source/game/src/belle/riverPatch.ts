/** Shared, bounded river patch topology. No per-frame geometry allocation. */
export const RIVER_PATCH_SIZE=400;
export const RIVER_PATCH_SEGMENTS=128;

/** Smooth water is a single flat plane. Keep every perimeter subdivision at
 * the ring seam and refer to the existing centre and boundary vertices. */
export function flatRiverPatchIndex(){
 const segments=RIVER_PATCH_SEGMENTS,stride=segments+1,centre=(segments/2)*(stride+1);
 const perimeter:number[]=[];
 for(let i=0;i<segments;i++)perimeter.push(i);
 for(let i=0;i<segments;i++)perimeter.push(i*stride+segments);
 for(let i=0;i<segments;i++)perimeter.push(segments*stride+segments-i);
 for(let i=0;i<segments;i++)perimeter.push((segments-i)*stride);
 const indices=new Uint16Array(perimeter.length*3);
 for(let i=0;i<perimeter.length;i++)indices.set([centre,perimeter[(i+1)%perimeter.length],perimeter[i]],i*3);
 return indices;
}

export function riverFarRing(size=RIVER_PATCH_SIZE,segments=RIVER_PATCH_SEGMENTS,outerHalf=9000){
 if(!Number.isFinite(size)||size<1||size>2000||!Number.isSafeInteger(segments)||segments<1||segments>256||!Number.isFinite(outerHalf)||outerHalf<=size/2||outerHalf>50000)throw Error('Invalid river ring dimensions');
 const positions:number[]=[],uv:number[]=[],indices:number[]=[],count=segments*4;
 // Every inner edge vertex is identical to the existing near PlaneGeometry grid.
 // Matching subdivisions avoid T-junction cracks without overlapping water sheets.
 for(const half of [size/2,outerHalf])for(let i=0;i<count;i++){
  const side=Math.floor(i/segments),t=i%segments/segments;
  const x=side===0?-half+2*half*t:side===1?half:side===2?half-2*half*t:-half;
  const z=side===0?-half:side===1?-half+2*half*t:side===2?half:half-2*half*t;
  positions.push(x,0,z);uv.push(x/8,z/8);
 }
 for(let i=0;i<count;i++){const next=(i+1)%count;indices.push(i,next,count+next,i,count+next,count+i);}
 return {positions,uv,indices};
}
