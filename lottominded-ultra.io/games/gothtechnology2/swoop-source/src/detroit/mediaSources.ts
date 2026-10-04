export const STUDIO_SCREEN_WALLS=[
 // Front interior wall: the blank wall to the left of the original cinema view.
 {id:'cinema',u:15.55,v:21.58,y:3.05,width:8,height:4.5,angle:Math.PI},
 {id:'stream',u:-23.90,v:15.55,y:3.05,width:8,height:4.5,angle:Math.PI/2},
] as const;
export const GOTHTECH_CINEMATICS=[
 {name:'Swoop Detroit · cinematic · 30 seconds',url:'/exports/polish/swoop-seedance-intro-30.mp4',credit:'Original Swoop Detroit artwork · Higgsfield Seedance cinematic · 30-second film'},
 {name:'Swoop Detroit · cinematic · 15 seconds',url:'/exports/polish/swoop-seedance-intro-15.mp4',credit:'Original Swoop Detroit artwork · Higgsfield Seedance cinematic · 15-second cut'},
] as const;
export const MOVIE_PROGRAMS=[
 ...GOTHTECH_CINEMATICS,
 {name:'GothTech · Detroit production promo',url:'/exports/polish/gothtech-studio-promo.mp4',credit:'Original GothTech promo · supplied artwork + Higgsfield Detroit asset'},
 {name:'Detroit commercial',url:'/exports/polish/detroit-commercial.mp4',credit:'Original supplied Detroit commercial'},
 {name:'Big Buck Bunny · full film',url:'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',credit:'© 2008 Blender Foundation / bigbuckbunny.org · CC BY 3.0 · full credits retained'},
] as const;
export const PUBLIC_LIVE_STREAM='https://stream.mux.com/v69RSHhFelSm4701snP22dYz2jICy4E4FUyk02rW4gxRM.m3u8';
/** Direct, credential-free HTTPS media only. No page/iframe URLs or active content. */
export function streamUrl(value:string){
 try{const u=new URL(value.trim());return u.protocol==='https:'&&!u.username&&!u.password&&/\.(m3u8|mp4|webm)$/i.test(u.pathname)?u.href:null;}catch{return null;}
}
export function mediaBadge(playing:boolean,live:boolean){return playing?(live?'LIVE':'PLAYING'):'PAUSED';}
