/** World-space path micro-materials. Coordinates are shared by adjacent
 * pavement tiles, so gravel/dirt seams never restart at a chunk boundary.
 * Uses existing PBR textures; no new network requests or render passes.
 */
export type PathSurface='concrete'|'pavers'|'gravel'|'wood';
export function pathWeatherFragment(kind:PathSurface):string{
 const weather=`
   float weatherField=.5+.27*sin(q.x*.107+sin(q.y*.064)*1.7)+.23*sin(q.y*.156-q.x*.041);
   float fineAggregate=fract(sin(dot(floor(q*14.0),vec2(12.9898,78.233)))*43758.5453);
   float aggregateAA=1.-smoothstep(.28,1.7,length(fwidth(q))*14.0);
 `;
 if(kind==='gravel')return weather+`
   // Irregular compressed-earth pockets between hard aggregate.
   float clay=smoothstep(.39,.68,weatherField);
   vec3 pebbles=vec3(1.01,1.01,.98);
   vec3 earth=vec3(.83,.78,.70);
   diffuseColor.rgb*=mix(pebbles,earth,clay*.72);
   diffuseColor.rgb*=1.+(fineAggregate-.5)*.085*aggregateAA;
 `;
 if(kind==='wood')return weather+`
   // Warm weathered grain on boards; the authored seams stay visible.
   float grain=sin(q.x*16.+sin(q.y*.6)*2.)*.025*aggregateAA;
   diffuseColor.rgb*=vec3(.97,.955,.94)*(1.-.09*weatherField+grain);
 `;
 if(kind==='pavers')return weather+`
   float moss=smoothstep(.68,.89,weatherField)*.085;
   diffuseColor.rgb*=mix(vec3(1.),vec3(.77,.84,.70),moss);
   diffuseColor.rgb*=.96+.065*(1.-weatherField);
 `;
 return weather+`
   // Narrow damp stains and old fine-aggregate grain, not hard dark bands.
   float weatherStain=smoothstep(.60,.89,weatherField);
   diffuseColor.rgb*=.965+.065*weatherField-.075*weatherStain;
   diffuseColor.rgb*=1.+(fineAggregate-.5)*.018*aggregateAA;
 `;
}
