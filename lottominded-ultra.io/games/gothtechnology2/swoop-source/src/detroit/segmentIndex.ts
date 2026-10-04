type Segment={ax:number;ay:number;bx:number;by:number};
type Node={minX:number;minY:number;maxX:number;maxY:number;ids?:number[];left?:Node;right?:Node};
/** Exact nearest-segment search. Bounds prune work without changing lane or ground geometry. */
export class SegmentIndex {
 private root:Node;
 private segments:readonly Segment[];
 constructor(segments:readonly Segment[]){
  this.segments=segments;
  if(!segments.length)throw new Error('A lane index needs at least one segment');
  const build=(ids:number[]):Node=>{
   const node:Node={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
   for(const id of ids){const s=segments[id];node.minX=Math.min(node.minX,s.ax,s.bx);node.minY=Math.min(node.minY,s.ay,s.by);node.maxX=Math.max(node.maxX,s.ax,s.bx);node.maxY=Math.max(node.maxY,s.ay,s.by);}
   if(ids.length<=8)node.ids=ids;
   else{const horizontal=node.maxX-node.minX>=node.maxY-node.minY;ids.sort((a,b)=>{const x=segments[a],y=segments[b];return horizontal?x.ax+x.bx-y.ax-y.bx:x.ay+x.by-y.ay-y.by;});const half=ids.length>>1;node.left=build(ids.slice(0,half));node.right=build(ids.slice(half));}
   return node;
  };this.root=build(segments.map((_,i)=>i));
 }
 nearest(x:number,y:number){
  let best=Infinity,id=Infinity,px=0,py=0;
  const bound=(n:Node)=>{const dx=Math.max(n.minX-x,0,x-n.maxX),dy=Math.max(n.minY-y,0,y-n.maxY);return dx*dx+dy*dy;};
  const visit=(n:Node)=>{
   if(bound(n)>best)return;
   if(n.ids){for(const i of n.ids){const s=this.segments[i],dx=s.bx-s.ax,dy=s.by-s.ay,t=Math.max(0,Math.min(1,((x-s.ax)*dx+(y-s.ay)*dy)/(dx*dx+dy*dy||1))),xx=s.ax+t*dx,yy=s.ay+t*dy,d=(x-xx)**2+(y-yy)**2;if(d<best||d===best&&i<id){best=d;id=i;px=xx;py=yy;}}}
   else{const a=n.left!,b=n.right!;if(bound(a)<=bound(b)){visit(a);visit(b);}else{visit(b);visit(a);}}
  };visit(this.root);return {index:id,distance:Math.sqrt(best),x:px,y:py};
 }
}
