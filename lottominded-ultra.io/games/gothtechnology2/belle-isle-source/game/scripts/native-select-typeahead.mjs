import assert from 'node:assert/strict';

// Closed native selects support label typeahead on both desktop macOS and
// phone emulation. Arrow keys instead open a platform popup on desktop macOS.
export function nativeTypeaheadPlan(options,currentValue,targetValue){
 assert(Array.isArray(options)&&options.length>1,'Missing native select options');
 const enabled=options.filter(option=>!option.disabled).map(option=>{
  assert(typeof option.value==='string'&&typeof option.label==='string','Invalid native option');
  return{value:option.value,label:option.label.trim().toLowerCase()};
 });
 assert.equal(new Set(enabled.map(option=>option.value)).size,enabled.length,'Ambiguous native option values');
 const target=enabled.find(option=>option.value===targetValue);
 assert(target,'Missing enabled native setting option '+targetValue);
 const choice=option=>{
  for(let length=1;length<=option.label.length;length++){
   const prefix=option.label.slice(0,length);
   // Space and navigation keys can open an OS popup. This helper deliberately
   // supports only unambiguous printable ASCII prefixes of the real labels.
   if(!/^[a-z0-9]+$/.test(prefix))break;
   if(enabled.filter(other=>other.label.startsWith(prefix)).length===1)return{value:option.value,prefix};
  }
  throw Error('No unique closed-select label prefix for '+option.value);
 };
 const result=[];
 if(currentValue===targetValue){
  const alternative=enabled.find(option=>option.value!==targetValue);
  assert(alternative,'A second enabled option is required to record a real change');
  result.push(choice(alternative));
 }
 result.push(choice(target));return result;
}

export async function selectNativeByLabel(page,expect,selector,value){
 const control=page.locator(selector);await control.scrollIntoViewIfNeeded();await expect(control).toBeEnabled();
 const initial=await control.evaluate(select=>({
  multiple:select.multiple,size:select.size,value:select.value,
  options:Array.from(select.options,option=>({value:option.value,label:option.label,
   disabled:option.disabled||!!option.closest('optgroup')?.disabled}))
 }));
 assert(!initial.multiple&&initial.size<=1,'Expected a closed single-choice native select');
 const plan=nativeTypeaheadPlan(initial.options,initial.value,value);
 const startedAt=await page.evaluate(()=>performance.now());
 for(const step of plan){
  // A native blur resets Chromium's typeahead session. This also ensures the
  // alternate and final choices cannot accidentally form one accumulated word.
  await control.press('Tab');await expect(control).not.toBeFocused();
  await control.pressSequentially(step.prefix);
  await expect(control).toBeFocused();await expect(control).toHaveValue(step.value);
 }
 await expect(control).toHaveValue(value);
 return{selector,value,initialValue:initial.value,plan,startedAt,finishedAt:await page.evaluate(()=>performance.now())};
}
