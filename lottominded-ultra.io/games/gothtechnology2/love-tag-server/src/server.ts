import {BattleRoyaleRoom,royaleCodes} from './BattleRoyaleRoom.js';
import {createTagServer} from './loveTagService.js';
export {LoveTagRoom} from './loveTagService.js';
export const server=createTagServer(app=>{
  app.get('/v1/royale/:code',(req,res)=>{const code=String(req.params.code).toUpperCase();if(!/^[A-F0-9]{8}$/.test(code)){res.status(400).json({error:'INVALID_ROOM_CODE'});return;}const room=royaleCodes.get(code);if(!room||room.expires<Date.now()){res.status(404).json({error:'ROOM_EXPIRED'});return;}res.json({roomId:room.roomId,arena:'detroit-full-map'});});
});
server.define('static-royale',BattleRoyaleRoom);
if(process.env.TAG_TEST_IMPORT!=='1'){
 await server.listen(Number(process.env.PORT??8211),process.env.TAG_BIND_HOST??'0.0.0.0');console.log('LOVE TAG server ready on port '+(process.env.PORT??8211));
 for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{void server.gracefullyShutdown(false).then(()=>process.exit(0));});
}
