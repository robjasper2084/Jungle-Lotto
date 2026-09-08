import type { APIRoute } from 'astro';
import { buildProvider } from '../commerce/provider';
import { canonical } from '../utilities/paths';
import seed from '../cfiles/seed.json';
import { supportPages } from '../content/support';
export const GET:APIRoute=async()=> {
  const paths=['c-files/','c-files/archive/','c-files/map/','c-files/sources/',...seed.map(c=>'c-files/cases/'+c.id+'/'),'','shop/','collections/','lookbook/','play/','about/',...Object.keys(supportPages).map(p=>p+'/'),...(await buildProvider.getProducts()).map(p=>'products/'+p.handle+'/'),...(await buildProvider.getCollections()).map(c=>'collections/'+c.handle+'/')];
  return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+paths.map(p=>'<url><loc>'+canonical(p).replaceAll('&','&amp;')+'</loc></url>').join('')+'</urlset>',{headers:{'Content-Type':'application/xml'}});
};
