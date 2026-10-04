/** Metre-space collision proxies for the Blender interiors; +Z is the entrance. */
export type StudioFixture={u:number;v:number;width:number;depth:number;height:number;y?:number;name:string};
export const STUDIO_FIXTURES:StudioFixture[]=[
 {u:0,v:-20.3,width:13.2,depth:.2,height:5.25,name:'cyclorama rear'},
 ...[-6.6,6.6].map(u=>({u,v:-18.8,width:.15,depth:2.9,height:4.9,name:'cyclorama side'})),
 {u:-15.3,v:-13.6,width:4.2,depth:1.1,height:.92,name:'editing desk'},
 {u:16,v:-16.7,width:3.5,depth:.8,height:1,name:'makeup vanity'},
 ...[-5.35,5.35].map(u=>({u,v:-12.1,width:1.2,depth:1.2,height:2.95,name:'studio softbox'})),
 ...[[-2.3,-10.1],[3,-10]].map(([u,v])=>({u,v,width:1.1,depth:1.1,height:2,name:'studio camera tripod'})),
 {u:6.9,v:-14,width:1.1,depth:1.1,height:2.7,name:'boom microphone stand'},
 {u:9.6,v:-10.5,width:.55,depth:.53,height:1.2,name:'director chair'},
 ...[-8.4,8.4].map(u=>({u,v:-17,width:.15,depth:1.85,height:3.18,name:'studio V-flat'})),
 ...[[-21,-9],[18.8,-9.8],[20.5,-12]].map(([u,v])=>({u,v,width:1.18,depth:.72,height:.95,name:'equipment case'})),
 ...[-9,-10.4].map(u=>({u,v:20.65,width:.95,depth:.88,height:2,name:'arcade cabinet'})),
 {u:15.55,v:21.70,width:8.18,depth:.18,height:4.68,y:3.05,name:'cinema display chassis'},
 ...[-4.6,4.6].map(offset=>({u:15.55+offset,v:21.52,width:.36,depth:.23,height:1.55,y:2.95,name:'cinema wall speaker'})),
];
export const RETAIL_FIXTURES:StudioFixture[]=[false,true].flatMap(store=>{
 const u=store?12:-12,v=3;
 return[
  ...[-8.88,8.88].map(x=>({u:u+x,v,width:.18,depth:12,height:4.4,name:'retail side wall'})),
  {u,v:v-5.88,width:18,depth:.18,height:4.4,name:'retail rear wall'},
  ...[-5.55,5.55].map(x=>({u:u+x,v:v+6,width:6.5,depth:.1,height:3.8,name:'retail glazing'})),
  ...[-5.55,5.55].map(x=>({u:u+x,v:v+4.7,width:3.7,depth:1.35,height:.5,name:'window display'})),
  {u:u+5.7,v:v-3.8,width:3.72,depth:1.17,height:1.29,name:'retail counter'},
  ...(store?[
   {u:u+2.35,v:v-4.7,width:.95,depth:.88,height:2,name:'Underground arcade cabinet'},
   {u:u-5.9,v:v-2.7,width:4.4,depth:.72,height:2.3,name:'garment rail'},
   {u:u+5.7,v:v+.2,width:3.3,depth:.72,height:2.3,name:'garment rail'},
   {u,v:v-1.1,width:3.22,depth:1.47,height:1.75,name:'glass accessory island'},
   ...[-6.5,-3.75].map(x=>({u:u+x,v:v+.5,width:2.05,depth:1.25,height:1.38,name:'folded apparel table'})),
  ]:[
   ...[-5.7,-2.7].map(x=>({u:u+x,v:v-1.9,width:2.08,depth:1.22,height:1.2,name:'print browser'})),
   {u,v:v+2,width:2.8,depth:1,height:1.31,name:'gallery lounge'},
   {u,v:v+.35,width:1.9,depth:.65,height:.6,name:'gallery reading table'},
  ]),
 ];
});
export const STUDIO_VIEWS={
 wide:{eye:[0,2.65,-4.7],target:[0,1.65,-17],horizontal:75},
 stage:{eye:[0,1.65,-10.6],target:[0,1.30,-17.5],horizontal:67},
 edit:{eye:[-15.3,1.8,-10.5],target:[-15.3,1.3,-14.3],horizontal:80},
 makeup:{eye:[16,1.85,-13.2],target:[16,1.7,-16.7],horizontal:90},
 storefront:{eye:[12,2.65,20],target:[12,2.0,3],horizontal:90},
 galleryfront:{eye:[-12,2.65,20],target:[-12,2.0,3],horizontal:90},
 store:{eye:[12,2.25,7.5],target:[12,1.8,.1],horizontal:90},
 gallery:{eye:[-12,2.25,7.8],target:[-12,1.8,-.7],horizontal:90},
 galleryphotos:{eye:[-12,2.65,4.9],target:[-20.65,2.55,4.9],horizontal:80},
 cinema:{eye:[15.55,2.1,12.6],target:[15.55,3.05,21.58],horizontal:78},
 stream:{eye:[-15,2.1,15.55],target:[-23.98,3.05,15.55],horizontal:78},
 arcade:{eye:[-9.7,1.7,17.5],target:[-9.7,1.3,20.65],horizontal:80},
} as const;
