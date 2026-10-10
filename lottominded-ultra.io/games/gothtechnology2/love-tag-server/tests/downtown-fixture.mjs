import {fileURLToPath} from 'node:url';
import {loadHostFixture} from '../dist/hostFixture.js';
import {TagTerrain} from '../../ride-core/dist/tag/fixture.js';
import {DowntownArena} from '../../ride-core/dist/royale.js';
export async function loadDowntown(){const data=await loadHostFixture(fileURLToPath(new URL('../fixtures/',import.meta.url)),'swoop-detroit');return new DowntownArena(await TagTerrain.create(data.fixture,await data.physics()));}
