/** Keep the desktop visual acceptance on the same Metal backend used for
 * sustained rides. Phone visual coverage can still use the software lane. */
export const galleryNeedsMetal=process.env.ENV_GALLERY_REQUIRE_METAL==='1';

export function launchGalleryBrowser(chromium,softwareChannel){
 return chromium.launch(galleryNeedsMetal
  ? {channel:'chrome',headless:false,args:['--enable-gpu','--use-gl=angle','--use-angle=metal']}
  : {channel:softwareChannel,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
}

export async function galleryRenderer(page){
 const renderer=await page.locator('#game').evaluate(canvas=>{
  const gl=canvas.getContext('webgl2');
  if(!gl||gl.isContextLost())return null;
  const debug=gl.getExtension('WEBGL_debug_renderer_info');
  return String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER));
 });
 if(!renderer)throw Error('Gallery requires an active WebGL2 canvas');
 if(galleryNeedsMetal&&(!/Metal/i.test(renderer)||/SwiftShader|llvmpipe|software rasterizer/i.test(renderer)))
  throw Error('The desktop gallery requires Chrome on Metal. Actual renderer: '+renderer);
 return renderer;
}
