import * as T from 'three';

/** Mipmapped thin leaves must retain fractional coverage, rather than vanish at a .45 cutoff. */
export function configureElmwoodFoliage(material:T.MeshStandardMaterial){
 material.userData.elmwoodBaseColor??=material.color.clone();
 material.side=T.DoubleSide;
 material.transparent=false;
 material.depthWrite=true;
 material.alphaTest=.01;
 material.alphaHash=Boolean(material.map);
 material.needsUpdate=true;
}

export function seasonElmwoodFoliage(material:T.MeshStandardMaterial,season:string){
 const evergreen=['white-pine','tour-spruce','tour-cedar'].includes(material.userData.species);
 material.color.copy(material.userData.elmwoodBaseColor??new T.Color('#ffffff'));
 if(season==='autumn'&&!evergreen)material.color.multiply(new T.Color('#e0a04b'));
 material.opacity=material.name.includes('blossom')?(season==='spring'?1:0):season==='winter'&&!evergreen?0:1;
 configureElmwoodFoliage(material);
}
