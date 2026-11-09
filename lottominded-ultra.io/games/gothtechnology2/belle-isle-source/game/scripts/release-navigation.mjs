/** Reveal the actual course using the native disclosure control, never DOM mutation. */
export async function revealPracticeCourse(page,expect,selector){
 const course=page.locator(selector),disclosure=page.locator('#trial-practice');
 await expect(course).toHaveCount(1);
 await expect(disclosure).toBeVisible();
 if(!await disclosure.evaluate(element=>element.open))await page.locator('#trial-practice > summary').tap();
 await expect(disclosure).toHaveJSProperty('open',true);
 await expect(course).toBeVisible();
 await expect(course).toBeEnabled();
}

/** Queue browser-native input without an intervening page/GPU response round trip.
 * This does not set game state, clocks, viewport, or event trust. */
export function queueNativeCountdownTouch(client,enter,point){
 if(!Number.isFinite(point?.x)||!Number.isFinite(point?.y)||point.x<0||point.y<0)throw Error('Invalid native touch point');
 return Promise.all([
  client.send('Input.dispatchKeyEvent',{type:'keyDown',...enter,text:'\r',unmodifiedText:'\r',autoRepeat:false}),
  client.send('Input.dispatchKeyEvent',{type:'keyUp',...enter}),
  client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:point.x,y:point.y,radiusX:4,radiusY:4,force:1}]})
 ]);
}
/** Serialized into the page solely to READ the existing input recorder. A command
 * acknowledgement is not evidence of delivery. Target/timing remain the strict
 * classifier's responsibility, so observing a wrong/late event cannot pass it. */
export function receivedNativeTouch(start){
 return window.__releaseInput.slice(start).some(event=>event.type==='pointerdown'&&event.trusted===true&&event.pointerType==='touch');
}

/** Wait for the real prepared countdown before issuing a fresh native touch.
 * The readiness callback only observes the actual HUD and reads its geometry.
 * No injected event, timer, game state, or deadline change is permitted here. */
export async function nativeCountdownTouchAfterReady(client,enter,readyPoint){
 if(typeof readyPoint!=='function')throw Error('A real countdown observation is required');
 await Promise.all([
  client.send('Input.dispatchKeyEvent',{type:'keyDown',...enter,text:'\r',unmodifiedText:'\r',autoRepeat:false}),
  client.send('Input.dispatchKeyEvent',{type:'keyUp',...enter})
 ]);
 const point=await readyPoint();
 if(!Number.isFinite(point?.x)||!Number.isFinite(point?.y)||point.x<0||point.y<0)throw Error('Invalid native touch point');
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:point.x,y:point.y,radiusX:4,radiusY:4,force:1}]});
 return point;
}
