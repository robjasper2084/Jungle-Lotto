import test from 'node:test';
import assert from 'node:assert/strict';
import {DISCOUNT_PREVIEW_KEY,DISCOUNT_TIERS,discountProgress,discountEstimate,readDiscountPreview,recordGameProgress,LEGACY_DISCOUNT_KEY,fighterReceipt} from '../../store/public/arcade/rewards.js';
import {demoProducts} from '../../store/content/catalog.ts';

const memory=()=>{const values=new Map<string,string>();return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};};

test('discount targets use the revised accessible milestones and stop at 20 percent',()=>{
  assert.deepEqual(DISCOUNT_TIERS.map(tier=>tier.points),[10000,25000,50000,100000]);
  assert.equal(discountProgress(0).percent,0);
  for(let index=0;index<DISCOUNT_TIERS.length;index++){
    const tier=DISCOUNT_TIERS[index];
    assert.equal(discountProgress(tier.points-1).percent,index?DISCOUNT_TIERS[index-1].percent:0);
    assert.equal(discountProgress(tier.points).percent,tier.percent);
  }
  assert.equal(discountProgress(9999999).percent,20);
  assert.equal(discountProgress(500000).next,null);
  assert.equal(discountProgress(99000).remaining,1000);
  for(const invalid of [-1,NaN,Infinity,'500000',500000.5,null])assert.equal(discountProgress(invalid).percent,0);
});

const run=(runId:string,score:number)=>({runId,score,seconds:60,mode:'playing'});
test('all games and new runs add points, while polling and resumed checkpoints count once',()=>{
 const storage=memory();
 recordGameProgress('underground',run('first',4000),storage);
 recordGameProgress('underground',run('first',4000),storage);
 recordGameProgress('underground',run('first',3000),storage);
 recordGameProgress('underground',run('first',5000),storage);
 recordGameProgress('underground',run('second',1000),storage);
 recordGameProgress('static-wars',run('first',1000),storage);
 recordGameProgress('vault-rush',run('first',500),storage);
 recordGameProgress('gothtechnology',run('first',2500),storage);
 const state=readDiscountPreview(storage);assert.equal(state.totalPoints,10000);assert.equal(state.percent,5);assert.equal(state.games.underground.points,6000);assert.equal(state.games.underground.runs,2);
 recordGameProgress('vault-rush',run('first',1500),storage);assert.equal(readDiscountPreview(storage).totalPoints,11000);
 recordGameProgress('static-wave',run('first',200),storage);
 recordGameProgress('static-wave',run('first',200),storage);
 assert.equal(readDiscountPreview(storage).totalPoints,11200);
});
test('legacy best reward carries forward and its current checkpoint is not counted again',()=>{
 const storage=memory();storage.setItem(LEGACY_DISCOUNT_KEY,JSON.stringify({version:1,bestScore:25000}));storage.setItem('rahbe-underground-v1-arcade-run',JSON.stringify({runId:'saved',score:10000}));
 assert.equal(readDiscountPreview(storage).totalPoints,25000);
 storage.setItem('rahbe-underground-v1-arcade-run',JSON.stringify({runId:'saved',score:11000}));
 recordGameProgress('underground',run('saved',10000),storage);assert.equal(readDiscountPreview(storage).totalPoints,25000);
 recordGameProgress('underground',run('saved',11000),storage);assert.equal(readDiscountPreview(storage).totalPoints,26000);
 recordGameProgress('underground',run('new',1000),storage);assert.equal(readDiscountPreview(storage).totalPoints,27000);
});
test('invalid, idle, training and replay receipts cannot advance the reward',()=>{
 const storage=memory();
 for(const game of ['unknown','__proto__'])recordGameProgress(game,run('first',100000),storage);
 for(const patch of [{runId:'__proto__'},{score:'100000'},{score:NaN},{score:-1},{seconds:-1},{seconds:0,score:0},{mode:'title'},{debug:true},{training:true},{replay:true}])recordGameProgress('underground',{...run('first',100000),...patch},storage);
 assert.equal(readDiscountPreview(storage).totalPoints,0);
 storage.setItem(DISCOUNT_PREVIEW_KEY,JSON.stringify({version:2,totalPoints:100000,percent:20,runs:{}}));assert.equal(readDiscountPreview(storage).percent,0);
 storage.setItem(DISCOUNT_PREVIEW_KEY,'broken');assert.doesNotThrow(()=>readDiscountPreview(storage));
});
test('a short run keeps real points even before its elapsed-seconds counter reaches one',()=>{
 const storage=memory();recordGameProgress('vault-rush',{...run('quick-run',50),seconds:0},storage);assert.equal(readDiscountPreview(storage).totalPoints,50);
});
test('fighter points require a completed active match and never count training, replays or idle time',()=>{
 const player={},game={phase:'matchEnd',rewardTotalTicks:1800,rewardMatchActions:2,rewardMeaningfulActions:0,rewardMatchKey:'match-one',matchWinner:player,fighters:[player]};
 assert.equal(fighterReceipt(game)?.score,5000);assert.equal(fighterReceipt({...game,matchWinner:{}})?.score,2500);
 for(const patch of [{phase:'fight'},{rewardTotalTicks:1799},{rewardMatchActions:0},{rewardMatchActions:undefined},{training:true},{isReplay:true},{debug:true}])assert.equal(fighterReceipt({...game,...patch}),null);
});
test('blocked storage retains cumulative session points and does not claim persistence',()=>{
 const blocked={getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}};
 const before=readDiscountPreview(blocked).totalPoints;
 const first=recordGameProgress('underground',run('blocked-one',5000),blocked);
 const second=recordGameProgress('vault-rush',run('blocked-two',5000),blocked);
 assert.equal(second.totalPoints,before+10000);assert.equal(first.saved,false);assert.equal(second.saved,false);
 assert.equal(recordGameProgress('underground',run('blocked-one',5000),blocked).totalPoints,second.totalPoints);
});

test('a full storage quota keeps new points visible in the current session',()=>{
 const storage={getItem:()=>null,setItem:()=>{throw Error('quota');}};
 recordGameProgress('vault-rush',run('quota-run',4000),storage);
 assert.equal(readDiscountPreview(storage).totalPoints,4000);assert.equal(readDiscountPreview(storage).saved,false);
 recordGameProgress('vault-rush',run('quota-run',4500),storage);assert.equal(readDiscountPreview(storage).totalPoints,4500);
});
test('loadout estimate rounds in minor currency units and never discounts more than 20 percent',()=>{
  assert.deepEqual(discountEstimate(500000,8900),{percent:20,saving:1780,total:7120});
  assert.deepEqual(discountEstimate(10000,1999),{percent:5,saving:100,total:1899});
  assert.deepEqual(discountEstimate(9999,8900),{percent:0,saving:0,total:8900});
  assert.deepEqual(discountEstimate(999999999,0),{percent:20,saving:0,total:0});
});

test('all fourteen priced products and variants are raised 20 percent while five prices stay pending',()=>{
  const original:Record<string,number>={
    'night-protocol-hoodie':8900,'detroit-2084-shirt':3600,'black-signal-beanie':1900,'detroit-skull-cap-alt':2200,
    'gothtechnology-luggage-charm':1999,'static-saints-patch-set':2000,'cyber-cathedral-art-print':2800,
    'mobster-luggage-charm':1999,'key-knife-keychain':1199,'black-signal-digital-pack':1200,
    'mobster-charm-key-knife-bundle':2999,'key-knife-gun-attachment-bundle':3900,'founder-loadout-bundle':12900,'detroit-skyline-cap':3200,
  };
  assert.equal(demoProducts.filter(product=>product.price.amount>0).length,14);
  assert.equal(demoProducts.filter(product=>product.price.amount===0).length,5);
  for(const product of demoProducts){
    const expected=original[product.handle]===undefined?0:Math.round(original[product.handle]*1.2);
    assert.equal(product.price.amount,expected,product.handle);
    assert.ok(product.variants.every(variant=>variant.price.amount===expected),product.handle+' variants');
    assert.equal(product.compareAtPrice,null,'No fabricated historical sale price');
  }
  assert.deepEqual(discountEstimate(100000,demoProducts[0].price.amount),{percent:20,saving:2136,total:8544});
});
