import * as T from 'three';
/** Separate front faces prevent mirrored lettering on the reverse of street blades. */
export function makeRoadSign(name:string,stop=false,allWay=false){
 const group=new T.Group();group.name=(stop?'Stop sign':'Street blade')+' · '+name;
 const steel=new T.MeshStandardMaterial({color:0x89918b,metalness:.65,roughness:.48});
 const post=new T.Mesh(new T.BoxGeometry(.065,3.05,.045),steel);post.position.set(0,1.475,-.065);group.add(post);
 const width=stop?.76:Math.min(2.05,Math.max(1.12,name.length*.075)),height=stop?.76:.30,y=stop?2.23:2.78;
 const c=document.createElement('canvas');c.width=stop?512:1024;c.height=stop?512:180;const ctx=c.getContext('2d')!;
 ctx.fillStyle=stop?'#bb252b':'#08613e';
 if(stop){ctx.beginPath();for(let i=0;i<8;i++){const a=Math.PI/8+i*Math.PI/4;ctx.lineTo(256+250*Math.cos(a),256+250*Math.sin(a));}ctx.closePath();ctx.fill();ctx.strokeStyle='#f2f2e7';ctx.lineWidth=13;ctx.stroke();}
 else{ctx.fillRect(0,0,1024,180);ctx.strokeStyle='#eef3e5';ctx.lineWidth=9;ctx.strokeRect(9,9,1006,162);}
 ctx.fillStyle='#fffef2';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=stop?'bold 142px Arial':'600 105px Arial';ctx.fillText(stop?'STOP':name.replace(/ Street$/,' St').replace(/ Avenue$/,' Ave'),c.width/2,c.height/2+4,c.width-64);
 // The map scene reflects X to match the riding coordinate system.
 const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;
 const paint=new T.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.5,roughness:.55});
 const board=new T.Mesh(stop?new T.CylinderGeometry(.39,.39,.025,8).rotateX(Math.PI/2).rotateZ(Math.PI/8):new T.BoxGeometry(width,height,.025),steel);
 board.position.y=y;group.add(board);
 for(const side of stop?[1]:[1,-1]){const geo=new T.PlaneGeometry(width,height),uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));const face=new T.Mesh(geo,paint);face.position.set(0,y,side*.016);face.rotation.y=side===1?0:Math.PI;group.add(face);}
 for(const dy of [-height*.32,height*.32]){const bolt=new T.Mesh(new T.SphereGeometry(.009,6,4),steel);bolt.position.set(0,y+dy,.025);group.add(bolt);}
 if(stop&&allWay){const plate=document.createElement('canvas');plate.width=256;plate.height=80;const p=plate.getContext('2d')!;p.fillStyle='#bb252b';p.fillRect(0,0,256,80);p.strokeStyle='#fff';p.lineWidth=5;p.strokeRect(3,3,250,74);p.fillStyle='#fff';p.font='bold 40px Arial';p.textAlign='center';p.fillText('ALL WAY',128,54);const t=new T.CanvasTexture(plate);t.colorSpace=T.SRGBColorSpace;const geo=new T.PlaneGeometry(.52,.16),uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));const m=new T.Mesh(geo,new T.MeshStandardMaterial({map:t}));m.position.set(0,1.70,.018);group.add(m);}
 return group;
}
