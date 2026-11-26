export const SHADER_PROOF_SIZE={width:960,height:600} as const;
/** Original dc4eb run 45877693528: this source pixel changes by seven channel
 * units when the original repair block is disabled on BOTH Metal and SwiftShader.
 * It is unprojected onto the unchanged pavement triangle, not a generated patch.
 * Only the two required 45m day/dusk controls use this observed source anchor. */
export const ASPHALT_REPAIR_CONTROL={
 point:[1364.9783391104663,2.0650000572204306,1074.5762425084263],
 faceIndex:41540,vertexIndices:[16219,15317,15318],
 triangle:[[1349.897216796875,2.065000057220459,1081.266357421875],[1367.7266845703125,2.065000057220459,1075.61376953125],[1366.36572265625,2.065000057220459,1072.40771484375]],
 repairCell:[97,56],pavementSha256:'14d16dd1c3148c8ee6132c765e59934b9e86ea79f4607dfd48dd08455feac21b',
 evidence:{sourceSha:'dc4eb3f29ab450df7a771d46900b03385c8ff2bb',run:45877693528,case:'asphalt-resolution-below',pixel:[595,496],
  metalZipSha256:'99be11a8e707aab6ef7f70862991a1ad01efef6ff1c832c69d7bc4e91cb403f9',
  swiftShaderZipSha256:'e8a17daf0c3abf9408dc3839f97746a4790743f6e0c753541be96f2e25106f4d',minimumNativeChannelDelta:7},
} as const;
export type ShaderProofCase={id:string;kind:'asphalt'|'limestone';distance:number;light:'day'|'dusk';
 mode?:'grazing'|'uv1'|'uv2-low'|'uv2-high'|'map-replaced'|'render-replaced'|'unequal-uv-alias'|'cached-unsafe-return'|'video-alias'|'owner-rewrapped'|'frozen-defines'|'no-map'|'discard';
 effectRequired?:boolean;shadowRequired?:boolean;guard?:boolean|null;nativeSafe?:boolean;};
export const SHADER_PROOF_CASES:readonly ShaderProofCase[]=[
 {id:'asphalt-near-day',kind:'asphalt',distance:45,light:'day',effectRequired:true,shadowRequired:true},
 {id:'asphalt-near-dusk',kind:'asphalt',distance:45,light:'dusk',effectRequired:true,shadowRequired:true},
 {id:'asphalt-grazing',kind:'asphalt',distance:90,light:'day',mode:'grazing'},
 {id:'asphalt-resolution-below',kind:'asphalt',distance:218,light:'day'},
 {id:'asphalt-resolution-above',kind:'asphalt',distance:222,light:'day'},
 {id:'asphalt-minified',kind:'asphalt',distance:850,light:'day'},
 {id:'limestone-near-day',kind:'limestone',distance:12,light:'day',effectRequired:true,shadowRequired:true,guard:true,nativeSafe:true},
 {id:'limestone-near-dusk',kind:'limestone',distance:12,light:'dusk',effectRequired:true,shadowRequired:true,guard:true,nativeSafe:true},
 {id:'limestone-mip-middle',kind:'limestone',distance:36,light:'day',guard:true,nativeSafe:true},
 {id:'limestone-mip-far',kind:'limestone',distance:192,light:'day',guard:true,nativeSafe:true},
 {id:'limestone-grazing',kind:'limestone',distance:85,light:'day',mode:'grazing',guard:true,nativeSafe:true},
 {id:'limestone-uv1-transform',kind:'limestone',distance:12,light:'day',mode:'uv1',effectRequired:true,guard:true,nativeSafe:true},
 {id:'limestone-uv2-mip-below',kind:'limestone',distance:36,light:'day',mode:'uv2-low',guard:true,nativeSafe:true},
 {id:'limestone-uv2-mip-above',kind:'limestone',distance:36,light:'day',mode:'uv2-high',guard:true,nativeSafe:true},
 {id:'limestone-map-replaced',kind:'limestone',distance:12,light:'day',mode:'map-replaced',effectRequired:true,guard:false,nativeSafe:true},
 {id:'limestone-render-replaced',kind:'limestone',distance:12,light:'day',mode:'render-replaced',effectRequired:true,guard:false,nativeSafe:true},
 {id:'limestone-unequal-uv-to-alias',kind:'limestone',distance:12,light:'day',mode:'unequal-uv-alias',guard:null,nativeSafe:false},
 {id:'limestone-cached-unsafe-return',kind:'limestone',distance:12,light:'day',mode:'cached-unsafe-return',guard:null,nativeSafe:false},
 {id:'limestone-video-to-ordinary',kind:'limestone',distance:12,light:'day',mode:'video-alias',guard:null,nativeSafe:false},
 {id:'limestone-owner-rewrapped',kind:'limestone',distance:12,light:'day',mode:'owner-rewrapped',guard:false,nativeSafe:true},
 {id:'limestone-frozen-defines',kind:'limestone',distance:12,light:'day',mode:'frozen-defines',guard:false,nativeSafe:true},
 {id:'limestone-no-map',kind:'limestone',distance:12,light:'day',mode:'no-map',guard:null,nativeSafe:false},
 {id:'limestone-discard',kind:'limestone',distance:12,light:'day',mode:'discard',guard:null,nativeSafe:false},
] as const;
