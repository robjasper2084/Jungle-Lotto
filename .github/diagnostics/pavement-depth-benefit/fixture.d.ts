declare module 'pavement-benefit-fixture'{
 export const gl:WebGL2RenderingContext;
 export function fence():Promise<void>;
 export function fixtureSettings():Record<string,unknown>;
 export function cameraInputs():Record<string,number[]>;
 export function ownerInputs():Record<string,unknown>[];
 export function fixtureIdentity():Promise<{gpu:string;assetSha256:string}>;
 export function setTimingMode(mode:'baseline'|'candidate'):void;
 export function timingRender():{calls:number;triangles:number;lines:number;points:number;frame:number;draws:Record<string,unknown>[];depthStats:Record<string,unknown>;ownersIntact:boolean};
 export function prepareTimingCase(index:number):Promise<{name:string;cameraInput:Record<string,number[]>;shadowAnchor:Record<string,unknown>;gpu:string;assetSha256:string}>;
}
