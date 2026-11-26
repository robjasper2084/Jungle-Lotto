import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

// A browser-compositor PNG after the existing real WebGL completion fence and
// two paint opportunities. No synthetic pixels, scene mutations or recaptures.
// Unlike page.screenshot(), this avoids an independent Playwright animation
// readiness wait on the very slow Linux SwiftShader canvas.
const SIGNATURE=Buffer.from([137,80,78,71,13,10,26,10]);
export function exactViewportPng(data,viewport){
 assert(typeof data==='string'&&data.length>0,'Browser returned no PNG screenshot bytes');
 assert(Number.isSafeInteger(viewport?.width)&&viewport.width>0&&Number.isSafeInteger(viewport?.height)&&viewport.height>0,'Missing exact viewport dimensions');
 const bytes=Buffer.from(data,'base64');
 assert(bytes.length>=33,'Truncated browser PNG screenshot');
 assert(bytes.subarray(0,8).equals(SIGNATURE),'Screenshot is not a PNG');
 assert.equal(bytes.readUInt32BE(8),13,'PNG IHDR length changed');
 assert.equal(bytes.toString('ascii',12,16),'IHDR','PNG IHDR missing');
 assert.equal(bytes.readUInt32BE(16),viewport.width,'PNG screenshot width changed');
 assert.equal(bytes.readUInt32BE(20),viewport.height,'PNG screenshot height changed');
 return bytes;
}
export async function captureCadillacViewportPng({client,viewport,path,write=writeFile}){
 // One original browser-compositor capture; no page-side canvas readback,
 // re-render, screenshot retries, resize or altered image format.
 const captured=await client.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});
 const bytes=exactViewportPng(captured?.data,viewport);
 await write(path,bytes);
 return bytes;
}
