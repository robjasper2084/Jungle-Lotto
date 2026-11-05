#include "runtime.cpp"
#include <cstdio>
#define REQUIRE(x) do { if(!(x)){std::fprintf(stderr,"FAIL line %d: %s\n",__LINE__,#x);return 1;} }while(0)
int main(){
 int a=bf_create(),b=bf_create();REQUIRE(a>0&&b>0&&a!=b);
 for(int slot=0;slot<6;slot++)for(int ch=0;ch<64;ch++){REQUIRE(bf_set(a,slot,ch,.5)==1);REQUIRE(bf_get(a,slot,ch)==.5);REQUIRE(bf_get(b,slot,ch)==0);}
 REQUIRE(bf_set(a,0,64,1)==-2);REQUIRE(bf_set(a,6,0,1)==-1);REQUIRE(bf_set(a,0,0,INFINITY)==-3);
 REQUIRE(bf_destroy(a)==1&&bf_get(a,0,0)==2);int reused=bf_create();REQUIRE(reused!=a&&bf_get(reused,0,0)==0);
 for(int i=0;i<6;i++){REQUIRE(bf_add(b,i)==1);REQUIRE(bf_add(b,i)==-1);}REQUIRE(bf_add(b,6)==-1);REQUIRE(bf_start(b,2)==1);
 for(int t=1;t<=241;t++){REQUIRE(bf_begin(b)==1);for(int i=0;i<6;i++)REQUIRE(bf_pose(b,i,i*5,0,0,0,0,1)==1);REQUIRE(bf_rules(b)==1);for(int i=0;i<256;i++)if(bf_projectile(b,i,0)==1)REQUIRE(bf_resolve(b,i,int(bf_projectile(b,i,1)),-2)==1);REQUIRE(bf_end(b)==1);}
 REQUIRE(bf_state(b,1)==2);
 REQUIRE(bf_set(b,0,8,1)==1&&bf_command(b,0,1,0)==1&&bf_begin(b)==1&&bf_rules(b)==1);
 int projectile=-1;for(int i=0;i<256;i++)if(bf_projectile(b,i,0)==1){projectile=i;break;}REQUIRE(projectile>=0);
 REQUIRE(bf_actor(b,0,6)==79&&bf_actor(b,0,19)==1);
 int token=int(bf_projectile(b,projectile,1));REQUIRE(bf_resolve(b,projectile,token,1)==1);REQUIRE(bf_resolve(b,projectile,token,1)==-2);REQUIRE(bf_end(b)==1);REQUIRE(bf_actor(b,1,1)==30&&bf_actor(b,1,0)==100);
 int size=bf_capture(b);REQUIRE(size>1000&&size<bf::Words);double snapshot[bf::Words];for(int i=0;i<size;i++)snapshot[i]=bf_saved(b,i);
 REQUIRE(bf_restore_begin(reused,size)==1);for(int i=0;i<size;i++)REQUIRE(bf_restore_value(reused,i,snapshot[i])==1);REQUIRE(bf_restore_commit(reused)==1);REQUIRE(bf_capture(reused)==size);
 for(int i=0;i<size;i++)REQUIRE(bf_saved(reused,i)==snapshot[i]);
 REQUIRE(bf_restore_begin(reused,size)==1);for(int i=0;i<size;i++)REQUIRE(bf_restore_value(reused,i,i==0?99:snapshot[i])==1);REQUIRE(bf_restore_commit(reused)==-2);REQUIRE(bf_actor(reused,1,1)==30);
 // Advance two restored complete rule states identically, including pending input.
 for(int t=0;t<300;t++)for(int id:{b,reused}){REQUIRE(bf_begin(id)==1&&bf_rules(id)==1);for(int i=0;i<256;i++)if(bf_projectile(id,i,0)==1)REQUIRE(bf_resolve(id,i,int(bf_projectile(id,i,1)),-2)==1);REQUIRE(bf_end(id)==1);}
 REQUIRE(bf_capture(b)==bf_capture(reused));for(int i=0;i<size;i++)REQUIRE(bf_saved(b,i)==bf_saved(reused,i));
 // All same-tick deaths are applied before outcome. Trusted native fixture only.
 auto& s=bf::get(b)->s;for(auto& actor:s.actors){actor.integrity=1;actor.shield=0;actor.lastDamage=s.tick;}REQUIRE(bf_begin(b)==1&&bf_rules(b)==1);for(int i=0;i<6;i++)bf::hit(s,i,1,(i+1)%6);REQUIRE(bf_end(b)==1&&bf_state(b,1)==3&&bf_state(b,2)==-1&&bf_state(b,3)==2);
 REQUIRE(bf_destroy(b)==1&&bf_destroy(reused)==1);
 // A collision batch cannot advance the same live projectile twice in one tick.
 int c=bf_create();auto& flight=bf::get(c)->s;flight.phase=2;flight.stage=2;flight.tick=10;
 flight.projectiles[0]={1,1,0,0,0,1,0,0,0,60};flight.salvos[0].active=1;
 REQUIRE(bf_resolve(c,0,1,-2)==1&&bf_projectile(c,0,7)==1);
 REQUIRE(bf_resolve(c,0,1,-2)==-2&&bf_projectile(c,0,7)==1);
 flight.tick++;REQUIRE(bf_resolve(c,0,1,-2)==1&&bf_projectile(c,0,7)==2);
 // Overflow fails closed and is observable; it never silently discards outcomes.
 for(int i=0;i<bf::Events+1;i++)bf::event(flight,1,0);
 REQUIRE(flight.error==20&&bf_end(c)==-1);REQUIRE(bf_destroy(c)==1);
 c=bf_create();auto& damage=bf::get(c)->s;for(int i=0;i<bf::Hits+1;i++)bf::hit(damage,0,1);
 REQUIRE(damage.error==21);REQUIRE(bf_destroy(c)==1);
 int handles[bf::Contexts];for(int i=0;i<bf::Contexts;i++){handles[i]=bf_create();REQUIRE(handles[i]>0);}
 REQUIRE(bf_create()==-1);for(int id:handles)REQUIRE(bf_destroy(id)==1);
 std::puts("PASS: native compiled inputs, context generations/isolation, roster, cadence/damage, stale hits, complete rule snapshot replay, invalid restore, simultaneous draw.");
}
