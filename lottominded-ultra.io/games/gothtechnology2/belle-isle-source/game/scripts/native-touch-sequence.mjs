/** Track only this smoke's native CDP contacts; never dispatch synthetic DOM input.
 * Do not cancel an already-ended sequence. Failed/uncertain sends remain fatal,
 * and cleanup still attempts cancellation when the transport may own contacts.
 */
export function createNativeTouchSequence(send) {
  const active = new Set();
  let pending, uncertain = false, closing = false, cleanup;
  const snapshot = () => ({activeIds: [...active].sort((a,b)=>a-b), uncertain});
  async function dispatch(type, points) {
    if (closing) throw new Error('Touch sequence is closing');
    if (pending) throw new Error('Touch commands must be awaited in order');
    if (!['touchStart','touchMove','touchEnd','touchCancel'].includes(type)) throw new Error('Unknown native touch command');
    const ids = new Set();
    for (const point of points) {
      if (!Number.isSafeInteger(point.id) || point.id < 0 || !Number.isFinite(point.x) || !Number.isFinite(point.y) || ids.has(point.id)) throw new Error('Invalid native touch point');
      ids.add(point.id);
    }
    if ((type === 'touchStart' || type === 'touchMove') && ids.size === 0) throw new Error('Native touch start/move needs contacts');
    if (type === 'touchMove' && (ids.size !== active.size || [...ids].some(id=>!active.has(id)))) throw new Error('Move must retain the active contacts');
    if (type === 'touchStart' && [...active].some(id=>!ids.has(id))) throw new Error('Start cannot discard an existing contact');
    if (type === 'touchEnd' && [...ids].some(id=>!active.has(id))) throw new Error('Cannot end an inactive contact');
    if (type === 'touchCancel' && ids.size) throw new Error('Cancel must not include contacts');
    if ((type === 'touchEnd' || type === 'touchCancel') && !active.size && !uncertain) throw new Error('No active touch sequence');
    // Clone before asynchronous dispatch; callers can safely reuse their points map.
    const payload = {type,touchPoints:points.map(p=>({...p}))};
    uncertain = true;
    pending = Promise.resolve().then(()=>send('Input.dispatchTouchEvent',payload));
    try {
      await pending;
      if (type === 'touchStart' || type === 'touchMove') {active.clear();for(const id of ids)active.add(id);}
      else if (type === 'touchCancel' || ids.size === 0) active.clear();
      else for (const id of ids) active.delete(id);
      uncertain = false;
    } finally {pending=undefined;}
  }
  function cancelActive() {
    if (cleanup) return cleanup;
    closing = true;
    cleanup = (async()=>{
      // Drain a command already issued before closing. Its failure is NOT hidden.
      let priorError;
      if (pending) try {await pending;} catch(error) {priorError=error;}
      const before=snapshot();
      if (!active.size && !uncertain) return {attempted:false,reason:'No active native contacts',before,after:snapshot()};
      await send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
      active.clear();uncertain=false;
      if (priorError) throw priorError;
      return {attempted:true,reason:'Cancelled active or uncertain contacts',before,after:snapshot()};
    })();
    return cleanup;
  }
  return {dispatch,cancelActive,snapshot};
}
