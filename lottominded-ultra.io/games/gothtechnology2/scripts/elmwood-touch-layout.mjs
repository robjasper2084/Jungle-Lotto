/** Fit the rendered controls without rewriting a player's saved layout. */
export function fitElmwoodTouch(layout,width,height){
 const placed=[],result={};
 const entries=Object.entries(layout).sort(([a,p],[b,q])=>a==='stick'?-1:b==='stick'?1:q.size-p.size);
 for(const [id,p]of entries){
  const r=p.size/2,minX=r+16,maxX=width-r-16,minY=r+Math.min(150,height*.22),maxY=height-r-24;
  const wanted={x:Math.max(minX,Math.min(maxX,p.x*width)),y:Math.max(minY,Math.min(maxY,p.y*height))};
  const clear=(x,y)=>(height>=540||x+r<=width-184||y-r>=Math.min(204,height*.55))&&placed.every(o=>Math.abs(x-o.x)>=r+o.r+6||Math.abs(y-o.y)>=r+o.r+6);
  let best=clear(wanted.x,wanted.y)?wanted:undefined,cost=Infinity;
  if(!best)for(let y=maxY;y>=minY;y-=6)for(let x=minX;x<=maxX;x+=6){
   if(!clear(x,y))continue;
   const value=(x-wanted.x)**2+(y-wanted.y)**2;
   if(value<cost){cost=value;best={x,y};}
  }
  best??=wanted;result[id]=best;placed.push({...best,r});
 }
 return result;
}
