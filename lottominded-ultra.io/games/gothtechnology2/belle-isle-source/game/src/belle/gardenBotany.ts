import * as T from 'three';
import type {GardenForm} from './oudolf.ts';

/** Original small opaque plant meshes: curved leaves, branched stems and
 * different flower silhouettes. Shared across instances; no image downloads. */
export function gardenBotany(form:GardenForm){
 const leaf:number[]=[],flower:number[]=[],lc:number[]=[],fc:number[]=[];
 function tri(out:number[],a:number[],b:number[],c:number[],shade=1){out.push(...a,...b,...c);const colors=out===leaf?lc:fc;for(let i=0;i<3;i++)colors.push(shade,shade,shade);}
 function ribbon(a:number[],b:number[],c:number[],width:number){
  const dx=c[0]-a[0],dz=c[2]-a[2],l=Math.hypot(dx,dz)||1,nx=-dz/l*width,nz=dx/l*width;
  const left=[b[0]+nx,b[1],b[2]+nz],right=[b[0]-nx,b[1]-.025,b[2]-nz];
  tri(leaf,a,left,b,.87);tri(leaf,a,b,right,.72);tri(leaf,left,c,b,1);tri(leaf,b,c,right,.89);
 }
 function stem(x:number,z:number,h:number){
  for(let j=0;j<3;j++){const a=j*2*Math.PI/3,b=(j+1)*2*Math.PI/3;tri(leaf,[x+Math.cos(a)*.009,0,z+Math.sin(a)*.009],[x+Math.cos(b)*.009,0,z+Math.sin(b)*.009],[x+.035,h,z+.018],.7);}
 }
 function disc(x:number,y:number,z:number,r:number,n=6){
  for(let i=0;i<n;i++){const a=i*Math.PI*2/n,b=(i+1)*Math.PI*2/n;
   tri(flower,[x,y+.018,z],[x+Math.cos(a)*r,y,z+Math.sin(a)*r],[x+Math.cos(b)*r,y,z+Math.sin(b)*r],.88+(i%3)*.06);
  }
 }
 const grass=form==='grass';
 for(let i=0;i<(grass?22:14);i++){
  const a=i*2.399,r=.29+(i%4)*.039,dx=Math.cos(a)*r,dz=Math.sin(a)*r;
  const h=grass?.48+(i%7)*.063:.15+(i%4)*.052;
  ribbon([0,.025,0],[dx*.57,h,dz*.57],[dx,h*.58,dz],grass?.019:.045);
 }
 for(let i=0;i<(grass?5:4);i++){
  const a=i*2.399,x=Math.cos(a)*.23,z=Math.sin(a)*.23,h=.73+(i%4)*.08;
  stem(x,z,h);
  if(!grass)for(let j=0;j<3;j++){
   const b=a+j*2.1,dx=Math.cos(b)*.20,dz=Math.sin(b)*.20,y=.18+j*.16;
   ribbon([x,y,z],[x+dx*.6,y+.11,z+dz*.6],[x+dx,y+.08,z+dz],form==='airy'?.025:.042);
  }
  if(form==='umbel'){
   // Yarrow's flat compound heads instead of oversized daisy/star petals.
   for(let j=0;j<7;j++){const b=j*2.399,r=j===0?0:.11;disc(x+.035+Math.cos(b)*r,h+(j%3)*.014,z+.018+Math.sin(b)*r,.065);}
  }else if(form==='spire'){
   for(let j=0;j<7;j++){const b=j*2.399,y=h-.24+j*.043;disc(x+.035+Math.cos(b)*.025,y,z+.018+Math.sin(b)*.025,.045*(1-j*.065),5);}
  }else if(form==='airy'||grass){
   for(let j=0;j<(grass?6:11);j++){
    const b=j*2.399,r=(.04+(j%4)*.043)*(grass?.6:1),y=h-.20+(j%5)*.045;
    const tx=x+Math.cos(b)*r,tz=z+Math.sin(b)*r;
    tri(leaf,[x-.003,y-.09,z],[x+.003,y-.09,z],[tx,y,tz],.85);
    disc(tx,y,tz,grass?.018:.029,4);
   }
  }else{
   disc(x+.035,h+.035,z+.018,.045);
   for(let j=0;j<8;j++){
    const b=j*Math.PI/4,dx=Math.cos(b),dz=Math.sin(b),cx=x+.035,cz=z+.018;
    tri(flower,[cx+dx*.026,h,cz+dz*.026],[cx+dx*.12-dz*.028,h-.07,cz+dz*.12+dx*.028],[cx+dx*.14+dz*.025,h-.09,cz+dz*.14-dx*.025],.90+(j%2)*.1);
   }
  }
 }
 function make(p:number[],color:number[]){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(color,3));g.computeVertexNormals();return g;}
 return {leaf:make(leaf,lc),flower:make(flower,fc)};
}
