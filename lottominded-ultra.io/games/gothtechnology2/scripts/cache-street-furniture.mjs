// Run with node --experimental-transform-types scripts/cache-street-furniture.mjs.
// Preserve the authored placement algorithm; move its deterministic search out
// of every player's startup, without removing street detail or colliders.
import fs from 'node:fs';
import {terrainChunks} from '../swoop-source/src/detroit/world.ts';
import {chunkCoverage} from '../swoop-source/src/detroit/chunkCoverage.ts';
import {streetFurnitureSites} from '../swoop-source/src/detroit/streetFurnitureLayout.ts';
const chunks=terrainChunks(),coverage=chunks.map(c=>c.x+','+c.z).sort().join(';');
const sites=streetFurnitureSites(chunkCoverage(chunks));
fs.writeFileSync(new URL('../swoop-source/src/detroit/street-furniture-layout.json',import.meta.url),JSON.stringify({coverage,sites}));
console.log('Cached '+sites.length+' unchanged Detroit street placements');
