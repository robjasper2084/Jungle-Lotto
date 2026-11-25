/** Four bounded local art directions using the same Belle Isle scene and renderer. */
import type {CloudType} from './skyModel.ts';
export const ART_STYLE_IDS=['authentic','golden','noir','detroit2084'] as const;
export type ArtStyleId=typeof ART_STYLE_IDS[number];
export const DEFAULT_ART_STYLE:ArtStyleId='authentic';
export const ART_STYLE_KEY='belle-isle-art-style-v1';
type Palette=Readonly<{zenith:string;horizon:string;warm:string;cloud:string;sun:string;fog:string;reflection:string}>;
/** Single shared scalar for authored road shaders. */
export const ART_ROAD_WETNESS={value:0};
type Look=Readonly<{label:string;hour:number;clouds:CloudType;mix:number;fogMix:number;reflectionMix:number;ambientScale:number;sunScale:number;hazeScale:number;environmentScale:number;roadWetness:number;palette:Palette}>;
export const ART_DIRECTIONS:Readonly<Record<ArtStyleId,Look>>={
 authentic:{label:'Authentic Detroit',hour:12.4,clouds:'scattered',mix:0,fogMix:0,reflectionMix:0,ambientScale:1,sunScale:1,hazeScale:1,environmentScale:1,roadWetness:0,palette:{zenith:'#397fb5',horizon:'#bdd3e1',warm:'#eed3ae',cloud:'#e5edf3',sun:'#fff1dc',fog:'#d8d4c5',reflection:'#c4d5d5'}},
 golden:{label:'Golden Hour',hour:17.55,clouds:'wispy',mix:.27,fogMix:.17,reflectionMix:.12,ambientScale:1.02,sunScale:1.04,hazeScale:1.08,environmentScale:1,roadWetness:0,palette:{zenith:'#728ba9',horizon:'#e4bca1',warm:'#f2aa71',cloud:'#edc8ad',sun:'#ffe3b0',fog:'#c7a38d',reflection:'#e5b68e'}},
 noir:{label:'Detroit Noir',hour:21.2,clouds:'layered',mix:.52,fogMix:.22,reflectionMix:.18,ambientScale:.93,sunScale:.95,hazeScale:1.04,environmentScale:.94,roadWetness:.42,palette:{zenith:'#111e39',horizon:'#2a3d59',warm:'#615577',cloud:'#374c66',sun:'#b5cdec',fog:'#2b344c',reflection:'#516a8f'}},
 detroit2084:{label:'Detroit 2084',hour:20.65,clouds:'scattered',mix:.47,fogMix:.22,reflectionMix:.21,ambientScale:.97,sunScale:.96,hazeScale:1.05,environmentScale:.97,roadWetness:.52,palette:{zenith:'#1e2047',horizon:'#45416d',warm:'#80588d',cloud:'#475678',sun:'#a9e4f1',fog:'#343854',reflection:'#55aab9'}}
} as const;
export function normalizeArtStyle(value:unknown):ArtStyleId{
 return typeof value==='string'&&ART_STYLE_IDS.some(id=>id===value)?value as ArtStyleId:DEFAULT_ART_STYLE;
}
/** Time is artistic rather than a survey-date solar calculation. Never alters FPS or shadows. */
export function artStyleSkyPreset(id:ArtStyleId){
 const {hour,clouds}=ART_DIRECTIONS[id];return {hour,clouds,cycle:false} as const;
}
