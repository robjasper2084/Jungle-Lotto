import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {ParkMap} from './terrain.ts';
import {CONSERVATORY_SEATS,CONSERVATORY_POTS,conservatoryPondPlan} from './conservatoryGardenPlan.ts';

type V=[number,number,number];
type Bed={u:number;v:number;rx:number;ry:number};
type Kind='leaf'|'stone'|'iron'|'pot'|'bark';

/** Original geometry informed by the supplied fernery and koi-pond photographs.
 * Five opaque batches, no new textures or per-plant draw calls. Local +z is -v. */
export function addConservatoryGarden(scene:T.Scene,map:ParkMap){
  const cfg=map.conservatory,root=new T.Group();
  root.name='Conservatory · fernery and pond photo details';root.visible=false;scene.add(root);
  if(!cfg)return{root,stats:{batches:0,triangles:0,fernCrowns:0,bankPlants:0,reedIslands:0},update(_x:number,_z:number){}};
  root.position.set(cfg.center[0],2.08,cfg.center[1]);root.rotation.y=cfg.yaw;
  const groups:Record<Kind,T.BufferGeometry[]>={leaf:[],stone:[],iron:[],pot:[],bark:[]};
  const foliage:number[]=[],colors:number[]=[];
  const palette=[0x426f24,0x679036,0x315b2c,0x849d3c,0x496f32,0x244b2c];
  let seed=111426,fernCrowns=0;
  const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  function colored(g:T.BufferGeometry,color:number,kind:Kind){
    const flat=g.index?g.toNonIndexed():g;if(flat!==g)g.dispose();
    flat.deleteAttribute('uv');const a=flat.attributes.position,c=new T.Color(color),values=new Float32Array(a.count*3);
    for(let i=0;i<a.count;i++)c.toArray(values,i*3);
    flat.setAttribute('color',new T.BufferAttribute(values,3));groups[kind].push(flat);
  }
  function shape(g:T.BufferGeometry,p:V,s:V,color:number,kind:Kind,yaw=0){g.scale(...s);g.rotateY(yaw);g.translate(...p);colored(g,color,kind);}
  function rock(p:V,s:V,color=0x77745a){
    const g=new T.IcosahedronGeometry(1,1),a=g.attributes.position;
    for(let i=0;i<a.count;i++){
      const x=a.getX(i),y=a.getY(i),z=a.getZ(i),r=1+.12*Math.sin(x*21+z*17)*Math.cos(y*19-x*9);
      a.setXYZ(i,x*r,y*r,z*r);
    }
    g.computeVertexNormals();shape(g,p,s,color,'stone',rnd()*6.28);
  }
  function tube(points:V[],radius:number,color:number,kind:Kind){
    const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
    colored(new T.TubeGeometry(path,Math.max(3,points.length*2),radius,4,false),color,kind);
  }
  function blade(base:V,tip:V,width:number,color:number,arch=.12,bed?:Bed){
    const dx=tip[0]-base[0],dz=tip[2]-base[2],len=Math.hypot(dx,dz)||1,sx=-dz/len,sz=dx/len,c=new T.Color(color);
    const rows:V[][]=[];
    for(let i=0;i<=6;i++){
      const t=i/6,w=width*Math.pow(Math.sin(t*Math.PI),.8),y=base[1]+(tip[1]-base[1])*t+arch*Math.sin(t*Math.PI);
      const x=base[0]+dx*t,z=base[2]+dz*t;
      rows.push([-1,0,1].map(side=>{
        const p:V=[x+sx*w*side,y+(side===0?w*.16:0),z+sz*w*side];
        // Keep the complete leaf silhouette inside the existing bed edge.
        if(bed&&p[1]<2.15){const r=Math.hypot((p[0]-bed.u)/(bed.rx-.12),(-p[2]-bed.v)/(bed.ry-.12));if(r>1){p[0]=bed.u+(p[0]-bed.u)/r;p[2]=-bed.v+(p[2]+bed.v)/r;}}
        return p;
      }));
    }
    for(let i=0;i<6;i++)for(let side=0;side<2;side++){
      for(const p of [rows[i][side],rows[i+1][side],rows[i+1][side+1],rows[i][side],rows[i+1][side+1],rows[i][side+1]]){
        foliage.push(...p);colors.push(c.r*(side?.91:1),c.g*(side?.94:1),c.b*(side?.9:1));
      }
    }
  }
  function fern(u:number,v:number,height:number,spread:number,bed?:Bed){
    fernCrowns++;const base:V=[u,height,-v];
    if(height>1)tube([[u,.42,-v],[u+.04,height*.55,-v+.05],base],.065,0x53432c,'bark');
    for(let f=0;f<9;f++){
      const a=f*2.399+rnd()*.2,dx=Math.cos(a),dz=Math.sin(a),length=spread*(.78+rnd()*.22);
      const pos=(t:number):V=>[u+dx*length*t,height+length*(.82*t-.97*t*t),-v+dz*length*t];
      const rib=[pos(0),pos(.3),pos(.65),pos(1)],ribColor=new T.Color(0x69823b);
      for(let k=1;k<rib.length;k++)for(const p of [rib[k-1],[rib[k][0]+.006,rib[k][1],rib[k][2]] as V,[rib[k][0]-.006,rib[k][1],rib[k][2]] as V]){foliage.push(...p);colors.push(ribColor.r,ribColor.g,ribColor.b);}
      for(let j=1;j<11;j++)for(const sign of[-1,1]){
        const t=j/12,q=pos(t),w=length*.23*Math.sin(Math.PI*t),advance=length*.105;
        const tip:V=[q[0]-dz*w*sign+dx*advance,q[1]-.035-w*.18,q[2]+dx*w*sign+dz*advance];
        const mid:V=[(q[0]+tip[0])*.5,(q[1]+tip[1])*.5+.025,(q[2]+tip[2])*.5];
        const width=length*.040,c=new T.Color(palette[(f+j)%palette.length]);
        const left:V=[mid[0]-dx*width,mid[1],mid[2]-dz*width],right:V=[mid[0]+dx*width,mid[1],mid[2]+dz*width];
        for(const source of [q,left,tip,q,tip,right]){
          const p:V=[...source];
          if(bed&&p[1]<2.15){const r=Math.hypot((p[0]-bed.u)/(bed.rx-.12),(-p[2]-bed.v)/(bed.ry-.12));if(r>1){p[0]=bed.u+(p[0]-bed.u)/r;p[2]=-bed.v+(p[2]+bed.v)/r;}}
          foliage.push(...p);colors.push(c.r,c.g,c.b);
        }
      }
    }
  }
  function broad(u:number,v:number,y:number,spread:number,tall:number,bed?:Bed,red=false){
    for(let j=0;j<8;j++){
      const a=j*2.399+rnd()*.3,r=spread*(.65+rnd()*.35),dx=Math.cos(a),dz=Math.sin(a),h=y+tall*(.65+rnd()*.35);
      const base:V=[u,y,-v],start:V=[u+dx*r*.25,h-.22,-v+dz*r*.25],end:V=[u+dx*r,h-.12,-v+dz*r];
      tube([base,[u+dx*r*.1,y+tall*.65,-v+dz*r*.1],start],.008,red?0x653044:0x547238,'bark');
      blade(start,end,r*(red?.17:.24),red?[0x7c3447,0x983a50,0x622b40][j%3]:palette[j%6],r*.18,bed);
    }
  }
  for(const b of cfg.beds){
    if(b.type==='cactus')continue;
    const count=b.type==='fern'?15:10;
    for(let j=0;j<count;j++){
      const a=j*2.399,r=.18+rnd()*.56,u=b.u+Math.cos(a)*b.rx*r,v=b.v+Math.sin(a)*b.ry*r;
      if(b.type==='fern'||j%4===0)fern(u,v,.52+rnd()*.12,.48+rnd()*.30,b);
      else broad(u,v,.40,.44+rnd()*.18,.3+rnd()*.45,b,b.type==='tropical'&&j%5===0);
    }
    if(b.type==='fern'){
      fern(b.u,b.v,2.65+(b.u===0?.40:0),2.05,b);
      fern(b.u+.36,b.v+.42,1.38,1.06,b);
    }
    if(b.type==='tropical')broad(b.u,b.v,1.2,Math.min(b.rx*.95,1.6),2.5,b);
  }
  // Tufa grotto sits in the rear fern bed, below the existing glass roof.
  const back=cfg.beds.find(b=>b.type==='fern'&&b.u===0);
  if(back){
    for(let row=0;row<10;row++)for(let col=0;col<9;col++){
      const u=(col-4)*.34+(row%2)*.12+(rnd()-.5)*.13,v=back.v+.8+rnd()*.14;
      rock([u,.56+row*.28+(rnd()-.5)*.1,-v],[.22+rnd()*.08,.20+rnd()*.05,.24], [0x5b5d45,0x68604d,0x79715a,0x4d5d38][(row+col)%4]);
    }
    for(let i=0;i<18;i++){
      const u=-1.5+i*.18,top=3.25+rnd()*.25,length=1.2+rnd()*1.7;
      for(let j=0;j<12;j++)for(const side of[-1,1]){
        const y=top-j*length/12,x=u+Math.sin(j*.8+i)*.10;
        blade([x,y,-(back.v+.47)],[x+side*.23,y-.21,-(back.v+.39)],.11,palette[(i+j)%6],.035,back);
      }
    }
    for(const side of[-1,1]){
      fern(side*1.1,back.v-.2,1.6,1.15,back);
      broad(side*1.2,back.v-.5,.55,.85,1.0,back);
    }
  }
  function bench(u:number,v:number,yaw:number){
    const p=(x:number,y:number,z:number):V=>[u+x*Math.cos(yaw)+z*Math.sin(yaw),y,-v-x*Math.sin(yaw)+z*Math.cos(yaw)];
    const bar=(a:V,b:V,r=.018)=>tube([p(...a),p(...b)],r,0x26322c,'iron');
    for(const side of[-1,1]){
      tube([p(side*.8,.04,.3),p(side*.73,.29,.22),p(side*.79,.51,.08),p(side*.86,.72,-.05)],.031,0x26322c,'iron');
      tube([p(side*.8,.04,-.29),p(side*.74,.3,-.22),p(side*.82,.57,-.19),p(side*.86,.77,.04)],.028,0x26322c,'iron');
      tube([p(side*.86,.68,.2),p(side*.86,.77,.10),p(side*.86,.76,-.19),p(side*.86,.62,-.25)],.023,0x26322c,'iron');
    }
    for(let j=0;j<7;j++)shape(new T.BoxGeometry(1,1,1),p(0,.49,-.24+j*.075),[1.83,.035,.045],0x26322c,'iron',yaw);
    bar([-.85,.60,-.25],[.85,.60,-.25],.026);
    tube([p(-.9,.57,-.25),p(-.88,1.02,-.29),p(-.45,1.17,-.31),p(0,1.13,-.31),p(.45,1.17,-.31),p(.88,1.02,-.29),p(.9,.57,-.25)],.025,0x26322c,'iron');
    for(let k=0;k<5;k++)for(const sign of[-1,1]){
      const points:V[]=[];
      for(let j=0;j<=20;j++){const t=j/20,a=t*Math.PI*2.25,r=.145*(1-t*.8);points.push(p((k-2)*.34+sign*Math.sin(a)*r,.87+Math.cos(a)*r,-.29));}
      tube(points,.012,0x344139,'iron');
    }
  }
  for(const s of CONSERVATORY_SEATS)bench(s.u,s.v,s.yaw);
  for(const p of CONSERVATORY_POTS){
    shape(new T.CylinderGeometry(.34,.24,.46,16,1,true),[p.u,.24,-p.v],[1,1,1],0x918369,'pot');
    const rim=new T.TorusGeometry(.337,.028,5,20);rim.rotateX(Math.PI/2);rim.translate(p.u,.46,-p.v);colored(rim,0x9d9078,'pot');
    shape(new T.CylinderGeometry(.31,.31,.02,16),[p.u,.43,-p.v],[1,1,1],0x3b3524,'bark');
    broad(p.u,p.v,.44,.48,.80);
  }
  const pond=conservatoryPondPlan(map);
  for(const p of pond.banks){
    if(p.fern)fern(p.u,p.v,.35,p.radius);
    else broad(p.u,p.v,-.05,p.radius,.48);
    rock([p.u,-.12,-p.v],[.34,.23,.3],0x72745c);
  }
  for(const p of pond.reeds){
    rock([p.u,-1.02,-p.v],[.28,.13,.26],0x606c41);
    for(let j=0;j<17;j++){
      const a=j*2.399,h=.55+rnd()*.65,r=.15+rnd()*.10;
      blade([p.u+Math.cos(a)*.08,-.98,-p.v+Math.sin(a)*.08],[p.u+Math.cos(a)*r,-.98+h,-p.v+Math.sin(a)*r],.018,[0x829642,0xa1a853,0x597a36][j%3],.10);
    }
  }
  if(foliage.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(foliage,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();groups.leaf.push(g);}
  let triangles=0,batches=0;
  for(const kind of Object.keys(groups) as Kind[]){
    const pieces=groups[kind];if(!pieces.length)continue;
    const g=mergeGeometries(pieces)!;pieces.forEach(p=>p.dispose());g.computeBoundingSphere();
    const material=new T.MeshStandardMaterial({vertexColors:true,roughness:kind==='iron'?.57:kind==='leaf'?.76:.94,metalness:kind==='iron'?.48:0,side:kind==='leaf'?T.DoubleSide:T.FrontSide});
    material.name='Conservatory photo garden '+kind;
    const mesh=new T.Mesh(g,material);mesh.name=material.name;mesh.receiveShadow=true;mesh.castShadow=false;root.add(mesh);
    triangles+=g.attributes.position.count/3;batches++;
  }
  root.updateMatrixWorld(true);root.traverse(o=>{o.matrixAutoUpdate=false;});
  return{root,stats:{batches,triangles,fernCrowns,bankPlants:pond.banks.length,reedIslands:pond.reeds.length},update(x:number,z:number){
    root.visible=Math.hypot(x-cfg.center[0],z-cfg.center[1])<(root.visible?155:140);
  }};
}
