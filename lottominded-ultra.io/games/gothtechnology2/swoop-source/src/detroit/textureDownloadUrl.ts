/** Package-only derived downloads. Authoring/dev URLs and HD originals are unchanged. */
export function textureDownloadUrl(url:string,maxSize:number,pageUrl?:string){
 if(maxSize>1024||url.includes('/texture-variants/'))return url;
 const match=url.match(/^(.*\/arcade\/swoop-detroit\/)((?:shared-textures|textures)\/[^?#]+\.(?:png|jpe?g|webp))([?#].*)?$/i);
 if(!match)return url;
 // Pages pins original model textures to an older immutable release. Derived
 // downloads belong to the currently served game, not that historical commit.
 const pageRoot=pageUrl?.match(/^(.*\/arcade\/swoop-detroit\/)/i)?.[1];
 const root=pageRoot&&url.startsWith('https://raw.githubusercontent.com/robjasper2084/Jungle-Lotto/')?pageRoot:match[1];
 return `${root}texture-variants/${maxSize<=512?512:1024}/${match[2]}.webp${match[3]??''}`;
}
