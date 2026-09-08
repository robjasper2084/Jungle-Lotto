import Parser from 'rss-parser';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const target=resolve(root,'store/cfiles/news.json');
const sources=JSON.parse(await readFile(resolve(root,'store/cfiles/sources.json'),'utf8'));
const parser=new Parser();let previous={items:[],sources:[]};try{previous=JSON.parse(await readFile(target,'utf8'));}catch{}
const runs=await Promise.all(sources.filter(s=>s.feed).map(async source=>{
 try{
  const response=await fetch(source.feed,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'GothTechnology-CFiles/1.0 (RSS headline index)'}});
  if(!response.ok)throw Error('HTTP '+response.status);
  const xml=await response.text();if(xml.length>3_000_000)throw Error('Feed too large');
  const data=await parser.parseString(xml);
  const relevant=data.items.filter(item=>!source.keywords||source.keywords.some(k=>String(item.title).toLowerCase().includes(k)));
  const items=relevant.slice(0,12).flatMap(item=>{
   let url;try{url=new URL(item.link);}catch{return [];}
   if(url.protocol!=='https:'||!item.title)return [];
   const time=Date.parse(item.isoDate||item.pubDate||'');
   return [{id:url.href,title:item.title.replace(/<[^>]*>/g,'').slice(0,220),url:url.href,source:source.name,source_id:source.id,published_at:Number.isFinite(time)?new Date(time).toISOString():null,category:'Science context'}];
  });
  return {source:source.id,ok:true,checked_at:new Date().toISOString(),items};
 }catch(error){return {source:source.id,ok:false,error:String(error.message),checked_at:new Date().toISOString(),items:previous.items.filter(i=>i.source_id===source.id)};}
}));
const items=[...new Map(runs.flatMap(r=>r.items).map(i=>[i.url,i])).values()].sort((a,b)=>(b.published_at||'').localeCompare(a.published_at||''));
const result={checked_at:new Date().toISOString(),items,sources:runs.map(({items,...status})=>status)};
await mkdir(resolve(root,'store/cfiles'),{recursive:true});await writeFile(target+'.tmp',JSON.stringify(result,null,2)+'\n');await rename(target+'.tmp',target);
console.log(JSON.stringify({headlines:items.length,sources:result.sources}));if(runs.every(r=>!r.ok))process.exitCode=1;
