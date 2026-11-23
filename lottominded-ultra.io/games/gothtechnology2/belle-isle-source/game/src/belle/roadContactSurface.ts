import type {BufferGeometry} from 'three';

const cellSize=16;
const cellKey=(x:number,z:number)=>x+','+z;
type Surface={position:ReturnType<BufferGeometry['getAttribute']>;index:NonNullable<BufferGeometry['index']>};

/** Rendered wearing surfaces supplement the terrain without changing its
 * collision shape. All registered geometry has authored world positions. */
export class RoadContactSurface {
  private readonly surfaces:Surface[]=[];
  private readonly cells=new Map<string,number[]>();

  add(geometry:BufferGeometry){
    const index=geometry.index;
    if(!index)return;
    const position=geometry.getAttribute('position');
    const surfaceId=this.surfaces.push({position,index})-1;
    for(let start=0;start<index.count;start+=3){
      const a=index.getX(start),b=index.getX(start+1),c=index.getX(start+2);
      const ax=position.getX(a),bx=position.getX(b),cx=position.getX(c);
      const az=position.getZ(a),bz=position.getZ(b),cz=position.getZ(c);
      const minX=Math.floor(Math.min(ax,bx,cx)/cellSize),maxX=Math.floor(Math.max(ax,bx,cx)/cellSize);
      const minZ=Math.floor(Math.min(az,bz,cz)/cellSize),maxZ=Math.floor(Math.max(az,bz,cz)/cellSize);
      for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){
        const key=cellKey(x,z);
        let triangles=this.cells.get(key);
        if(!triangles)this.cells.set(key,triangles=[]);
        triangles.push(surfaceId,start);
      }
    }
  }

  height(x:number,z:number,terrainHeight:number){
    const triangles=this.cells.get(cellKey(Math.floor(x/cellSize),Math.floor(z/cellSize)));
    if(!triangles)return terrainHeight;
    let support=terrainHeight;
    for(let i=0;i<triangles.length;i+=2){
      const {position,index}=this.surfaces[triangles[i]],start=triangles[i+1];
      const a=index.getX(start),b=index.getX(start+1),c=index.getX(start+2);
      const ax=position.getX(a),az=position.getZ(a);
      const bx=position.getX(b)-ax,bz=position.getZ(b)-az;
      const cx=position.getX(c)-ax,cz=position.getZ(c)-az;
      const area=bx*cz-bz*cx;
      if(Math.abs(area)<1e-8)continue;
      const u=((x-ax)*cz-(z-az)*cx)/area,v=(bx*(z-az)-bz*(x-ax))/area;
      if(u< -1e-6||v< -1e-6||u+v>1+1e-6)continue;
      const height=position.getY(a)*(1-u-v)+position.getY(b)*u+position.getY(c)*v;
      // A low road skin and the bridge above it can occupy the same cell.
      // Only use the surface belonging to the current terrain level.
      if(height>support&&height<=terrainHeight+.16)support=height;
    }
    return support;
  }
}
