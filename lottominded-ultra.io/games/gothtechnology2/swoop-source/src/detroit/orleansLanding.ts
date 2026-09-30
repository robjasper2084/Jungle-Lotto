import * as T from 'three';
// Orleans/Atwater Nov 2024 Street View: four-story corner, three-story residential rows.
export function orleansFloors(id:string){return id==='965070592'?4:Number(id)>=965070591&&Number(id)<=965070602?3:0;}
export function orleansMaterial(floors:number){
 const c=document.createElement('canvas');c.width=1024;c.height=1024;const g=c.getContext('2d')!;
 g.fillStyle='#8c5746';g.fillRect(0,0,1024,1024);
 for(let y=0;y<1024;y+=10)for(let x=-40;x<1024;x+=80){g.fillStyle=['#885648','#9c6651','#805145'][(Math.floor(y/10)+Math.floor((x+40)/80))%3];g.fillRect(x+(y%20?40:0),y,77,8);}
 const row=1024/floors;
 for(let f=0;f<floors;f++){const y=f*row;
  if(f===floors-1){g.fillStyle='#b1aa93';g.fillRect(0,y,1024,row);}
  g.fillStyle='#716e68';g.fillRect(360,y,310,row);
  g.strokeStyle='#5c5b56';g.lineWidth=2;for(let j=0;j<row;j+=11){g.beginPath();g.moveTo(360,y+j);g.lineTo(670,y+j);g.stroke();}
  for(const x of [85,395,735]){g.fillStyle='#d2cdbb';g.fillRect(x,y+row*.17,190,row*.64);const grad=g.createLinearGradient(0,y,0,y+row);grad.addColorStop(0,'#7d9aa5');grad.addColorStop(1,'#283b40');g.fillStyle=grad;g.fillRect(x+8,y+row*.17+8,174,row*.64-16);g.fillStyle='#bfbfae';g.fillRect(x+91,y+row*.17,7,row*.64);g.fillRect(x,y+row*.46,190,7);}
  if(f<floors-1){g.fillStyle='#252c2b';g.fillRect(65,y+row*.74,230,7);g.fillRect(65,y+row*.94,230,9);for(let x=65;x<295;x+=16)g.fillRect(x,y+row*.74,4,row*.2);}
 }
 g.fillStyle='#383c39';g.fillRect(0,0,1024,12);
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=T.RepeatWrapping;t.wrapT=T.ClampToEdgeWrapping;t.anisotropy=4;
 return new T.MeshStandardMaterial({map:t,roughness:.86});
}
