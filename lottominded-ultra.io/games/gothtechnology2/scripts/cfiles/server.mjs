import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual, createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import sharp from 'sharp';
const root=resolve(import.meta.dirname,'../..');
const base=process.env.STORE_BASE_PATH||'/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/';
const prefix=base+'c-files/api/';
const port=Number(process.env.CFILES_PORT||4185);
const dataDir=resolve(process.env.CFILES_DATA_DIR||resolve(root,'output/c-files-local'));mkdirSync(dataDir,{recursive:true});
const db=new DatabaseSync(resolve(dataDir,'cfiles.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'member');
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),expires INTEGER);
CREATE TABLE IF NOT EXISTS cases(id TEXT PRIMARY KEY,title TEXT NOT NULL,year INTEGER,event_date TEXT,timezone TEXT,location TEXT,lat REAL,lon REAL,location_note TEXT,event_type TEXT,witness_type TEXT,credibility TEXT,narrative TEXT,gear TEXT,source_name TEXT,source_url TEXT,status TEXT NOT NULL,created_at TEXT,author_id TEXT REFERENCES users(id));
CREATE TABLE IF NOT EXISTS evidence(id TEXT PRIMARY KEY,case_id TEXT REFERENCES cases(id),author_id TEXT REFERENCES users(id),kind TEXT,narrative TEXT,source_url TEXT,image BLOB,image_hash TEXT,status TEXT,created_at TEXT);
CREATE TABLE IF NOT EXISTS decisions(id TEXT PRIMARY KEY,kind TEXT,item_id TEXT,reviewer_id TEXT REFERENCES users(id),decision TEXT,note TEXT,created_at TEXT);
CREATE VIRTUAL TABLE IF NOT EXISTS case_search USING fts5(id UNINDEXED,title,location,narrative);
`);
const seeds=JSON.parse(readFileSync(resolve(root,'store/cfiles/seed.json'),'utf8'));
function insertCase(c){const keys=Object.keys(c);db.prepare(`INSERT OR IGNORE INTO cases(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).run(...keys.map(k=>c[k]??null));}
for(const seed of seeds){insertCase(seed);db.prepare('UPDATE cases SET source_url=?,narrative=? WHERE id=? AND author_id IS NULL').run(seed.source_url,seed.narrative,seed.id);}
function indexCases(){db.exec('DELETE FROM case_search');db.exec('INSERT INTO case_search(id,title,location,narrative) SELECT id,title,location,narrative FROM cases');}indexCases();
const hash=value=>createHash('sha256').update(value).digest('hex');
const counters=new Map();
function rate(key,max){const now=Date.now();let c=counters.get(key);if(!c||c.end<now)c={n:0,end:now+60000};counters.set(key,c);if(++c.n>max)throw Object.assign(Error('Too many requests. Please wait a minute.'),{status:429});if(counters.size>10000)for(const[k,v]of counters)if(v.end<now)counters.delete(k);}
function currentUser(req){const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('cf_session='))?.slice(11);return token?db.prepare('SELECT u.id,u.name,u.email,u.role FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?').get(hash(token),Date.now()):null;}
function required(req,admin=false){const user=currentUser(req);if(!user)throw Object.assign(Error('Sign in to continue.'),{status:401});if(admin&&user.role!=='moderator')throw Object.assign(Error('Moderator access required.'),{status:403});return user;}
function fail(message,status=400){throw Object.assign(Error(message),{status});}
function text(v,min,max,label){if(typeof v!=='string'||v.trim().length<min||v.trim().length>max)fail(`${label} must be ${min}–${max} characters.`);return v.trim();}
function optional(v,max=300){return typeof v==='string'?v.trim().slice(0,max):'';}
function safeURL(v){if(!v)return '';try{const u=new URL(v);if(u.protocol!=='https:'||u.username||u.password)fail('Use an HTTPS source link.');return u.href;}catch{fail('Use an HTTPS source link.');}}
function choice(v,allowed){if(!allowed.includes(v))fail('Choose a valid option.');return v;}
async function body(req){let count=0;const chunks=[];for await(const chunk of req){count+=chunk.length;if(count>7_000_000)fail('Upload must be below 4 MB.',413);chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail('Invalid request.');}}
function send(res,data,status=200){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
async function api(req,res,url){
 const route=url.pathname.slice(prefix.length);rate(req.socket.remoteAddress+':read',180);
 if(req.method!=='GET'){
  if(req.headers.origin!==`http://${req.headers.host}`)fail('Origin not allowed.',403);
  if(!req.headers['content-type']?.startsWith('application/json'))fail('JSON required.',415);
  rate(req.socket.remoteAddress+':write',30);
 }
 if(route==='health')return send(res,{mode:'local',connected:true,note:'Local review environment. Accounts and reports stay on this computer. The first local account is the moderator.'});
 if(route==='me')return send(res,{user:currentUser(req)||null});
 if(route==='auth/signup'&&req.method==='POST'){
  rate(req.socket.remoteAddress+':signup',6);const b=await body(req);const email=text(b.email,5,254,'Email').toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('Enter a valid email.');
  const password=text(b.password,12,128,'Password'),name=text(b.name,2,60,'Display name');const salt=randomBytes(16).toString('hex');
  const role=db.prepare('SELECT count(*) AS n FROM users').get().n===0?'moderator':'member';
  const id=randomUUID();try{db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(id,email,name,salt+':'+scryptSync(password,salt,64).toString('hex'),role);}catch{fail('An account with that email already exists.',409);}
  return send(res,{ok:true,message:'Local account created. Sign in to continue.'},201);
 }
 if(route==='auth/login'&&req.method==='POST'){
  rate(req.socket.remoteAddress+':login',8);const b=await body(req);const u=db.prepare('SELECT * FROM users WHERE email=?').get(optional(b.email,254).toLowerCase());
  const parts=(u?.password||'unknown:'+Buffer.alloc(64).toString('hex')).split(':');const candidate=scryptSync(optional(b.password,128),parts[0],64);
  if(!u||!timingSafeEqual(candidate,Buffer.from(parts[1],'hex')))fail('Email or password not recognized.',401);
  const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),u.id,Date.now()+86400000);
  res.setHeader('Set-Cookie',`cf_session=${token}; HttpOnly; SameSite=Strict; Path=${base}c-files/; Max-Age=86400`);return send(res,{ok:true});
 }
 if(route==='auth/logout'&&req.method==='POST'){const token=(req.headers.cookie||'').match(/cf_session=([^;]+)/)?.[1];if(token)db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token));res.setHeader('Set-Cookie',`cf_session=; HttpOnly; SameSite=Strict; Path=${base}c-files/; Max-Age=0`);return send(res,{ok:true});}
 if(route==='cases'&&req.method==='GET'){
  const clauses=["status='published'"],args=[];const q=url.searchParams.get('q');
  if(q){const words=q.slice(0,160).match(/[\p{L}\p{N}]+/gu)||[];if(words.length){clauses.push('id IN (SELECT id FROM case_search WHERE case_search MATCH ?)');args.push(words.map(w=>'"'+w+'"').join(' AND '));}}
  for(const [param,col]of [['year','year'],['type','event_type'],['witness','witness_type'],['status','credibility']])if(url.searchParams.get(param)){clauses.push(col+'=?');args.push(url.searchParams.get(param));}
  const cases=db.prepare('SELECT * FROM cases WHERE '+clauses.join(' AND ')+' ORDER BY year DESC LIMIT 500').all(...args);return send(res,{cases});
 }
 if(route==='reports'&&req.method==='POST'){
  const user=required(req);rate(user.id+':report',5);const b=await body(req);if(b.consent!==true)fail('Permission to share is required.');
  const date=text(b.event_date,10,25,'Event date');if(!Number.isFinite(Date.parse(date))||Date.parse(date)>Date.now()+86400000)fail('Enter a valid past event date.');
  const tz=text(b.timezone,3,80,'Timezone');try{new Intl.DateTimeFormat('en',{timeZone:tz});}catch{fail('Use an IANA timezone such as America/New_York.');}
  let lat=null,lon=null;if(b.lat!==''&&b.lat!=null||b.lon!==''&&b.lon!=null){lat=Number(b.lat);lon=Number(b.lon);if(b.lat===''||b.lon===''||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)fail('Enter both valid coordinates.');lat=Math.round(lat*10)/10;lon=Math.round(lon*10)/10;}
  const c={id:randomUUID(),title:text(b.title,5,140,'Title'),year:Number(date.slice(0,4)),event_date:date,timezone:tz,location:text(b.location,3,160,'Location'),lat,lon,location_note:'Community location rounded to one decimal degree for privacy.',event_type:choice(b.event_type,['Sighting','Physical trace','Reported abduction','Astronomical event','Other']),witness_type:choice(b.witness_type,['Civilian','Military','Pilot','Astronomer','Other']),credibility:'Unreviewed',narrative:text(b.narrative,40,6000,'Observation'),gear:optional(b.gear),source_name:'Community submission',source_url:'',status:'queued',created_at:new Date().toISOString(),author_id:user.id};
  insertCase(c);indexCases();return send(res,{id:c.id,status:'queued'},201);
 }
 if(route==='mine'){const u=required(req);return send(res,{reports:db.prepare('SELECT id,title,status,created_at FROM cases WHERE author_id=? ORDER BY created_at DESC').all(u.id)});}
 if(route==='evidence'&&req.method==='GET'){
  const u=currentUser(req);const c=db.prepare('SELECT * FROM cases WHERE id=?').get(url.searchParams.get('case'));
  if(!c||(c.status!=='published'&&c.author_id!==u?.id&&u?.role!=='moderator'))fail('Case not found.',404);
  return send(res,{evidence:db.prepare("SELECT id,case_id,kind,narrative,source_url,status,created_at,image IS NOT NULL AS has_image FROM evidence WHERE case_id=? AND (status='published' OR author_id=?) ORDER BY created_at DESC").all(c.id,u?.id||'')});
 }
 if(route==='evidence'&&req.method==='POST'){
  const u=required(req);rate(u.id+':evidence',8);const b=await body(req);if(b.consent!==true)fail('Permission to share is required.');const c=db.prepare('SELECT * FROM cases WHERE id=?').get(b.case_id);if(!c||(c.status!=='published'&&c.author_id!==u.id))fail('Case not found.',404);
  let image=null,imageHash=null;if(b.image){if(typeof b.image!=='string'||b.image.length>5_700_000)fail('Image exceeds 4 MB.',413);const raw=Buffer.from(b.image,'base64');if(raw.length>4_194_304)fail('Image exceeds 4 MB.',413);try{const metadata=await sharp(raw,{limitInputPixels:25_000_000}).metadata();if(!['jpeg','png','webp'].includes(metadata.format))fail('Use JPEG, PNG or WebP.');imageHash=hash(raw);image=await sharp(raw,{limitInputPixels:25_000_000}).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();}catch{fail('Use a valid JPEG, PNG or WebP image.');}}
  const id=randomUUID();db.prepare('INSERT INTO evidence VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,c.id,u.id,choice(b.kind,['Corroboration','Alternative explanation','Source document']),text(b.narrative,10,4000,'Evidence note'),safeURL(b.source_url),image,imageHash,'queued',new Date().toISOString());return send(res,{id,status:'queued'},201);
 }
 if(route.startsWith('image/')&&req.method==='GET'){const u=currentUser(req),id=route.slice(6);const e=db.prepare('SELECT e.*,c.status AS case_status FROM evidence e JOIN cases c ON c.id=e.case_id WHERE e.id=?').get(id);const publiclyVisible=e?.status==='published'&&e.case_status==='published';if(!e?.image||(!publiclyVisible&&e.author_id!==u?.id&&u?.role!=='moderator'))fail('Image not found.',404);res.writeHead(200,{'Content-Type':'image/webp','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(e.image);}
 if(route==='queue'){required(req,true);return send(res,{reports:db.prepare("SELECT * FROM cases WHERE status='queued' ORDER BY created_at").all(),evidence:db.prepare("SELECT id,case_id,kind,narrative,source_url,image IS NOT NULL AS has_image,created_at FROM evidence WHERE status='queued' ORDER BY created_at").all()});}
 if(route==='review'&&req.method==='POST'){
  const u=required(req,true),b=await body(req);const table=choice(b.kind,['cases','evidence']);const decision=choice(b.decision,['published','rejected']);const note=text(b.note,5,2000,'Moderator rationale');const item=db.prepare(`SELECT id,status FROM ${table} WHERE id=?`).get(b.id);if(!item||item.status!=='queued')fail('This item is no longer pending.',409);
  const credibility=table==='cases'?choice(b.credibility,['Unreviewed','Source documented','Insufficient data','Explanation proposed']):null;
  if(table==='evidence'&&decision==='published'){const parent=db.prepare('SELECT c.status FROM cases c JOIN evidence e ON e.case_id=c.id WHERE e.id=?').get(b.id);if(parent?.status!=='published')fail('Publish the case before publishing its evidence.',409);}
  db.exec('BEGIN');try{if(table==='cases')db.prepare('UPDATE cases SET status=?,credibility=? WHERE id=?').run(decision,credibility,b.id);else db.prepare('UPDATE evidence SET status=? WHERE id=?').run(decision,b.id);db.prepare('INSERT INTO decisions VALUES(?,?,?,?,?,?,?)').run(randomUUID(),table,b.id,u.id,decision,note,new Date().toISOString());db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}indexCases();return send(res,{ok:true});
 }
 fail('Route not found.',404);
}
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.mp4':'video/mp4','.mp3':'audio/mpeg','.glb':'model/gltf-binary'};
export const server=http.createServer(async(req,res)=>{try{
 if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host))fail('Host not allowed.',403);
 const url=new URL(req.url,'http://127.0.0.1');if(url.pathname.startsWith(prefix))return await api(req,res,url);
 if(!url.pathname.startsWith(base)){res.writeHead(302,{Location:base+'c-files/'});return res.end();}
 let name=decodeURIComponent(url.pathname.slice(base.length));if(!name||name.endsWith('/'))name+='index.html';const dist=resolve(root,'dist');const file=resolve(dist,name);if(!file.startsWith(dist+sep))fail('Not found.',404);
 const info=await stat(file);if(!info.isFile())fail('Not found.',404);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'});createReadStream(file).pipe(res);
}catch(error){if(!res.headersSent)send(res,{error:error.status?error.message:error.code==='ENOENT'?'Not found.':'Request could not be completed.'},error.status||(error.code==='ENOENT'?404:500));else res.end();}});
server.listen(port,'127.0.0.1',()=>console.log('C-Files local review: http://127.0.0.1:'+port+base+'c-files/'));
