/** A fresh shuffled cycle, with no immediate repeat across cycles or stations. */
export class MusicShuffle {
 private bags=new Map<string,string[]>();
 constructor(private random:()=>number=Math.random){}
 next(key:string,ids:readonly string[],previous?:string){
  if(!ids.length)return undefined;
  let bag=this.bags.get(key)?.filter(id=>ids.includes(id))??[];
  if(!bag.length){
   bag=[...new Set(ids)];
   for(let i=bag.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
  }
  if(bag[bag.length-1]===previous&&bag.length>1){const other=bag.findIndex(id=>id!==previous);[bag[other],bag[bag.length-1]]=[bag[bag.length-1],bag[other]];}
  const next=bag.pop();this.bags.set(key,bag);return next;
 }
}
