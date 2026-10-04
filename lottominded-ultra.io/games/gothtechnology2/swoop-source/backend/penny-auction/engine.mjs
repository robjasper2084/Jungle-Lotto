import {DatabaseSync} from 'node:sqlite';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

export class AuctionError extends Error {constructor(code,status=409){super(code);this.status=status;}}
const fail=(code,status)=>{throw new AuctionError(code,status);};
const cents=n=>Number.isSafeInteger(n)&&n>=0;
const merchandise=JSON.parse(readFileSync(resolve(import.meta.dirname,'../../public/exports/boutique/catalog.json'),'utf8'));

/** Single-writer SQLite transactions are authoritative for money, bids and time.
 * Accounts are auction-only. Existing LottoMind balances and contracts are untouched.
 * SQLite must run on one persistent server (not an ephemeral Edge Function).
 */
export class AuctionEngine {
 constructor(path,{clock=Date.now,allowLive=false}={}){
  this.db=new DatabaseSync(path);this.clock=clock;this.allowLive=allowLive;
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),processor_approved INTEGER NOT NULL DEFAULT 0,fulfillment_ready INTEGER NOT NULL DEFAULT 0,policy_ready INTEGER NOT NULL DEFAULT 0,processor_name TEXT NOT NULL DEFAULT '');
   INSERT OR IGNORE INTO settings(id) VALUES(1);
   CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,name TEXT NOT NULL,brand TEXT NOT NULL,source_url TEXT NOT NULL,kind TEXT NOT NULL,image TEXT NOT NULL,reference_price_cents INTEGER,concept INTEGER NOT NULL DEFAULT 1,stock INTEGER NOT NULL DEFAULT 0 CHECK(stock>=0),verified INTEGER NOT NULL DEFAULT 0 CHECK(verified IN(0,1)),retail_cents INTEGER CHECK(retail_cents>=0),shipping_cents INTEGER NOT NULL DEFAULT 0 CHECK(shipping_cents>=0));
   CREATE TABLE IF NOT EXISTS auctions(id TEXT PRIMARY KEY,product_id TEXT NOT NULL REFERENCES products(id),mode TEXT NOT NULL CHECK(mode IN('test','live')),model TEXT NOT NULL CHECK(model IN('paid','free')),state TEXT NOT NULL CHECK(state IN('live','closed','cancelled')),price_cents INTEGER NOT NULL DEFAULT 0 CHECK(price_cents>=0),bid_fee_cents INTEGER NOT NULL CHECK(bid_fee_cents>=0),reset_ms INTEGER NOT NULL CHECK(reset_ms BETWEEN 9000 AND 60000),starts_at INTEGER NOT NULL,ends_at INTEGER NOT NULL,leader TEXT,version INTEGER NOT NULL DEFAULT 0);
   CREATE INDEX IF NOT EXISTS auction_ends ON auctions(state,ends_at);
   CREATE TABLE IF NOT EXISTS wallets(user_id TEXT NOT NULL,mode TEXT NOT NULL CHECK(mode IN('test','live')),credits INTEGER NOT NULL DEFAULT 0 CHECK(credits>=0),PRIMARY KEY(user_id,mode));
   CREATE TABLE IF NOT EXISTS bids(id TEXT PRIMARY KEY,auction_id TEXT NOT NULL REFERENCES auctions(id),user_id TEXT NOT NULL,request_id TEXT NOT NULL,price_cents INTEGER NOT NULL,credits_spent INTEGER NOT NULL,at INTEGER NOT NULL,UNIQUE(user_id,request_id));
   CREATE INDEX IF NOT EXISTS auction_bid_history ON bids(auction_id,at);
   CREATE TABLE IF NOT EXISTS ledger(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,mode TEXT NOT NULL,delta INTEGER NOT NULL,reason TEXT NOT NULL,reference_id TEXT NOT NULL UNIQUE,at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,auction_id TEXT NOT NULL UNIQUE REFERENCES auctions(id),user_id TEXT NOT NULL,price_cents INTEGER NOT NULL,shipping_cents INTEGER NOT NULL,state TEXT NOT NULL CHECK(state IN('test_result','awaiting_payment','paid','shipped','cancelled')),tracking TEXT,created_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS purchases(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN('bid_pack','order')),order_id TEXT REFERENCES orders(id),credits INTEGER NOT NULL,amount_cents INTEGER NOT NULL CHECK(amount_cents>0),currency TEXT NOT NULL DEFAULT 'USD',state TEXT NOT NULL DEFAULT 'pending',created_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS payment_events(id TEXT PRIMARY KEY,purchase_id TEXT NOT NULL REFERENCES purchases(id),at INTEGER NOT NULL);
  `);
  const put=this.db.prepare('INSERT INTO products(id,name,brand,source_url,kind,image,reference_price_cents,concept) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,source_url=excluded.source_url,kind=excluded.kind,image=excluded.image,reference_price_cents=excluded.reference_price_cents,concept=excluded.concept');
  for(const p of merchandise)put.run(p.handle,p.title,'GOTHTECHNOLOGY',p.url,p.category,p.image,!p.pending&&p.price>0?Math.round(p.price*100):null,p.concept?1:0);
 }
 transaction(work){this.db.exec('BEGIN IMMEDIATE');try{const result=work();this.db.exec('COMMIT');return result;}catch(error){this.db.exec('ROLLBACK');throw error;}}
 alias(user){return user?'Bidder '+createHash('sha256').update(user).digest('hex').slice(0,6).toUpperCase():null;}
 gates(){const s=this.db.prepare('SELECT * FROM settings WHERE id=1').get();return {...s,liveEnabled:this.allowLive&&!!s.processor_approved&&!!s.fulfillment_ready&&!!s.policy_ready};}
 closeDue(){return this.transaction(()=>this.settleInside());}
 settleInside(){
  const due=this.db.prepare("SELECT a.*,p.shipping_cents FROM auctions a JOIN products p ON p.id=a.product_id WHERE a.state='live' AND a.ends_at<=?").all(this.clock());
  for(const a of due){this.db.prepare("UPDATE auctions SET state='closed',version=version+1 WHERE id=?").run(a.id);
   if(a.leader)this.db.prepare('INSERT INTO orders(id,auction_id,user_id,price_cents,shipping_cents,state,created_at) VALUES(?,?,?,?,?,?,?)').run(randomUUID(),a.id,a.leader,a.price_cents,a.mode==='test'?0:a.shipping_cents,a.mode==='test'?'test_result':'awaiting_payment',this.clock());
   else if(a.mode==='live')this.db.prepare('UPDATE products SET stock=stock+1 WHERE id=?').run(a.product_id);
  }return due.length;
 }
 catalog(){this.closeDue();return {serverTime:this.clock(),state:this.gates().liveEnabled?'ready':'prelaunch',products:this.db.prepare('SELECT id,name,brand,source_url,kind,image,reference_price_cents,concept,retail_cents,verified,stock FROM products').all().map(p=>({...p,availability:p.verified&&p.stock>0?'verified_inventory':'awaiting_inventory'})),auctions:this.db.prepare('SELECT * FROM auctions ORDER BY starts_at DESC LIMIT 50').all().map(a=>this.publicAuction(a))};}
 publicAuction(a){const {leader,...publicData}=a;return {...publicData,leader:this.alias(leader),history:this.db.prepare('SELECT user_id,price_cents,at FROM bids WHERE auction_id=? ORDER BY rowid DESC LIMIT 10').all(a.id).map(b=>({bidder:this.alias(b.user_id),price_cents:b.price_cents,at:b.at}))};}
 account(user,mode){this.closeDue();return {credits:this.db.prepare('SELECT credits FROM wallets WHERE user_id=? AND mode=?').get(user,mode)?.credits??0,orders:this.db.prepare('SELECT id,auction_id,price_cents,shipping_cents,state,tracking,created_at FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 30').all(user),bids:this.db.prepare('SELECT auction_id,count(*) AS count,sum(credits_spent) AS spent FROM bids WHERE user_id=? GROUP BY auction_id').all(user)};}
 startTest(user,product='night-protocol-hoodie'){
  if(!user.startsWith('test:'))fail('TEST_SESSION_REQUIRED',403);
  return this.transaction(()=>{
   if(!this.db.prepare('SELECT id FROM products WHERE id=?').get(product))fail('PRODUCT_NOT_FOUND',404);
   if(!this.db.prepare('SELECT 1 FROM wallets WHERE user_id=? AND mode=?').get(user,'test')){
    this.db.prepare("INSERT INTO wallets VALUES(?,'test',20)").run(user);this.db.prepare("INSERT INTO ledger VALUES(?,?,'test',20,'test_grant',?,?)").run(randomUUID(),user,'test-grant:'+user,this.clock());
   }
   this.settleInside();let a=this.db.prepare("SELECT * FROM auctions WHERE mode='test' AND state='live' AND product_id=? LIMIT 1").get(product);
   if(!a){const id=randomUUID(),now=this.clock();this.db.prepare("INSERT INTO auctions(id,product_id,mode,model,state,bid_fee_cents,reset_ms,starts_at,ends_at) VALUES(?,?,'test','paid','live',0,10000,?,?)").run(id,product,now,now+30000);a=this.db.prepare('SELECT * FROM auctions WHERE id=?').get(id);}
   return this.publicAuction(a);
  });
 }
 bid(user,id,requestId){
  if(!/^[a-zA-Z0-9_-]{16,80}$/.test(requestId??''))fail('INVALID_REQUEST_ID',400);
  return this.transaction(()=>{
   const previous=this.db.prepare('SELECT * FROM bids WHERE user_id=? AND request_id=?').get(user,requestId);
   if(previous){if(previous.auction_id!==id)fail('REQUEST_ID_REUSED');return {bid:previous,replayed:true};}
   this.settleInside();const a=this.db.prepare('SELECT * FROM auctions WHERE id=?').get(id);if(!a)fail('AUCTION_NOT_FOUND',404);
   if(a.state!=='live'||this.clock()>=a.ends_at)fail('AUCTION_ENDED');
   if(a.mode==='test'&&!user.startsWith('test:'))fail('TEST_SESSION_REQUIRED',403);
   if(a.mode==='live'&&(user.startsWith('test:')||!this.gates().liveEnabled))fail('REAL_BIDDING_NOT_OPEN',403);
   if(a.leader===user)fail('ALREADY_HIGHEST_BIDDER');
   const spent=a.model==='paid'?1:0;
   if(spent){const result=this.db.prepare('UPDATE wallets SET credits=credits-1 WHERE user_id=? AND mode=? AND credits>=1').run(user,a.mode);if(!result.changes)fail('NO_BID_CREDITS',402);}
   const now=this.clock(),bid={id:randomUUID(),auction_id:id,user_id:user,request_id:requestId,price_cents:a.price_cents+1,credits_spent:spent,at:now};
   this.db.prepare('INSERT INTO bids VALUES(?,?,?,?,?,?,?)').run(...Object.values(bid));
   if(spent)this.db.prepare('INSERT INTO ledger VALUES(?,?,?,?,?,?,?)').run(randomUUID(),user,a.mode,-1,'bid',bid.id,now);
   // A bid never shortens an existing longer countdown.
   this.db.prepare('UPDATE auctions SET price_cents=?,ends_at=?,leader=?,version=version+1 WHERE id=?').run(bid.price_cents,Math.max(a.ends_at,now+a.reset_ms),user,id);
   return {bid,replayed:false};
  });
 }
 verifyProduct(id,{stock,retailCents,shippingCents=0}){
  if(!Number.isSafeInteger(stock)||stock<1||!cents(retailCents)||retailCents<1||!cents(shippingCents))fail('INVALID_INVENTORY',400);
  if(!this.db.prepare('UPDATE products SET stock=?,verified=1,retail_cents=?,shipping_cents=? WHERE id=?').run(stock,retailCents,shippingCents,id).changes)fail('PRODUCT_NOT_FOUND',404);
 }
 publish(productId,{model='paid',feeCents=60,durationMs=3600000,resetMs=10000}={}){
  if(!this.gates().liveEnabled)fail('LAUNCH_REQUIREMENTS_PENDING',403);
  if(!['paid','free'].includes(model)||!cents(feeCents)||(model==='paid'&&feeCents!==60)||(model==='free'&&feeCents!==0)||durationMs<30000||!Number.isSafeInteger(durationMs)||!Number.isSafeInteger(resetMs)||resetMs<9000||resetMs>60000)fail('INVALID_RULES',400);
  return this.transaction(()=>{const p=this.db.prepare('SELECT * FROM products WHERE id=?').get(productId);if(!p?.verified||p.stock<1)fail('VERIFIED_STOCK_REQUIRED');
   this.db.prepare('UPDATE products SET stock=stock-1 WHERE id=?').run(productId);const id=randomUUID(),now=this.clock();this.db.prepare("INSERT INTO auctions(id,product_id,mode,model,state,bid_fee_cents,reset_ms,starts_at,ends_at) VALUES(?,?,?,?,'live',?,?,?,?)").run(id,productId,'live',model,feeCents,resetMs,now,now+durationMs);return id;});
 }
 quotePurchase(user,{kind,orderId}){
  if(user.startsWith('test:')||!this.gates().liveEnabled)fail('PAYMENTS_NOT_OPEN',403);
  return this.transaction(()=>{let amount,credits=0;
   if(kind==='bid_pack'){amount=600;credits=10;} // Operator offer: 10 bids for $6; never change client-side.
   else if(kind==='order'){const order=this.db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(orderId,user);if(!order||order.state!=='awaiting_payment')fail('ORDER_NOT_PAYABLE',403);amount=order.price_cents+order.shipping_cents;}
   else fail('INVALID_PURCHASE',400);
   if(!cents(amount)||amount<1)fail('INVALID_PRICE',400);const id=randomUUID();this.db.prepare('INSERT INTO purchases(id,user_id,kind,order_id,credits,amount_cents,created_at) VALUES(?,?,?,?,?,?,?)').run(id,user,kind,kind==='order'?orderId:null,credits,amount,this.clock());return {id,amount_cents:amount,currency:'USD',kind};});
 }
 paymentEvent({eventId,purchaseId,amountCents,currency}){
  return this.transaction(()=>{const old=this.db.prepare('SELECT purchase_id FROM payment_events WHERE id=?').get(eventId);if(old){if(old.purchase_id!==purchaseId)fail('EVENT_REUSED');return {replayed:true};}
   const p=this.db.prepare('SELECT * FROM purchases WHERE id=?').get(purchaseId);if(!p||p.amount_cents!==amountCents||p.currency!==currency)fail('PAYMENT_MISMATCH',400);
   this.db.prepare('INSERT INTO payment_events VALUES(?,?,?)').run(eventId,purchaseId,this.clock());if(p.state==='paid')return {replayed:true};
   if(p.kind==='bid_pack'){this.db.prepare("INSERT INTO wallets VALUES(?,'live',?) ON CONFLICT(user_id,mode) DO UPDATE SET credits=credits+excluded.credits").run(p.user_id,p.credits);this.db.prepare("INSERT INTO ledger VALUES(?,?,'live',?,'purchase',?,?)").run(randomUUID(),p.user_id,p.credits,p.id,this.clock());}
   else {const r=this.db.prepare("UPDATE orders SET state='paid' WHERE id=? AND user_id=? AND state='awaiting_payment'").run(p.order_id,p.user_id);if(!r.changes)fail('ORDER_NOT_PAYABLE');}
   this.db.prepare("UPDATE purchases SET state='paid' WHERE id=?").run(p.id);return {replayed:false};});
 }
 acceptTaxQuote(id,{totalAmountCents,currency,taxCalculated}){
  const p=this.db.prepare('SELECT * FROM purchases WHERE id=?').get(id);if(!p||p.state!=='pending'||!cents(totalAmountCents)||totalAmountCents<p.amount_cents||currency!==p.currency||taxCalculated!==true)fail('VALID_TAX_QUOTE_REQUIRED',502);
  this.db.prepare('UPDATE purchases SET amount_cents=? WHERE id=?').run(totalAmountCents,id);
 }
 shipOrder(id,tracking){if(typeof tracking!=='string'||tracking.length<3||tracking.length>200)fail('TRACKING_REQUIRED',400);if(!this.db.prepare("UPDATE orders SET state='shipped',tracking=? WHERE id=? AND state='paid'").run(tracking,id).changes)fail('PAID_ORDER_REQUIRED');}
 close(){this.db.close();}
}
