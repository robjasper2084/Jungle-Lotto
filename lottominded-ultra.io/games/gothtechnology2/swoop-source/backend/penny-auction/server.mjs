import http from 'node:http';
import {mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
import {AuctionEngine,AuctionError} from './engine.mjs';
const localOrigin=/^http:\/\/(127\.0\.0\.1|localhost):418[01]$/;
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
async function body(req){let data='';for await(const part of req){data+=part;if(Buffer.byteLength(data)>16384)throw new AuctionError('REQUEST_TOO_LARGE',413);}return data;}
export function validWebhook(raw,timestamp,signature,secret,now=Date.now()){
 if(!secret||!/^\d{13}$/.test(timestamp??'')||Math.abs(now-Number(timestamp))>300000||!/^sha256=[a-f0-9]{64}$/.test(signature??''))return false;
 const expected=createHmac('sha256',secret).update(timestamp+'.'+raw).digest(),received=Buffer.from(signature.slice(7),'hex');return timingSafeEqual(expected,received);
}
export function auctionServer(engine,{testEnabled=false,authUrl='',publicKey='',origins=[],checkoutAdapter='',adapterSecret='',webhookSecret=''}={}){
 const tests=new Map(),sessions=new Map(),rates=new Map();
 async function identity(req){const token=/^Bearer (.{20,4096})$/.exec(req.headers.authorization??'')?.[1];if(!token)throw new AuctionError('SIGN_IN_REQUIRED',401);
  if(tests.has(token))return tests.get(token);
  const cached=sessions.get(token);if(cached&&cached.expires>Date.now())return cached.id;
  if(!authUrl||!publicKey)throw new AuctionError('ACCOUNT_SERVICE_NOT_CONFIGURED',503);
  const response=await fetch(authUrl+'/auth/v1/user',{headers:{apikey:publicKey,Authorization:'Bearer '+token},signal:AbortSignal.timeout(5000)});if(!response.ok)throw new AuctionError('SIGN_IN_REQUIRED',401);
  const user=await response.json();if(!user.id||user.is_anonymous||!(user.email_confirmed_at||user.phone_confirmed_at))throw new AuctionError('VERIFIED_ACCOUNT_REQUIRED',403);
  if(sessions.size>500)sessions.clear();sessions.set(token,{id:user.id,expires:Date.now()+30000});return user.id;
 }
 const rate=(key,limit=5)=>{const now=Date.now(),entry=rates.get(key);if(entry&&now-entry.at<1000){if(++entry.count>limit)throw new AuctionError('SLOW_DOWN',429);}else rates.set(key,{at:now,count:1});if(rates.size>2000)rates.clear();};
 const server=http.createServer(async(req,res)=>{
  const origin=req.headers.origin;const allowed=origin&&(origins.includes(origin)||(testEnabled&&localOrigin.test(origin)));
  if(origin&&!allowed){json(res,403,{error:'ORIGIN_NOT_ALLOWED'});return;}
  if(allowed){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');}
  if(req.method==='OPTIONS'){res.writeHead(204).end();return;}
  try{const path=new URL(req.url,'http://localhost').pathname;rate(req.socket.remoteAddress??'unknown',60);
   if(req.method==='GET'&&path==='/api/auctions'){json(res,200,{...engine.catalog(),testEnabled});return;}
   if(req.method==='POST'&&path==='/api/payments/webhook'){
    const raw=await body(req);if(!validWebhook(raw,req.headers['x-auction-timestamp'],req.headers['x-auction-signature'],webhookSecret))throw new AuctionError('INVALID_WEBHOOK',401);
    const e=JSON.parse(raw);if(e.type!=='payment.succeeded'||!e.eventId||e.eventId.length>160)throw new AuctionError('UNSUPPORTED_PAYMENT_EVENT',400);
    json(res,200,engine.paymentEvent(e));return;
   }
   if(req.method==='POST'&&path==='/api/test-session'){
    // Preview testing is only permitted on a loopback server and an allowed local origin.
    if(!testEnabled||!allowed||!localOrigin.test(origin)||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))throw new AuctionError('TESTS_DISABLED',403);
    const token=randomBytes(32).toString('hex'),id='test:'+randomBytes(12).toString('hex');tests.set(token,id);if(tests.size>1000)tests.delete(tests.keys().next().value);
    json(res,201,{token,auction:engine.startTest(id),...engine.account(id,'test')});return;
   }
   const user=await identity(req);rate(user,12);
   if(req.method==='GET'&&path==='/api/account'){json(res,200,engine.account(user,user.startsWith('test:')?'test':'live'));return;}
   if(req.method==='POST'&&path==='/api/bids'){rate('bid:'+user);const b=JSON.parse(await body(req));engine.bid(user,b.auctionId,b.requestId);json(res,200,{...engine.account(user,user.startsWith('test:')?'test':'live'),...engine.catalog()});return;}
   if(req.method==='POST'&&path==='/api/checkout'){
    if(!checkoutAdapter||!adapterSecret||!webhookSecret)throw new AuctionError('APPROVED_PAYMENT_PROCESSOR_REQUIRED',503);
    const config=new URL(checkoutAdapter);if(config.protocol!=='https:')throw new AuctionError('INVALID_PAYMENT_CONFIGURATION',503);
    const quote=engine.quotePurchase(user,JSON.parse(await body(req)));
    const reply=await fetch(checkoutAdapter,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+adapterSecret,'Idempotency-Key':quote.id},body:JSON.stringify(quote),signal:AbortSignal.timeout(10000)});
    if(!reply.ok)throw new AuctionError('CHECKOUT_UNAVAILABLE',502);const result=await reply.json();engine.acceptTaxQuote(quote.id,result);const redirect=new URL(result.checkoutUrl);if(redirect.protocol!=='https:')throw new AuctionError('CHECKOUT_UNAVAILABLE',502);
    json(res,201,{purchaseId:quote.id,checkoutUrl:redirect.href});return;
   }
   json(res,404,{error:'NOT_FOUND'});
  }catch(e){json(res,e instanceof AuctionError?e.status:e instanceof SyntaxError?400:500,{error:e instanceof AuctionError?e.message:e instanceof SyntaxError?'INVALID_JSON':'SERVICE_UNAVAILABLE'});}
 });
 const timer=setInterval(()=>{try{engine.closeDue();}catch{}},250);timer.unref();server.on('close',()=>clearInterval(timer));return server;
}
if(process.argv[1]&&resolve(process.argv[1])===import.meta.filename){
 const path=resolve(process.env.AUCTION_DATABASE??resolve(import.meta.dirname,'data/auctions.sqlite'));mkdirSync(dirname(path),{recursive:true});
 const allowLive=process.env.AUCTION_LIVE_ENABLED==='true',testEnabled=!allowLive&&process.env.AUCTION_TEST_ENABLED!=='false';
 const engine=new AuctionEngine(path,{allowLive});const server=auctionServer(engine,{testEnabled,authUrl:process.env.SUPABASE_URL??'',publicKey:process.env.SUPABASE_PUBLISHABLE_KEY??'',origins:(process.env.AUCTION_ALLOWED_ORIGINS??'').split(',').filter(Boolean),checkoutAdapter:process.env.AUCTION_CHECKOUT_ADAPTER_URL??'',adapterSecret:process.env.AUCTION_ADAPTER_SECRET??'',webhookSecret:process.env.AUCTION_WEBHOOK_SECRET??''});
 server.listen(Number(process.env.AUCTION_PORT??4182),allowLive?'0.0.0.0':'127.0.0.1',()=>console.log('Penny Exchange backend: '+(allowLive?'configured production':'local prelaunch, real payments closed')));
 const stop=()=>server.close(()=>{engine.close();process.exit(0);});process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
