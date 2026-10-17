/** Coalesce only exactly flat rectangles in the original regular terrain grid.
 * Curved cells, ramp slopes, winding and every original height stay unchanged.
 * No vertex quantization or approximate mesh simplification is performed. */
export function compactGroundGrid(vertices:Float32Array,indices:Uint32Array){
 const count=vertices.length/3,side=Math.sqrt(count),n=side-1;
 if(!Number.isInteger(side)||n<2||indices.length!==n*n*6)return {vertices,indices};
 const dx=vertices[3]-vertices[0],dz=vertices[side*3+2]-vertices[2];
 if(!(dx>0&&dz>0))return {vertices,indices};
 for(let z=0;z<=n;z++)for(let x=0;x<=n;x++){
  const i=z*side+x;
  if(vertices[i*3]!==Math.fround(vertices[0]+dx*x)||vertices[i*3+2]!==Math.fround(vertices[2]+dz*z))return {vertices,indices};
  if(x<n&&z<n){const a=i,b=a+1,c=a+side,d=c+1,k=(z*n+x)*6;
   if(indices[k]!==a||indices[k+1]!==c||indices[k+2]!==b||indices[k+3]!==b||indices[k+4]!==c||indices[k+5]!==d)return {vertices,indices};
  }
 }
 const faces:number[]=[];
 function region(x:number,z:number,w:number,h:number){
  const a=z*side+x,b=a+w,c=(z+h)*side+x,d=c+w,y=vertices[a*3+1];let flat=true;
  outer:for(let j=z;j<=z+h;j++)for(let i=x;i<=x+w;i++)if(vertices[(j*side+i)*3+1]!==y){flat=false;break outer;}
  if(flat||w===1&&h===1){faces.push(a,c,b,b,c,d);return;}
  if(w>=h&&w>1){const half=Math.floor(w/2);region(x,z,half,h);region(x+half,z,w-half,h);}
  else {const half=Math.floor(h/2);region(x,z,w,half);region(x,z+half,w,h-half);}
 }
 region(0,0,n,n);
 if(faces.length>=indices.length)return {vertices,indices};
 const used=new Map<number,number>(),points:number[]=[];
 const compact=Uint32Array.from(faces,i=>{let out=used.get(i);if(out===undefined){out=used.size;used.set(i,out);points.push(vertices[i*3],vertices[i*3+1],vertices[i*3+2]);}return out;});
 return {vertices:Float32Array.from(points),indices:compact};
}
