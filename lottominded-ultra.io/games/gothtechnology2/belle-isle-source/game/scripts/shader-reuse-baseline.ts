// Source-bound, untouched comparison text from the original 759 candidate.
// It is not imported by the application; the native fixture verifies its hash.
export const SHADER_REUSE_BASELINE = {
  "sourceSha": "75906273c0cd414c0d004320fc6f654b4783e5b1",
  "treeSha": "9f0351be133dd370a676090d27559a0adaf00605",
  "asphaltPath": "lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/src/belle/asphaltPolish.ts",
  "asphaltSourceSha256": "01855e0050163144d29f8eb58698ba40de140712d21a46ec4153e07d527420ff",
  "asphaltBlockSha256": "9ff53ea16d13019ea828a1b0136307ad5133921b5312de89de73215614e78614",
  "asphaltBlock": "\n vec2 repairGrid=asphaltXZ/vec2(14.,19.);\n vec2 repairCell=floor(repairGrid),repairUv=fract(repairGrid);\n float repairSeed=fract(sin(dot(repairCell,vec2(127.1,311.7)))*43758.5453);\n vec2 repairCentre=vec2(.40+.15*fract(repairSeed*7.1),.42+.16*fract(repairSeed*11.3));\n vec2 repairHalf=vec2(.12+.13*fract(repairSeed*17.7),.09+.19*fract(repairSeed*23.1));\n vec2 repairEdge=repairHalf-abs(repairUv-repairCentre);\n vec2 repairAa=max(fwidth(repairGrid),vec2(.001));\n float repairShape=smoothstep(0.,repairAa.x*1.5,repairEdge.x)*smoothstep(0.,repairAa.y*1.5,repairEdge.y);\n float repairResolved=1.-smoothstep(.035,.12,max(repairAa.x,repairAa.y));\n float repairAmount=step(.77,repairSeed)*repairShape*repairResolved;\n diffuseColor.rgb*=1.-repairAmount*(.045+.055*repairSeed);\n"
} as const;
