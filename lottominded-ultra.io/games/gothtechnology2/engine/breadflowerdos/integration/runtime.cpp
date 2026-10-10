// Original portable integration, 2026. Upstream PlayerInput is unchanged and MIT licensed.
// No upstream unfinished EventManager/GameServer behavior is claimed here.
#include <dice/hfe/io/PlayerInput.hpp>
#include <cmath>
#include <algorithm>
#include <cstdint>

namespace bf {
using dice::hfe::io::PlayerInput;
using dice::hfe::io::PlayerInputMap;
constexpr int Slots=6, Contexts=16, Projectiles=256, Salvos=64, Events=128, Hits=512, Words=24000;
struct Weapon {double damage,speed,radius,spread; int cadence,life,ammo,pellets;double gravity,inherit;int magazine,reloadCommit,reloadEnd,modes,burstCount,adsTicks;double kickYaw,kickPitch,recovery;};
#include "combat_profiles.hpp"
struct Actor {
 int present=0,alive=1,connected=1,drop=-1,slot=0,loadout[2]={0,-1},ammo[3]={80,0,0};
 int utility=1,repairs=1,shieldUntil=0,repairUntil=0,switchUntil=0,shotAt=-999,lastShot=0;
 int lastDamage=-99999,kills=0,shots=0,hits=0,eliminated=-1,crashed=0,commandShot=0,commandSlot=0;
 double integrity=100,shield=50,damage=0,x=0,y=0,z=0,heading=0,scale=1;
 int mag[3]={20,0,0},pattern[3]{},fireMode[3]{},fireHeld=0,reloadHeld=0,modeHeld=0,burstLeft=0,fireSerial=0;
 int reloadStart=-1,reloadCommit=0,reloadEnd=0,reloadWeapon=-1,reloadCommitted=0;
 double vx=0,vz=0,roll=0,air=0,rough=0,kickYaw=0,kickPitch=0,aimBlend=0,lean=0;
};
struct Projectile {int active=0,serial=0,salvo=0,pellet=0;double x=0,y=0,z=0,vx=0,vy=0,vz=0;int resolvedTick=-1;};
struct Salvo {int active=0,owner=0,shot=0,weapon=0,expires=0;double awarded[6]{};};
struct Loot {int present=0,available=1,kind=0;double x=0,y=0,z=0;};
struct Event {int tick=0,kind=0,actor=0,target=-1;};
struct Hit {int target=0,owner=-1,bypass=0;double amount=0;};
struct State {
 PlayerInput inputs[6]{};
 Actor actors[6];Projectile projectiles[Projectiles];Salvo salvos[Salvos];Loot loot[32];
 Event events[Events];Hit hits[Hits];
 int tick=0,phase=0,seed=0,winner=-1,reason=0,serial=0,stage=0,eventCount=0,hitCount=0,error=0;
 double radii[6]={320,210,130,60,16,0};
 double frames=0;double centers[5][2]={{0,0},{-12,0},{12,0},{0,-12},{0,12}};
};
struct Context {bool used=false;int generation=1;State s{};double saved[Words]{};int savedSize=0,restoreSize=0,restoreAt=0;};
Context contexts[Contexts];
Context* get(int handle){if(handle<=0)return nullptr;int i=(handle-1)%Contexts,g=(handle-1)/Contexts;auto& c=contexts[i];return c.used&&c.generation==g?&c:nullptr;}
bool slot(int s){return s>=0&&s<Slots;}
bool finite(double n,double lo,double hi){return std::isfinite(n)&&n>=lo&&n<=hi;}
int fail(State& s,int code){s.error=code;return -code;}
double input(State& s,int who,int ch){auto p=s.inputs[who].getInput(static_cast<PlayerInputMap>(ch));return p?*p:0;}
void event(State& s,int kind,int who,int target=-1){if(s.eventCount==Events){fail(s,20);return;}s.events[s.eventCount++]={s.tick,kind,who,target};}
void hit(State& s,int target,double amount,int owner=-1,int bypass=0){if(s.hitCount==Hits){fail(s,21);return;}s.hits[s.hitCount++]={target,owner,bypass,amount};}
struct Field {double x,z,radius,next,remaining,damage;int phase;};
Field field(const State& s){

 constexpr double ends[]={80,170,255,335,360},damage[]={2,4,8,18,100};
 double t=std::max(0,s.tick-240)/60.0;int p=0;while(p<4&&t>=ends[p])++p;
 double start=p?ends[p-1]:0,f=std::clamp((t-start)/(ends[p]-start),0.0,1.0);
 int center=s.seed%5;return {s.centers[center][0],s.centers[center][1],s.radii[p]+(s.radii[p+1]-s.radii[p])*f,s.radii[p+1],std::max(0.0,ends[p]-t),damage[p],p};
}
void fire(State& s,int who){
 auto& a=s.actors[who];
 int weapon=a.loadout[a.slot];auto w=weapons[weapon];
 if(s.phase!=2||a.shieldUntil>s.tick||a.crashed||s.tick<a.switchUntil||a.reloadStart>=0||s.tick-a.shotAt<w.cadence||a.mag[weapon]<=0)return;
 int group=-1,free=0;for(int i=0;i<Salvos;i++)if(!s.salvos[i].active){group=i;break;}
 for(auto& p:s.projectiles)if(!p.active)++free;
 if(group<0||free<w.pellets){fail(s,22);return;}
 --a.ammo[weapon];--a.mag[weapon];a.shotAt=s.tick;++a.shots;int seq=++a.fireSerial;
 s.salvos[group]={1,who,seq,weapon,s.tick+w.life,{}};
 double yaw=a.heading+std::clamp(input(s,who,4)*1.25+a.kickYaw,-1.25,1.25),pitch=std::clamp(input(s,who,5)*.65+a.kickPitch,-.65,.65),reach=.52*a.scale;
 double turn=input(s,who,4)*1.25*.6,side=-.02,forward=a.scale<1?-.03:.14;double gx=(std::cos(turn)*side+std::sin(turn)*forward+a.roll*.9+a.lean*.025)*a.scale,gy=(1.43+.12*a.aimBlend)*a.scale+(a.scale<1?.08:0),gz=(-std::sin(turn)*side+std::cos(turn)*forward)*a.scale;
 double x=a.x+std::cos(a.heading)*gx+std::sin(a.heading)*gz+std::sin(yaw)*std::cos(pitch)*reach;
 double y=a.y+gy+std::sin(pitch)*reach;
 double z=a.z-std::sin(a.heading)*gx+std::cos(a.heading)*gz+std::cos(yaw)*std::cos(pitch)*reach;
 // Seed belongs to the match, pattern counters survive reload, swap and reconnect.
 int count=a.pattern[weapon]++;uint32_t noise=uint32_t(s.seed)^(uint32_t(who+1)*73471u)^(uint32_t(count)*19349663u);
 noise^=noise<<13;noise^=noise>>17;noise^=noise<<5;
 double variation=(double(noise%1001)/500.0-1)*.25;
 double stability=std::clamp(1+std::abs(a.roll)*.6+a.air*.5+a.rough*.2+std::hypot(a.vx,a.vz)/100-a.aimBlend*.35,.6,1.9);
 constexpr double pattern[]={-.6,.3,.8,-.2,-.8,.5};
 double dispersion=w.spread*(1-a.aimBlend*.65)*(1+std::abs(a.roll)*.4);
 int pellet=0;for(auto& p:s.projectiles)if(!p.active&&pellet<w.pellets){
  double angle=yaw+(pellet-(w.pellets-1)/2.0)*dispersion+variation*dispersion;
  p={1,++s.serial,group,pellet++,x,y,z,std::sin(angle)*std::cos(pitch)*w.speed+a.vx*w.inherit,std::sin(pitch)*w.speed,std::cos(angle)*std::cos(pitch)*w.speed+a.vz*w.inherit};
 }
 a.kickYaw=std::clamp(a.kickYaw+(pattern[count%6]+variation)*w.kickYaw*stability,-.12,.12);
 a.kickPitch=std::clamp(a.kickPitch+w.kickPitch*stability,0.0,.22);
 if(a.burstLeft>0)--a.burstLeft;
 event(s,1,who);
}
void cancelReload(Actor& a){a.reloadStart=-1;a.reloadCommit=a.reloadEnd=0;a.reloadWeapon=-1;a.reloadCommitted=0;}
void startReload(State& s,int who){
 auto& a=s.actors[who];int id=a.loadout[a.slot];auto w=weapons[id];
 if(a.reloadStart>=0||a.mag[id]>=w.magazine||a.ammo[id]<=a.mag[id]||a.crashed||s.tick<a.switchUntil)return;
 a.reloadStart=s.tick;a.reloadCommit=s.tick+w.reloadCommit;a.reloadEnd=s.tick+w.reloadEnd;a.reloadWeapon=id;a.reloadCommitted=0;a.burstLeft=0;event(s,7,who);
}
void rules(State& s){
 auto f=field(s);
 for(int who=0;who<Slots;who++){
  auto& a=s.actors[who];if(!a.present||!a.alive)continue;
  if(!a.connected&&a.drop>=0&&s.tick-a.drop>=1200){hit(s,who,999,-1,1);continue;}
  int sel=a.commandSlot;if(sel!=a.slot&&a.loadout[sel]>=0){cancelReload(a);a.burstLeft=0;a.slot=sel;a.switchUntil=s.tick+24;}
  auto w=weapons[a.loadout[a.slot]];
  a.kickYaw*=std::exp(-w.recovery/60);a.kickPitch*=std::exp(-w.recovery/60);
  double targetAim=input(s,who,18);a.aimBlend+=std::clamp(targetAim-a.aimBlend,-1.0/w.adsTicks,1.0/w.adsTicks);
  a.lean+=std::clamp(input(s,who,19)-a.lean,-.08,.08);
  bool held=input(s,who,8)>0,edge=held&&!a.fireHeld,reload=input(s,who,16)>0,mode=input(s,who,17)>0;
  a.lastShot=std::max(a.lastShot,a.commandShot);
  if(a.crashed||!a.alive){cancelReload(a);a.burstLeft=0;}
  if(mode&&!a.modeHeld){int id=a.loadout[a.slot];do{a.fireMode[id]=(a.fireMode[id]+1)%3;}while(!(w.modes&(1<<a.fireMode[id])));a.burstLeft=0;}
  a.modeHeld=mode;
  if(reload&&!a.reloadHeld)startReload(s,who);a.reloadHeld=reload;
  if(a.reloadStart>=0&&s.tick>=a.reloadCommit&&!a.reloadCommitted){
   a.mag[a.reloadWeapon]=std::min(weapons[a.reloadWeapon].magazine,a.ammo[a.reloadWeapon]);a.reloadCommitted=1;event(s,8,who);
  }
  if(a.reloadStart>=0&&s.tick>=a.reloadEnd)cancelReload(a);
  // Fire cancels an uncommitted or committed reload but cannot create ammunition.
  if(edge&&a.reloadStart>=0){cancelReload(a);a.switchUntil=std::max(a.switchUntil,s.tick+6);}
  if(!a.connected){a.burstLeft=0;held=edge=false;}
  int fireMode=a.fireMode[a.loadout[a.slot]];
  if(edge&&fireMode==1)a.burstLeft=w.burstCount;
  bool wants=fireMode==0?edge:fireMode==1?a.burstLeft>0:held;
  a.fireHeld=held;
  if(s.phase!=2)continue;
  if(input(s,who,10)>0&&a.utility&&s.tick>=a.shieldUntil){--a.utility;a.shieldUntil=s.tick+150;event(s,2,who);}
  if(input(s,who,11)>0&&a.repairs&&!a.repairUntil){--a.repairs;a.repairUntil=s.tick+180;}
  if(wants){a.repairUntil=0;fire(s,who);}
  if(a.repairUntil&&s.tick>=a.repairUntil){a.integrity=std::min(100.0,a.integrity+35);a.repairUntil=0;}
  if(s.tick-a.lastDamage>480)a.shield=std::min(50.0,a.shield+.05);
  if(std::hypot(a.x-f.x,a.z-f.z)>f.radius)hit(s,who,f.damage/60,-1,1);
  for(auto& item:s.loot){
   if(!item.present||!item.available||std::hypot(a.x-item.x,a.z-item.z)>2.5)continue;
   if(item.kind==3){if(a.repairs>=2)continue;++a.repairs;}
   else if(item.kind==4){if(a.utility>=1)continue;++a.utility;}
   else if(item.kind==5){for(int w:a.loadout)if(w>=0)a.ammo[w]=std::min(weapons[w].ammo,a.ammo[w]+int(std::ceil(weapons[w].ammo*.3)));}
   else if(a.loadout[0]==item.kind||a.loadout[1]==item.kind)a.ammo[item.kind]=std::min(weapons[item.kind].ammo,a.ammo[item.kind]+12);
   else if(a.loadout[1]<0){a.loadout[1]=item.kind;a.ammo[item.kind]=weapons[item.kind].ammo;a.mag[item.kind]=weapons[item.kind].magazine;}
   else if(input(s,who,12)>0){cancelReload(a);a.burstLeft=0;a.loadout[a.slot]=item.kind;a.ammo[item.kind]=weapons[item.kind].ammo;a.mag[item.kind]=weapons[item.kind].magazine;a.switchUntil=s.tick+24;}
   else continue;
   item.available=0;event(s,3,who);
  }
 }
}
void finish(State& s){
 for(int i=0;i<s.hitCount;i++){auto h=s.hits[i];auto& a=s.actors[h.target];a.lastDamage=s.tick;a.repairUntil=0;
  double shield=h.bypass?0:std::min(a.shield,h.amount),injury=std::min(a.integrity,h.amount-shield);
  a.shield-=shield;a.integrity-=injury;if(h.owner>=0){auto& owner=s.actors[h.owner];owner.damage+=shield+injury;++owner.hits;event(s,4,h.owner,h.target);}
 }
 for(int who=0;who<Slots;who++){auto& a=s.actors[who];if(a.present&&a.alive&&a.integrity<=0){a.alive=0;a.eliminated=s.tick;
  for(int i=s.hitCount-1;i>=0;i--)if(s.hits[i].target==who&&s.hits[i].owner>=0){++s.actors[s.hits[i].owner].kills;break;}
  cancelReload(a);a.burstLeft=0;a.fireHeld=0;event(s,5,who);
 }}
 int live=0,last=-1;for(int i=0;i<Slots;i++)if(s.actors[i].present&&s.actors[i].alive){++live;last=i;}
 if(s.phase==2&&live<=1){s.phase=3;s.winner=last;s.reason=live?1:2;}
 else if(s.phase==2&&s.tick>=21840){s.phase=3;s.winner=-1;s.reason=3;for(auto& a:s.actors)if(a.alive){a.alive=0;a.integrity=0;a.eliminated=s.tick;event(s,5,int(&a-s.actors));}}
 if(s.phase==3){for(auto& p:s.projectiles)p.active=0;for(auto& a:s.inputs)a={};for(auto& a:s.actors){cancelReload(a);a.burstLeft=0;a.fireHeld=0;}event(s,6,s.winner);}
 for(int i=0;i<Salvos;i++){bool active=false;for(auto& p:s.projectiles)if(p.active&&p.salvo==i){active=true;break;}if(!active)s.salvos[i].active=0;}
 s.stage=0;
}
// Versioned semantic scalar stream. Each field is validated before candidate commit.
// No pointers, padding, native object bytes or vtables cross the boundary.
struct Stream {
 double* data;int count=0;bool reading=false,ok=true;
 void number(double& v,double lo,double hi){if(count>=Words){ok=false;return;}if(reading){double n=data[count];if(!finite(n,lo,hi))ok=false;else v=n;}else data[count]=v;++count;}
 void integer(int& v,int lo,int hi){double n=v;number(n,lo,hi);if(reading){if(std::floor(n)!=n)ok=false;else v=int(n);}}
};
void serialize(State& s,Stream& v){
 int version=6;v.integer(version,6,6);
 for(auto& r:s.radii)v.number(r,0,10000);
 if(v.reading){for(int i=0;i<5;i++)if(s.radii[i]<=s.radii[i+1])v.ok=false;if(s.radii[5]!=0)v.ok=false;}
 for(auto& center:s.centers)for(auto& n:center)v.number(n,-10000,10000);
 v.integer(s.tick,0,21840);v.integer(s.phase,0,3);v.integer(s.seed,0,2147483647);v.integer(s.winner,-1,5);v.integer(s.reason,0,3);
 v.integer(s.serial,0,2147483647);v.integer(s.stage,0,2);v.integer(s.eventCount,0,Events);v.integer(s.hitCount,0,Hits);v.integer(s.error,0,100);v.number(s.frames,0,1e12);
 for(auto& a:s.inputs){for(int ch=0;ch<64;ch++){auto p=a.getInput(static_cast<PlayerInputMap>(ch));int has=p?1:0;double n=p?*p:0;v.integer(has,0,1);v.number(n,-1,1);if(v.reading){if(ch==0)a={};if(has)a.setInput(static_cast<PlayerInputMap>(ch),float(n));}}}
 for(auto& a:s.actors){
  v.integer(a.present,0,1);v.integer(a.alive,0,1);v.integer(a.connected,0,1);v.integer(a.drop,-1,21840);v.integer(a.slot,0,1);
  for(auto& n:a.loadout)v.integer(n,-1,2);for(int i=0;i<3;i++)v.integer(a.ammo[i],0,weapons[i].ammo);
  v.integer(a.utility,0,1);v.integer(a.repairs,0,2);v.integer(a.shieldUntil,0,22020);v.integer(a.repairUntil,0,22020);v.integer(a.switchUntil,0,22020);
  v.integer(a.shotAt,-999,21840);v.integer(a.lastShot,0,2147483647);v.integer(a.lastDamage,-99999,21840);v.integer(a.kills,0,5);
  v.integer(a.shots,0,10000);v.integer(a.hits,0,100000);v.integer(a.eliminated,-1,21840);v.integer(a.crashed,0,1);
  v.integer(a.commandShot,0,2147483647);v.integer(a.commandSlot,0,1);
  v.number(a.integrity,0,100);v.number(a.shield,0,50);v.number(a.damage,0,1e7);
  v.number(a.x,-10000,10000);v.number(a.y,-10000,10000);v.number(a.z,-10000,10000);v.number(a.heading,-1e9,1e9);v.number(a.scale,.1,2);
  for(int i=0;i<3;i++){v.integer(a.mag[i],0,weapons[i].magazine);v.integer(a.pattern[i],0,10000);v.integer(a.fireMode[i],0,2);if(v.reading&&(a.mag[i]>a.ammo[i]||!(weapons[i].modes&(1<<a.fireMode[i]))))v.ok=false;}
  v.integer(a.fireHeld,0,1);v.integer(a.reloadHeld,0,1);v.integer(a.modeHeld,0,1);v.integer(a.burstLeft,0,3);v.integer(a.fireSerial,0,10000);
  v.integer(a.reloadStart,-1,21840);v.integer(a.reloadCommit,0,22020);v.integer(a.reloadEnd,0,22020);v.integer(a.reloadWeapon,-1,2);v.integer(a.reloadCommitted,0,1);
  v.number(a.vx,-100,100);v.number(a.vz,-100,100);v.number(a.roll,-2,2);v.number(a.air,0,1);v.number(a.rough,0,1);v.number(a.kickYaw,-.12,.12);v.number(a.kickPitch,0,.22);v.number(a.aimBlend,0,1);v.number(a.lean,-1,1);
  if(v.reading&&a.reloadStart>=0&&(a.reloadWeapon<0||a.reloadCommit<a.reloadStart||a.reloadEnd<a.reloadCommit))v.ok=false;
  if(v.reading&&a.present&&(a.loadout[0]<0||a.loadout[a.slot]<0||(!a.alive&&a.integrity>0)))v.ok=false;
 }
 for(auto& p:s.projectiles){v.integer(p.active,0,1);v.integer(p.serial,0,2147483647);v.integer(p.salvo,0,Salvos-1);v.integer(p.pellet,0,3);
  v.number(p.x,-10000,10000);v.number(p.y,-10000,10000);v.number(p.z,-10000,10000);v.number(p.vx,-512,512);v.number(p.vy,-512,512);v.number(p.vz,-512,512);v.integer(p.resolvedTick,-1,21840);}
 for(auto& g:s.salvos){v.integer(g.active,0,1);v.integer(g.owner,0,5);v.integer(g.shot,0,2147483647);v.integer(g.weapon,0,2);v.integer(g.expires,0,22020);for(auto& n:g.awarded)v.number(n,0,48);}
 for(auto& l:s.loot){v.integer(l.present,0,1);v.integer(l.available,0,1);v.integer(l.kind,0,5);v.number(l.x,-10000,10000);v.number(l.y,-10000,10000);v.number(l.z,-10000,10000);}
 for(auto& e:s.events){v.integer(e.tick,0,21840);v.integer(e.kind,0,8);v.integer(e.actor,-1,5);v.integer(e.target,-1,5);}
 for(auto& h:s.hits){v.integer(h.target,0,5);v.integer(h.owner,-1,5);v.integer(h.bypass,0,1);v.number(h.amount,0,999);}
 if(v.reading)for(auto& p:s.projectiles)if(p.active&&!s.salvos[p.salvo].active)v.ok=false;
}
}
extern "C" {
int bf_abi(){return 4;}
int bf_upstream(){return 0x6b4d4e1f;}
int bf_capabilities(){return 7;} // input + context lifecycle + original Royale rules
int bf_create(){for(int i=0;i<bf::Contexts;i++){auto& c=bf::contexts[i];if(!c.used){c.used=true;c.s={};c.savedSize=c.restoreSize=c.restoreAt=0;return c.generation*bf::Contexts+i+1;}}return -1;}
int bf_destroy(int id){auto c=bf::get(id);if(!c)return -1;c->used=false;c->s={};if(c->generation<100000000)++c->generation;else c->generation=1;return 1;}
int bf_clear(int id,int who){auto c=bf::get(id);if(!c||!bf::slot(who))return -1;c->s.inputs[who]={};return 1;}
int bf_set(int id,int who,int channel,double value){auto c=bf::get(id);if(!c||!bf::slot(who))return -1;if(channel<0||channel>=64)return -2;if(!bf::finite(value,-1,1))return -3;c->s.inputs[who].setInput(static_cast<bf::PlayerInputMap>(channel),float(value));return 1;}
double bf_get(int id,int who,int channel){auto c=bf::get(id);if(!c||!bf::slot(who)||channel<0||channel>=64)return 2;return bf::input(c->s,who,channel);}
int bf_frame(int id){auto c=bf::get(id);if(!c)return -1;++c->s.frames;return 1;}
double bf_frames(int id){auto c=bf::get(id);return c?c->s.frames:-1;}
int bf_add(int id,int who){auto c=bf::get(id);if(!c||!bf::slot(who)||c->s.phase||c->s.actors[who].present)return -1;c->s.actors[who]={};c->s.actors[who].present=1;return 1;}
int bf_start(int id,int seed){auto c=bf::get(id);if(!c||seed<0||(c->s.phase!=0&&c->s.phase!=3))return -1;for(auto& a:c->s.actors)if(!a.present)return -2;
 c->s={};for(auto& a:c->s.actors)a.present=1;c->s.seed=seed;c->s.phase=1;return 1;}
int bf_connected(int id,int who,int connected){auto c=bf::get(id);if(!c||!bf::slot(who)||(connected!=0&&connected!=1))return -1;auto& a=c->s.actors[who];if(a.connected!=connected){a.connected=connected;a.drop=connected?-1:c->s.tick;}if(!connected)c->s.inputs[who]={};return 1;}
int bf_loot(int id,int item,int kind,double x,double y,double z){auto c=bf::get(id);if(!c||item<0||item>=32||kind<0||kind>5||c->s.tick||!bf::finite(x,-10000,10000)||!bf::finite(y,-10000,10000)||!bf::finite(z,-10000,10000))return -1;c->s.loot[item]={1,1,kind,x,y,z};return 1;}
int bf_zone(int id,int index,double x,double z){auto c=bf::get(id);if(!c||c->s.tick||index<0||index>=5||!bf::finite(x,-10000,10000)||!bf::finite(z,-10000,10000))return -1;c->s.centers[index][0]=x;c->s.centers[index][1]=z;return 1;}
int bf_radii(int id,double a,double b,double d,double e,double f,double g){
 auto c=bf::get(id);if(!c||c->s.tick)return -1;double values[]={a,b,d,e,f,g};
 for(int i=0;i<6;i++)if(!bf::finite(values[i],0,10000)||(i<5&&values[i]<=values[i+1]))return -1;
 if(g!=0)return -1;for(int i=0;i<6;i++)c->s.radii[i]=values[i];return 1;
}
int bf_begin(int id){auto c=bf::get(id);if(!c||c->s.stage||c->s.error||c->s.phase==0||c->s.phase==3)return -1;auto& s=c->s;++s.tick;if(s.tick>=240)s.phase=2;s.stage=1;s.hitCount=0;s.eventCount=0;
 for(auto& p:s.projectiles)if(p.active&&s.salvos[p.salvo].expires<s.tick)p.active=0;return 1;}
int bf_pose(int id,int who,double x,double y,double z,double heading,int crashed,double scale){auto c=bf::get(id);if(!c||!bf::slot(who)||!bf::finite(x,-10000,10000)||!bf::finite(y,-10000,10000)||!bf::finite(z,-10000,10000)||!bf::finite(heading,-1e9,1e9)||!bf::finite(scale,.1,2)||(crashed!=0&&crashed!=1))return -1;
 auto& a=c->s.actors[who];a.x=x;a.y=y;a.z=z;a.heading=heading;a.crashed=crashed;a.scale=scale;return 1;}
int bf_command(int id,int who,int shot,int slot){auto c=bf::get(id);if(!c||!bf::slot(who)||shot<0||slot<0||slot>1)return -1;auto& a=c->s.actors[who];a.commandShot=shot;a.commandSlot=slot;return 1;}
int bf_motion(int id,int who,double vx,double vz,double roll,double air,double rough){
 auto c=bf::get(id);if(!c||!bf::slot(who)||!bf::finite(vx,-100,100)||!bf::finite(vz,-100,100)||!bf::finite(roll,-2,2)||!bf::finite(air,0,1)||!bf::finite(rough,0,1))return -1;
 auto& a=c->s.actors[who];a.vx=vx;a.vz=vz;a.roll=roll;a.air=air;a.rough=rough;return 1;
}
double bf_combat(int id,int who,int key){
 auto c=bf::get(id);if(!c||!bf::slot(who))return -1;auto& a=c->s.actors[who];
 switch(key){case 0:case 1:case 2:return a.mag[key];case 3:return a.reloadStart;case 4:return a.reloadCommit;case 5:return a.reloadEnd;case 6:return a.reloadCommitted;case 7:return a.kickYaw;case 8:return a.kickPitch;case 9:return a.aimBlend;case 10:return a.lean;case 11:return a.fireMode[a.loadout[a.slot]];case 12:return a.fireSerial;default:return -1;}
}
double bf_trajectory(int id,int index,double seconds,int axis){
 auto c=bf::get(id);if(!c||index<0||index>=bf::Projectiles||!bf::finite(seconds,0,1.0/60)||axis<0||axis>2)return std::nan("");
 auto& p=c->s.projectiles[index];auto& g=c->s.salvos[p.salvo];
 return axis==0?p.x+p.vx*seconds:axis==1?p.y+p.vy*seconds-bf::weapons[g.weapon].gravity*seconds*seconds*.5:p.z+p.vz*seconds;
}
int bf_rules(int id){auto c=bf::get(id);if(!c||c->s.stage!=1||c->s.error)return -1;bf::rules(c->s);c->s.stage=2;return c->s.error?-c->s.error:1;}
// index + serial guard prevents a stale query from resolving a reused projectile.
// target=-2 advances an unobstructed segment, -1 consumes a world hit, 0..5 rider.
int bf_resolve(int id,int index,int serial,int target){auto c=bf::get(id);if(!c||c->s.stage!=2||index<0||index>=bf::Projectiles||target<-2||target>=6)return -1;
 auto& s=c->s;auto& p=s.projectiles[index];if(!p.active||p.serial!=serial||p.resolvedTick==s.tick)return -2;auto& g=s.salvos[p.salvo];
 if(target==-2){p.resolvedTick=s.tick;p.x+=p.vx/60;p.y+=p.vy/60-bf::weapons[g.weapon].gravity/7200;p.z+=p.vz/60;p.vy-=bf::weapons[g.weapon].gravity/60;return 1;}
 if(target>=0){auto& a=s.actors[target];if(target==g.owner||!a.alive||!a.present)return -3;
  double facing=std::sin(a.heading)*(-p.vx)+std::cos(a.heading)*(-p.vz);bool blocked=a.shieldUntil>s.tick&&facing>std::hypot(p.vx,p.vz)*.45;
  double amount=std::max(0.0,std::min(bf::weapons[g.weapon].damage,(g.weapon==2?48:bf::weapons[g.weapon].damage)-g.awarded[target]));
  if(!blocked&&amount){if(s.hitCount==bf::Hits)return bf::fail(s,21);g.awarded[target]+=amount;bf::hit(s,target,amount,g.owner);}
 }p.resolvedTick=s.tick;p.active=0;return 1;}
int bf_end(int id){auto c=bf::get(id);if(!c||c->s.stage!=2||c->s.error)return -1;bf::finish(c->s);return c->s.error?-c->s.error:1;}
double bf_state(int id,int key){auto c=bf::get(id);if(!c)return -1;auto& s=c->s;switch(key){case 0:return s.tick;case 1:return s.phase;case 2:return s.winner;case 3:return s.reason;case 4:return s.error;case 5:return s.eventCount;default:return -1;}}
double bf_field(int id,int key){auto c=bf::get(id);if(!c)return -1;auto f=bf::field(c->s);switch(key){case 0:return f.x;case 1:return f.z;case 2:return f.radius;case 3:return f.next;case 4:return f.remaining;case 5:return f.phase;case 6:return f.damage;default:return -1;}}
double bf_actor(int id,int who,int key){auto c=bf::get(id);if(!c||!bf::slot(who))return -1;auto& a=c->s.actors[who];
 switch(key){case 0:return a.integrity;case 1:return a.shield;case 2:return a.alive;case 3:return a.slot;case 4:return a.loadout[0];case 5:return a.loadout[1];case 6:return a.ammo[0];case 7:return a.ammo[1];case 8:return a.ammo[2];case 9:return a.utility;case 10:return a.repairs;case 11:return a.shieldUntil;case 12:return a.repairUntil;case 13:return a.switchUntil;case 14:return a.shotAt;case 15:return a.lastShot;case 16:return a.lastDamage;case 17:return a.kills;case 18:return a.damage;case 19:return a.shots;case 20:return a.hits;case 21:return a.eliminated;default:return -1;}}
double bf_projectile(int id,int index,int key){auto c=bf::get(id);if(!c||index<0||index>=bf::Projectiles)return -1;auto& p=c->s.projectiles[index];auto& g=c->s.salvos[p.salvo];
 switch(key){case 0:return p.active;case 1:return p.serial;case 2:return g.owner;case 3:return g.shot;case 4:return g.weapon;case 5:return p.x;case 6:return p.y;case 7:return p.z;case 8:return p.vx;case 9:return p.vy;case 10:return p.vz;case 11:return g.expires;case 12:return p.pellet;default:return -1;}}
int bf_available(int id,int item){auto c=bf::get(id);return c&&item>=0&&item<32?c->s.loot[item].present&&c->s.loot[item].available:-1;}
int bf_event(int id,int index,int key){auto c=bf::get(id);if(!c||index<0||index>=c->s.eventCount)return -1;auto e=c->s.events[index];switch(key){case 0:return e.tick;case 1:return e.kind;case 2:return e.actor;case 3:return e.target;default:return -1;}}
int bf_capture(int id){auto c=bf::get(id);if(!c)return -1;bf::Stream v{c->saved};bf::serialize(c->s,v);c->savedSize=v.count;return v.ok?v.count:-1;}
double bf_saved(int id,int index){auto c=bf::get(id);return c&&index>=0&&index<c->savedSize?c->saved[index]:std::nan("");}
int bf_restore_begin(int id,int count){auto c=bf::get(id);if(!c||count<1||count>bf::Words)return -1;c->restoreSize=count;c->restoreAt=0;return 1;}
int bf_restore_value(int id,int index,double value){auto c=bf::get(id);if(!c||index!=c->restoreAt||index>=c->restoreSize||!std::isfinite(value))return -1;c->saved[index]=value;++c->restoreAt;return 1;}
int bf_restore_commit(int id){auto c=bf::get(id);if(!c||!c->restoreSize||c->restoreAt!=c->restoreSize)return -1;bf::State candidate{};bf::Stream v{c->saved,0,true};bf::serialize(candidate,v);if(!v.ok||v.count!=c->restoreSize)return -2;c->s=candidate;c->savedSize=c->restoreSize;c->restoreSize=0;return 1;}
}
