import * as T from 'three';
/** Reference-matched Michigan bridge plate. Original mount and bolts are retained. */
export async function attachMichiganPlate(root:T.Object3D){
 const mount=root.getObjectByName('Michigan_2084_Plate');if(!mount)return;
 const texture=await new T.TextureLoader().loadAsync('./belle/hoverbike/michigan-2084-bridge.png');texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;
 for(const name of ['Michigan_plate','Plate_number','Plate_state','Plate_caption']){const old=root.getObjectByName(name);if(old)old.visible=false;}
 const plate=new T.Mesh(new T.PlaneGeometry(.452,.226),new T.MeshPhysicalMaterial({map:texture,color:0xffffff,metalness:.24,roughness:.27,clearcoat:.4,clearcoatRoughness:.18,side:T.DoubleSide}));plate.name='Pure Michigan bridge plate · 2084';plate.position.set(0,0,-.033);plate.rotation.y=Math.PI;plate.castShadow=true;plate.receiveShadow=true;mount.add(plate);
}
