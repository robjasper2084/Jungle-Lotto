/** Interior furnishings and fine trim cannot contribute a readable silhouette
 * at island-scale distances. Building shells, doors and collision stay present. */
export function landmarkDisplayRange(name:string){
 const n=name.replace(/_/g,' ');
 if(/Aquarium (river gravel|aquatic plants|tank interiors|jade glazed|black glazed|tank glazing|illuminated habitat|warm pendant|skylight)/i.test(n))return 180;
 if(/Conservatory (leaf|flower|palm bark|rough tufa|tufa edging|orchid|terracotta pots|potting earth)|Botanical label|Koi pond|Water lily|Pond bank weathered/i.test(n))return 240;
 if(/Casino (dark window frames|recessed window glass|arcade opal globes)/i.test(n))return 500;
 return 1800;
}
