import { createRequire } from 'node:module';
import { writeFile, copyFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const lucide = require('../output/control-icons/node_modules/lucide');
const names = ['Settings2', 'Pause', 'HandFist', 'Footprints', 'Zap', 'Flame', 'ArrowUp', 'ArrowDown', 'ChevronsRight', 'Crosshair', 'Bomb', 'Target', 'Shield', 'Users', 'Hand', 'Volume2'];
const icons = Object.fromEntries(names.map(name => [name, lucide[name]]));
await writeFile(new URL('../src/ui/touch-icon-data.js', import.meta.url), `// Generated from Lucide 0.545.0. See lucide.LICENSE.\nexport const controlIcons = ${JSON.stringify(icons)};\n`);
await copyFile(new URL('../output/control-icons/node_modules/lucide/LICENSE', import.meta.url), new URL('../src/ui/lucide.LICENSE', import.meta.url));
