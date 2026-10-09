// Narrow hosted entry: authoritative LOVE TAG only; other game backends stay separate.
import {createTagServer} from './loveTagService.js';
const server=createTagServer();
await server.listen(Number(process.env.PORT??8211),'0.0.0.0');
console.log('LOVE TAG ready on port '+(process.env.PORT??8211));
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{void server.gracefullyShutdown(false).then(()=>process.exit(0));});
