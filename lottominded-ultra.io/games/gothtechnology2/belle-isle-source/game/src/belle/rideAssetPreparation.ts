/** Start selected asset I/O before independent camera preparation. Asset
 * loading must not submit renderer work: lighting and scene attachment still
 * happen after this barrier. Wait for both outcomes even on failure so a retry
 * cannot race unfinished graphics preparation, and observe both rejections. */
export async function prepareRideAssets<T>(loadAssets:()=>Promise<T>,prepareCamera:()=>unknown|Promise<unknown>):Promise<T>{
 const assets=Promise.resolve().then(loadAssets);
 const camera=Promise.resolve().then(prepareCamera);
 const [loaded,prepared]=await Promise.allSettled([assets,camera]);
 // Preserve the original camera-first error priority if both tasks fail.
 if(prepared.status==='rejected')throw prepared.reason;
 if(loaded.status==='rejected')throw loaded.reason;
 return loaded.value;
}
