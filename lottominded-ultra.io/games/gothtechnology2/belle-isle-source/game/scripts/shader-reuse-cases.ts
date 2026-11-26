export const SHADER_PROOF_SIZE={width:960,height:600} as const;
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
