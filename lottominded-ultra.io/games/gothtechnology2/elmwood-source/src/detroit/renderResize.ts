type Renderer={getPixelRatio:()=>number;setPixelRatio:(ratio:number)=>void;setSize:(width:number,height:number)=>void};
/** Avoid repeated canvas reallocations when only draw distance or LOD changes. */
export function makeRenderResize(renderer:Renderer){let width=0,height=0;return (w:number,h:number,ratio:number)=>{if(Math.abs(renderer.getPixelRatio()-ratio)>.001)renderer.setPixelRatio(ratio);if(w!==width||h!==height){width=w;height=h;renderer.setSize(w,h);}};}
