/** Opt-in, source-pinned Three 0.185.1 transform. No installed dependency is
 * modified. The standard setter and all other uniform paths stay untouched. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {dirname} from 'node:path';

export const THREE_SHADOW_UNIFORM_PINS=Object.freeze({
 threeVersion:'0.185.1',
 'build/three.module.js':'bbf5ed13fe4373f5bd38b14ea8e62e9f157327da5638edc6d3863e08b167c9c7',
 'src/renderers/webgl/WebGLUniforms.js':'a1910ebdedfb7903b8d6155515ffb414add03108c222de95868eee790bef2317',
});
export const THREE_SHADOW_UNIFORM_MARKER='belle-directional-shadow-array-owned-v1';
const hash=value=>createHash('sha256').update(value).digest('hex');

// This exact body is identical in proof and production transformations. Mode
// switching changes live node.setValue outside a draw, never a global hot flag.
const CANDIDATE_SETTER=String.raw`function belleDirectionalShadowMatrixArray( gl, v ) {

	const counts = context.counts;
	counts.setterCalls ++;
	const serial = ++ record.serial;
	const invocation = ++ context.invocations;
	const epoch = context.epoch;
	if ( this !== node || gl !== context.gl || ! record.active || context.lost ) {

		record.valid = false;
		counts.fallbackCalls ++;
		return belleShadowCall( setValueM4Array, this, gl, v );

	}
	try {

		// Preserve the original conversion, including its exceptions and effects.
		const size = this.size;
		const data = flatten( v, size, 16 );
		// JS resolves this method before evaluating the address argument. Never
		// look it up again after an accessor or reentrant call can replace it.
		const method = gl.uniformMatrix4fv;
		const address = this.addr;
		let eligible = record.active && ! context.lost && context.epoch === epoch && record.serial === serial && context.invocations === invocation &&
			size === record.size && address === record.address && belleShadowNativeMethod( gl, method ) &&
			data === arrayCacheF32[ record.length ] && belleShadowPrototype( data ) === belleShadowFloatPrototype &&
			belleShadowLength( data ) === record.length;
		let equal = eligible && record.valid && record.method === method && record.epoch === epoch;
		if ( equal ) {

			for ( let i = 0; i < record.length; i ++ ) {

				if ( ! belleShadowSame( record.values[ i ], data[ i ] ) ) { equal = false; break; }

			}

		}
		// A valid snapshot contains only finite values. Exact equality proves
		// current values finite too, without another sixteen finite checks.
		if ( equal ) { counts.skippedCalls ++; return; }
		if ( eligible ) for ( let i = 0; i < record.length; i ++ ) if ( ! belleShadowFinite( data[ i ] ) ) { eligible = false; break; }
		record.valid = false;
		let snapshot = null;
		if ( eligible ) {

			snapshot = record.values || ( record.values = new Float32Array( record.length ) );
			for ( let i = 0; i < record.length; i ++ ) snapshot[ i ] = data[ i ];

		} else { counts.fallbackCalls ++; }
		// Noncallable lookup still evaluates this.addr above before throwing,
		// exactly as the original call expression does. It is not a native call.
		if ( typeof method !== 'function' ) { belleShadowCall( method, gl, address, false, data ); return; }
		counts.nativeCalls ++;
		try { belleShadowCall( method, gl, address, false, data ); counts.nativeSuccesses ++; }
		catch ( error ) { counts.nativeErrors ++; throw error; }
		if ( snapshot && record.active && ! context.lost && context.epoch === epoch && record.serial === serial && context.invocations === invocation ) {

			let unchanged = true;
			for ( let i = 0; i < record.length; i ++ ) if ( ! belleShadowSame( snapshot[ i ], data[ i ] ) ) { unchanged = false; break; }
			if ( unchanged ) { record.method = method; record.epoch = epoch; record.valid = true; }

		}
		// A nested invocation may have installed its own cache entry. The outer
		// native call can run after it, so any interrupted transaction invalidates.
		if ( record.serial !== serial || context.invocations !== invocation || context.epoch !== epoch || ! record.active || context.lost ) record.valid = false;

	} catch ( error ) {

		record.valid = false;
		record.serial ++;
		throw error;

	}

}`;

const RUNTIME=String.raw`
// belle-directional-shadow-array-owned-v1
const belleShadowContexts = new WeakMap();
const belleShadowContextRefs = new Set();
const belleShadowCall = Function.prototype.call.bind( Function.prototype.call );
const belleShadowFloatPrototype = Float32Array.prototype;
const belleShadowPrototype = Object.getPrototypeOf;
const belleShadowDescriptor = Object.getOwnPropertyDescriptor;
const belleShadowFinite = Number.isFinite;
const belleShadowSame = Object.is;
const belleShadowLength = Function.prototype.call.bind( Object.getOwnPropertyDescriptor( Object.getPrototypeOf( Float32Array.prototype ), 'length' ).get );
// Capture the platform method before any optional renderer observer is installed.
// Wrappers can reenter unrelated stock setters and mutate flatten's shared scratch;
// even a stable wrapper identity must therefore never establish a cache entry.
const belleShadowNative = ( () => {

	try {

		const prototype = typeof WebGL2RenderingContext === 'function' ? WebGL2RenderingContext.prototype : null;
		const own = prototype && belleShadowDescriptor( prototype, 'uniformMatrix4fv' );
		return own && 'value' in own && typeof own.value === 'function' ? { prototype, method: own.value } : null;

	} catch { return null; }

} )();
let belleShadowMode = __BELLE_INITIAL_MODE__;
let belleShadowGeneration = 0;

function belleShadowNativeMethod( gl, method ) {

	if ( ! belleShadowNative || method !== belleShadowNative.method ) return false;
	try {

		if ( belleShadowPrototype( gl ) !== belleShadowNative.prototype ) return false;
		const own = belleShadowDescriptor( gl, 'uniformMatrix4fv' );
		if ( own && ( ! ( 'value' in own ) || own.value !== method ) ) return false;
		const inherited = belleShadowDescriptor( belleShadowNative.prototype, 'uniformMatrix4fv' );
		return !! inherited && 'value' in inherited && inherited.value === method;

	} catch { return false; }

}

function belleShadowCounters() {

	return { setterCalls: 0, nativeCalls: 0, nativeSuccesses: 0, nativeErrors: 0, skippedCalls: 0, fallbackCalls: 0 };

}

function belleShadowInvalidate( context ) {

	context.epoch ++;
	context.counts = belleShadowCounters();
	for ( const ref of context.nodes ) {

		const record = ref.deref();
		if ( record ) { record.valid = false; record.serial ++; }
		else context.nodes.delete( ref );

	}

}

function belleShadowContext( gl ) {

	let context = belleShadowContexts.get( gl );
	if ( context ) return context;
	const canvas = gl.canvas;
	if ( ! canvas || typeof canvas.addEventListener !== 'function' || typeof canvas.removeEventListener !== 'function' ) return null;
	context = { gl, nodes: new Set(), epoch: 0, invocations: 0, lost: false, contextResets: 0, ownershipFailures: 0, counts: belleShadowCounters() };
	const lost = () => { context.lost = true; context.contextResets ++; belleShadowInvalidate( context ); };
	const restored = () => { context.lost = false; context.contextResets ++; belleShadowInvalidate( context ); };
	try {

		canvas.addEventListener( 'webglcontextlost', lost );
		canvas.addEventListener( 'webglcontextrestored', restored );

	} catch ( error ) {

		try { canvas.removeEventListener( 'webglcontextlost', lost ); canvas.removeEventListener( 'webglcontextrestored', restored ); } catch {}
		return null;

	}
	belleShadowContexts.set( gl, context );
	belleShadowContextRefs.add( new WeakRef( context ) );
	return context;

}

function belleShadowSelect( record, mode ) {

	record.valid = false;
	record.serial ++;
	const own = Object.getOwnPropertyDescriptor( record.node, 'setValue' );
	if ( ! own || ! ( 'value' in own ) || ( own.value !== setValueM4Array && own.value !== record.setter ) || ! own.writable ) {

		record.active = false;
		record.context.ownershipFailures ++;
		return;

	}
	record.active = mode === 'inline';
	Object.defineProperty( record.node, 'setValue', { ...own, value: record.active ? record.setter : setValueM4Array } );

}

function belleRegisterDirectionalShadowArray( node, gl ) {

	try {

		const context = belleShadowContext( gl );
		if ( ! context ) return;
		const record = { node, context, size: node.size, length: node.size * 16, address: node.addr, active: false,
			valid: false, values: null, method: null, epoch: -1, serial: 0, setter: null };
		const setter = __BELLE_CANDIDATE_SETTER__;
		record.setter = setter;
		context.nodes.add( new WeakRef( record ) );
		// The original node retains this private record through its selected
		// closure. In original proof mode the weak registration needs an owner.
		Object.defineProperty( node, belleShadowRecord, { value: record } );
		belleShadowSelect( record, belleShadowMode );

	} catch ( error ) {

		// Reflection still succeeds if this optional candidate cannot acquire
		// its ordinary node/context lifecycle. Original setter remains usable.

	}

}

const belleShadowRecord = Symbol( 'belle directional shadow array' );

const belleUniformArrayControl = Object.freeze( {
	setMode( mode ) {

		if ( mode !== 'original' && mode !== 'inline' ) throw new TypeError( 'Expected original or inline uniform mode' );
		belleShadowMode = mode;
		belleShadowGeneration ++;
		for ( const ref of belleShadowContextRefs ) {

			const context = ref.deref();
			if ( ! context ) { belleShadowContextRefs.delete( ref ); continue; }
			belleShadowInvalidate( context );
			for ( const nodeRef of context.nodes ) { const record = nodeRef.deref(); if ( record ) belleShadowSelect( record, mode ); }

		}

	},
	reset() {

		belleShadowGeneration ++;
		for ( const ref of belleShadowContextRefs ) { const context = ref.deref(); if ( context ) belleShadowInvalidate( context ); else belleShadowContextRefs.delete( ref ); }

	},
	read() {

		const result = { version: 1, mode: belleShadowMode, generation: belleShadowGeneration, contexts: 0,
			registeredUniforms: 0, activeUniforms: 0, ...belleShadowCounters(), contextResets: 0, ownershipFailures: 0 };
		for ( const ref of belleShadowContextRefs ) {

			const context = ref.deref();
			if ( ! context ) { belleShadowContextRefs.delete( ref ); continue; }
			result.contexts ++;
			result.contextResets += context.contextResets;
			result.ownershipFailures += context.ownershipFailures;
			for ( const name of Object.keys( context.counts ) ) result[ name ] += context.counts[ name ];
			for ( const nodeRef of context.nodes ) {

				const record = nodeRef.deref();
				if ( ! record ) { context.nodes.delete( nodeRef ); continue; }
				result.registeredUniforms ++;
				if ( record.active && Object.getOwnPropertyDescriptor( record.node, 'setValue' )?.value === record.setter ) result.activeUniforms ++;

			}

		}
		return result;

	}
} );
`;

const ORIGINAL_CLASS=String.raw`class PureArrayUniform {

	constructor( id, activeInfo, addr ) {

		this.id = id;
		this.addr = addr;
		this.cache = [];
		this.type = activeInfo.type;
		this.size = activeInfo.size;
		this.setValue = getPureArraySetter( activeInfo.type );

		// this.path = activeInfo.name; // DEBUG

	}

}`;
const CANDIDATE_CLASS=ORIGINAL_CLASS.replace('constructor( id, activeInfo, addr )','constructor( id, activeInfo, addr, belleContext )').replace(
 '\t\t// this.path = activeInfo.name; // DEBUG',
 `\t\tif ( belleContext !== undefined && id === 'directionalShadowMatrix' && this.type === 0x8b5c &&
\t\t\tthis.setValue === setValueM4Array && Number.isInteger( this.size ) && this.size >= 1 && this.size <= 16 &&
\t\t\taddr !== null && ( typeof addr === 'object' || typeof addr === 'function' ) ) belleRegisterDirectionalShadowArray( this, belleContext );

\t\t// this.path = activeInfo.name; // DEBUG`);

function moduleName(id){
 const path=id.replaceAll('\\','/').split('?')[0];
 return Object.keys(THREE_SHADOW_UNIFORM_PINS).filter(name=>name!=='threeVersion').find(name=>path.endsWith('/three/'+name)||path==='three/'+name)||null;
}

/** Only these two exact reviewed distribution/source inputs can be transformed.
 * `proof` exposes controls; it does not change the dedicated setter body. */
export function transformThreeShadowUniform(source,id,{enabled=false,proof=false}={}){
 if(!enabled)return null;
 const module=moduleName(id);if(!module)return null;
 const inputSha256=hash(source);assert.equal(inputSha256,THREE_SHADOW_UNIFORM_PINS[module],'Unreviewed Three shadow-uniform source: '+module);
 const replacements={};let code=source;
 const replace=(name,from,to)=>{assert.equal(code.split(from).length,2,'Three transform anchor must occur once: '+name);code=code.replace(from,to);replacements[name]=1;};
 const runtime=RUNTIME.replace('__BELLE_INITIAL_MODE__',JSON.stringify(proof?'original':'inline')).replace('__BELLE_CANDIDATE_SETTER__',CANDIDATE_SETTER);
 replace('runtime','// --- Uniform Classes ---',runtime+'\n// --- Uniform Classes ---');
 replace('pureArrayConstructor',ORIGINAL_CLASS,CANDIDATE_CLASS);
 replace('parserContext','function parseUniform( activeInfo, addr, container ) {','function parseUniform( activeInfo, addr, container, belleContext ) {');
 replace('exactShadowArray','new PureArrayUniform( id, activeInfo, addr )','new PureArrayUniform( id, activeInfo, addr, path === \'directionalShadowMatrix[0]\' ? belleContext : undefined )');
 replace('reflectedContext','parseUniform( info, addr, this );','parseUniform( info, addr, this, gl );');
 if(proof){code+='\nexport { belleUniformArrayControl as __belleUniformArrayProofControl };\n';replacements.proofExport=1;}
 return {code,receipt:{threeVersion:THREE_SHADOW_UNIFORM_PINS.threeVersion,module,inputSha256,outputSha256:hash(code),proof,
  marker:THREE_SHADOW_UNIFORM_MARKER,candidateSetterSha256:hash(CANDIDATE_SETTER),replacements}};
}

/** Not installed by vite.config.ts. Explicit opt-in prevents silent activation. */
export function threeShadowUniformVitePlugin({enabled=false,proof=false,onReceipt=()=>{}}={}){
 return {name:'belle-pinned-directional-shadow-uniform',enforce:'pre',
  config(){if(enabled)return {optimizeDeps:{exclude:['three']}};},
  transform(source,id){const value=transformThreeShadowUniform(source,id,{enabled,proof});if(!value)return null;onReceipt(value.receipt);return {code:value.code,map:null};}};
}

/** Uses the same exact transformation as Vite, including source identity checks. */
export function threeShadowUniformEsbuildPlugin({enabled=false,proof=false,onReceipt=()=>{}}={}){
 return {name:'belle-pinned-directional-shadow-uniform',setup(builder){
  if(!enabled)return;
  builder.onLoad({filter:/[\\/]three[\\/](?:build[\\/]three\.module\.js|src[\\/]renderers[\\/]webgl[\\/]WebGLUniforms\.js)$/},async args=>{
   const source=await readFile(args.path,'utf8'),value=transformThreeShadowUniform(source,args.path,{enabled,proof});assert(value,'Expected pinned Three input');onReceipt(value.receipt);return {contents:value.code,loader:'js',resolveDir:dirname(args.path)};
  });
 }};
}
