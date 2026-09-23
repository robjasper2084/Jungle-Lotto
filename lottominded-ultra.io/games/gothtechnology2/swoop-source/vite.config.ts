import {defineConfig} from 'vite';
import {resolve} from 'node:path';
export default defineConfig({
  base:'/detroit/',publicDir:false,
  plugins:[{name:'project-source-boundary',moduleParsed(info){
    const id=info.id.replaceAll('\\','/');
    if(!id.includes('/node_modules/') && /\/euc-thrills-detroit\//i.test(id)) throw new Error('Unexpected source outside the independent ride project');
  }}],
  server:{host:'127.0.0.1',port:8196,strictPort:true,proxy:{'/audio':'http://127.0.0.1:8194','/exports':'http://127.0.0.1:8194','/textures':'http://127.0.0.1:8194'}},
  build:{outDir:'dist',rollupOptions:{input:{game:resolve(import.meta.dirname,'detroit.html'),studio:resolve(import.meta.dirname,'rider-studio.html'),companion:resolve(import.meta.dirname,'companion-studio.html'),traffic:resolve(import.meta.dirname,'traffic-studio.html')}}}
});
