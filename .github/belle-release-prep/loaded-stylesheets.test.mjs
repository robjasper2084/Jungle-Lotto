import test from 'node:test';
import assert from 'node:assert/strict';
import {readLoadedStyles} from './loaded-stylesheets.mjs';
const sheet=(css,href='inline',media='all')=>({href,media:{mediaText:media},cssRules:[{type:1,cssText:css}]});
const ui=()=>sheet('#trial-hud {width:100px} #hover-hud {position:fixed}', '/assets/main.css');
test('lazy HUD stylesheet is required rather than silently accepting entry-only styles',()=>{
 const doc={styleSheets:[sheet('body{margin:0}', '/assets/entry.css')]};
 assert.throws(()=>readLoadedStyles(doc),/incomplete/);doc.styleSheets.push(ui());
 const result=readLoadedStyles(doc);assert.equal(result.sheetCount,2);
 assert.deepEqual(result.sources,['/assets/entry.css','/assets/main.css']);
 assert.ok(result.css.indexOf('body')<result.css.indexOf('#trial-hud'));
});
test('responsive media remains conditional instead of being flattened at capture size',()=>{
 const result=readLoadedStyles({styleSheets:[ui(),sheet('#trial-hud{width:80px}',null,'(max-width: 400px)')]});
 assert.match(result.css,/@media \(max-width: 400px\)/);assert.ok(result.css.endsWith('\n}'));
});
test('imports and adopted styles preserve their place in the cascade',()=>{
 const imported=ui(),parent={href:'/assets/index.css',cssRules:[{type:3,styleSheet:imported},{type:1,cssText:'#trial-hud{color:white}'}]};
 const result=readLoadedStyles({styleSheets:[parent],adoptedStyleSheets:[sheet('#hover-hud{color:red}')]});
 assert.equal(result.sheetCount,3);assert.ok(result.css.indexOf('width:100px')<result.css.indexOf('color:white'));
 assert.ok(result.css.indexOf('color:white')<result.css.indexOf('color:red'));
});
test('disabled stylesheet never enters the fixture',()=>{
 const result=readLoadedStyles({styleSheets:[ui(),{...sheet('DO_NOT_COPY'),disabled:true}]});
 assert.doesNotMatch(result.css,/DO_NOT_COPY/);assert.equal(result.sheetCount,1);
});
test('unreadable and cyclic CSS fail closed',()=>{
 const inaccessible={get cssRules(){throw Error('SecurityError');}};
 assert.throws(()=>readLoadedStyles({styleSheets:[ui(),inaccessible]}),/SecurityError/);
 const cyclic={cssRules:[]};cyclic.cssRules.push({type:3,styleSheet:cyclic});
 assert.throws(()=>readLoadedStyles({styleSheets:[ui(),cyclic]}),/Cyclic/);
});
