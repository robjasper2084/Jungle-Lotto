import type { APIRoute } from 'astro';
import { href } from '../utilities/paths';
export const GET:APIRoute=()=>new Response(JSON.stringify({name:'GOTHTECHNOLOGY // The Armory',short_name:'The Armory',start_url:href(),scope:href(),display:'browser',background_color:'#030303',theme_color:'#030303',icons:[{src:href('favicon.svg'),sizes:'any',type:'image/svg+xml',purpose:'any'}]}),{headers:{'Content-Type':'application/manifest+json'}});
