/** A dangling branch can be lower than the trunk. Anchor the central bole. */
export function trunkRootHeight(positions:ArrayLike<number>,translationY=0,radius=.5){let root=Infinity;for(let i=0;i<positions.length;i+=3)if(Math.hypot(positions[i],positions[i+2])<=radius)root=Math.min(root,positions[i+1]+translationY);return Number.isFinite(root)?root:0;}
export const cherryTreeSite={x:1164.623,y:2,z:1201.111};
export function replacedByCherry(p:{x:number;z:number}){return Math.hypot(p.x-cherryTreeSite.x,p.z-cherryTreeSite.z)<1;}
