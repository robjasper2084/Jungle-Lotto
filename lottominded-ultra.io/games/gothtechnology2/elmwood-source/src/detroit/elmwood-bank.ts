export type BankSurface={x0:number;y0:number;dx:number;dy:number;cols:number;rows:number;heights:number[]};
export type BankPlacement={position:number[];rotation:number;bankSurface?:BankSurface};
/** The exact NW-SE triangles used by the authored Blender hillside. */
export function bankHeight(p:BankPlacement,x:number,north:number):number|undefined{
  const b=p.bankSurface;if(!b)return;
  const c=Math.cos(p.rotation),s=Math.sin(p.rotation),dx=x-p.position[0],dn=north-p.position[1];
  const u=(c*dx+s*dn-b.x0)/b.dx,v=(-s*dx+c*dn-b.y0)/b.dy;
  if(u<0||v<0||u>=b.cols-1||v>=b.rows-1)return;
  const i=Math.floor(u),j=Math.floor(v),a=u-i,d=v-j,h=b.heights,k=j*b.cols+i;
  return p.position[2]+(a>=d?h[k]+(h[k+1]-h[k])*a+(h[k+b.cols+1]-h[k+1])*d:h[k]+(h[k+b.cols+1]-h[k+b.cols])*a+(h[k+b.cols]-h[k])*d);
}
