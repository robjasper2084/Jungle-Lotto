import express from '../love-tag-server/node_modules/express/index.js';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),app=express(),prefix='/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/arcade';
for(const product of ['swoop-detroit','elmwood-explorer'])app.use(prefix+'/'+product,express.static(resolve(root,'.game-builds/love-tag-review',product),{setHeaders(res){res.setHeader('Cache-Control','no-store');}}));
app.use('/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2',express.static(resolve(root,'store/public')));
app.listen(8212,'127.0.0.1',()=>console.log('LOVE TAG packaged local review: http://127.0.0.1:8212'+prefix+'/swoop-detroit/'));
