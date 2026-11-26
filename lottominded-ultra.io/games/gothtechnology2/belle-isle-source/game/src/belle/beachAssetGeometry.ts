// Derived from Beach Scene by BMF (Blend Swap 47462; CC0).
// 16-bit positions at 1/16384 units, 8-bit triangle indices. Offline quadric
// simplification, quantization, and bounds fitting; these are not lossless LODs.
// Existing per-instance colors supply the runtime material palette.
export type BeachAsset='driftwood'|'grass';
const packed:Record<BeachAsset,string>={
 driftwood:'NABjAADg+/+p61ThO/ea4cnhlvx78m3je+249LPkzeTm78Dkw+Xr5p3niOqF7gfsb/1v8EbsCP1U6aTs//VJ9fPs2e5S8antv+6H6evtw/Yd5Wjz4/yR+nbzzPZE+JjzAPphAxP09vDZ+0T3Vf0vB273ofPLBzP45/4+/9v4ePiw+fb4X/Cb/pz6NPrCE4/7WAFmHr38jwG5FsD8hvsPCBv9CPl6GiD9ifAIDab+c/EoFWECggCCDy8EUfocG5cEfQEdGMoFh/o7DIsGS/M1EKAIi/mOGIwJOwqNERIO7RZREmEOBAOfD3IOpwKsFscOwgrgC8sOGwmiG/EOAhdCFmYQdBGiEYMVYQClF48VWQA+EM8VKvpjG9IVXPjcCxIW4vMsGTcWlu/jD1kfZxgID3AfMxteGAAgfxM7EgEDAAgBAAIAAwIHAAgABwQBAwQFAQUMAQgMAQkCAwkHAgYDBAYKAwoJAwYEBQsGBQsMBQsKBgcNCA8HCRENBw8RBw0MCBIJChIPCQsQChASCgsODBAOCw0ODBMODRETDRUOEBMUDhUUDhIRDxsSEBUbEBoREhgTERYYERoWERwaEhwSGxkUExgZExsUFRsZFBYXGBcWGhcaGBgdGRofGB8dGCEZGx0gGSEgGR4aHB4fGiEcGyIeHCEiHCMdHyMgHSkfHigeIigpHikjHyUgIScgIyUnICYiISUmISYoIiQnIykkIyQqJyokKTAmJTAnJS8oJjAvJiwnKiwuJzAuJy0pKC8tKCsqKS0rKSssKjIsKzIrLTEuLDIxLDItLzMuMDMxLjAzLzMyLw==',
 grass:'xABgADTkAhXw+DfoTBMV60Dp5BF+/cPqlhB27+TqaSMmBQzrOCRwAH/uhRZc/c7u7Cdd+l/vWhYA+NDwvh/m/6bxWgXhC+/x3SCz+ADyQQXm9iPy+hEv/W/yDheO/JPyDRJH9YLzOyFQ9gj0gyKmAPD1IQhE+bX3Zwi4+dX35Ag/B+D3fxLQ4vT3FhOU+2z4Fgl4B9b4pRD//Pf4syJi72z5oxAO/sv58w9e+D36PSf3/Yb67iic9aD6XBAz/PX6RyfGBPn6rxZm/gr7JyM0/Rb7mRFmAX/76hJM6pz7yw9k+J77FBHa/y38uBRN/y/8PQ8CAIX8ChpF7Jz8SwVZ7cr8lhbk/NT8RAzb+/f8LA6z/vv8SyjBADz9aycW/3L9awwd+3X9GBgB/IH9Ogu0/pb9SAq5/aP9qRkx7cD9XSNB/sr9GhY5/Oj93hI//hX+HRg0+x7+MAi78T7+vBbC/1v+6xW3+Pn+pwhp/RP/bwjq8hj/xhfI+SX/OBWW/nH/KA9y/XP/iATA/cT/nAAe/h0AdBl0+WIAnACbAGQATgaz/2QAsQdW/G4AnABX/IgA2QrVAIsANyDR75cAEgIi/v4ArxC/+QIB1wpO+hgB3wC6/i4BqACS+1cB3gEl/lsBSBYw+F8BxwUi/mMBAABr/pEBXwob/50BKwOc/aYB8hLg58ABnAClAcIBMgL5/cMBfQIz/skBRgH1/tIBUQ8W79wBoQ9N3O0BFAOm/RUCBgDZ/hsCeAaNAUgCrApB+YMC2wBwAJoCMQag/KoC9BAQ67EC/xFn77kCLwp8/b0CAgRc+tICnADGAdYCmwAU+9gC9AVsANgC2A8tEeEC4gDR/PAC5AlpBiEDOwZv/kEDLAYkAXID9AXM/3kD/wlY+3sD6AnTAL0D9AW1/9oDiRA+A98D5wNJ/QQE4gCJ/gYEAAS/+hYEyg+sGCQE8gXo/yUE8gpp+iYEmgWDAScE/QqzI1QEnAAWAVsE+RbK+W4ELQcW/3AEJQFa/q4EKAhP+7kECwsW+7oEnABP/LoEUhAvA7sEyxaIAb0EyAS1/skEvQOx+vEECxc+Bx8FUQgh/CwF2QD9/VgFnADM/oUFZxax9rkF4gDx/b8F0wvY/AYGIhA1BQgGTQftAToGCCASEVYGZg92+2UGWA5r/G4G6CBO8JcGpw+C8J4GVCH0CM8GDhR/BuUGZA6O+P4G2wUYDjgHyBcaApkHGQaNDtQHmyQl9NoHLAw7BxwIex9+7CsI2RB4+EQIGSC/96YI3SKp97oIHwiJ8b8IhQjl8sgI+BDz7B8J8hK//DkJ6xlED08J4xAd96kJQQngF7EJKyXj9MkJzQ538U4KsClgA2YKSwUy7XYKWBlAFI4K8RAl/t4KkRjjD+IKzTzM8hcLHRItALQLTxdoEeoLgQ66BwwMqAeSADsMTRNQ/18MmRKm9bwMSRCx7skMmxfsEWUPfBCzFNUQowrY+DARSAg3AGcRfBdV/6kRjRCJD7cRbAoG+fgTbAW29jgU9w5SG20UbySZ6F0VBhdd/sAWggWQAN4XqyWI958YKw5CFswbDSNhAh4AGCQBGzENAg8vAycEIiUsBRoOBj8HNhY7CCYgCQoXFCowCwwSEzEyDQ4aQCsvDzU3EDk+ERJnExQXXUsjFRhXHj1CGRtTJCEcUUU6HUdEHyAmSUozKCk4PCpOMFJQLTQuXDVWNzhtPDlYPj1bQkFDTEZBTU1BTExDX0NVX09gSE1MaV9zTGlMc2lmTWJaVF5iVFVlX2FZZGV6X196c2N7kYBmaWpodWh5dXOAaYJrk4Vsjm6Jm5RvrJ9woIFxo6NxqrOkcnqIc4iAc6GSdLu3dnd+mZh4lnyXqLJ9rn+Gprmrg7SnhI+Kh4eKkI+HkJCKj6LBi4yvtbCNuo+QnZ6dkJWcvqWYlpq2vZ6tnamfoKu5v67DsrC6wsC4sby3uw==',
};
export function decodeBeachAsset(kind:BeachAsset){
 const bytes=Uint8Array.from(atob(packed[kind]),c=>c.charCodeAt(0));
 const view=new DataView(bytes.buffer),vertices=view.getUint16(0,true),faces=view.getUint16(2,true);
 if(vertices<3||vertices>255||faces<1||faces>100||bytes.length!==4+vertices*6+faces*3)throw Error('Invalid beach asset');
 const positions=new Float32Array(vertices*3),indices=new Uint16Array(faces*3);
 for(let i=0;i<positions.length;i++){
  // Fit the reduced grass clump inside the previous beach-decoration envelope.
  const scale=kind==='grass'?(i%3===1?.65:.53):1;
  positions[i]=view.getInt16(4+i*2,true)*scale/16384;
 }
 for(let i=0;i<indices.length;i++){
  const index=bytes[4+vertices*6+i];if(index>=vertices)throw Error('Invalid beach index');indices[i]=index;
 }
 return{positions,indices};
}
