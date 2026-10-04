// Operator console. Never expose this file or the SQLite database as public assets.
import {AuctionEngine} from './engine.mjs';
import {resolve} from 'node:path';
const [command,id,input]=process.argv.slice(2),path=resolve(process.env.AUCTION_DATABASE??resolve(import.meta.dirname,'data/auctions.sqlite'));
const engine=new AuctionEngine(path,{allowLive:process.env.AUCTION_LIVE_ENABLED==='true'});
try{
 if(command==='catalog')console.log(JSON.stringify(engine.catalog(),null,2));
 else if(command==='inventory'){const value=JSON.parse(input??'{}');engine.verifyProduct(id,value);console.log('Inventory verified for '+id);}
 else if(command==='publish'){console.log(engine.publish(id,JSON.parse(input??'{}')));}
 else if(command==='ship'){engine.shipOrder(id,input);console.log('Paid order marked shipped.');}
 else if(command==='launch-approval'){
  const value=JSON.parse(input??'{}');if(value.confirmation!=='APPROVED INVENTORY, PROCESSOR AND POLICY'||typeof value.processor!=='string'||value.processor.length<3||/stripe/i.test(value.processor))throw Error('Name the accepted processor and confirm the operating requirements. Stripe cannot process bidding-fee auctions.');
  engine.db.prepare('UPDATE settings SET processor_approved=1,fulfillment_ready=1,policy_ready=1,processor_name=? WHERE id=1').run(value.processor);console.log('Operator launch approval stored; AUCTION_LIVE_ENABLED is still required.');
 }else throw Error('Commands: catalog; inventory <product> <JSON stock,retailCents,shippingCents>; publish <product> <JSON model,feeCents>; ship <order> <tracking>; launch-approval <unused> <approval JSON>.');
}finally{engine.close();}
