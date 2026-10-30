/** Exact inclusive coverage of the world's 100 m terrain tiles. A clearance
 * search checks many rejected points; inspect only the local tile candidates. */
export function chunkCoverage(chunks:readonly {x:number;z:number}[]){
 const cells=new Map<string,{x:number;z:number}[]>();
 for(const c of chunks)for(let x=Math.floor((c.x-50)/100);x<=Math.floor((c.x+50)/100);x++)for(let z=Math.floor((c.z-50)/100);z<=Math.floor((c.z+50)/100);z++){
  const key=x+','+z,list=cells.get(key)??[];list.push(c);cells.set(key,list);
 }
 return(x:number,z:number)=>(cells.get(Math.floor(x/100)+','+Math.floor(z/100))??[]).some(c=>Math.abs(c.x-x)<=50&&Math.abs(c.z-z)<=50);
}
