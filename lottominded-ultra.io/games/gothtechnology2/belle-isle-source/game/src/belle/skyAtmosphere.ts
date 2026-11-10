/** Same sky draw and same noise texture; preserve sun/moon/stars and time settings. */
export function livingSkyFragment(source:string):string {
 const gradient='vec3 color=mix(horizon,zenith,pow(smoothstep(-.045,.85,d.y),.52));';
 const warmth='color=mix(color,warm,towardSun*exp(-h*4.5)*(.18+.72*dusk));';
 const traced=source.includes('if(volumeReady<.5&&d.y>-.02&&coverage>.001){');
 const begin=traced?' if(volumeReady<.5&&d.y>-.02&&coverage>.001){':' if(d.y>-.02&&coverage>.001){';
 const end=traced?' if(volumeReady>.5){':' // Stars, lunar terrain and brief meteors share the cloud occlusion.';
 const a=source.indexOf(begin),b=source.indexOf(end);
 if(!source.includes(gradient)||!source.includes(warmth)||a<0||b<=a)throw new Error('Living sky: source shader contract changed');
 const clouds=` if(${traced?'volumeReady<.5&&':''}d.y>-.02&&coverage>.001){
  vec2 uv=d.xz/(max(.045,d.y)+.105)*.22*cloudScale;
  uv=mat2(.94,-.342,.342,.94)*uv;uv.x/=sqrt(max(stretch,.1));
  vec2 drift=vec2(cloudTime*.00028,cloudTime*.00011);
  vec4 broad=texture2D(cloudNoise,uv*.34+drift*.55);
  vec4 n=texture2D(cloudNoise,uv+drift+vec2(broad.g,broad.b)*.065);
  vec4 detail=texture2D(cloudNoise,uv*3.17-drift*.4+vec2(.31,.62));
  float field=n.r*.69+broad.r*.23+detail.r*.08;
  float threshold=mix(.78,.34,coverage);
  float thickness=smoothstep(threshold-.035,threshold+.12,field);
  float banks=mix(smoothstep(.25,.56,broad.g),1.,clamp(overcast,0.,1.));
  float horizonFade=smoothstep(.035,.16,d.y);
  cover=clamp(thickness*density*banks*horizonFade,0.,1.);
  vec2 lightOffset=normalize(sunDirection.xz+vec2(.001))*.022;
  float litField=texture2D(cloudNoise,uv+drift+lightOffset).r;
  float edgeLight=clamp((n.r-litField)*9.+.48,0.,1.);
  float depth=clamp((field-threshold)*4.2,0.,1.);
  vec3 shadow=mix(cloudColor*.39,vec3(.095,.125,.185),.20*daylight);
  vec3 lit=cloudColor*(.91+edgeLight*.48);
  vec3 shade=mix(shadow,lit,clamp(.35+edgeLight*.56-depth*.22,0.,1.));
  float silver=pow(max(0.,sunDot),7.)*pow(1.-thickness,2.)*thickness*5.;
  shade+=sunColor*silver*(.22+.72*daylight);
  shade=mix(shade,warm*(.75+edgeLight*.38),towardSun*dusk*.42);
  color=mix(color,shade,cover);
  // Higher, thinner cirrus drifts independently; it must not turn into a grey veil.
  vec2 highUV=mat2(.86,-.50,.50,.86)*(d.xz/(max(.07,d.y)+.16));
  vec4 wisps=texture2D(cloudNoise,highUV*vec2(.075,.64)+drift*.24);
  float ripple=texture2D(cloudNoise,highUV*vec2(.32,1.7)+wisps.gb*.12).g;
  float veil=smoothstep(.48,.72,wisps.r+(.5-ripple)*.12)*(.08+.13*coverage)*density*horizonFade;
  vec3 highColor=mix(cloudColor,warm,towardSun*dusk*.42)*(.86+wisps.g*.28);
  color=mix(color,highColor,veil*(1.-cover*.7));
  cover=clamp(cover+veil*(1.-cover),0.,1.);
 }
`;
 return (source.slice(0,a)+clouds+source.slice(b))
  .replace(gradient,'vec3 color=mix(horizon,zenith,pow(smoothstep(-.025,.62,d.y),.56));')
  .replace(warmth,'color=mix(color,warm,towardSun*exp(-h*6.8)*(.10+.54*dusk));');
}
/** Bounded directional-sun modulation. Not a spatially projected cloud-shadow map. */
export function cloudLightFactor(seconds:number,coverage:number,overcast:number,daylight:number,reduced=false){
 if(reduced||![seconds,coverage,overcast,daylight].every(Number.isFinite))return 1;
 const unit=(x:number)=>Math.max(0,Math.min(1,x));
 const strength=.065*unit(coverage)*(1-unit(overcast))*unit(daylight);
 return 1-strength*(.5+.5*Math.sin(seconds*.075))*(.7+.3*Math.sin(seconds*.027+.6));
}
/** A six-bird distant river flock, no random allocation and no real-world flight claims. */
export function skyBirdPose(index:number,seconds:number,out:{x:number;y:number;z:number;heading:number}){
 const t=Number.isFinite(seconds)?seconds:0,i=Math.max(0,Math.min(5,Math.floor(Number.isFinite(index)?index:0)));
 const a=t*.009+i*.014,r=460+i*9;
 out.x=-650+Math.cos(a)*r;out.z=950+Math.sin(a)*r;
 out.y=120+Math.sin(t*.11+i*.8)*2.5+(i%3)*3;
 out.heading=-a;return out;
}
