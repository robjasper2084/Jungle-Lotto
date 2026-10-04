import{ap as Dt,aq as Vr,ar as Nt,r as ln,C as Be,as as zr,at as Ze,au as ke,av as vt,aw as wi,ai as Ft,ax as Ja,ay as Di,az as It,aA as Qe,aB as qt,af as Jt,x as Ut,U as Et,ac as fn,V as we,aC as Wr,aD as An,z as hn,E as Ui,aE as Xr,M as yt,aF as _i,aG as Je,aH as qr,P as Tn,aI as Kr,aJ as Wn,i as gt,aK as Gt,aL as on,aM as dn,aN as Rn,aO as en,aP as jr,aQ as Yr,aR as un,aS as mt,aj as yn,aT as Jr,aU as rn,aV as Ni,aW as Zr,aX as Qr,aY as gn,aZ as $r,a_ as eo,a$ as to,b0 as no,b1 as io,b2 as ao,b3 as ro,b4 as oo,b5 as so,b6 as co,b7 as lo,b8 as fo,b9 as uo,ba as po,bb as ho,bc as Za,a5 as On,bd as Un,be as xn,bf as Qa,bg as Bt,bh as mo,bi as go,bj as bi,bk as _o,bl as vi,bm as bo,bn as vo,bo as xo,bp as Fe,j as Eo,a9 as So,bq as To,N as Ht,a4 as Yt,e as Nn,ae as Mo,br as kt,bs as En,bt as Kt,bu as Ao,bv as $a,bw as er,bx as tr,by as Gn,bz as nr,bA as ir,bB as ar,a as rr,bC as Ro,bD as Co,bE as Po,bF as Lo,bG as or,bH as wo,bI as Do,bJ as Uo,bK as Xn,bL as qn,bM as Kn,bN as jn,bO as Ii,bP as Fi,bQ as yi,bR as Oi,bS as Gi,bT as Bi,bU as ki,bV as Hi,bW as Vi,bX as ci,bY as zi,bZ as Wi,b_ as Xi,b$ as qi,c0 as Ki,c1 as ji,c2 as Yi,c3 as Ji,c4 as Zi,c5 as Qi,c6 as $i,c7 as ea,c8 as ta,c9 as na,ca as ia,cb as aa,cc as ra,cd as oa,ce as sa,cf as ca,cg as li,ch as la,ci as No,cj as Io,ck as Fo,cl as yo,cm as Oo,cn as Go,co as Bo,cp as ko,cq as fa,cr as Ho,cs as In,ct as Vo,cu as da,cv as ua,am as pa,cw as sr,cx as zo,cy as Bn,cz as ha,cA as Wo,cB as cr,B as xi,cC as fi,cD as lr,ag as Xo,cE as fr,cF as dr,cG as ur,A as pr,cH as hr,cI as mr,cJ as gr,cK as ma,cL as _r,cM as Yn,cN as Jn,cO as qo,cP as Ko,cQ as ga,cR as bt,cS as jo,cT as Mt,cU as Cn,cV as pn,d as sn,cW as Yo,cX as Jo,cY as Zo,cZ as Qo,c_ as $o,c$ as di,d0 as es,d1 as ts,d2 as ns,d3 as is,d4 as ui,d5 as br,d6 as as,d7 as Mn,d8 as vr,w as Ot,a6 as rs,y as os,D as ss,I as cs,Q as xr,a8 as ls,o as Er,v as fs,d9 as ds,da as us,ao as ps,db as Zn,Y as hs,b as Sr,dc as ms,$ as gs,W as _s,dd as bs,de as vs,an as xs,l as Qn,k as Es,df as Ss,dg as Ts,dh as Ms,di as As,dj as Tr,dk as Rs,dl as _a,dm as ba,dn as va,dp as Cs,a7 as Ps,dq as Ls}from"./three.core-BjRw1Yol.js";function Mr(){let e=null,n=!1,t=null,i=null;function r(a,o){t(a,o),i=e.requestAnimationFrame(r)}return{start:function(){n!==!0&&t!==null&&e!==null&&(i=e.requestAnimationFrame(r),n=!0)},stop:function(){e!==null&&e.cancelAnimationFrame(i),n=!1},setAnimationLoop:function(a){t=a},setContext:function(a){e=a}}}function ws(e){const n=new WeakMap;function t(l,f){const d=l.array,_=l.usage,g=d.byteLength,u=e.createBuffer();e.bindBuffer(f,u),e.bufferData(f,d,_),l.onUploadCallback();let v;if(d instanceof Float32Array)v=e.FLOAT;else if(typeof Float16Array<"u"&&d instanceof Float16Array)v=e.HALF_FLOAT;else if(d instanceof Uint16Array)l.isFloat16BufferAttribute?v=e.HALF_FLOAT:v=e.UNSIGNED_SHORT;else if(d instanceof Int16Array)v=e.SHORT;else if(d instanceof Uint32Array)v=e.UNSIGNED_INT;else if(d instanceof Int32Array)v=e.INT;else if(d instanceof Int8Array)v=e.BYTE;else if(d instanceof Uint8Array)v=e.UNSIGNED_BYTE;else if(d instanceof Uint8ClampedArray)v=e.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+d);return{buffer:u,type:v,bytesPerElement:d.BYTES_PER_ELEMENT,version:l.version,size:g}}function i(l,f,d){const _=f.array,g=f.updateRanges;if(e.bindBuffer(d,l),g.length===0)e.bufferSubData(d,0,_);else{g.sort((v,A)=>v.start-A.start);let u=0;for(let v=1;v<g.length;v++){const A=g[u],D=g[v];D.start<=A.start+A.count+1?A.count=Math.max(A.count,D.start+D.count-A.start):(++u,g[u]=D)}g.length=u+1;for(let v=0,A=g.length;v<A;v++){const D=g[v];e.bufferSubData(d,D.start*_.BYTES_PER_ELEMENT,_,D.start,D.count)}f.clearUpdateRanges()}f.onUploadCallback()}function r(l){return l.isInterleavedBufferAttribute&&(l=l.data),n.get(l)}function a(l){l.isInterleavedBufferAttribute&&(l=l.data);const f=n.get(l);f&&(e.deleteBuffer(f.buffer),n.delete(l))}function o(l,f){if(l.isInterleavedBufferAttribute&&(l=l.data),l.isGLBufferAttribute){const _=n.get(l);(!_||_.version<l.version)&&n.set(l,{buffer:l.buffer,type:l.type,bytesPerElement:l.elementSize,version:l.version});return}const d=n.get(l);if(d===void 0)n.set(l,t(l,f));else if(d.version<l.version){if(d.size!==l.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(d.buffer,l,f),d.version=l.version}}return{get:r,remove:a,update:o}}var Ds=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Us=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,Ns=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Is=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Fs=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,ys=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Os=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,Gs=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Bs=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,ks=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Hs=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Vs=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,zs=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Ws=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,Xs=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,qs=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,Ks=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,js=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Ys=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Js=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,Zs=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,Qs=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,$s=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,ec=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,tc=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,nc=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,ic=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,ac=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,rc=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,oc=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,sc="gl_FragColor = linearToOutputTexel( gl_FragColor );",cc=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,lc=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,fc=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,dc=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,uc=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,pc=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,hc=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,mc=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,gc=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,_c=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,bc=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,vc=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,xc=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Ec=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Sc=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,Tc=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,Mc=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Ac=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Rc=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,Cc=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Pc=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Lc=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
		vec3 iridescenceFresnelDielectric;
		vec3 iridescenceFresnelMetallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
vec3 BRDF_GGX_Multiscatter( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 singleScatter = BRDF_GGX( lightDir, viewDir, normal, material );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 dfgV = texture2D( dfgLUT, vec2( material.roughness, dotNV ) ).rg;
	vec2 dfgL = texture2D( dfgLUT, vec2( material.roughness, dotNL ) ).rg;
	vec3 FssEss_V = material.specularColorBlended * dfgV.x + material.specularF90 * dfgV.y;
	vec3 FssEss_L = material.specularColorBlended * dfgL.x + material.specularF90 * dfgL.y;
	float Ess_V = dfgV.x + dfgV.y;
	float Ess_L = dfgL.x + dfgL.y;
	float Ems_V = 1.0 - Ess_V;
	float Ems_L = 1.0 - Ess_L;
	vec3 Favg = material.specularColorBlended + ( 1.0 - material.specularColorBlended ) * 0.047619;
	vec3 Fms = FssEss_V * FssEss_L * Favg / ( 1.0 - Ems_V * Ems_L * Favg + EPSILON );
	float compensationFactor = Ems_V * Ems_L;
	vec3 multiScatter = Fms * compensationFactor;
	return singleScatter + multiScatter;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX_Multiscatter( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnelDielectric, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceFresnelMetallic, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,wc=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( material.iridescenceFresnelDielectric, material.iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Dc=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,Uc=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Nc=`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,Ic=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Fc=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,yc=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Oc=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Gc=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Bc=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,kc=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,Hc=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Vc=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,zc=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Wc=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Xc=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,qc=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Kc=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,jc=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Yc=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Jc=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,Zc=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Qc=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,$c=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,el=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,tl=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,nl=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,il=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,al=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,rl=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,ol=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,sl=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,cl=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,ll=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,fl=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,dl=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,ul=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,pl=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,hl=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,ml=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,gl=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,_l=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,bl=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,vl=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,xl=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,El=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,Sl=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Tl=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Ml=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,Al=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,Rl=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,Cl=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Pl=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Ll=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,wl=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const Dl=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Ul=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Nl=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Il=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Fl=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,yl=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Ol=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,Gl=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,Bl=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,kl=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,Hl=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Vl=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,zl=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Wl=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Xl=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,ql=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Kl=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,jl=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Yl=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,Jl=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Zl=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,Ql=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,$l=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,ef=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,tf=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,nf=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,af=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,rf=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,of=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,sf=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,cf=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,lf=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,ff=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,df=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,De={alphahash_fragment:Ds,alphahash_pars_fragment:Us,alphamap_fragment:Ns,alphamap_pars_fragment:Is,alphatest_fragment:Fs,alphatest_pars_fragment:ys,aomap_fragment:Os,aomap_pars_fragment:Gs,batching_pars_vertex:Bs,batching_vertex:ks,begin_vertex:Hs,beginnormal_vertex:Vs,bsdfs:zs,iridescence_fragment:Ws,bumpmap_pars_fragment:Xs,clipping_planes_fragment:qs,clipping_planes_pars_fragment:Ks,clipping_planes_pars_vertex:js,clipping_planes_vertex:Ys,color_fragment:Js,color_pars_fragment:Zs,color_pars_vertex:Qs,color_vertex:$s,common:ec,cube_uv_reflection_fragment:tc,defaultnormal_vertex:nc,displacementmap_pars_vertex:ic,displacementmap_vertex:ac,emissivemap_fragment:rc,emissivemap_pars_fragment:oc,colorspace_fragment:sc,colorspace_pars_fragment:cc,envmap_fragment:lc,envmap_common_pars_fragment:fc,envmap_pars_fragment:dc,envmap_pars_vertex:uc,envmap_physical_pars_fragment:Tc,envmap_vertex:pc,fog_vertex:hc,fog_pars_vertex:mc,fog_fragment:gc,fog_pars_fragment:_c,gradientmap_pars_fragment:bc,lightmap_pars_fragment:vc,lights_lambert_fragment:xc,lights_lambert_pars_fragment:Ec,lights_pars_begin:Sc,lights_toon_fragment:Mc,lights_toon_pars_fragment:Ac,lights_phong_fragment:Rc,lights_phong_pars_fragment:Cc,lights_physical_fragment:Pc,lights_physical_pars_fragment:Lc,lights_fragment_begin:wc,lights_fragment_maps:Dc,lights_fragment_end:Uc,lightprobes_pars_fragment:Nc,logdepthbuf_fragment:Ic,logdepthbuf_pars_fragment:Fc,logdepthbuf_pars_vertex:yc,logdepthbuf_vertex:Oc,map_fragment:Gc,map_pars_fragment:Bc,map_particle_fragment:kc,map_particle_pars_fragment:Hc,metalnessmap_fragment:Vc,metalnessmap_pars_fragment:zc,morphinstance_vertex:Wc,morphcolor_vertex:Xc,morphnormal_vertex:qc,morphtarget_pars_vertex:Kc,morphtarget_vertex:jc,normal_fragment_begin:Yc,normal_fragment_maps:Jc,normal_pars_fragment:Zc,normal_pars_vertex:Qc,normal_vertex:$c,normalmap_pars_fragment:el,clearcoat_normal_fragment_begin:tl,clearcoat_normal_fragment_maps:nl,clearcoat_pars_fragment:il,iridescence_pars_fragment:al,opaque_fragment:rl,packing:ol,premultiplied_alpha_fragment:sl,project_vertex:cl,dithering_fragment:ll,dithering_pars_fragment:fl,roughnessmap_fragment:dl,roughnessmap_pars_fragment:ul,shadowmap_pars_fragment:pl,shadowmap_pars_vertex:hl,shadowmap_vertex:ml,shadowmask_pars_fragment:gl,skinbase_vertex:_l,skinning_pars_vertex:bl,skinning_vertex:vl,skinnormal_vertex:xl,specularmap_fragment:El,specularmap_pars_fragment:Sl,tonemapping_fragment:Tl,tonemapping_pars_fragment:Ml,transmission_fragment:Al,transmission_pars_fragment:Rl,uv_pars_fragment:Cl,uv_pars_vertex:Pl,uv_vertex:Ll,worldpos_vertex:wl,background_vert:Dl,background_frag:Ul,backgroundCube_vert:Nl,backgroundCube_frag:Il,cube_vert:Fl,cube_frag:yl,depth_vert:Ol,depth_frag:Gl,distance_vert:Bl,distance_frag:kl,equirect_vert:Hl,equirect_frag:Vl,linedashed_vert:zl,linedashed_frag:Wl,meshbasic_vert:Xl,meshbasic_frag:ql,meshlambert_vert:Kl,meshlambert_frag:jl,meshmatcap_vert:Yl,meshmatcap_frag:Jl,meshnormal_vert:Zl,meshnormal_frag:Ql,meshphong_vert:$l,meshphong_frag:ef,meshphysical_vert:tf,meshphysical_frag:nf,meshtoon_vert:af,meshtoon_frag:rf,points_vert:of,points_frag:sf,shadow_vert:cf,shadow_frag:lf,sprite_vert:ff,sprite_frag:df},se={common:{diffuse:{value:new Be(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Fe},alphaMap:{value:null},alphaMapTransform:{value:new Fe},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Fe}},envmap:{envMap:{value:null},envMapRotation:{value:new Fe},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Fe}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Fe}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Fe},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Fe},normalScale:{value:new gt(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Fe},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Fe}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Fe}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Fe}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Be(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new we},probesMax:{value:new we},probesResolution:{value:new we}},points:{diffuse:{value:new Be(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Fe},alphaTest:{value:0},uvTransform:{value:new Fe}},sprite:{diffuse:{value:new Be(16777215)},opacity:{value:1},center:{value:new gt(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Fe},alphaMap:{value:null},alphaMapTransform:{value:new Fe},alphaTest:{value:0}}},wt={basic:{uniforms:bt([se.common,se.specularmap,se.envmap,se.aomap,se.lightmap,se.fog]),vertexShader:De.meshbasic_vert,fragmentShader:De.meshbasic_frag},lambert:{uniforms:bt([se.common,se.specularmap,se.envmap,se.aomap,se.lightmap,se.emissivemap,se.bumpmap,se.normalmap,se.displacementmap,se.fog,se.lights,{emissive:{value:new Be(0)},envMapIntensity:{value:1}}]),vertexShader:De.meshlambert_vert,fragmentShader:De.meshlambert_frag},phong:{uniforms:bt([se.common,se.specularmap,se.envmap,se.aomap,se.lightmap,se.emissivemap,se.bumpmap,se.normalmap,se.displacementmap,se.fog,se.lights,{emissive:{value:new Be(0)},specular:{value:new Be(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:De.meshphong_vert,fragmentShader:De.meshphong_frag},standard:{uniforms:bt([se.common,se.envmap,se.aomap,se.lightmap,se.emissivemap,se.bumpmap,se.normalmap,se.displacementmap,se.roughnessmap,se.metalnessmap,se.fog,se.lights,{emissive:{value:new Be(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:De.meshphysical_vert,fragmentShader:De.meshphysical_frag},toon:{uniforms:bt([se.common,se.aomap,se.lightmap,se.emissivemap,se.bumpmap,se.normalmap,se.displacementmap,se.gradientmap,se.fog,se.lights,{emissive:{value:new Be(0)}}]),vertexShader:De.meshtoon_vert,fragmentShader:De.meshtoon_frag},matcap:{uniforms:bt([se.common,se.bumpmap,se.normalmap,se.displacementmap,se.fog,{matcap:{value:null}}]),vertexShader:De.meshmatcap_vert,fragmentShader:De.meshmatcap_frag},points:{uniforms:bt([se.points,se.fog]),vertexShader:De.points_vert,fragmentShader:De.points_frag},dashed:{uniforms:bt([se.common,se.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:De.linedashed_vert,fragmentShader:De.linedashed_frag},depth:{uniforms:bt([se.common,se.displacementmap]),vertexShader:De.depth_vert,fragmentShader:De.depth_frag},normal:{uniforms:bt([se.common,se.bumpmap,se.normalmap,se.displacementmap,{opacity:{value:1}}]),vertexShader:De.meshnormal_vert,fragmentShader:De.meshnormal_frag},sprite:{uniforms:bt([se.sprite,se.fog]),vertexShader:De.sprite_vert,fragmentShader:De.sprite_frag},background:{uniforms:{uvTransform:{value:new Fe},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:De.background_vert,fragmentShader:De.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Fe}},vertexShader:De.backgroundCube_vert,fragmentShader:De.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:De.cube_vert,fragmentShader:De.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:De.equirect_vert,fragmentShader:De.equirect_frag},distance:{uniforms:bt([se.common,se.displacementmap,{referencePosition:{value:new we},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:De.distance_vert,fragmentShader:De.distance_frag},shadow:{uniforms:bt([se.lights,se.fog,{color:{value:new Be(0)},opacity:{value:1}}]),vertexShader:De.shadow_vert,fragmentShader:De.shadow_frag}};wt.physical={uniforms:bt([wt.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Fe},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Fe},clearcoatNormalScale:{value:new gt(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Fe},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Fe},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Fe},sheen:{value:0},sheenColor:{value:new Be(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Fe},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Fe},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Fe},transmissionSamplerSize:{value:new gt},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Fe},attenuationDistance:{value:0},attenuationColor:{value:new Be(0)},specularColor:{value:new Be(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Fe},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Fe},anisotropyVector:{value:new gt},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Fe}}]),vertexShader:De.meshphysical_vert,fragmentShader:De.meshphysical_frag};const wn={r:0,b:0,g:0},uf=new Ft,Ar=new Fe;Ar.set(-1,0,0,0,1,0,0,0,1);function pf(e,n,t,i,r,a){const o=new Be(0);let l=r===!0?0:1,f,d,_=null,g=0,u=null;function v(M){let R=M.isScene===!0?M.background:null;if(R&&R.isTexture){const b=M.backgroundBlurriness>0;R=n.get(R,b)}return R}function A(M){let R=!1;const b=v(M);b===null?h(o,l):b&&b.isColor&&(h(b,1),R=!0);const T=e.xr.getEnvironmentBlendMode();T==="additive"?t.buffers.color.setClear(0,0,0,1,a):T==="alpha-blend"&&t.buffers.color.setClear(0,0,0,0,a),(e.autoClear||R)&&(t.buffers.depth.setTest(!0),t.buffers.depth.setMask(!0),t.buffers.color.setMask(!0),e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil))}function D(M,R){const b=v(R);b&&(b.isCubeTexture||b.mapping===Bn)?(d===void 0&&(d=new yt(new xi(1,1,1),new Ht({name:"BackgroundCubeMaterial",uniforms:fi(wt.backgroundCube.uniforms),vertexShader:wt.backgroundCube.vertexShader,fragmentShader:wt.backgroundCube.fragmentShader,side:Et,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),d.geometry.deleteAttribute("normal"),d.geometry.deleteAttribute("uv"),d.onBeforeRender=function(T,E,P){this.matrixWorld.copyPosition(P.matrixWorld)},Object.defineProperty(d.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(d)),d.material.uniforms.envMap.value=b,d.material.uniforms.backgroundBlurriness.value=R.backgroundBlurriness,d.material.uniforms.backgroundIntensity.value=R.backgroundIntensity,d.material.uniforms.backgroundRotation.value.setFromMatrix4(uf.makeRotationFromEuler(R.backgroundRotation)).transpose(),b.isCubeTexture&&b.isRenderTargetTexture===!1&&d.material.uniforms.backgroundRotation.value.premultiply(Ar),d.material.toneMapped=Qe.getTransfer(b.colorSpace)!==Je,(_!==b||g!==b.version||u!==e.toneMapping)&&(d.material.needsUpdate=!0,_=b,g=b.version,u=e.toneMapping),d.layers.enableAll(),M.unshift(d,d.geometry,d.material,0,0,null)):b&&b.isTexture&&(f===void 0&&(f=new yt(new rr(2,2),new Ht({name:"BackgroundMaterial",uniforms:fi(wt.background.uniforms),vertexShader:wt.background.vertexShader,fragmentShader:wt.background.fragmentShader,side:fn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),f.geometry.deleteAttribute("normal"),Object.defineProperty(f.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(f)),f.material.uniforms.t2D.value=b,f.material.uniforms.backgroundIntensity.value=R.backgroundIntensity,f.material.toneMapped=Qe.getTransfer(b.colorSpace)!==Je,b.matrixAutoUpdate===!0&&b.updateMatrix(),f.material.uniforms.uvTransform.value.copy(b.matrix),(_!==b||g!==b.version||u!==e.toneMapping)&&(f.material.needsUpdate=!0,_=b,g=b.version,u=e.toneMapping),f.layers.enableAll(),M.unshift(f,f.geometry,f.material,0,0,null))}function h(M,R){M.getRGB(wn,cr(e)),t.buffers.color.setClear(wn.r,wn.g,wn.b,R,a)}function c(){d!==void 0&&(d.geometry.dispose(),d.material.dispose(),d=void 0),f!==void 0&&(f.geometry.dispose(),f.material.dispose(),f=void 0)}return{getClearColor:function(){return o},setClearColor:function(M,R=1){o.set(M),l=R,h(o,l)},getClearAlpha:function(){return l},setClearAlpha:function(M){l=M,h(o,l)},render:A,addToRenderList:D,dispose:c}}function hf(e,n){const t=e.getParameter(e.MAX_VERTEX_ATTRIBS),i={},r=u(null);let a=r,o=!1;function l(U,B,J,Y,z){let W=!1;const H=g(U,Y,J,B);a!==H&&(a=H,d(a.object)),W=v(U,Y,J,z),W&&A(U,Y,J,z),z!==null&&n.update(z,e.ELEMENT_ARRAY_BUFFER),(W||o)&&(o=!1,b(U,B,J,Y),z!==null&&e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,n.get(z).buffer))}function f(){return e.createVertexArray()}function d(U){return e.bindVertexArray(U)}function _(U){return e.deleteVertexArray(U)}function g(U,B,J,Y){const z=Y.wireframe===!0;let W=i[B.id];W===void 0&&(W={},i[B.id]=W);const H=U.isInstancedMesh===!0?U.id:0;let Z=W[H];Z===void 0&&(Z={},W[H]=Z);let le=Z[J.id];le===void 0&&(le={},Z[J.id]=le);let _e=le[z];return _e===void 0&&(_e=u(f()),le[z]=_e),_e}function u(U){const B=[],J=[],Y=[];for(let z=0;z<t;z++)B[z]=0,J[z]=0,Y[z]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:B,enabledAttributes:J,attributeDivisors:Y,object:U,attributes:{},index:null}}function v(U,B,J,Y){const z=a.attributes,W=B.attributes;let H=0;const Z=J.getAttributes();for(const le in Z)if(Z[le].location>=0){const be=z[le];let Ee=W[le];if(Ee===void 0&&(le==="instanceMatrix"&&U.instanceMatrix&&(Ee=U.instanceMatrix),le==="instanceColor"&&U.instanceColor&&(Ee=U.instanceColor)),be===void 0||be.attribute!==Ee||Ee&&be.data!==Ee.data)return!0;H++}return a.attributesNum!==H||a.index!==Y}function A(U,B,J,Y){const z={},W=B.attributes;let H=0;const Z=J.getAttributes();for(const le in Z)if(Z[le].location>=0){let be=W[le];be===void 0&&(le==="instanceMatrix"&&U.instanceMatrix&&(be=U.instanceMatrix),le==="instanceColor"&&U.instanceColor&&(be=U.instanceColor));const Ee={};Ee.attribute=be,be&&be.data&&(Ee.data=be.data),z[le]=Ee,H++}a.attributes=z,a.attributesNum=H,a.index=Y}function D(){const U=a.newAttributes;for(let B=0,J=U.length;B<J;B++)U[B]=0}function h(U){c(U,0)}function c(U,B){const J=a.newAttributes,Y=a.enabledAttributes,z=a.attributeDivisors;J[U]=1,Y[U]===0&&(e.enableVertexAttribArray(U),Y[U]=1),z[U]!==B&&(e.vertexAttribDivisor(U,B),z[U]=B)}function M(){const U=a.newAttributes,B=a.enabledAttributes;for(let J=0,Y=B.length;J<Y;J++)B[J]!==U[J]&&(e.disableVertexAttribArray(J),B[J]=0)}function R(U,B,J,Y,z,W,H){H===!0?e.vertexAttribIPointer(U,B,J,z,W):e.vertexAttribPointer(U,B,J,Y,z,W)}function b(U,B,J,Y){D();const z=Y.attributes,W=J.getAttributes(),H=B.defaultAttributeValues;for(const Z in W){const le=W[Z];if(le.location>=0){let _e=z[Z];if(_e===void 0&&(Z==="instanceMatrix"&&U.instanceMatrix&&(_e=U.instanceMatrix),Z==="instanceColor"&&U.instanceColor&&(_e=U.instanceColor)),_e!==void 0){const be=_e.normalized,Ee=_e.itemSize,Ke=n.get(_e);if(Ke===void 0)continue;const ot=Ke.buffer,Ve=Ke.type,K=Ke.bytesPerElement,te=Ve===e.INT||Ve===e.UNSIGNED_INT||_e.gpuType===or;if(_e.isInterleavedBufferAttribute){const Q=_e.data,Re=Q.stride,Ce=_e.offset;if(Q.isInstancedInterleavedBuffer){for(let Me=0;Me<le.locationSize;Me++)c(le.location+Me,Q.meshPerAttribute);U.isInstancedMesh!==!0&&Y._maxInstanceCount===void 0&&(Y._maxInstanceCount=Q.meshPerAttribute*Q.count)}else for(let Me=0;Me<le.locationSize;Me++)h(le.location+Me);e.bindBuffer(e.ARRAY_BUFFER,ot);for(let Me=0;Me<le.locationSize;Me++)R(le.location+Me,Ee/le.locationSize,Ve,be,Re*K,(Ce+Ee/le.locationSize*Me)*K,te)}else{if(_e.isInstancedBufferAttribute){for(let Q=0;Q<le.locationSize;Q++)c(le.location+Q,_e.meshPerAttribute);U.isInstancedMesh!==!0&&Y._maxInstanceCount===void 0&&(Y._maxInstanceCount=_e.meshPerAttribute*_e.count)}else for(let Q=0;Q<le.locationSize;Q++)h(le.location+Q);e.bindBuffer(e.ARRAY_BUFFER,ot);for(let Q=0;Q<le.locationSize;Q++)R(le.location+Q,Ee/le.locationSize,Ve,be,Ee*K,Ee/le.locationSize*Q*K,te)}}else if(H!==void 0){const be=H[Z];if(be!==void 0)switch(be.length){case 2:e.vertexAttrib2fv(le.location,be);break;case 3:e.vertexAttrib3fv(le.location,be);break;case 4:e.vertexAttrib4fv(le.location,be);break;default:e.vertexAttrib1fv(le.location,be)}}}}M()}function T(){S();for(const U in i){const B=i[U];for(const J in B){const Y=B[J];for(const z in Y){const W=Y[z];for(const H in W)_(W[H].object),delete W[H];delete Y[z]}}delete i[U]}}function E(U){if(i[U.id]===void 0)return;const B=i[U.id];for(const J in B){const Y=B[J];for(const z in Y){const W=Y[z];for(const H in W)_(W[H].object),delete W[H];delete Y[z]}}delete i[U.id]}function P(U){for(const B in i){const J=i[B];for(const Y in J){const z=J[Y];if(z[U.id]===void 0)continue;const W=z[U.id];for(const H in W)_(W[H].object),delete W[H];delete z[U.id]}}}function m(U){for(const B in i){const J=i[B],Y=U.isInstancedMesh===!0?U.id:0,z=J[Y];if(z!==void 0){for(const W in z){const H=z[W];for(const Z in H)_(H[Z].object),delete H[Z];delete z[W]}delete J[Y],Object.keys(J).length===0&&delete i[B]}}}function S(){I(),o=!0,a!==r&&(a=r,d(a.object))}function I(){r.geometry=null,r.program=null,r.wireframe=!1}return{setup:l,reset:S,resetDefaultState:I,dispose:T,releaseStatesOfGeometry:E,releaseStatesOfObject:m,releaseStatesOfProgram:P,initAttributes:D,enableAttribute:h,disableUnusedAttributes:M}}function mf(e,n,t){let i;function r(f){i=f}function a(f,d){e.drawArrays(i,f,d),t.update(d,i,1)}function o(f,d,_){_!==0&&(e.drawArraysInstanced(i,f,d,_),t.update(d,i,_))}function l(f,d,_){if(_===0)return;n.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,f,0,d,0,_);let u=0;for(let v=0;v<_;v++)u+=d[v];t.update(u,i,1)}this.setMode=r,this.render=a,this.renderInstances=o,this.renderMultiDraw=l}function gf(e,n,t,i){let r;function a(){if(r!==void 0)return r;if(n.has("EXT_texture_filter_anisotropic")===!0){const P=n.get("EXT_texture_filter_anisotropic");r=e.getParameter(P.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else r=0;return r}function o(P){return!(P!==Gt&&i.convert(P)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_FORMAT))}function l(P){const m=P===Jt&&(n.has("EXT_color_buffer_half_float")||n.has("EXT_color_buffer_float"));return!(P!==Dt&&i.convert(P)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_TYPE)&&P!==Kt&&!m)}function f(P){if(P==="highp"){if(e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT).precision>0)return"highp";P="mediump"}return P==="mediump"&&e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let d=t.precision!==void 0?t.precision:"highp";const _=f(d);_!==d&&(ke("WebGLRenderer:",d,"not supported, using",_,"instead."),d=_);const g=t.logarithmicDepthBuffer===!0,u=t.reversedDepthBuffer===!0&&n.has("EXT_clip_control");t.reversedDepthBuffer===!0&&u===!1&&ke("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");const v=e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS),A=e.getParameter(e.MAX_VERTEX_TEXTURE_IMAGE_UNITS),D=e.getParameter(e.MAX_TEXTURE_SIZE),h=e.getParameter(e.MAX_CUBE_MAP_TEXTURE_SIZE),c=e.getParameter(e.MAX_VERTEX_ATTRIBS),M=e.getParameter(e.MAX_VERTEX_UNIFORM_VECTORS),R=e.getParameter(e.MAX_VARYING_VECTORS),b=e.getParameter(e.MAX_FRAGMENT_UNIFORM_VECTORS),T=e.getParameter(e.MAX_SAMPLES),E=e.getParameter(e.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:a,getMaxPrecision:f,textureFormatReadable:o,textureTypeReadable:l,precision:d,logarithmicDepthBuffer:g,reversedDepthBuffer:u,maxTextures:v,maxVertexTextures:A,maxTextureSize:D,maxCubemapSize:h,maxAttributes:c,maxVertexUniforms:M,maxVaryings:R,maxFragmentUniforms:b,maxSamples:T,samples:E}}function _f(e){const n=this;let t=null,i=0,r=!1,a=!1;const o=new Eo,l=new Fe,f={value:null,needsUpdate:!1};this.uniform=f,this.numPlanes=0,this.numIntersection=0,this.init=function(g,u){const v=g.length!==0||u||i!==0||r;return r=u,i=g.length,v},this.beginShadows=function(){a=!0,_(null)},this.endShadows=function(){a=!1},this.setGlobalState=function(g,u){t=_(g,u,0)},this.setState=function(g,u,v){const A=g.clippingPlanes,D=g.clipIntersection,h=g.clipShadows,c=e.get(g);if(!r||A===null||A.length===0||a&&!h)a?_(null):d();else{const M=a?0:i,R=M*4;let b=c.clippingState||null;f.value=b,b=_(A,u,R,v);for(let T=0;T!==R;++T)b[T]=t[T];c.clippingState=b,this.numIntersection=D?this.numPlanes:0,this.numPlanes+=M}};function d(){f.value!==t&&(f.value=t,f.needsUpdate=i>0),n.numPlanes=i,n.numIntersection=0}function _(g,u,v,A){const D=g!==null?g.length:0;let h=null;if(D!==0){if(h=f.value,A!==!0||h===null){const c=v+D*4,M=u.matrixWorldInverse;l.getNormalMatrix(M),(h===null||h.length<c)&&(h=new Float32Array(c));for(let R=0,b=v;R!==D;++R,b+=4)o.copy(g[R]).applyMatrix4(M,l),o.normal.toArray(h,b),h[b+3]=o.constant}f.value=h,f.needsUpdate=!0}return n.numPlanes=D,n.numIntersection=0,h}}const jt=4,xa=[.125,.215,.35,.446,.526,.582],$t=20,bf=256,_n=new _i,Ea=new Be;let $n=null,ei=0,ti=0,ni=!1;const vf=new we;class Sa{constructor(n){this._renderer=n,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._sigmas=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(n,t=0,i=.1,r=100,a={}){const{size:o=256,position:l=vf}=a;$n=this._renderer.getRenderTarget(),ei=this._renderer.getActiveCubeFace(),ti=this._renderer.getActiveMipmapLevel(),ni=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(o);const f=this._allocateTargets();return f.depthBuffer=!0,this._sceneToCubeUV(n,i,r,f,l),t>0&&this._blur(f,0,0,t),this._applyPMREM(f),this._cleanup(f),f}fromEquirectangular(n,t=null){return this._fromTexture(n,t)}fromCubemap(n,t=null){return this._fromTexture(n,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Aa(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Ma(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(n){this._lodMax=Math.floor(Math.log2(n)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let n=0;n<this._lodMeshes.length;n++)this._lodMeshes[n].geometry.dispose()}_cleanup(n){this._renderer.setRenderTarget($n,ei,ti),this._renderer.xr.enabled=ni,n.scissorTest=!1,an(n,0,0,n.width,n.height)}_fromTexture(n,t){n.mapping===Cn||n.mapping===pn?this._setSize(n.image.length===0?16:n.image[0].width||n.image[0].image.width):this._setSize(n.image.width/4),$n=this._renderer.getRenderTarget(),ei=this._renderer.getActiveCubeFace(),ti=this._renderer.getActiveMipmapLevel(),ni=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const i=t||this._allocateTargets();return this._textureToCubeUV(n,i),this._applyPMREM(i),this._cleanup(i),i}_allocateTargets(){const n=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,i={magFilter:mt,minFilter:mt,generateMipmaps:!1,type:Jt,format:Gt,colorSpace:Mt,depthBuffer:!1},r=Ta(n,t,i);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==n||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Ta(n,t,i);const{_lodMax:a}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods,sigmas:this._sigmas}=xf(a)),this._blurMaterial=Sf(a,n,t),this._ggxMaterial=Ef(a,n,t)}return r}_compileMaterial(n){const t=new yt(new hn,n);this._renderer.compile(t,_n)}_sceneToCubeUV(n,t,i,r,a){const f=new Tn(90,1,t,i),d=[1,-1,1,1,1,1],_=[1,1,1,-1,-1,-1],g=this._renderer,u=g.autoClear,v=g.toneMapping;g.getClearColor(Ea),g.toneMapping=Nt,g.autoClear=!1,g.state.buffers.depth.getReversed()&&(g.setRenderTarget(r),g.clearDepth(),g.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new yt(new xi,new sn({name:"PMREM.Background",side:Et,depthWrite:!1,depthTest:!1})));const D=this._backgroundBox,h=D.material;let c=!1;const M=n.background;M?M.isColor&&(h.color.copy(M),n.background=null,c=!0):(h.color.copy(Ea),c=!0);for(let R=0;R<6;R++){const b=R%3;b===0?(f.up.set(0,d[R],0),f.position.set(a.x,a.y,a.z),f.lookAt(a.x+_[R],a.y,a.z)):b===1?(f.up.set(0,0,d[R]),f.position.set(a.x,a.y,a.z),f.lookAt(a.x,a.y+_[R],a.z)):(f.up.set(0,d[R],0),f.position.set(a.x,a.y,a.z),f.lookAt(a.x,a.y,a.z+_[R]));const T=this._cubeSize;an(r,b*T,R>2?T:0,T,T),g.setRenderTarget(r),c&&g.render(D,f),g.render(n,f)}g.toneMapping=v,g.autoClear=u,n.background=M}_textureToCubeUV(n,t){const i=this._renderer,r=n.mapping===Cn||n.mapping===pn;r?(this._cubemapMaterial===null&&(this._cubemapMaterial=Aa()),this._cubemapMaterial.uniforms.flipEnvMap.value=n.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Ma());const a=r?this._cubemapMaterial:this._equirectMaterial,o=this._lodMeshes[0];o.material=a;const l=a.uniforms;l.envMap.value=n;const f=this._cubeSize;an(t,0,0,3*f,2*f),i.setRenderTarget(t),i.render(o,_n)}_applyPMREM(n){const t=this._renderer,i=t.autoClear;t.autoClear=!1;const r=this._lodMeshes.length;for(let a=1;a<r;a++)this._applyGGXFilter(n,a-1,a);t.autoClear=i}_applyGGXFilter(n,t,i){const r=this._renderer,a=this._pingPongRenderTarget,o=this._ggxMaterial,l=this._lodMeshes[i];l.material=o;const f=o.uniforms,d=i/(this._lodMeshes.length-1),_=t/(this._lodMeshes.length-1),g=Math.sqrt(d*d-_*_),u=0+d*1.25,v=g*u,{_lodMax:A}=this,D=this._sizeLods[i],h=3*D*(i>A-jt?i-A+jt:0),c=4*(this._cubeSize-D);f.envMap.value=n.texture,f.roughness.value=v,f.mipInt.value=A-t,an(a,h,c,3*D,2*D),r.setRenderTarget(a),r.render(l,_n),f.envMap.value=a.texture,f.roughness.value=0,f.mipInt.value=A-i,an(n,h,c,3*D,2*D),r.setRenderTarget(n),r.render(l,_n)}_blur(n,t,i,r,a){const o=this._pingPongRenderTarget;this._halfBlur(n,o,t,i,r,"latitudinal",a),this._halfBlur(o,n,i,i,r,"longitudinal",a)}_halfBlur(n,t,i,r,a,o,l){const f=this._renderer,d=this._blurMaterial;o!=="latitudinal"&&o!=="longitudinal"&&Ze("blur direction must be either latitudinal or longitudinal!");const _=3,g=this._lodMeshes[r];g.material=d;const u=d.uniforms,v=this._sizeLods[i]-1,A=isFinite(a)?Math.PI/(2*v):2*Math.PI/(2*$t-1),D=a/A,h=isFinite(a)?1+Math.floor(_*D):$t;h>$t&&ke(`sigmaRadians, ${a}, is too large and will clip, as it requested ${h} samples when the maximum is set to ${$t}`);const c=[];let M=0;for(let P=0;P<$t;++P){const m=P/D,S=Math.exp(-m*m/2);c.push(S),P===0?M+=S:P<h&&(M+=2*S)}for(let P=0;P<c.length;P++)c[P]=c[P]/M;u.envMap.value=n.texture,u.samples.value=h,u.weights.value=c,u.latitudinal.value=o==="latitudinal",l&&(u.poleAxis.value=l);const{_lodMax:R}=this;u.dTheta.value=A,u.mipInt.value=R-i;const b=this._sizeLods[r],T=3*b*(r>R-jt?r-R+jt:0),E=4*(this._cubeSize-b);an(t,T,E,3*b,2*b),f.setRenderTarget(t),f.render(g,_n)}}function xf(e){const n=[],t=[],i=[];let r=e;const a=e-jt+1+xa.length;for(let o=0;o<a;o++){const l=Math.pow(2,r);n.push(l);let f=1/l;o>e-jt?f=xa[o-e+jt-1]:o===0&&(f=0),t.push(f);const d=1/(l-2),_=-d,g=1+d,u=[_,_,g,_,g,g,_,_,g,g,_,g],v=6,A=6,D=3,h=2,c=1,M=new Float32Array(D*A*v),R=new Float32Array(h*A*v),b=new Float32Array(c*A*v);for(let E=0;E<v;E++){const P=E%3*2/3-1,m=E>2?0:-1,S=[P,m,0,P+2/3,m,0,P+2/3,m+1,0,P,m,0,P+2/3,m+1,0,P,m+1,0];M.set(S,D*A*E),R.set(u,h*A*E);const I=[E,E,E,E,E,E];b.set(I,c*A*E)}const T=new hn;T.setAttribute("position",new Yt(M,D)),T.setAttribute("uv",new Yt(R,h)),T.setAttribute("faceIndex",new Yt(b,c)),i.push(new yt(T,null)),r>jt&&r--}return{lodMeshes:i,sizeLods:n,sigmas:t}}function Ta(e,n,t){const i=new It(e,n,t);return i.texture.mapping=Bn,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function an(e,n,t,i,r){e.viewport.set(n,t,i,r),e.scissor.set(n,t,i,r)}function Ef(e,n,t){return new Ht({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:bf,CUBEUV_TEXEL_WIDTH:1/n,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:kn(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:kt,depthTest:!1,depthWrite:!1})}function Sf(e,n,t){const i=new Float32Array($t),r=new we(0,1,0);return new Ht({name:"SphericalGaussianBlur",defines:{n:$t,CUBEUV_TEXEL_WIDTH:1/n,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:i},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:r}},vertexShader:kn(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:kt,depthTest:!1,depthWrite:!1})}function Ma(){return new Ht({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:kn(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:kt,depthTest:!1,depthWrite:!1})}function Aa(){return new Ht({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:kn(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:kt,depthTest:!1,depthWrite:!1})}function kn(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}class Rr extends It{constructor(n=1,t={}){super(n,n,t),this.isWebGLCubeRenderTarget=!0;const i={width:n,height:n,depth:1},r=[i,i,i,i,i,i];this.texture=new lr(r),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(n,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;const i={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},r=new xi(5,5,5),a=new Ht({name:"CubemapFromEquirect",uniforms:fi(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:Et,blending:kt});a.uniforms.tEquirect.value=t;const o=new yt(r,a),l=t.minFilter;return t.minFilter===qt&&(t.minFilter=mt),new Xo(1,10,this).update(n,o),t.minFilter=l,o.geometry.dispose(),o.material.dispose(),this}clear(n,t=!0,i=!0,r=!0){const a=n.getRenderTarget();for(let o=0;o<6;o++)n.setRenderTarget(this,o),n.clear(t,i,r);n.setRenderTarget(a)}}function Tf(e){let n=new WeakMap,t=new WeakMap,i=null;function r(u,v=!1){return u==null?null:v?o(u):a(u)}function a(u){if(u&&u.isTexture){const v=u.mapping;if(v===Yn||v===Jn)if(n.has(u)){const A=n.get(u).texture;return l(A,u.mapping)}else{const A=u.image;if(A&&A.height>0){const D=new Rr(A.height);return D.fromEquirectangularTexture(e,u),n.set(u,D),u.addEventListener("dispose",d),l(D.texture,u.mapping)}else return null}}return u}function o(u){if(u&&u.isTexture){const v=u.mapping,A=v===Yn||v===Jn,D=v===Cn||v===pn;if(A||D){let h=t.get(u);const c=h!==void 0?h.texture.pmremVersion:0;if(u.isRenderTargetTexture&&u.pmremVersion!==c)return i===null&&(i=new Sa(e)),h=A?i.fromEquirectangular(u,h):i.fromCubemap(u,h),h.texture.pmremVersion=u.pmremVersion,t.set(u,h),h.texture;if(h!==void 0)return h.texture;{const M=u.image;return A&&M&&M.height>0||D&&M&&f(M)?(i===null&&(i=new Sa(e)),h=A?i.fromEquirectangular(u):i.fromCubemap(u),h.texture.pmremVersion=u.pmremVersion,t.set(u,h),u.addEventListener("dispose",_),h.texture):null}}}return u}function l(u,v){return v===Yn?u.mapping=Cn:v===Jn&&(u.mapping=pn),u}function f(u){let v=0;const A=6;for(let D=0;D<A;D++)u[D]!==void 0&&v++;return v===A}function d(u){const v=u.target;v.removeEventListener("dispose",d);const A=n.get(v);A!==void 0&&(n.delete(v),A.dispose())}function _(u){const v=u.target;v.removeEventListener("dispose",_);const A=t.get(v);A!==void 0&&(t.delete(v),A.dispose())}function g(){n=new WeakMap,t=new WeakMap,i!==null&&(i.dispose(),i=null)}return{get:r,dispose:g}}function Mf(e){const n={};function t(i){if(n[i]!==void 0)return n[i];const r=e.getExtension(i);return n[i]=r,r}return{has:function(i){return t(i)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(i){const r=t(i);return r===null&&Jr("WebGLRenderer: "+i+" extension not supported."),r}}}function Af(e,n,t,i){const r={},a=new WeakMap;function o(g){const u=g.target;u.index!==null&&n.remove(u.index);for(const A in u.attributes)n.remove(u.attributes[A]);u.removeEventListener("dispose",o),delete r[u.id];const v=a.get(u);v&&(n.remove(v),a.delete(u)),i.releaseStatesOfGeometry(u),u.isInstancedBufferGeometry===!0&&delete u._maxInstanceCount,t.memory.geometries--}function l(g,u){return r[u.id]===!0||(u.addEventListener("dispose",o),r[u.id]=!0,t.memory.geometries++),u}function f(g){const u=g.attributes;for(const v in u)n.update(u[v],e.ARRAY_BUFFER)}function d(g){const u=[],v=g.index,A=g.attributes.position;let D=0;if(A===void 0)return;if(v!==null){const M=v.array;D=v.version;for(let R=0,b=M.length;R<b;R+=3){const T=M[R+0],E=M[R+1],P=M[R+2];u.push(T,E,E,P,P,T)}}else{const M=A.array;D=A.version;for(let R=0,b=M.length/3-1;R<b;R+=3){const T=R+0,E=R+1,P=R+2;u.push(T,E,E,P,P,T)}}const h=new(A.count>=65535?qo:Ko)(u,1);h.version=D;const c=a.get(g);c&&n.remove(c),a.set(g,h)}function _(g){const u=a.get(g);if(u){const v=g.index;v!==null&&u.version<v.version&&d(g)}else d(g);return a.get(g)}return{get:l,update:f,getWireframeAttribute:_}}function Rf(e,n,t){let i;function r(g){i=g}let a,o;function l(g){a=g.type,o=g.bytesPerElement}function f(g,u){e.drawElements(i,u,a,g*o),t.update(u,i,1)}function d(g,u,v){v!==0&&(e.drawElementsInstanced(i,u,a,g*o,v),t.update(u,i,v))}function _(g,u,v){if(v===0)return;n.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,u,0,a,g,0,v);let D=0;for(let h=0;h<v;h++)D+=u[h];t.update(D,i,1)}this.setMode=r,this.setIndex=l,this.render=f,this.renderInstances=d,this.renderMultiDraw=_}function Cf(e){const n={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function i(a,o,l){switch(t.calls++,o){case e.TRIANGLES:t.triangles+=l*(a/3);break;case e.LINES:t.lines+=l*(a/2);break;case e.LINE_STRIP:t.lines+=l*(a-1);break;case e.LINE_LOOP:t.lines+=l*a;break;case e.POINTS:t.points+=l*a;break;default:Ze("WebGLInfo: Unknown draw mode:",o);break}}function r(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:n,render:t,programs:null,autoReset:!0,reset:r,update:i}}function Pf(e,n,t){const i=new WeakMap,r=new vt;function a(o,l,f){const d=o.morphTargetInfluences,_=l.morphAttributes.position||l.morphAttributes.normal||l.morphAttributes.color,g=_!==void 0?_.length:0;let u=i.get(l);if(u===void 0||u.count!==g){let S=function(){P.dispose(),i.delete(l),l.removeEventListener("dispose",S)};u!==void 0&&u.texture.dispose();const v=l.morphAttributes.position!==void 0,A=l.morphAttributes.normal!==void 0,D=l.morphAttributes.color!==void 0,h=l.morphAttributes.position||[],c=l.morphAttributes.normal||[],M=l.morphAttributes.color||[];let R=0;v===!0&&(R=1),A===!0&&(R=2),D===!0&&(R=3);let b=l.attributes.position.count*R,T=1;b>n.maxTextureSize&&(T=Math.ceil(b/n.maxTextureSize),b=n.maxTextureSize);const E=new Float32Array(b*T*4*g),P=new sr(E,b,T,g);P.type=Kt,P.needsUpdate=!0;const m=R*4;for(let I=0;I<g;I++){const U=h[I],B=c[I],J=M[I],Y=b*T*4*I;for(let z=0;z<U.count;z++){const W=z*m;v===!0&&(r.fromBufferAttribute(U,z),E[Y+W+0]=r.x,E[Y+W+1]=r.y,E[Y+W+2]=r.z,E[Y+W+3]=0),A===!0&&(r.fromBufferAttribute(B,z),E[Y+W+4]=r.x,E[Y+W+5]=r.y,E[Y+W+6]=r.z,E[Y+W+7]=0),D===!0&&(r.fromBufferAttribute(J,z),E[Y+W+8]=r.x,E[Y+W+9]=r.y,E[Y+W+10]=r.z,E[Y+W+11]=J.itemSize===4?r.w:1)}}u={count:g,texture:P,size:new gt(b,T)},i.set(l,u),l.addEventListener("dispose",S)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)f.getUniforms().setValue(e,"morphTexture",o.morphTexture,t);else{let v=0;for(let D=0;D<d.length;D++)v+=d[D];const A=l.morphTargetsRelative?1:1-v;f.getUniforms().setValue(e,"morphTargetBaseInfluence",A),f.getUniforms().setValue(e,"morphTargetInfluences",d)}f.getUniforms().setValue(e,"morphTargetsTexture",u.texture,t),f.getUniforms().setValue(e,"morphTargetsTextureSize",u.size)}return{update:a}}function Lf(e,n,t,i,r){let a=new WeakMap;function o(d){const _=r.render.frame,g=d.geometry,u=n.get(d,g);if(a.get(u)!==_&&(n.update(u),a.set(u,_)),d.isInstancedMesh&&(d.hasEventListener("dispose",f)===!1&&d.addEventListener("dispose",f),a.get(d)!==_&&(t.update(d.instanceMatrix,e.ARRAY_BUFFER),d.instanceColor!==null&&t.update(d.instanceColor,e.ARRAY_BUFFER),a.set(d,_))),d.isSkinnedMesh){const v=d.skeleton;a.get(v)!==_&&(v.update(),a.set(v,_))}return u}function l(){a=new WeakMap}function f(d){const _=d.target;_.removeEventListener("dispose",f),i.releaseStatesOfObject(_),t.remove(_.instanceMatrix),_.instanceColor!==null&&t.remove(_.instanceColor)}return{update:o,dispose:l}}const wf={[gr]:"LINEAR_TONE_MAPPING",[mr]:"REINHARD_TONE_MAPPING",[hr]:"CINEON_TONE_MAPPING",[pr]:"ACES_FILMIC_TONE_MAPPING",[ur]:"AGX_TONE_MAPPING",[dr]:"NEUTRAL_TONE_MAPPING",[fr]:"CUSTOM_TONE_MAPPING"};function Df(e,n,t,i,r,a){const o=new It(n,t,{type:e,depthBuffer:r,stencilBuffer:a,samples:i?4:0,depthTexture:r?new An(n,t):void 0}),l=new It(n,t,{type:Jt,depthBuffer:!1,stencilBuffer:!1}),f=new hn;f.setAttribute("position",new Ui([-1,3,0,-1,-1,0,3,-1,0],3)),f.setAttribute("uv",new Ui([0,2,0,0,2,0],2));const d=new Xr({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),_=new yt(f,d),g=new _i(-1,1,1,-1,0,1);let u=null,v=null,A=!1,D,h=null,c=[],M=!1;this.setSize=function(R,b){o.setSize(R,b),l.setSize(R,b);for(let T=0;T<c.length;T++){const E=c[T];E.setSize&&E.setSize(R,b)}},this.setEffects=function(R){c=R,M=c.length>0&&c[0].isRenderPass===!0;const b=o.width,T=o.height;for(let E=0;E<c.length;E++){const P=c[E];P.setSize&&P.setSize(b,T)}},this.begin=function(R,b){if(A||R.toneMapping===Nt&&c.length===0)return!1;if(h=b,b!==null){const T=b.width,E=b.height;(o.width!==T||o.height!==E)&&this.setSize(T,E)}return M===!1&&R.setRenderTarget(o),D=R.toneMapping,R.toneMapping=Nt,!0},this.hasRenderPass=function(){return M},this.end=function(R,b){R.toneMapping=D,A=!0;let T=o,E=l;for(let P=0;P<c.length;P++){const m=c[P];if(m.enabled!==!1&&(m.render(R,E,T,b),m.needsSwap!==!1)){const S=T;T=E,E=S}}if(u!==R.outputColorSpace||v!==R.toneMapping){u=R.outputColorSpace,v=R.toneMapping,d.defines={},Qe.getTransfer(u)===Je&&(d.defines.SRGB_TRANSFER="");const P=wf[v];P&&(d.defines[P]=""),d.needsUpdate=!0}d.uniforms.tDiffuse.value=T.texture,R.setRenderTarget(h),R.render(_,g),h=null,A=!1},this.isCompositing=function(){return A},this.dispose=function(){o.depthTexture&&o.depthTexture.dispose(),o.dispose(),l.dispose(),f.dispose(),d.dispose()}}const Cr=new di,pi=new An(1,1),Pr=new sr,Lr=new Yo,wr=new lr,Ra=[],Ca=[],Pa=new Float32Array(16),La=new Float32Array(9),wa=new Float32Array(4);function mn(e,n,t){const i=e[0];if(i<=0||i>0)return e;const r=n*t;let a=Ra[r];if(a===void 0&&(a=new Float32Array(r),Ra[r]=a),n!==0){i.toArray(a,0);for(let o=1,l=0;o!==n;++o)l+=t,e[o].toArray(a,l)}return a}function ft(e,n){if(e.length!==n.length)return!1;for(let t=0,i=e.length;t<i;t++)if(e[t]!==n[t])return!1;return!0}function dt(e,n){for(let t=0,i=n.length;t<i;t++)e[t]=n[t]}function Hn(e,n){let t=Ca[n];t===void 0&&(t=new Int32Array(n),Ca[n]=t);for(let i=0;i!==n;++i)t[i]=e.allocateTextureUnit();return t}function Uf(e,n){const t=this.cache;t[0]!==n&&(e.uniform1f(this.addr,n),t[0]=n)}function Nf(e,n){const t=this.cache;if(n.x!==void 0)(t[0]!==n.x||t[1]!==n.y)&&(e.uniform2f(this.addr,n.x,n.y),t[0]=n.x,t[1]=n.y);else{if(ft(t,n))return;e.uniform2fv(this.addr,n),dt(t,n)}}function If(e,n){const t=this.cache;if(n.x!==void 0)(t[0]!==n.x||t[1]!==n.y||t[2]!==n.z)&&(e.uniform3f(this.addr,n.x,n.y,n.z),t[0]=n.x,t[1]=n.y,t[2]=n.z);else if(n.r!==void 0)(t[0]!==n.r||t[1]!==n.g||t[2]!==n.b)&&(e.uniform3f(this.addr,n.r,n.g,n.b),t[0]=n.r,t[1]=n.g,t[2]=n.b);else{if(ft(t,n))return;e.uniform3fv(this.addr,n),dt(t,n)}}function Ff(e,n){const t=this.cache;if(n.x!==void 0)(t[0]!==n.x||t[1]!==n.y||t[2]!==n.z||t[3]!==n.w)&&(e.uniform4f(this.addr,n.x,n.y,n.z,n.w),t[0]=n.x,t[1]=n.y,t[2]=n.z,t[3]=n.w);else{if(ft(t,n))return;e.uniform4fv(this.addr,n),dt(t,n)}}function yf(e,n){const t=this.cache,i=n.elements;if(i===void 0){if(ft(t,n))return;e.uniformMatrix2fv(this.addr,!1,n),dt(t,n)}else{if(ft(t,i))return;wa.set(i),e.uniformMatrix2fv(this.addr,!1,wa),dt(t,i)}}function Of(e,n){const t=this.cache,i=n.elements;if(i===void 0){if(ft(t,n))return;e.uniformMatrix3fv(this.addr,!1,n),dt(t,n)}else{if(ft(t,i))return;La.set(i),e.uniformMatrix3fv(this.addr,!1,La),dt(t,i)}}function Gf(e,n){const t=this.cache,i=n.elements;if(i===void 0){if(ft(t,n))return;e.uniformMatrix4fv(this.addr,!1,n),dt(t,n)}else{if(ft(t,i))return;Pa.set(i),e.uniformMatrix4fv(this.addr,!1,Pa),dt(t,i)}}function Bf(e,n){const t=this.cache;t[0]!==n&&(e.uniform1i(this.addr,n),t[0]=n)}function kf(e,n){const t=this.cache;if(n.x!==void 0)(t[0]!==n.x||t[1]!==n.y)&&(e.uniform2i(this.addr,n.x,n.y),t[0]=n.x,t[1]=n.y);else{if(ft(t,n))return;e.uniform2iv(this.addr,n),dt(t,n)}}function Hf(e,n){const t=this.cache;if(n.x!==void 0)(t[0]!==n.x||t[1]!==n.y||t[2]!==n.z)&&(e.uniform3i(this.addr,n.x,n.y,n.z),t[0]=n.x,t[1]=n.y,t[2]=n.z);else{if(ft(t,n))return;e.uniform3iv(this.addr,n),dt(t,n)}}function Vf(e,n){const t=this.cache;if(n.x!==void 0)(t[0]!==n.x||t[1]!==n.y||t[2]!==n.z||t[3]!==n.w)&&(e.uniform4i(this.addr,n.x,n.y,n.z,n.w),t[0]=n.x,t[1]=n.y,t[2]=n.z,t[3]=n.w);else{if(ft(t,n))return;e.uniform4iv(this.addr,n),dt(t,n)}}function zf(e,n){const t=this.cache;t[0]!==n&&(e.uniform1ui(this.addr,n),t[0]=n)}function Wf(e,n){const t=this.cache;if(n.x!==void 0)(t[0]!==n.x||t[1]!==n.y)&&(e.uniform2ui(this.addr,n.x,n.y),t[0]=n.x,t[1]=n.y);else{if(ft(t,n))return;e.uniform2uiv(this.addr,n),dt(t,n)}}function Xf(e,n){const t=this.cache;if(n.x!==void 0)(t[0]!==n.x||t[1]!==n.y||t[2]!==n.z)&&(e.uniform3ui(this.addr,n.x,n.y,n.z),t[0]=n.x,t[1]=n.y,t[2]=n.z);else{if(ft(t,n))return;e.uniform3uiv(this.addr,n),dt(t,n)}}function qf(e,n){const t=this.cache;if(n.x!==void 0)(t[0]!==n.x||t[1]!==n.y||t[2]!==n.z||t[3]!==n.w)&&(e.uniform4ui(this.addr,n.x,n.y,n.z,n.w),t[0]=n.x,t[1]=n.y,t[2]=n.z,t[3]=n.w);else{if(ft(t,n))return;e.uniform4uiv(this.addr,n),dt(t,n)}}function Kf(e,n,t){const i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(e.uniform1i(this.addr,r),i[0]=r);let a;this.type===e.SAMPLER_2D_SHADOW?(pi.compareFunction=t.isReversedDepthBuffer()?bi:vi,a=pi):a=Cr,t.setTexture2D(n||a,r)}function jf(e,n,t){const i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(e.uniform1i(this.addr,r),i[0]=r),t.setTexture3D(n||Lr,r)}function Yf(e,n,t){const i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(e.uniform1i(this.addr,r),i[0]=r),t.setTextureCube(n||wr,r)}function Jf(e,n,t){const i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(e.uniform1i(this.addr,r),i[0]=r),t.setTexture2DArray(n||Pr,r)}function Zf(e){switch(e){case 5126:return Uf;case 35664:return Nf;case 35665:return If;case 35666:return Ff;case 35674:return yf;case 35675:return Of;case 35676:return Gf;case 5124:case 35670:return Bf;case 35667:case 35671:return kf;case 35668:case 35672:return Hf;case 35669:case 35673:return Vf;case 5125:return zf;case 36294:return Wf;case 36295:return Xf;case 36296:return qf;case 35678:case 36198:case 36298:case 36306:case 35682:return Kf;case 35679:case 36299:case 36307:return jf;case 35680:case 36300:case 36308:case 36293:return Yf;case 36289:case 36303:case 36311:case 36292:return Jf}}function Qf(e,n){e.uniform1fv(this.addr,n)}function $f(e,n){const t=mn(n,this.size,2);e.uniform2fv(this.addr,t)}function ed(e,n){const t=mn(n,this.size,3);e.uniform3fv(this.addr,t)}function td(e,n){const t=mn(n,this.size,4);e.uniform4fv(this.addr,t)}function nd(e,n){const t=mn(n,this.size,4);e.uniformMatrix2fv(this.addr,!1,t)}function id(e,n){const t=mn(n,this.size,9);e.uniformMatrix3fv(this.addr,!1,t)}function ad(e,n){const t=mn(n,this.size,16);e.uniformMatrix4fv(this.addr,!1,t)}function rd(e,n){e.uniform1iv(this.addr,n)}function od(e,n){e.uniform2iv(this.addr,n)}function sd(e,n){e.uniform3iv(this.addr,n)}function cd(e,n){e.uniform4iv(this.addr,n)}function ld(e,n){e.uniform1uiv(this.addr,n)}function fd(e,n){e.uniform2uiv(this.addr,n)}function dd(e,n){e.uniform3uiv(this.addr,n)}function ud(e,n){e.uniform4uiv(this.addr,n)}function pd(e,n,t){const i=this.cache,r=n.length,a=Hn(t,r);ft(i,a)||(e.uniform1iv(this.addr,a),dt(i,a));let o;this.type===e.SAMPLER_2D_SHADOW?o=pi:o=Cr;for(let l=0;l!==r;++l)t.setTexture2D(n[l]||o,a[l])}function hd(e,n,t){const i=this.cache,r=n.length,a=Hn(t,r);ft(i,a)||(e.uniform1iv(this.addr,a),dt(i,a));for(let o=0;o!==r;++o)t.setTexture3D(n[o]||Lr,a[o])}function md(e,n,t){const i=this.cache,r=n.length,a=Hn(t,r);ft(i,a)||(e.uniform1iv(this.addr,a),dt(i,a));for(let o=0;o!==r;++o)t.setTextureCube(n[o]||wr,a[o])}function gd(e,n,t){const i=this.cache,r=n.length,a=Hn(t,r);ft(i,a)||(e.uniform1iv(this.addr,a),dt(i,a));for(let o=0;o!==r;++o)t.setTexture2DArray(n[o]||Pr,a[o])}function _d(e){switch(e){case 5126:return Qf;case 35664:return $f;case 35665:return ed;case 35666:return td;case 35674:return nd;case 35675:return id;case 35676:return ad;case 5124:case 35670:return rd;case 35667:case 35671:return od;case 35668:case 35672:return sd;case 35669:case 35673:return cd;case 5125:return ld;case 36294:return fd;case 36295:return dd;case 36296:return ud;case 35678:case 36198:case 36298:case 36306:case 35682:return pd;case 35679:case 36299:case 36307:return hd;case 35680:case 36300:case 36308:case 36293:return md;case 36289:case 36303:case 36311:case 36292:return gd}}class bd{constructor(n,t,i){this.id=n,this.addr=i,this.cache=[],this.type=t.type,this.setValue=Zf(t.type)}}class vd{constructor(n,t,i){this.id=n,this.addr=i,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=_d(t.type)}}class xd{constructor(n){this.id=n,this.seq=[],this.map={}}setValue(n,t,i){const r=this.seq;for(let a=0,o=r.length;a!==o;++a){const l=r[a];l.setValue(n,t[l.id],i)}}}const ii=/(\w+)(\])?(\[|\.)?/g;function Da(e,n){e.seq.push(n),e.map[n.id]=n}function Ed(e,n,t){const i=e.name,r=i.length;for(ii.lastIndex=0;;){const a=ii.exec(i),o=ii.lastIndex;let l=a[1];const f=a[2]==="]",d=a[3];if(f&&(l=l|0),d===void 0||d==="["&&o+2===r){Da(t,d===void 0?new bd(l,e,n):new vd(l,e,n));break}else{let g=t.map[l];g===void 0&&(g=new xd(l),Da(t,g)),t=g}}}class Fn{constructor(n,t){this.seq=[],this.map={};const i=n.getProgramParameter(t,n.ACTIVE_UNIFORMS);for(let o=0;o<i;++o){const l=n.getActiveUniform(t,o),f=n.getUniformLocation(t,l.name);Ed(l,f,this)}const r=[],a=[];for(const o of this.seq)o.type===n.SAMPLER_2D_SHADOW||o.type===n.SAMPLER_CUBE_SHADOW||o.type===n.SAMPLER_2D_ARRAY_SHADOW?r.push(o):a.push(o);r.length>0&&(this.seq=r.concat(a))}setValue(n,t,i,r){const a=this.map[t];a!==void 0&&a.setValue(n,i,r)}setOptional(n,t,i){const r=t[i];r!==void 0&&this.setValue(n,i,r)}static upload(n,t,i,r){for(let a=0,o=t.length;a!==o;++a){const l=t[a],f=i[l.id];f.needsUpdate!==!1&&l.setValue(n,f.value,r)}}static seqWithValue(n,t){const i=[];for(let r=0,a=n.length;r!==a;++r){const o=n[r];o.id in t&&i.push(o)}return i}}function Ua(e,n,t){const i=e.createShader(n);return e.shaderSource(i,t),e.compileShader(i),i}const Sd=37297;let Td=0;function Md(e,n){const t=e.split(`
`),i=[],r=Math.max(n-6,0),a=Math.min(n+6,t.length);for(let o=r;o<a;o++){const l=o+1;i.push(`${l===n?">":" "} ${l}: ${t[o]}`)}return i.join(`
`)}const Na=new Fe;function Ad(e){Qe._getMatrix(Na,Qe.workingColorSpace,e);const n=`mat3( ${Na.elements.map(t=>t.toFixed(4))} )`;switch(Qe.getTransfer(e)){case _r:return[n,"LinearTransferOETF"];case Je:return[n,"sRGBTransferOETF"];default:return ke("WebGLProgram: Unsupported color space: ",e),[n,"LinearTransferOETF"]}}function Ia(e,n,t){const i=e.getShaderParameter(n,e.COMPILE_STATUS),a=(e.getShaderInfoLog(n)||"").trim();if(i&&a==="")return"";const o=/ERROR: 0:(\d+)/.exec(a);if(o){const l=parseInt(o[1]);return t.toUpperCase()+`

`+a+`

`+Md(e.getShaderSource(n),l)}else return a}function Rd(e,n){const t=Ad(n);return[`vec4 ${e}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}const Cd={[gr]:"Linear",[mr]:"Reinhard",[hr]:"Cineon",[pr]:"ACESFilmic",[ur]:"AgX",[dr]:"Neutral",[fr]:"Custom"};function Pd(e,n){const t=Cd[n];return t===void 0?(ke("WebGLProgram: Unsupported toneMapping:",n),"vec3 "+e+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+e+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}const Dn=new we;function Ld(){Qe.getLuminanceCoefficients(Dn);const e=Dn.x.toFixed(4),n=Dn.y.toFixed(4),t=Dn.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${e}, ${n}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function wd(e){return[e.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",e.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(Sn).join(`
`)}function Dd(e){const n=[];for(const t in e){const i=e[t];i!==!1&&n.push("#define "+t+" "+i)}return n.join(`
`)}function Ud(e,n){const t={},i=e.getProgramParameter(n,e.ACTIVE_ATTRIBUTES);for(let r=0;r<i;r++){const a=e.getActiveAttrib(n,r),o=a.name;let l=1;a.type===e.FLOAT_MAT2&&(l=2),a.type===e.FLOAT_MAT3&&(l=3),a.type===e.FLOAT_MAT4&&(l=4),t[o]={type:a.type,location:e.getAttribLocation(n,o),locationSize:l}}return t}function Sn(e){return e!==""}function Fa(e,n){const t=n.numSpotLightShadows+n.numSpotLightMaps-n.numSpotLightShadowsWithMaps;return e.replace(/NUM_DIR_LIGHTS/g,n.numDirLights).replace(/NUM_SPOT_LIGHTS/g,n.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,n.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,n.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,n.numPointLights).replace(/NUM_HEMI_LIGHTS/g,n.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,n.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,n.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,n.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,n.numPointLightShadows)}function ya(e,n){return e.replace(/NUM_CLIPPING_PLANES/g,n.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,n.numClippingPlanes-n.numClipIntersection)}const Nd=/^[ \t]*#include +<([\w\d./]+)>/gm;function hi(e){return e.replace(Nd,Fd)}const Id=new Map;function Fd(e,n){let t=De[n];if(t===void 0){const i=Id.get(n);if(i!==void 0)t=De[i],ke('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',n,i);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+n+">")}return hi(t)}const yd=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Oa(e){return e.replace(yd,Od)}function Od(e,n,t,i){let r="";for(let a=parseInt(n);a<parseInt(t);a++)r+=i.replace(/\[\s*i\s*\]/g,"[ "+a+" ]").replace(/UNROLLED_LOOP_INDEX/g,a);return r}function Ga(e){let n=`precision ${e.precision} float;
	precision ${e.precision} int;
	precision ${e.precision} sampler2D;
	precision ${e.precision} samplerCube;
	precision ${e.precision} sampler3D;
	precision ${e.precision} sampler2DArray;
	precision ${e.precision} sampler2DShadow;
	precision ${e.precision} samplerCubeShadow;
	precision ${e.precision} sampler2DArrayShadow;
	precision ${e.precision} isampler2D;
	precision ${e.precision} isampler3D;
	precision ${e.precision} isamplerCube;
	precision ${e.precision} isampler2DArray;
	precision ${e.precision} usampler2D;
	precision ${e.precision} usampler3D;
	precision ${e.precision} usamplerCube;
	precision ${e.precision} usampler2DArray;
	`;return e.precision==="highp"?n+=`
#define HIGH_PRECISION`:e.precision==="mediump"?n+=`
#define MEDIUM_PRECISION`:e.precision==="lowp"&&(n+=`
#define LOW_PRECISION`),n}const Gd={[Nn]:"SHADOWMAP_TYPE_PCF",[En]:"SHADOWMAP_TYPE_VSM"};function Bd(e){return Gd[e.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}const kd={[Cn]:"ENVMAP_TYPE_CUBE",[pn]:"ENVMAP_TYPE_CUBE",[Bn]:"ENVMAP_TYPE_CUBE_UV"};function Hd(e){return e.envMap===!1?"ENVMAP_TYPE_CUBE":kd[e.envMapMode]||"ENVMAP_TYPE_CUBE"}const Vd={[pn]:"ENVMAP_MODE_REFRACTION"};function zd(e){return e.envMap===!1?"ENVMAP_MODE_REFLECTION":Vd[e.envMapMode]||"ENVMAP_MODE_REFLECTION"}const Wd={[$o]:"ENVMAP_BLENDING_MULTIPLY",[Qo]:"ENVMAP_BLENDING_MIX",[Zo]:"ENVMAP_BLENDING_ADD"};function Xd(e){return e.envMap===!1?"ENVMAP_BLENDING_NONE":Wd[e.combine]||"ENVMAP_BLENDING_NONE"}function qd(e){const n=e.envMapCubeUVHeight;if(n===null)return null;const t=Math.log2(n)-2,i=1/n;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:i,maxMip:t}}function Kd(e,n,t,i){const r=e.getContext(),a=t.defines;let o=t.vertexShader,l=t.fragmentShader;const f=Bd(t),d=Hd(t),_=zd(t),g=Xd(t),u=qd(t),v=wd(t),A=Dd(a),D=r.createProgram();let h,c,M=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(h=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,A].filter(Sn).join(`
`),h.length>0&&(h+=`
`),c=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,A].filter(Sn).join(`
`),c.length>0&&(c+=`
`)):(h=[Ga(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,A,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+_:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexNormals?"#define HAS_NORMAL":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+f:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(Sn).join(`
`),c=[Ga(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,A,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+d:"",t.envMap?"#define "+_:"",t.envMap?"#define "+g:"",u?"#define CUBEUV_TEXEL_WIDTH "+u.texelWidth:"",u?"#define CUBEUV_TEXEL_HEIGHT "+u.texelHeight:"",u?"#define CUBEUV_MAX_MIP "+u.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas||t.batchingColor?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+f:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==Nt?"#define TONE_MAPPING":"",t.toneMapping!==Nt?De.tonemapping_pars_fragment:"",t.toneMapping!==Nt?Pd("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",De.colorspace_pars_fragment,Rd("linearToOutputTexel",t.outputColorSpace),Ld(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(Sn).join(`
`)),o=hi(o),o=Fa(o,t),o=ya(o,t),l=hi(l),l=Fa(l,t),l=ya(l,t),o=Oa(o),l=Oa(l),t.isRawShaderMaterial!==!0&&(M=`#version 300 es
`,h=[v,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+h,c=["#define varying in",t.glslVersion===ga?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===ga?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+c);const R=M+h+o,b=M+c+l,T=Ua(r,r.VERTEX_SHADER,R),E=Ua(r,r.FRAGMENT_SHADER,b);r.attachShader(D,T),r.attachShader(D,E),t.index0AttributeName!==void 0?r.bindAttribLocation(D,0,t.index0AttributeName):t.hasPositionAttribute===!0&&r.bindAttribLocation(D,0,"position"),r.linkProgram(D);function P(U){if(e.debug.checkShaderErrors){const B=r.getProgramInfoLog(D)||"",J=r.getShaderInfoLog(T)||"",Y=r.getShaderInfoLog(E)||"",z=B.trim(),W=J.trim(),H=Y.trim();let Z=!0,le=!0;if(r.getProgramParameter(D,r.LINK_STATUS)===!1)if(Z=!1,typeof e.debug.onShaderError=="function")e.debug.onShaderError(r,D,T,E);else{const _e=Ia(r,T,"vertex"),be=Ia(r,E,"fragment");Ze("WebGLProgram: Shader Error "+r.getError()+" - VALIDATE_STATUS "+r.getProgramParameter(D,r.VALIDATE_STATUS)+`

Material Name: `+U.name+`
Material Type: `+U.type+`

Program Info Log: `+z+`
`+_e+`
`+be)}else z!==""?ke("WebGLProgram: Program Info Log:",z):(W===""||H==="")&&(le=!1);le&&(U.diagnostics={runnable:Z,programLog:z,vertexShader:{log:W,prefix:h},fragmentShader:{log:H,prefix:c}})}r.deleteShader(T),r.deleteShader(E),m=new Fn(r,D),S=Ud(r,D)}let m;this.getUniforms=function(){return m===void 0&&P(this),m};let S;this.getAttributes=function(){return S===void 0&&P(this),S};let I=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return I===!1&&(I=r.getProgramParameter(D,Sd)),I},this.destroy=function(){i.releaseStatesOfProgram(this),r.deleteProgram(D),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=Td++,this.cacheKey=n,this.usedTimes=1,this.program=D,this.vertexShader=T,this.fragmentShader=E,this}let jd=0;class Yd{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(n,t,i){const r=this._getShaderCacheForMaterial(n);return r.has(t)===!1&&(r.add(t),t.usedTimes++),r.has(i)===!1&&(r.add(i),i.usedTimes++),this}remove(n){const t=this.materialCache.get(n);for(const i of t)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(n),this}getVertexShaderStage(n){return this._getShaderStage(n.vertexShader)}getFragmentShaderStage(n){return this._getShaderStage(n.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(n){const t=this.materialCache;let i=t.get(n);return i===void 0&&(i=new Set,t.set(n,i)),i}_getShaderStage(n){const t=this.shaderCache;let i=t.get(n);return i===void 0&&(i=new Jd(n),t.set(n,i)),i}}class Jd{constructor(n){this.id=jd++,this.code=n,this.usedTimes=0}}function Zd(e){return e===un||e===ci||e===li}function Qd(e,n,t,i,r,a){const o=new jo,l=new Yd,f=new Set,d=[],_=new Map,g=i.logarithmicDepthBuffer;let u=i.precision;const v={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function A(m){return f.add(m),m===0?"uv":`uv${m}`}function D(m,S,I,U,B,J){const Y=U.fog,z=B.geometry,W=m.isMeshStandardMaterial||m.isMeshLambertMaterial||m.isMeshPhongMaterial?U.environment:null,H=m.isMeshStandardMaterial||m.isMeshLambertMaterial&&!m.envMap||m.isMeshPhongMaterial&&!m.envMap,Z=n.get(m.envMap||W,H),le=Z&&Z.mapping===Bn?Z.image.height:null,_e=v[m.type];m.precision!==null&&(u=i.getMaxPrecision(m.precision),u!==m.precision&&ke("WebGLProgram.getParameters:",m.precision,"not supported, using",u,"instead."));const be=z.morphAttributes.position||z.morphAttributes.normal||z.morphAttributes.color,Ee=be!==void 0?be.length:0;let Ke=0;z.morphAttributes.position!==void 0&&(Ke=1),z.morphAttributes.normal!==void 0&&(Ke=2),z.morphAttributes.color!==void 0&&(Ke=3);let ot,Ve,K,te;if(_e){const he=wt[_e];ot=he.vertexShader,Ve=he.fragmentShader}else{ot=m.vertexShader,Ve=m.fragmentShader;const he=l.getVertexShaderStage(m),et=l.getFragmentShaderStage(m);l.update(m,he,et),K=he.id,te=et.id}const Q=e.getRenderTarget(),Re=e.state.buffers.depth.getReversed(),Ce=B.isInstancedMesh===!0,Me=B.isBatchedMesh===!0,nt=!!m.map,Ie=!!m.matcap,We=!!Z,Ge=!!m.aoMap,ye=!!m.lightMap,st=!!m.bumpMap&&m.wireframe===!1,lt=!!m.normalMap,ut=!!m.displacementMap,pt=!!m.emissiveMap,$e=!!m.metalnessMap,ct=!!m.roughnessMap,L=m.anisotropy>0,_t=m.clearcoat>0,He=m.dispersion>0,x=m.iridescence>0,s=m.sheen>0,N=m.transmission>0,O=L&&!!m.anisotropyMap,k=_t&&!!m.clearcoatMap,$=_t&&!!m.clearcoatNormalMap,ne=_t&&!!m.clearcoatRoughnessMap,V=x&&!!m.iridescenceMap,q=x&&!!m.iridescenceThicknessMap,ie=s&&!!m.sheenColorMap,ve=s&&!!m.sheenRoughnessMap,oe=!!m.specularMap,ae=!!m.specularColorMap,Te=!!m.specularIntensityMap,Ae=N&&!!m.transmissionMap,Pe=N&&!!m.thicknessMap,C=!!m.gradientMap,ee=!!m.alphaMap,X=m.alphaTest>0,re=!!m.alphaHash,de=!!m.extensions;let j=Nt;m.toneMapped&&(Q===null||Q.isXRRenderTarget===!0)&&(j=e.toneMapping);const ge={shaderID:_e,shaderType:m.type,shaderName:m.name,vertexShader:ot,fragmentShader:Ve,defines:m.defines,customVertexShaderID:K,customFragmentShaderID:te,isRawShaderMaterial:m.isRawShaderMaterial===!0,glslVersion:m.glslVersion,precision:u,batching:Me,batchingColor:Me&&B._colorsTexture!==null,instancing:Ce,instancingColor:Ce&&B.instanceColor!==null,instancingMorph:Ce&&B.morphTexture!==null,outputColorSpace:Q===null?e.outputColorSpace:Q.isXRRenderTarget===!0?Q.texture.colorSpace:Qe.workingColorSpace,alphaToCoverage:!!m.alphaToCoverage,map:nt,matcap:Ie,envMap:We,envMapMode:We&&Z.mapping,envMapCubeUVHeight:le,aoMap:Ge,lightMap:ye,bumpMap:st,normalMap:lt,displacementMap:ut,emissiveMap:pt,normalMapObjectSpace:lt&&m.normalMapType===Wo,normalMapTangentSpace:lt&&m.normalMapType===ha,packedNormalMap:lt&&m.normalMapType===ha&&Zd(m.normalMap.format),metalnessMap:$e,roughnessMap:ct,anisotropy:L,anisotropyMap:O,clearcoat:_t,clearcoatMap:k,clearcoatNormalMap:$,clearcoatRoughnessMap:ne,dispersion:He,iridescence:x,iridescenceMap:V,iridescenceThicknessMap:q,sheen:s,sheenColorMap:ie,sheenRoughnessMap:ve,specularMap:oe,specularColorMap:ae,specularIntensityMap:Te,transmission:N,transmissionMap:Ae,thicknessMap:Pe,gradientMap:C,opaque:m.transparent===!1&&m.blending===In&&m.alphaToCoverage===!1,alphaMap:ee,alphaTest:X,alphaHash:re,combine:m.combine,mapUv:nt&&A(m.map.channel),aoMapUv:Ge&&A(m.aoMap.channel),lightMapUv:ye&&A(m.lightMap.channel),bumpMapUv:st&&A(m.bumpMap.channel),normalMapUv:lt&&A(m.normalMap.channel),displacementMapUv:ut&&A(m.displacementMap.channel),emissiveMapUv:pt&&A(m.emissiveMap.channel),metalnessMapUv:$e&&A(m.metalnessMap.channel),roughnessMapUv:ct&&A(m.roughnessMap.channel),anisotropyMapUv:O&&A(m.anisotropyMap.channel),clearcoatMapUv:k&&A(m.clearcoatMap.channel),clearcoatNormalMapUv:$&&A(m.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:ne&&A(m.clearcoatRoughnessMap.channel),iridescenceMapUv:V&&A(m.iridescenceMap.channel),iridescenceThicknessMapUv:q&&A(m.iridescenceThicknessMap.channel),sheenColorMapUv:ie&&A(m.sheenColorMap.channel),sheenRoughnessMapUv:ve&&A(m.sheenRoughnessMap.channel),specularMapUv:oe&&A(m.specularMap.channel),specularColorMapUv:ae&&A(m.specularColorMap.channel),specularIntensityMapUv:Te&&A(m.specularIntensityMap.channel),transmissionMapUv:Ae&&A(m.transmissionMap.channel),thicknessMapUv:Pe&&A(m.thicknessMap.channel),alphaMapUv:ee&&A(m.alphaMap.channel),vertexTangents:!!z.attributes.tangent&&(lt||L),vertexNormals:!!z.attributes.normal,vertexColors:m.vertexColors,vertexAlphas:m.vertexColors===!0&&!!z.attributes.color&&z.attributes.color.itemSize===4,pointsUvs:B.isPoints===!0&&!!z.attributes.uv&&(nt||ee),fog:!!Y,useFog:m.fog===!0,fogExp2:!!Y&&Y.isFogExp2,flatShading:m.wireframe===!1&&(m.flatShading===!0||z.attributes.normal===void 0&&lt===!1&&(m.isMeshLambertMaterial||m.isMeshPhongMaterial||m.isMeshStandardMaterial||m.isMeshPhysicalMaterial)),sizeAttenuation:m.sizeAttenuation===!0,logarithmicDepthBuffer:g,reversedDepthBuffer:Re,skinning:B.isSkinnedMesh===!0,hasPositionAttribute:z.attributes.position!==void 0,morphTargets:z.morphAttributes.position!==void 0,morphNormals:z.morphAttributes.normal!==void 0,morphColors:z.morphAttributes.color!==void 0,morphTargetsCount:Ee,morphTextureStride:Ke,numDirLights:S.directional.length,numPointLights:S.point.length,numSpotLights:S.spot.length,numSpotLightMaps:S.spotLightMap.length,numRectAreaLights:S.rectArea.length,numHemiLights:S.hemi.length,numDirLightShadows:S.directionalShadowMap.length,numPointLightShadows:S.pointShadowMap.length,numSpotLightShadows:S.spotShadowMap.length,numSpotLightShadowsWithMaps:S.numSpotLightShadowsWithMaps,numLightProbes:S.numLightProbes,numLightProbeGrids:J.length,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:m.dithering,shadowMapEnabled:e.shadowMap.enabled&&I.length>0,shadowMapType:e.shadowMap.type,toneMapping:j,decodeVideoTexture:nt&&m.map.isVideoTexture===!0&&Qe.getTransfer(m.map.colorSpace)===Je,decodeVideoTextureEmissive:pt&&m.emissiveMap.isVideoTexture===!0&&Qe.getTransfer(m.emissiveMap.colorSpace)===Je,premultipliedAlpha:m.premultipliedAlpha,doubleSided:m.side===Ut,flipSided:m.side===Et,useDepthPacking:m.depthPacking>=0,depthPacking:m.depthPacking||0,index0AttributeName:m.index0AttributeName,extensionClipCullDistance:de&&m.extensions.clipCullDistance===!0&&t.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(de&&m.extensions.multiDraw===!0||Me)&&t.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:t.has("KHR_parallel_shader_compile"),customProgramCacheKey:m.customProgramCacheKey()};return ge.vertexUv1s=f.has(1),ge.vertexUv2s=f.has(2),ge.vertexUv3s=f.has(3),f.clear(),ge}function h(m){const S=[];if(m.shaderID?S.push(m.shaderID):(S.push(m.customVertexShaderID),S.push(m.customFragmentShaderID)),m.defines!==void 0)for(const I in m.defines)S.push(I),S.push(m.defines[I]);return m.isRawShaderMaterial===!1&&(c(S,m),M(S,m),S.push(e.outputColorSpace)),S.push(m.customProgramCacheKey),S.join()}function c(m,S){m.push(S.precision),m.push(S.outputColorSpace),m.push(S.envMapMode),m.push(S.envMapCubeUVHeight),m.push(S.mapUv),m.push(S.alphaMapUv),m.push(S.lightMapUv),m.push(S.aoMapUv),m.push(S.bumpMapUv),m.push(S.normalMapUv),m.push(S.displacementMapUv),m.push(S.emissiveMapUv),m.push(S.metalnessMapUv),m.push(S.roughnessMapUv),m.push(S.anisotropyMapUv),m.push(S.clearcoatMapUv),m.push(S.clearcoatNormalMapUv),m.push(S.clearcoatRoughnessMapUv),m.push(S.iridescenceMapUv),m.push(S.iridescenceThicknessMapUv),m.push(S.sheenColorMapUv),m.push(S.sheenRoughnessMapUv),m.push(S.specularMapUv),m.push(S.specularColorMapUv),m.push(S.specularIntensityMapUv),m.push(S.transmissionMapUv),m.push(S.thicknessMapUv),m.push(S.combine),m.push(S.fogExp2),m.push(S.sizeAttenuation),m.push(S.morphTargetsCount),m.push(S.morphAttributeCount),m.push(S.numDirLights),m.push(S.numPointLights),m.push(S.numSpotLights),m.push(S.numSpotLightMaps),m.push(S.numHemiLights),m.push(S.numRectAreaLights),m.push(S.numDirLightShadows),m.push(S.numPointLightShadows),m.push(S.numSpotLightShadows),m.push(S.numSpotLightShadowsWithMaps),m.push(S.numLightProbes),m.push(S.shadowMapType),m.push(S.toneMapping),m.push(S.numClippingPlanes),m.push(S.numClipIntersection),m.push(S.depthPacking)}function M(m,S){o.disableAll(),S.instancing&&o.enable(0),S.instancingColor&&o.enable(1),S.instancingMorph&&o.enable(2),S.matcap&&o.enable(3),S.envMap&&o.enable(4),S.normalMapObjectSpace&&o.enable(5),S.normalMapTangentSpace&&o.enable(6),S.clearcoat&&o.enable(7),S.iridescence&&o.enable(8),S.alphaTest&&o.enable(9),S.vertexColors&&o.enable(10),S.vertexAlphas&&o.enable(11),S.vertexUv1s&&o.enable(12),S.vertexUv2s&&o.enable(13),S.vertexUv3s&&o.enable(14),S.vertexTangents&&o.enable(15),S.anisotropy&&o.enable(16),S.alphaHash&&o.enable(17),S.batching&&o.enable(18),S.dispersion&&o.enable(19),S.batchingColor&&o.enable(20),S.gradientMap&&o.enable(21),S.packedNormalMap&&o.enable(22),S.vertexNormals&&o.enable(23),m.push(o.mask),o.disableAll(),S.fog&&o.enable(0),S.useFog&&o.enable(1),S.flatShading&&o.enable(2),S.logarithmicDepthBuffer&&o.enable(3),S.reversedDepthBuffer&&o.enable(4),S.skinning&&o.enable(5),S.morphTargets&&o.enable(6),S.morphNormals&&o.enable(7),S.morphColors&&o.enable(8),S.premultipliedAlpha&&o.enable(9),S.shadowMapEnabled&&o.enable(10),S.doubleSided&&o.enable(11),S.flipSided&&o.enable(12),S.useDepthPacking&&o.enable(13),S.dithering&&o.enable(14),S.transmission&&o.enable(15),S.sheen&&o.enable(16),S.opaque&&o.enable(17),S.pointsUvs&&o.enable(18),S.decodeVideoTexture&&o.enable(19),S.decodeVideoTextureEmissive&&o.enable(20),S.alphaToCoverage&&o.enable(21),S.numLightProbeGrids>0&&o.enable(22),S.hasPositionAttribute&&o.enable(23),m.push(o.mask)}function R(m){const S=v[m.type];let I;if(S){const U=wt[S];I=zo.clone(U.uniforms)}else I=m.uniforms;return I}function b(m,S){let I=_.get(S);return I!==void 0?++I.usedTimes:(I=new Kd(e,S,m,r),d.push(I),_.set(S,I)),I}function T(m){if(--m.usedTimes===0){const S=d.indexOf(m);d[S]=d[d.length-1],d.pop(),_.delete(m.cacheKey),m.destroy()}}function E(m){l.remove(m)}function P(){l.dispose()}return{getParameters:D,getProgramCacheKey:h,getUniforms:R,acquireProgram:b,releaseProgram:T,releaseShaderCache:E,programs:d,dispose:P}}function $d(){let e=new WeakMap;function n(o){return e.has(o)}function t(o){let l=e.get(o);return l===void 0&&(l={},e.set(o,l)),l}function i(o){e.delete(o)}function r(o,l,f){e.get(o)[l]=f}function a(){e=new WeakMap}return{has:n,get:t,remove:i,update:r,dispose:a}}function eu(e,n){return e.groupOrder!==n.groupOrder?e.groupOrder-n.groupOrder:e.renderOrder!==n.renderOrder?e.renderOrder-n.renderOrder:e.material.id!==n.material.id?e.material.id-n.material.id:e.materialVariant!==n.materialVariant?e.materialVariant-n.materialVariant:e.z!==n.z?e.z-n.z:e.id-n.id}function Ba(e,n){return e.groupOrder!==n.groupOrder?e.groupOrder-n.groupOrder:e.renderOrder!==n.renderOrder?e.renderOrder-n.renderOrder:e.z!==n.z?n.z-e.z:e.id-n.id}function ka(){const e=[];let n=0;const t=[],i=[],r=[];function a(){n=0,t.length=0,i.length=0,r.length=0}function o(u){let v=0;return u.isInstancedMesh&&(v+=2),u.isSkinnedMesh&&(v+=1),v}function l(u,v,A,D,h,c){let M=e[n];return M===void 0?(M={id:u.id,object:u,geometry:v,material:A,materialVariant:o(u),groupOrder:D,renderOrder:u.renderOrder,z:h,group:c},e[n]=M):(M.id=u.id,M.object=u,M.geometry=v,M.material=A,M.materialVariant=o(u),M.groupOrder=D,M.renderOrder=u.renderOrder,M.z=h,M.group=c),n++,M}function f(u,v,A,D,h,c){const M=l(u,v,A,D,h,c);A.transmission>0?i.push(M):A.transparent===!0?r.push(M):t.push(M)}function d(u,v,A,D,h,c){const M=l(u,v,A,D,h,c);A.transmission>0?i.unshift(M):A.transparent===!0?r.unshift(M):t.unshift(M)}function _(u,v,A){t.length>1&&t.sort(u||eu),i.length>1&&i.sort(v||Ba),r.length>1&&r.sort(v||Ba),A&&(t.reverse(),i.reverse(),r.reverse())}function g(){for(let u=n,v=e.length;u<v;u++){const A=e[u];if(A.id===null)break;A.id=null,A.object=null,A.geometry=null,A.material=null,A.group=null}}return{opaque:t,transmissive:i,transparent:r,init:a,push:f,unshift:d,finish:g,sort:_}}function tu(){let e=new WeakMap;function n(i,r){const a=e.get(i);let o;return a===void 0?(o=new ka,e.set(i,[o])):r>=a.length?(o=new ka,a.push(o)):o=a[r],o}function t(){e=new WeakMap}return{get:n,dispose:t}}function nu(){const e={};return{get:function(n){if(e[n.id]!==void 0)return e[n.id];let t;switch(n.type){case"DirectionalLight":t={direction:new we,color:new Be};break;case"SpotLight":t={position:new we,direction:new we,color:new Be,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new we,color:new Be,distance:0,decay:0};break;case"HemisphereLight":t={direction:new we,skyColor:new Be,groundColor:new Be};break;case"RectAreaLight":t={color:new Be,position:new we,halfWidth:new we,halfHeight:new we};break}return e[n.id]=t,t}}}function iu(){const e={};return{get:function(n){if(e[n.id]!==void 0)return e[n.id];let t;switch(n.type){case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new gt};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new gt};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new gt,shadowCameraNear:1,shadowCameraFar:1e3};break}return e[n.id]=t,t}}}let au=0;function ru(e,n){return(n.castShadow?2:0)-(e.castShadow?2:0)+(n.map?1:0)-(e.map?1:0)}function ou(e){const n=new nu,t=iu(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let d=0;d<9;d++)i.probe.push(new we);const r=new we,a=new Ft,o=new Ft;function l(d){let _=0,g=0,u=0;for(let S=0;S<9;S++)i.probe[S].set(0,0,0);let v=0,A=0,D=0,h=0,c=0,M=0,R=0,b=0,T=0,E=0,P=0;d.sort(ru);for(let S=0,I=d.length;S<I;S++){const U=d[S],B=U.color,J=U.intensity,Y=U.distance;let z=null;if(U.shadow&&U.shadow.map&&(U.shadow.map.texture.format===un?z=U.shadow.map.texture:z=U.shadow.map.depthTexture||U.shadow.map.texture),U.isAmbientLight)_+=B.r*J,g+=B.g*J,u+=B.b*J;else if(U.isLightProbe){for(let W=0;W<9;W++)i.probe[W].addScaledVector(U.sh.coefficients[W],J);P++}else if(U.isDirectionalLight){const W=n.get(U);if(W.color.copy(U.color).multiplyScalar(U.intensity),U.castShadow){const H=U.shadow,Z=t.get(U);Z.shadowIntensity=H.intensity,Z.shadowBias=H.bias,Z.shadowNormalBias=H.normalBias,Z.shadowRadius=H.radius,Z.shadowMapSize=H.mapSize,i.directionalShadow[v]=Z,i.directionalShadowMap[v]=z,i.directionalShadowMatrix[v]=U.shadow.matrix,M++}i.directional[v]=W,v++}else if(U.isSpotLight){const W=n.get(U);W.position.setFromMatrixPosition(U.matrixWorld),W.color.copy(B).multiplyScalar(J),W.distance=Y,W.coneCos=Math.cos(U.angle),W.penumbraCos=Math.cos(U.angle*(1-U.penumbra)),W.decay=U.decay,i.spot[D]=W;const H=U.shadow;if(U.map&&(i.spotLightMap[T]=U.map,T++,H.updateMatrices(U),U.castShadow&&E++),i.spotLightMatrix[D]=H.matrix,U.castShadow){const Z=t.get(U);Z.shadowIntensity=H.intensity,Z.shadowBias=H.bias,Z.shadowNormalBias=H.normalBias,Z.shadowRadius=H.radius,Z.shadowMapSize=H.mapSize,i.spotShadow[D]=Z,i.spotShadowMap[D]=z,b++}D++}else if(U.isRectAreaLight){const W=n.get(U);W.color.copy(B).multiplyScalar(J),W.halfWidth.set(U.width*.5,0,0),W.halfHeight.set(0,U.height*.5,0),i.rectArea[h]=W,h++}else if(U.isPointLight){const W=n.get(U);if(W.color.copy(U.color).multiplyScalar(U.intensity),W.distance=U.distance,W.decay=U.decay,U.castShadow){const H=U.shadow,Z=t.get(U);Z.shadowIntensity=H.intensity,Z.shadowBias=H.bias,Z.shadowNormalBias=H.normalBias,Z.shadowRadius=H.radius,Z.shadowMapSize=H.mapSize,Z.shadowCameraNear=H.camera.near,Z.shadowCameraFar=H.camera.far,i.pointShadow[A]=Z,i.pointShadowMap[A]=z,i.pointShadowMatrix[A]=U.shadow.matrix,R++}i.point[A]=W,A++}else if(U.isHemisphereLight){const W=n.get(U);W.skyColor.copy(U.color).multiplyScalar(J),W.groundColor.copy(U.groundColor).multiplyScalar(J),i.hemi[c]=W,c++}}h>0&&(e.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=se.LTC_FLOAT_1,i.rectAreaLTC2=se.LTC_FLOAT_2):(i.rectAreaLTC1=se.LTC_HALF_1,i.rectAreaLTC2=se.LTC_HALF_2)),i.ambient[0]=_,i.ambient[1]=g,i.ambient[2]=u;const m=i.hash;(m.directionalLength!==v||m.pointLength!==A||m.spotLength!==D||m.rectAreaLength!==h||m.hemiLength!==c||m.numDirectionalShadows!==M||m.numPointShadows!==R||m.numSpotShadows!==b||m.numSpotMaps!==T||m.numLightProbes!==P)&&(i.directional.length=v,i.spot.length=D,i.rectArea.length=h,i.point.length=A,i.hemi.length=c,i.directionalShadow.length=M,i.directionalShadowMap.length=M,i.pointShadow.length=R,i.pointShadowMap.length=R,i.spotShadow.length=b,i.spotShadowMap.length=b,i.directionalShadowMatrix.length=M,i.pointShadowMatrix.length=R,i.spotLightMatrix.length=b+T-E,i.spotLightMap.length=T,i.numSpotLightShadowsWithMaps=E,i.numLightProbes=P,m.directionalLength=v,m.pointLength=A,m.spotLength=D,m.rectAreaLength=h,m.hemiLength=c,m.numDirectionalShadows=M,m.numPointShadows=R,m.numSpotShadows=b,m.numSpotMaps=T,m.numLightProbes=P,i.version=au++)}function f(d,_){let g=0,u=0,v=0,A=0,D=0;const h=_.matrixWorldInverse;for(let c=0,M=d.length;c<M;c++){const R=d[c];if(R.isDirectionalLight){const b=i.directional[g];b.direction.setFromMatrixPosition(R.matrixWorld),r.setFromMatrixPosition(R.target.matrixWorld),b.direction.sub(r),b.direction.transformDirection(h),g++}else if(R.isSpotLight){const b=i.spot[v];b.position.setFromMatrixPosition(R.matrixWorld),b.position.applyMatrix4(h),b.direction.setFromMatrixPosition(R.matrixWorld),r.setFromMatrixPosition(R.target.matrixWorld),b.direction.sub(r),b.direction.transformDirection(h),v++}else if(R.isRectAreaLight){const b=i.rectArea[A];b.position.setFromMatrixPosition(R.matrixWorld),b.position.applyMatrix4(h),o.identity(),a.copy(R.matrixWorld),a.premultiply(h),o.extractRotation(a),b.halfWidth.set(R.width*.5,0,0),b.halfHeight.set(0,R.height*.5,0),b.halfWidth.applyMatrix4(o),b.halfHeight.applyMatrix4(o),A++}else if(R.isPointLight){const b=i.point[u];b.position.setFromMatrixPosition(R.matrixWorld),b.position.applyMatrix4(h),u++}else if(R.isHemisphereLight){const b=i.hemi[D];b.direction.setFromMatrixPosition(R.matrixWorld),b.direction.transformDirection(h),D++}}}return{setup:l,setupView:f,state:i}}function Ha(e){const n=new ou(e),t=[],i=[],r=[];function a(u){g.camera=u,t.length=0,i.length=0,r.length=0}function o(u){t.push(u)}function l(u){i.push(u)}function f(u){r.push(u)}function d(){n.setup(t)}function _(u){n.setupView(t,u)}const g={lightsArray:t,shadowsArray:i,lightProbeGridArray:r,camera:null,lights:n,transmissionRenderTarget:{},textureUnits:0};return{init:a,state:g,setupLights:d,setupLightsView:_,pushLight:o,pushShadow:l,pushLightProbeGrid:f}}function su(e){let n=new WeakMap;function t(r,a=0){const o=n.get(r);let l;return o===void 0?(l=new Ha(e),n.set(r,[l])):a>=o.length?(l=new Ha(e),o.push(l)):l=o[a],l}function i(){n=new WeakMap}return{get:t,dispose:i}}const cu=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,lu=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,fu=[new we(1,0,0),new we(-1,0,0),new we(0,1,0),new we(0,-1,0),new we(0,0,1),new we(0,0,-1)],du=[new we(0,-1,0),new we(0,-1,0),new we(0,0,1),new we(0,0,-1),new we(0,-1,0),new we(0,-1,0)],Va=new Ft,bn=new we,ai=new we;function uu(e,n,t){let i=new Ja;const r=new gt,a=new gt,o=new vt,l=new So,f=new To,d={},_=t.maxTextureSize,g={[fn]:Et,[Et]:fn,[Ut]:Ut},u=new Ht({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new gt},radius:{value:4}},vertexShader:cu,fragmentShader:lu}),v=u.clone();v.defines.HORIZONTAL_PASS=1;const A=new hn;A.setAttribute("position",new Yt(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const D=new yt(A,u),h=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Nn;let c=this.type;this.render=function(E,P,m){if(h.enabled===!1||h.autoUpdate===!1&&h.needsUpdate===!1||E.length===0)return;this.type===Mo&&(ke("WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead."),this.type=Nn);const S=e.getRenderTarget(),I=e.getActiveCubeFace(),U=e.getActiveMipmapLevel(),B=e.state;B.setBlending(kt),B.buffers.depth.getReversed()===!0?B.buffers.color.setClear(0,0,0,0):B.buffers.color.setClear(1,1,1,1),B.buffers.depth.setTest(!0),B.setScissorTest(!1);const J=c!==this.type;J&&P.traverse(function(Y){Y.material&&(Array.isArray(Y.material)?Y.material.forEach(z=>z.needsUpdate=!0):Y.material.needsUpdate=!0)});for(let Y=0,z=E.length;Y<z;Y++){const W=E[Y],H=W.shadow;if(H===void 0){ke("WebGLShadowMap:",W,"has no shadow.");continue}if(H.autoUpdate===!1&&H.needsUpdate===!1)continue;r.copy(H.mapSize);const Z=H.getFrameExtents();r.multiply(Z),a.copy(H.mapSize),(r.x>_||r.y>_)&&(r.x>_&&(a.x=Math.floor(_/Z.x),r.x=a.x*Z.x,H.mapSize.x=a.x),r.y>_&&(a.y=Math.floor(_/Z.y),r.y=a.y*Z.y,H.mapSize.y=a.y));const le=e.state.buffers.depth.getReversed();if(H.camera._reversedDepth=le,H.map===null||J===!0){if(H.map!==null&&(H.map.depthTexture!==null&&(H.map.depthTexture.dispose(),H.map.depthTexture=null),H.map.dispose()),this.type===En){if(W.isPointLight){ke("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}H.map=new It(r.x,r.y,{format:un,type:Jt,minFilter:mt,magFilter:mt,generateMipmaps:!1}),H.map.texture.name=W.name+".shadowMap",H.map.depthTexture=new An(r.x,r.y,Kt),H.map.depthTexture.name=W.name+".shadowMapDepth",H.map.depthTexture.format=dn,H.map.depthTexture.compareFunction=null,H.map.depthTexture.minFilter=Bt,H.map.depthTexture.magFilter=Bt}else W.isPointLight?(H.map=new Rr(r.x),H.map.depthTexture=new Ao(r.x,en)):(H.map=new It(r.x,r.y),H.map.depthTexture=new An(r.x,r.y,en)),H.map.depthTexture.name=W.name+".shadowMap",H.map.depthTexture.format=dn,this.type===Nn?(H.map.depthTexture.compareFunction=le?bi:vi,H.map.depthTexture.minFilter=mt,H.map.depthTexture.magFilter=mt):(H.map.depthTexture.compareFunction=null,H.map.depthTexture.minFilter=Bt,H.map.depthTexture.magFilter=Bt);H.camera.updateProjectionMatrix()}const _e=H.map.isWebGLCubeRenderTarget?6:1;for(let be=0;be<_e;be++){if(H.map.isWebGLCubeRenderTarget)e.setRenderTarget(H.map,be),e.clear();else{be===0&&(e.setRenderTarget(H.map),e.clear());const Ee=H.getViewport(be);o.set(a.x*Ee.x,a.y*Ee.y,a.x*Ee.z,a.y*Ee.w),B.viewport(o)}if(W.isPointLight){const Ee=H.camera,Ke=H.matrix,ot=W.distance||Ee.far;ot!==Ee.far&&(Ee.far=ot,Ee.updateProjectionMatrix()),bn.setFromMatrixPosition(W.matrixWorld),Ee.position.copy(bn),ai.copy(Ee.position),ai.add(fu[be]),Ee.up.copy(du[be]),Ee.lookAt(ai),Ee.updateMatrixWorld(),Ke.makeTranslation(-bn.x,-bn.y,-bn.z),Va.multiplyMatrices(Ee.projectionMatrix,Ee.matrixWorldInverse),H._frustum.setFromProjectionMatrix(Va,Ee.coordinateSystem,Ee.reversedDepth)}else H.updateMatrices(W);i=H.getFrustum(),b(P,m,H.camera,W,this.type)}H.isPointLightShadow!==!0&&this.type===En&&M(H,m),H.needsUpdate=!1}c=this.type,h.needsUpdate=!1,e.setRenderTarget(S,I,U)};function M(E,P){const m=n.update(D);u.defines.VSM_SAMPLES!==E.blurSamples&&(u.defines.VSM_SAMPLES=E.blurSamples,v.defines.VSM_SAMPLES=E.blurSamples,u.needsUpdate=!0,v.needsUpdate=!0),E.mapPass===null&&(E.mapPass=new It(r.x,r.y,{format:un,type:Jt})),u.uniforms.shadow_pass.value=E.map.depthTexture,u.uniforms.resolution.value=E.mapSize,u.uniforms.radius.value=E.radius,e.setRenderTarget(E.mapPass),e.clear(),e.renderBufferDirect(P,null,m,u,D,null),v.uniforms.shadow_pass.value=E.mapPass.texture,v.uniforms.resolution.value=E.mapSize,v.uniforms.radius.value=E.radius,e.setRenderTarget(E.map),e.clear(),e.renderBufferDirect(P,null,m,v,D,null)}function R(E,P,m,S){let I=null;const U=m.isPointLight===!0?E.customDistanceMaterial:E.customDepthMaterial;if(U!==void 0)I=U;else if(I=m.isPointLight===!0?f:l,e.localClippingEnabled&&P.clipShadows===!0&&Array.isArray(P.clippingPlanes)&&P.clippingPlanes.length!==0||P.displacementMap&&P.displacementScale!==0||P.alphaMap&&P.alphaTest>0||P.map&&P.alphaTest>0||P.alphaToCoverage===!0){const B=I.uuid,J=P.uuid;let Y=d[B];Y===void 0&&(Y={},d[B]=Y);let z=Y[J];z===void 0&&(z=I.clone(),Y[J]=z,P.addEventListener("dispose",T)),I=z}if(I.visible=P.visible,I.wireframe=P.wireframe,S===En?I.side=P.shadowSide!==null?P.shadowSide:P.side:I.side=P.shadowSide!==null?P.shadowSide:g[P.side],I.alphaMap=P.alphaMap,I.alphaTest=P.alphaToCoverage===!0?.5:P.alphaTest,I.map=P.map,I.clipShadows=P.clipShadows,I.clippingPlanes=P.clippingPlanes,I.clipIntersection=P.clipIntersection,I.displacementMap=P.displacementMap,I.displacementScale=P.displacementScale,I.displacementBias=P.displacementBias,I.wireframeLinewidth=P.wireframeLinewidth,I.linewidth=P.linewidth,m.isPointLight===!0&&I.isMeshDistanceMaterial===!0){const B=e.properties.get(I);B.light=m}return I}function b(E,P,m,S,I){if(E.visible===!1)return;if(E.layers.test(P.layers)&&(E.isMesh||E.isLine||E.isPoints)&&(E.castShadow||E.receiveShadow&&I===En)&&(!E.frustumCulled||i.intersectsObject(E))){E.modelViewMatrix.multiplyMatrices(m.matrixWorldInverse,E.matrixWorld);const J=n.update(E),Y=E.material;if(Array.isArray(Y)){const z=J.groups;for(let W=0,H=z.length;W<H;W++){const Z=z[W],le=Y[Z.materialIndex];if(le&&le.visible){const _e=R(E,le,S,I);E.onBeforeShadow(e,E,P,m,J,_e,Z),e.renderBufferDirect(m,null,J,_e,E,Z),E.onAfterShadow(e,E,P,m,J,_e,Z)}}}else if(Y.visible){const z=R(E,Y,S,I);E.onBeforeShadow(e,E,P,m,J,z,null),e.renderBufferDirect(m,null,J,z,E,null),E.onAfterShadow(e,E,P,m,J,z,null)}}const B=E.children;for(let J=0,Y=B.length;J<Y;J++)b(B[J],P,m,S,I)}function T(E){E.target.removeEventListener("dispose",T);for(const m in d){const S=d[m],I=E.target.uuid;I in S&&(S[I].dispose(),delete S[I])}}}function pu(e,n){function t(){let C=!1;const ee=new vt;let X=null;const re=new vt(0,0,0,0);return{setMask:function(de){X!==de&&!C&&(e.colorMask(de,de,de,de),X=de)},setLocked:function(de){C=de},setClear:function(de,j,ge,he,et){et===!0&&(de*=he,j*=he,ge*=he),ee.set(de,j,ge,he),re.equals(ee)===!1&&(e.clearColor(de,j,ge,he),re.copy(ee))},reset:function(){C=!1,X=null,re.set(-1,0,0,0)}}}function i(){let C=!1,ee=!1,X=null,re=null,de=null;return{setReversed:function(j){if(ee!==j){const ge=n.get("EXT_clip_control");j?ge.clipControlEXT(ge.LOWER_LEFT_EXT,ge.ZERO_TO_ONE_EXT):ge.clipControlEXT(ge.LOWER_LEFT_EXT,ge.NEGATIVE_ONE_TO_ONE_EXT),ee=j;const he=de;de=null,this.setClear(he)}},getReversed:function(){return ee},setTest:function(j){j?Q(e.DEPTH_TEST):Re(e.DEPTH_TEST)},setMask:function(j){X!==j&&!C&&(e.depthMask(j),X=j)},setFunc:function(j){if(ee&&(j=es[j]),re!==j){switch(j){case Bo:e.depthFunc(e.NEVER);break;case Go:e.depthFunc(e.ALWAYS);break;case Oo:e.depthFunc(e.LESS);break;case Ni:e.depthFunc(e.LEQUAL);break;case yo:e.depthFunc(e.EQUAL);break;case Fo:e.depthFunc(e.GEQUAL);break;case Io:e.depthFunc(e.GREATER);break;case No:e.depthFunc(e.NOTEQUAL);break;default:e.depthFunc(e.LEQUAL)}re=j}},setLocked:function(j){C=j},setClear:function(j){de!==j&&(de=j,ee&&(j=1-j),e.clearDepth(j))},reset:function(){C=!1,X=null,re=null,de=null,ee=!1}}}function r(){let C=!1,ee=null,X=null,re=null,de=null,j=null,ge=null,he=null,et=null;return{setTest:function(je){C||(je?Q(e.STENCIL_TEST):Re(e.STENCIL_TEST))},setMask:function(je){ee!==je&&!C&&(e.stencilMask(je),ee=je)},setFunc:function(je,At,Rt){(X!==je||re!==At||de!==Rt)&&(e.stencilFunc(je,At,Rt),X=je,re=At,de=Rt)},setOp:function(je,At,Rt){(j!==je||ge!==At||he!==Rt)&&(e.stencilOp(je,At,Rt),j=je,ge=At,he=Rt)},setLocked:function(je){C=je},setClear:function(je){et!==je&&(e.clearStencil(je),et=je)},reset:function(){C=!1,ee=null,X=null,re=null,de=null,j=null,ge=null,he=null,et=null}}}const a=new t,o=new i,l=new r,f=new WeakMap,d=new WeakMap;let _={},g={},u={},v=new WeakMap,A=[],D=null,h=!1,c=null,M=null,R=null,b=null,T=null,E=null,P=null,m=new Be(0,0,0),S=0,I=!1,U=null,B=null,J=null,Y=null,z=null;const W=e.getParameter(e.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let H=!1,Z=0;const le=e.getParameter(e.VERSION);le.indexOf("WebGL")!==-1?(Z=parseFloat(/^WebGL (\d)/.exec(le)[1]),H=Z>=1):le.indexOf("OpenGL ES")!==-1&&(Z=parseFloat(/^OpenGL ES (\d)/.exec(le)[1]),H=Z>=2);let _e=null,be={};const Ee=e.getParameter(e.SCISSOR_BOX),Ke=e.getParameter(e.VIEWPORT),ot=new vt().fromArray(Ee),Ve=new vt().fromArray(Ke);function K(C,ee,X,re){const de=new Uint8Array(4),j=e.createTexture();e.bindTexture(C,j),e.texParameteri(C,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(C,e.TEXTURE_MAG_FILTER,e.NEAREST);for(let ge=0;ge<X;ge++)C===e.TEXTURE_3D||C===e.TEXTURE_2D_ARRAY?e.texImage3D(ee,0,e.RGBA,1,1,re,0,e.RGBA,e.UNSIGNED_BYTE,de):e.texImage2D(ee+ge,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,de);return j}const te={};te[e.TEXTURE_2D]=K(e.TEXTURE_2D,e.TEXTURE_2D,1),te[e.TEXTURE_CUBE_MAP]=K(e.TEXTURE_CUBE_MAP,e.TEXTURE_CUBE_MAP_POSITIVE_X,6),te[e.TEXTURE_2D_ARRAY]=K(e.TEXTURE_2D_ARRAY,e.TEXTURE_2D_ARRAY,1,1),te[e.TEXTURE_3D]=K(e.TEXTURE_3D,e.TEXTURE_3D,1,1),a.setClear(0,0,0,1),o.setClear(1),l.setClear(0),Q(e.DEPTH_TEST),o.setFunc(Ni),st(!1),lt(fa),Q(e.CULL_FACE),Ge(kt);function Q(C){_[C]!==!0&&(e.enable(C),_[C]=!0)}function Re(C){_[C]!==!1&&(e.disable(C),_[C]=!1)}function Ce(C,ee){return u[C]!==ee?(e.bindFramebuffer(C,ee),u[C]=ee,C===e.DRAW_FRAMEBUFFER&&(u[e.FRAMEBUFFER]=ee),C===e.FRAMEBUFFER&&(u[e.DRAW_FRAMEBUFFER]=ee),!0):!1}function Me(C,ee){let X=A,re=!1;if(C){X=v.get(ee),X===void 0&&(X=[],v.set(ee,X));const de=C.textures;if(X.length!==de.length||X[0]!==e.COLOR_ATTACHMENT0){for(let j=0,ge=de.length;j<ge;j++)X[j]=e.COLOR_ATTACHMENT0+j;X.length=de.length,re=!0}}else X[0]!==e.BACK&&(X[0]=e.BACK,re=!0);re&&e.drawBuffers(X)}function nt(C){return D!==C?(e.useProgram(C),D=C,!0):!1}const Ie={[gn]:e.FUNC_ADD,[Qr]:e.FUNC_SUBTRACT,[Zr]:e.FUNC_REVERSE_SUBTRACT};Ie[ts]=e.MIN,Ie[ns]=e.MAX;const We={[ho]:e.ZERO,[po]:e.ONE,[uo]:e.SRC_COLOR,[fo]:e.SRC_ALPHA,[lo]:e.SRC_ALPHA_SATURATE,[co]:e.DST_COLOR,[so]:e.DST_ALPHA,[oo]:e.ONE_MINUS_SRC_COLOR,[ro]:e.ONE_MINUS_SRC_ALPHA,[ao]:e.ONE_MINUS_DST_COLOR,[io]:e.ONE_MINUS_DST_ALPHA,[no]:e.CONSTANT_COLOR,[to]:e.ONE_MINUS_CONSTANT_COLOR,[eo]:e.CONSTANT_ALPHA,[$r]:e.ONE_MINUS_CONSTANT_ALPHA};function Ge(C,ee,X,re,de,j,ge,he,et,je){if(C===kt){h===!0&&(Re(e.BLEND),h=!1);return}if(h===!1&&(Q(e.BLEND),h=!0),C!==Vo){if(C!==c||je!==I){if((M!==gn||T!==gn)&&(e.blendEquation(e.FUNC_ADD),M=gn,T=gn),je)switch(C){case In:e.blendFuncSeparate(e.ONE,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case pa:e.blendFunc(e.ONE,e.ONE);break;case ua:e.blendFuncSeparate(e.ZERO,e.ONE_MINUS_SRC_COLOR,e.ZERO,e.ONE);break;case da:e.blendFuncSeparate(e.DST_COLOR,e.ONE_MINUS_SRC_ALPHA,e.ZERO,e.ONE);break;default:Ze("WebGLState: Invalid blending: ",C);break}else switch(C){case In:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case pa:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE,e.ONE,e.ONE);break;case ua:Ze("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case da:Ze("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Ze("WebGLState: Invalid blending: ",C);break}R=null,b=null,E=null,P=null,m.set(0,0,0),S=0,c=C,I=je}return}de=de||ee,j=j||X,ge=ge||re,(ee!==M||de!==T)&&(e.blendEquationSeparate(Ie[ee],Ie[de]),M=ee,T=de),(X!==R||re!==b||j!==E||ge!==P)&&(e.blendFuncSeparate(We[X],We[re],We[j],We[ge]),R=X,b=re,E=j,P=ge),(he.equals(m)===!1||et!==S)&&(e.blendColor(he.r,he.g,he.b,et),m.copy(he),S=et),c=C,I=!1}function ye(C,ee){C.side===Ut?Re(e.CULL_FACE):Q(e.CULL_FACE);let X=C.side===Et;ee&&(X=!X),st(X),C.blending===In&&C.transparent===!1?Ge(kt):Ge(C.blending,C.blendEquation,C.blendSrc,C.blendDst,C.blendEquationAlpha,C.blendSrcAlpha,C.blendDstAlpha,C.blendColor,C.blendAlpha,C.premultipliedAlpha),o.setFunc(C.depthFunc),o.setTest(C.depthTest),o.setMask(C.depthWrite),a.setMask(C.colorWrite);const re=C.stencilWrite;l.setTest(re),re&&(l.setMask(C.stencilWriteMask),l.setFunc(C.stencilFunc,C.stencilRef,C.stencilFuncMask),l.setOp(C.stencilFail,C.stencilZFail,C.stencilZPass)),pt(C.polygonOffset,C.polygonOffsetFactor,C.polygonOffsetUnits),C.alphaToCoverage===!0?Q(e.SAMPLE_ALPHA_TO_COVERAGE):Re(e.SAMPLE_ALPHA_TO_COVERAGE)}function st(C){U!==C&&(C?e.frontFace(e.CW):e.frontFace(e.CCW),U=C)}function lt(C){C!==ko?(Q(e.CULL_FACE),C!==B&&(C===fa?e.cullFace(e.BACK):C===Ho?e.cullFace(e.FRONT):e.cullFace(e.FRONT_AND_BACK))):Re(e.CULL_FACE),B=C}function ut(C){C!==J&&(H&&e.lineWidth(C),J=C)}function pt(C,ee,X){C?(Q(e.POLYGON_OFFSET_FILL),(Y!==ee||z!==X)&&(Y=ee,z=X,o.getReversed()&&(ee=-ee),e.polygonOffset(ee,X))):Re(e.POLYGON_OFFSET_FILL)}function $e(C){C?Q(e.SCISSOR_TEST):Re(e.SCISSOR_TEST)}function ct(C){C===void 0&&(C=e.TEXTURE0+W-1),_e!==C&&(e.activeTexture(C),_e=C)}function L(C,ee,X){X===void 0&&(_e===null?X=e.TEXTURE0+W-1:X=_e);let re=be[X];re===void 0&&(re={type:void 0,texture:void 0},be[X]=re),(re.type!==C||re.texture!==ee)&&(_e!==X&&(e.activeTexture(X),_e=X),e.bindTexture(C,ee||te[C]),re.type=C,re.texture=ee)}function _t(){const C=be[_e];C!==void 0&&C.type!==void 0&&(e.bindTexture(C.type,null),C.type=void 0,C.texture=void 0)}function He(){try{e.compressedTexImage2D(...arguments)}catch(C){Ze("WebGLState:",C)}}function x(){try{e.compressedTexImage3D(...arguments)}catch(C){Ze("WebGLState:",C)}}function s(){try{e.texSubImage2D(...arguments)}catch(C){Ze("WebGLState:",C)}}function N(){try{e.texSubImage3D(...arguments)}catch(C){Ze("WebGLState:",C)}}function O(){try{e.compressedTexSubImage2D(...arguments)}catch(C){Ze("WebGLState:",C)}}function k(){try{e.compressedTexSubImage3D(...arguments)}catch(C){Ze("WebGLState:",C)}}function $(){try{e.texStorage2D(...arguments)}catch(C){Ze("WebGLState:",C)}}function ne(){try{e.texStorage3D(...arguments)}catch(C){Ze("WebGLState:",C)}}function V(){try{e.texImage2D(...arguments)}catch(C){Ze("WebGLState:",C)}}function q(){try{e.texImage3D(...arguments)}catch(C){Ze("WebGLState:",C)}}function ie(C){return g[C]!==void 0?g[C]:e.getParameter(C)}function ve(C,ee){g[C]!==ee&&(e.pixelStorei(C,ee),g[C]=ee)}function oe(C){ot.equals(C)===!1&&(e.scissor(C.x,C.y,C.z,C.w),ot.copy(C))}function ae(C){Ve.equals(C)===!1&&(e.viewport(C.x,C.y,C.z,C.w),Ve.copy(C))}function Te(C,ee){let X=d.get(ee);X===void 0&&(X=new WeakMap,d.set(ee,X));let re=X.get(C);re===void 0&&(re=e.getUniformBlockIndex(ee,C.name),X.set(C,re))}function Ae(C,ee){const re=d.get(ee).get(C);f.get(ee)!==re&&(e.uniformBlockBinding(ee,re,C.__bindingPointIndex),f.set(ee,re))}function Pe(){e.disable(e.BLEND),e.disable(e.CULL_FACE),e.disable(e.DEPTH_TEST),e.disable(e.POLYGON_OFFSET_FILL),e.disable(e.SCISSOR_TEST),e.disable(e.STENCIL_TEST),e.disable(e.SAMPLE_ALPHA_TO_COVERAGE),e.blendEquation(e.FUNC_ADD),e.blendFunc(e.ONE,e.ZERO),e.blendFuncSeparate(e.ONE,e.ZERO,e.ONE,e.ZERO),e.blendColor(0,0,0,0),e.colorMask(!0,!0,!0,!0),e.clearColor(0,0,0,0),e.depthMask(!0),e.depthFunc(e.LESS),o.setReversed(!1),e.clearDepth(1),e.stencilMask(4294967295),e.stencilFunc(e.ALWAYS,0,4294967295),e.stencilOp(e.KEEP,e.KEEP,e.KEEP),e.clearStencil(0),e.cullFace(e.BACK),e.frontFace(e.CCW),e.polygonOffset(0,0),e.activeTexture(e.TEXTURE0),e.bindFramebuffer(e.FRAMEBUFFER,null),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),e.bindFramebuffer(e.READ_FRAMEBUFFER,null),e.useProgram(null),e.lineWidth(1),e.scissor(0,0,e.canvas.width,e.canvas.height),e.viewport(0,0,e.canvas.width,e.canvas.height),e.pixelStorei(e.PACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,e.BROWSER_DEFAULT_WEBGL),e.pixelStorei(e.PACK_ROW_LENGTH,0),e.pixelStorei(e.PACK_SKIP_PIXELS,0),e.pixelStorei(e.PACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_ROW_LENGTH,0),e.pixelStorei(e.UNPACK_IMAGE_HEIGHT,0),e.pixelStorei(e.UNPACK_SKIP_PIXELS,0),e.pixelStorei(e.UNPACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_SKIP_IMAGES,0),_={},g={},_e=null,be={},u={},v=new WeakMap,A=[],D=null,h=!1,c=null,M=null,R=null,b=null,T=null,E=null,P=null,m=new Be(0,0,0),S=0,I=!1,U=null,B=null,J=null,Y=null,z=null,ot.set(0,0,e.canvas.width,e.canvas.height),Ve.set(0,0,e.canvas.width,e.canvas.height),a.reset(),o.reset(),l.reset()}return{buffers:{color:a,depth:o,stencil:l},enable:Q,disable:Re,bindFramebuffer:Ce,drawBuffers:Me,useProgram:nt,setBlending:Ge,setMaterial:ye,setFlipSided:st,setCullFace:lt,setLineWidth:ut,setPolygonOffset:pt,setScissorTest:$e,activeTexture:ct,bindTexture:L,unbindTexture:_t,compressedTexImage2D:He,compressedTexImage3D:x,texImage2D:V,texImage3D:q,pixelStorei:ve,getParameter:ie,updateUBOMapping:Te,uniformBlockBinding:Ae,texStorage2D:$,texStorage3D:ne,texSubImage2D:s,texSubImage3D:N,compressedTexSubImage2D:O,compressedTexSubImage3D:k,scissor:oe,viewport:ae,reset:Pe}}function hu(e,n,t,i,r,a,o){const l=n.has("WEBGL_multisampled_render_to_texture")?n.get("WEBGL_multisampled_render_to_texture"):null,f=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),d=new gt,_=new WeakMap,g=new Set;let u;const v=new WeakMap;let A=!1;try{A=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function D(x,s){return A?new OffscreenCanvas(x,s):Jo("canvas")}function h(x,s,N){let O=1;const k=He(x);if((k.width>N||k.height>N)&&(O=N/Math.max(k.width,k.height)),O<1)if(typeof HTMLImageElement<"u"&&x instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&x instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&x instanceof ImageBitmap||typeof VideoFrame<"u"&&x instanceof VideoFrame){const $=Math.floor(O*k.width),ne=Math.floor(O*k.height);u===void 0&&(u=D($,ne));const V=s?D($,ne):u;return V.width=$,V.height=ne,V.getContext("2d").drawImage(x,0,0,$,ne),ke("WebGLRenderer: Texture has been resized from ("+k.width+"x"+k.height+") to ("+$+"x"+ne+")."),V}else return"data"in x&&ke("WebGLRenderer: Image in DataTexture is too big ("+k.width+"x"+k.height+")."),x;return x}function c(x){return x.generateMipmaps}function M(x){e.generateMipmap(x)}function R(x){return x.isWebGLCubeRenderTarget?e.TEXTURE_CUBE_MAP:x.isWebGL3DRenderTarget?e.TEXTURE_3D:x.isWebGLArrayRenderTarget||x.isCompressedArrayTexture?e.TEXTURE_2D_ARRAY:e.TEXTURE_2D}function b(x,s,N,O,k,$=!1){if(x!==null){if(e[x]!==void 0)return e[x];ke("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+x+"'")}let ne;O&&(ne=n.get("EXT_texture_norm16"),ne||ke("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let V=s;if(s===e.RED&&(N===e.FLOAT&&(V=e.R32F),N===e.HALF_FLOAT&&(V=e.R16F),N===e.UNSIGNED_BYTE&&(V=e.R8),N===e.UNSIGNED_SHORT&&ne&&(V=ne.R16_EXT),N===e.SHORT&&ne&&(V=ne.R16_SNORM_EXT)),s===e.RED_INTEGER&&(N===e.UNSIGNED_BYTE&&(V=e.R8UI),N===e.UNSIGNED_SHORT&&(V=e.R16UI),N===e.UNSIGNED_INT&&(V=e.R32UI),N===e.BYTE&&(V=e.R8I),N===e.SHORT&&(V=e.R16I),N===e.INT&&(V=e.R32I)),s===e.RG&&(N===e.FLOAT&&(V=e.RG32F),N===e.HALF_FLOAT&&(V=e.RG16F),N===e.UNSIGNED_BYTE&&(V=e.RG8),N===e.UNSIGNED_SHORT&&ne&&(V=ne.RG16_EXT),N===e.SHORT&&ne&&(V=ne.RG16_SNORM_EXT)),s===e.RG_INTEGER&&(N===e.UNSIGNED_BYTE&&(V=e.RG8UI),N===e.UNSIGNED_SHORT&&(V=e.RG16UI),N===e.UNSIGNED_INT&&(V=e.RG32UI),N===e.BYTE&&(V=e.RG8I),N===e.SHORT&&(V=e.RG16I),N===e.INT&&(V=e.RG32I)),s===e.RGB_INTEGER&&(N===e.UNSIGNED_BYTE&&(V=e.RGB8UI),N===e.UNSIGNED_SHORT&&(V=e.RGB16UI),N===e.UNSIGNED_INT&&(V=e.RGB32UI),N===e.BYTE&&(V=e.RGB8I),N===e.SHORT&&(V=e.RGB16I),N===e.INT&&(V=e.RGB32I)),s===e.RGBA_INTEGER&&(N===e.UNSIGNED_BYTE&&(V=e.RGBA8UI),N===e.UNSIGNED_SHORT&&(V=e.RGBA16UI),N===e.UNSIGNED_INT&&(V=e.RGBA32UI),N===e.BYTE&&(V=e.RGBA8I),N===e.SHORT&&(V=e.RGBA16I),N===e.INT&&(V=e.RGBA32I)),s===e.RGB&&(N===e.UNSIGNED_SHORT&&ne&&(V=ne.RGB16_EXT),N===e.SHORT&&ne&&(V=ne.RGB16_SNORM_EXT),N===e.UNSIGNED_INT_5_9_9_9_REV&&(V=e.RGB9_E5),N===e.UNSIGNED_INT_10F_11F_11F_REV&&(V=e.R11F_G11F_B10F)),s===e.RGBA){const q=$?_r:Qe.getTransfer(k);N===e.FLOAT&&(V=e.RGBA32F),N===e.HALF_FLOAT&&(V=e.RGBA16F),N===e.UNSIGNED_BYTE&&(V=q===Je?e.SRGB8_ALPHA8:e.RGBA8),N===e.UNSIGNED_SHORT&&ne&&(V=ne.RGBA16_EXT),N===e.SHORT&&ne&&(V=ne.RGBA16_SNORM_EXT),N===e.UNSIGNED_SHORT_4_4_4_4&&(V=e.RGBA4),N===e.UNSIGNED_SHORT_5_5_5_1&&(V=e.RGB5_A1)}return(V===e.R16F||V===e.R32F||V===e.RG16F||V===e.RG32F||V===e.RGBA16F||V===e.RGBA32F)&&n.get("EXT_color_buffer_float"),V}function T(x,s){let N;return x?s===null||s===en||s===Rn?N=e.DEPTH24_STENCIL8:s===Kt?N=e.DEPTH32F_STENCIL8:s===Gn&&(N=e.DEPTH24_STENCIL8,ke("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):s===null||s===en||s===Rn?N=e.DEPTH_COMPONENT24:s===Kt?N=e.DEPTH_COMPONENT32F:s===Gn&&(N=e.DEPTH_COMPONENT16),N}function E(x,s){return c(x)===!0||x.isFramebufferTexture&&x.minFilter!==Bt&&x.minFilter!==mt?Math.log2(Math.max(s.width,s.height))+1:x.mipmaps!==void 0&&x.mipmaps.length>0?x.mipmaps.length:x.isCompressedTexture&&Array.isArray(x.image)?s.mipmaps.length:1}function P(x){const s=x.target;s.removeEventListener("dispose",P),S(s),s.isVideoTexture&&_.delete(s),s.isHTMLTexture&&g.delete(s)}function m(x){const s=x.target;s.removeEventListener("dispose",m),U(s)}function S(x){const s=i.get(x);if(s.__webglInit===void 0)return;const N=x.source,O=v.get(N);if(O){const k=O[s.__cacheKey];k.usedTimes--,k.usedTimes===0&&I(x),Object.keys(O).length===0&&v.delete(N)}i.remove(x)}function I(x){const s=i.get(x);e.deleteTexture(s.__webglTexture);const N=x.source,O=v.get(N);delete O[s.__cacheKey],o.memory.textures--}function U(x){const s=i.get(x);if(x.depthTexture&&(x.depthTexture.dispose(),i.remove(x.depthTexture)),x.isWebGLCubeRenderTarget)for(let O=0;O<6;O++){if(Array.isArray(s.__webglFramebuffer[O]))for(let k=0;k<s.__webglFramebuffer[O].length;k++)e.deleteFramebuffer(s.__webglFramebuffer[O][k]);else e.deleteFramebuffer(s.__webglFramebuffer[O]);s.__webglDepthbuffer&&e.deleteRenderbuffer(s.__webglDepthbuffer[O])}else{if(Array.isArray(s.__webglFramebuffer))for(let O=0;O<s.__webglFramebuffer.length;O++)e.deleteFramebuffer(s.__webglFramebuffer[O]);else e.deleteFramebuffer(s.__webglFramebuffer);if(s.__webglDepthbuffer&&e.deleteRenderbuffer(s.__webglDepthbuffer),s.__webglMultisampledFramebuffer&&e.deleteFramebuffer(s.__webglMultisampledFramebuffer),s.__webglColorRenderbuffer)for(let O=0;O<s.__webglColorRenderbuffer.length;O++)s.__webglColorRenderbuffer[O]&&e.deleteRenderbuffer(s.__webglColorRenderbuffer[O]);s.__webglDepthRenderbuffer&&e.deleteRenderbuffer(s.__webglDepthRenderbuffer)}const N=x.textures;for(let O=0,k=N.length;O<k;O++){const $=i.get(N[O]);$.__webglTexture&&(e.deleteTexture($.__webglTexture),o.memory.textures--),i.remove(N[O])}i.remove(x)}let B=0;function J(){B=0}function Y(){return B}function z(x){B=x}function W(){const x=B;return x>=r.maxTextures&&ke("WebGLTextures: Trying to use "+x+" texture units while this GPU supports only "+r.maxTextures),B+=1,x}function H(x){const s=[];return s.push(x.wrapS),s.push(x.wrapT),s.push(x.wrapR||0),s.push(x.magFilter),s.push(x.minFilter),s.push(x.anisotropy),s.push(x.internalFormat),s.push(x.format),s.push(x.type),s.push(x.generateMipmaps),s.push(x.premultiplyAlpha),s.push(x.flipY),s.push(x.unpackAlignment),s.push(x.colorSpace),s.join()}function Z(x,s){const N=i.get(x);if(x.isVideoTexture&&L(x),x.isRenderTargetTexture===!1&&x.isExternalTexture!==!0&&x.version>0&&N.__version!==x.version){const O=x.image;if(O===null)ke("WebGLRenderer: Texture marked for update but no image data found.");else if(O.complete===!1)ke("WebGLRenderer: Texture marked for update but image is incomplete");else{Re(N,x,s);return}}else x.isExternalTexture&&(N.__webglTexture=x.sourceTexture?x.sourceTexture:null);t.bindTexture(e.TEXTURE_2D,N.__webglTexture,e.TEXTURE0+s)}function le(x,s){const N=i.get(x);if(x.isRenderTargetTexture===!1&&x.version>0&&N.__version!==x.version){Re(N,x,s);return}else x.isExternalTexture&&(N.__webglTexture=x.sourceTexture?x.sourceTexture:null);t.bindTexture(e.TEXTURE_2D_ARRAY,N.__webglTexture,e.TEXTURE0+s)}function _e(x,s){const N=i.get(x);if(x.isRenderTargetTexture===!1&&x.version>0&&N.__version!==x.version){Re(N,x,s);return}t.bindTexture(e.TEXTURE_3D,N.__webglTexture,e.TEXTURE0+s)}function be(x,s){const N=i.get(x);if(x.isCubeDepthTexture!==!0&&x.version>0&&N.__version!==x.version){Ce(N,x,s);return}t.bindTexture(e.TEXTURE_CUBE_MAP,N.__webglTexture,e.TEXTURE0+s)}const Ee={[On]:e.REPEAT,[yn]:e.CLAMP_TO_EDGE,[Za]:e.MIRRORED_REPEAT},Ke={[Bt]:e.NEAREST,[Qa]:e.NEAREST_MIPMAP_NEAREST,[xn]:e.NEAREST_MIPMAP_LINEAR,[mt]:e.LINEAR,[Un]:e.LINEAR_MIPMAP_NEAREST,[qt]:e.LINEAR_MIPMAP_LINEAR},ot={[xo]:e.NEVER,[vo]:e.ALWAYS,[bo]:e.LESS,[vi]:e.LEQUAL,[_o]:e.EQUAL,[bi]:e.GEQUAL,[go]:e.GREATER,[mo]:e.NOTEQUAL};function Ve(x,s){if(s.type===Kt&&n.has("OES_texture_float_linear")===!1&&(s.magFilter===mt||s.magFilter===Un||s.magFilter===xn||s.magFilter===qt||s.minFilter===mt||s.minFilter===Un||s.minFilter===xn||s.minFilter===qt)&&ke("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),e.texParameteri(x,e.TEXTURE_WRAP_S,Ee[s.wrapS]),e.texParameteri(x,e.TEXTURE_WRAP_T,Ee[s.wrapT]),(x===e.TEXTURE_3D||x===e.TEXTURE_2D_ARRAY)&&e.texParameteri(x,e.TEXTURE_WRAP_R,Ee[s.wrapR]),e.texParameteri(x,e.TEXTURE_MAG_FILTER,Ke[s.magFilter]),e.texParameteri(x,e.TEXTURE_MIN_FILTER,Ke[s.minFilter]),s.compareFunction&&(e.texParameteri(x,e.TEXTURE_COMPARE_MODE,e.COMPARE_REF_TO_TEXTURE),e.texParameteri(x,e.TEXTURE_COMPARE_FUNC,ot[s.compareFunction])),n.has("EXT_texture_filter_anisotropic")===!0){if(s.magFilter===Bt||s.minFilter!==xn&&s.minFilter!==qt||s.type===Kt&&n.has("OES_texture_float_linear")===!1)return;if(s.anisotropy>1||i.get(s).__currentAnisotropy){const N=n.get("EXT_texture_filter_anisotropic");e.texParameterf(x,N.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(s.anisotropy,r.getMaxAnisotropy())),i.get(s).__currentAnisotropy=s.anisotropy}}}function K(x,s){let N=!1;x.__webglInit===void 0&&(x.__webglInit=!0,s.addEventListener("dispose",P));const O=s.source;let k=v.get(O);k===void 0&&(k={},v.set(O,k));const $=H(s);if($!==x.__cacheKey){k[$]===void 0&&(k[$]={texture:e.createTexture(),usedTimes:0},o.memory.textures++,N=!0),k[$].usedTimes++;const ne=k[x.__cacheKey];ne!==void 0&&(k[x.__cacheKey].usedTimes--,ne.usedTimes===0&&I(s)),x.__cacheKey=$,x.__webglTexture=k[$].texture}return N}function te(x,s,N){return Math.floor(Math.floor(x/N)/s)}function Q(x,s,N,O){const $=x.updateRanges;if($.length===0)t.texSubImage2D(e.TEXTURE_2D,0,0,0,s.width,s.height,N,O,s.data);else{$.sort((ve,oe)=>ve.start-oe.start);let ne=0;for(let ve=1;ve<$.length;ve++){const oe=$[ne],ae=$[ve],Te=oe.start+oe.count,Ae=te(ae.start,s.width,4),Pe=te(oe.start,s.width,4);ae.start<=Te+1&&Ae===Pe&&te(ae.start+ae.count-1,s.width,4)===Ae?oe.count=Math.max(oe.count,ae.start+ae.count-oe.start):(++ne,$[ne]=ae)}$.length=ne+1;const V=t.getParameter(e.UNPACK_ROW_LENGTH),q=t.getParameter(e.UNPACK_SKIP_PIXELS),ie=t.getParameter(e.UNPACK_SKIP_ROWS);t.pixelStorei(e.UNPACK_ROW_LENGTH,s.width);for(let ve=0,oe=$.length;ve<oe;ve++){const ae=$[ve],Te=Math.floor(ae.start/4),Ae=Math.ceil(ae.count/4),Pe=Te%s.width,C=Math.floor(Te/s.width),ee=Ae,X=1;t.pixelStorei(e.UNPACK_SKIP_PIXELS,Pe),t.pixelStorei(e.UNPACK_SKIP_ROWS,C),t.texSubImage2D(e.TEXTURE_2D,0,Pe,C,ee,X,N,O,s.data)}x.clearUpdateRanges(),t.pixelStorei(e.UNPACK_ROW_LENGTH,V),t.pixelStorei(e.UNPACK_SKIP_PIXELS,q),t.pixelStorei(e.UNPACK_SKIP_ROWS,ie)}}function Re(x,s,N){let O=e.TEXTURE_2D;(s.isDataArrayTexture||s.isCompressedArrayTexture)&&(O=e.TEXTURE_2D_ARRAY),s.isData3DTexture&&(O=e.TEXTURE_3D);const k=K(x,s),$=s.source;t.bindTexture(O,x.__webglTexture,e.TEXTURE0+N);const ne=i.get($);if($.version!==ne.__version||k===!0){if(t.activeTexture(e.TEXTURE0+N),(typeof ImageBitmap<"u"&&s.image instanceof ImageBitmap)===!1){const X=Qe.getPrimaries(Qe.workingColorSpace),re=s.colorSpace===rn?null:Qe.getPrimaries(s.colorSpace),de=s.colorSpace===rn||X===re?e.NONE:e.BROWSER_DEFAULT_WEBGL;t.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,s.flipY),t.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,s.premultiplyAlpha),t.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,de)}t.pixelStorei(e.UNPACK_ALIGNMENT,s.unpackAlignment);let q=h(s.image,!1,r.maxTextureSize);q=_t(s,q);const ie=a.convert(s.format,s.colorSpace),ve=a.convert(s.type);let oe=b(s.internalFormat,ie,ve,s.normalized,s.colorSpace,s.isVideoTexture);Ve(O,s);let ae;const Te=s.mipmaps,Ae=s.isVideoTexture!==!0,Pe=ne.__version===void 0||k===!0,C=$.dataReady,ee=E(s,q);if(s.isDepthTexture)oe=T(s.format===on,s.type),Pe&&(Ae?t.texStorage2D(e.TEXTURE_2D,1,oe,q.width,q.height):t.texImage2D(e.TEXTURE_2D,0,oe,q.width,q.height,0,ie,ve,null));else if(s.isDataTexture)if(Te.length>0){Ae&&Pe&&t.texStorage2D(e.TEXTURE_2D,ee,oe,Te[0].width,Te[0].height);for(let X=0,re=Te.length;X<re;X++)ae=Te[X],Ae?C&&t.texSubImage2D(e.TEXTURE_2D,X,0,0,ae.width,ae.height,ie,ve,ae.data):t.texImage2D(e.TEXTURE_2D,X,oe,ae.width,ae.height,0,ie,ve,ae.data);s.generateMipmaps=!1}else Ae?(Pe&&t.texStorage2D(e.TEXTURE_2D,ee,oe,q.width,q.height),C&&Q(s,q,ie,ve)):t.texImage2D(e.TEXTURE_2D,0,oe,q.width,q.height,0,ie,ve,q.data);else if(s.isCompressedTexture)if(s.isCompressedArrayTexture){Ae&&Pe&&t.texStorage3D(e.TEXTURE_2D_ARRAY,ee,oe,Te[0].width,Te[0].height,q.depth);for(let X=0,re=Te.length;X<re;X++)if(ae=Te[X],s.format!==Gt)if(ie!==null)if(Ae){if(C)if(s.layerUpdates.size>0){const de=ma(ae.width,ae.height,s.format,s.type);for(const j of s.layerUpdates){const ge=ae.data.subarray(j*de/ae.data.BYTES_PER_ELEMENT,(j+1)*de/ae.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,X,0,0,j,ae.width,ae.height,1,ie,ge)}s.clearLayerUpdates()}else t.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,X,0,0,0,ae.width,ae.height,q.depth,ie,ae.data)}else t.compressedTexImage3D(e.TEXTURE_2D_ARRAY,X,oe,ae.width,ae.height,q.depth,0,ae.data,0,0);else ke("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Ae?C&&t.texSubImage3D(e.TEXTURE_2D_ARRAY,X,0,0,0,ae.width,ae.height,q.depth,ie,ve,ae.data):t.texImage3D(e.TEXTURE_2D_ARRAY,X,oe,ae.width,ae.height,q.depth,0,ie,ve,ae.data)}else{Ae&&Pe&&t.texStorage2D(e.TEXTURE_2D,ee,oe,Te[0].width,Te[0].height);for(let X=0,re=Te.length;X<re;X++)ae=Te[X],s.format!==Gt?ie!==null?Ae?C&&t.compressedTexSubImage2D(e.TEXTURE_2D,X,0,0,ae.width,ae.height,ie,ae.data):t.compressedTexImage2D(e.TEXTURE_2D,X,oe,ae.width,ae.height,0,ae.data):ke("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Ae?C&&t.texSubImage2D(e.TEXTURE_2D,X,0,0,ae.width,ae.height,ie,ve,ae.data):t.texImage2D(e.TEXTURE_2D,X,oe,ae.width,ae.height,0,ie,ve,ae.data)}else if(s.isDataArrayTexture)if(Ae){if(Pe&&t.texStorage3D(e.TEXTURE_2D_ARRAY,ee,oe,q.width,q.height,q.depth),C)if(s.layerUpdates.size>0){const X=ma(q.width,q.height,s.format,s.type);for(const re of s.layerUpdates){const de=q.data.subarray(re*X/q.data.BYTES_PER_ELEMENT,(re+1)*X/q.data.BYTES_PER_ELEMENT);t.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,re,q.width,q.height,1,ie,ve,de)}s.clearLayerUpdates()}else t.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,0,q.width,q.height,q.depth,ie,ve,q.data)}else t.texImage3D(e.TEXTURE_2D_ARRAY,0,oe,q.width,q.height,q.depth,0,ie,ve,q.data);else if(s.isData3DTexture)Ae?(Pe&&t.texStorage3D(e.TEXTURE_3D,ee,oe,q.width,q.height,q.depth),C&&t.texSubImage3D(e.TEXTURE_3D,0,0,0,0,q.width,q.height,q.depth,ie,ve,q.data)):t.texImage3D(e.TEXTURE_3D,0,oe,q.width,q.height,q.depth,0,ie,ve,q.data);else if(s.isFramebufferTexture){if(Pe)if(Ae)t.texStorage2D(e.TEXTURE_2D,ee,oe,q.width,q.height);else{let X=q.width,re=q.height;for(let de=0;de<ee;de++)t.texImage2D(e.TEXTURE_2D,de,oe,X,re,0,ie,ve,null),X>>=1,re>>=1}}else if(s.isHTMLTexture){if("texElementImage2D"in e){const X=e.canvas;if(X.hasAttribute("layoutsubtree")||X.setAttribute("layoutsubtree","true"),q.parentNode!==X){X.appendChild(q),g.add(s),X.onpaint=re=>{const de=re.changedElements;for(const j of g)de.includes(j.image)&&(j.needsUpdate=!0)},X.requestPaint();return}if(e.texElementImage2D.length===3)e.texElementImage2D(e.TEXTURE_2D,e.RGBA8,q);else{const de=e.RGBA,j=e.RGBA,ge=e.UNSIGNED_BYTE;e.texElementImage2D(e.TEXTURE_2D,0,de,j,ge,q)}e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE)}}else if(Te.length>0){if(Ae&&Pe){const X=He(Te[0]);t.texStorage2D(e.TEXTURE_2D,ee,oe,X.width,X.height)}for(let X=0,re=Te.length;X<re;X++)ae=Te[X],Ae?C&&t.texSubImage2D(e.TEXTURE_2D,X,0,0,ie,ve,ae):t.texImage2D(e.TEXTURE_2D,X,oe,ie,ve,ae);s.generateMipmaps=!1}else if(Ae){if(Pe){const X=He(q);t.texStorage2D(e.TEXTURE_2D,ee,oe,X.width,X.height)}C&&t.texSubImage2D(e.TEXTURE_2D,0,0,0,ie,ve,q)}else t.texImage2D(e.TEXTURE_2D,0,oe,ie,ve,q);c(s)&&M(O),ne.__version=$.version,s.onUpdate&&s.onUpdate(s)}x.__version=s.version}function Ce(x,s,N){if(s.image.length!==6)return;const O=K(x,s),k=s.source;t.bindTexture(e.TEXTURE_CUBE_MAP,x.__webglTexture,e.TEXTURE0+N);const $=i.get(k);if(k.version!==$.__version||O===!0){t.activeTexture(e.TEXTURE0+N);const ne=Qe.getPrimaries(Qe.workingColorSpace),V=s.colorSpace===rn?null:Qe.getPrimaries(s.colorSpace),q=s.colorSpace===rn||ne===V?e.NONE:e.BROWSER_DEFAULT_WEBGL;t.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,s.flipY),t.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,s.premultiplyAlpha),t.pixelStorei(e.UNPACK_ALIGNMENT,s.unpackAlignment),t.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,q);const ie=s.isCompressedTexture||s.image[0].isCompressedTexture,ve=s.image[0]&&s.image[0].isDataTexture,oe=[];for(let j=0;j<6;j++)!ie&&!ve?oe[j]=h(s.image[j],!0,r.maxCubemapSize):oe[j]=ve?s.image[j].image:s.image[j],oe[j]=_t(s,oe[j]);const ae=oe[0],Te=a.convert(s.format,s.colorSpace),Ae=a.convert(s.type),Pe=b(s.internalFormat,Te,Ae,s.normalized,s.colorSpace),C=s.isVideoTexture!==!0,ee=$.__version===void 0||O===!0,X=k.dataReady;let re=E(s,ae);Ve(e.TEXTURE_CUBE_MAP,s);let de;if(ie){C&&ee&&t.texStorage2D(e.TEXTURE_CUBE_MAP,re,Pe,ae.width,ae.height);for(let j=0;j<6;j++){de=oe[j].mipmaps;for(let ge=0;ge<de.length;ge++){const he=de[ge];s.format!==Gt?Te!==null?C?X&&t.compressedTexSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+j,ge,0,0,he.width,he.height,Te,he.data):t.compressedTexImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+j,ge,Pe,he.width,he.height,0,he.data):ke("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):C?X&&t.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+j,ge,0,0,he.width,he.height,Te,Ae,he.data):t.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+j,ge,Pe,he.width,he.height,0,Te,Ae,he.data)}}}else{if(de=s.mipmaps,C&&ee){de.length>0&&re++;const j=He(oe[0]);t.texStorage2D(e.TEXTURE_CUBE_MAP,re,Pe,j.width,j.height)}for(let j=0;j<6;j++)if(ve){C?X&&t.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,0,0,oe[j].width,oe[j].height,Te,Ae,oe[j].data):t.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,Pe,oe[j].width,oe[j].height,0,Te,Ae,oe[j].data);for(let ge=0;ge<de.length;ge++){const et=de[ge].image[j].image;C?X&&t.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+j,ge+1,0,0,et.width,et.height,Te,Ae,et.data):t.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+j,ge+1,Pe,et.width,et.height,0,Te,Ae,et.data)}}else{C?X&&t.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,0,0,Te,Ae,oe[j]):t.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,Pe,Te,Ae,oe[j]);for(let ge=0;ge<de.length;ge++){const he=de[ge];C?X&&t.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+j,ge+1,0,0,Te,Ae,he.image[j]):t.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+j,ge+1,Pe,Te,Ae,he.image[j])}}}c(s)&&M(e.TEXTURE_CUBE_MAP),$.__version=k.version,s.onUpdate&&s.onUpdate(s)}x.__version=s.version}function Me(x,s,N,O,k,$){const ne=a.convert(N.format,N.colorSpace),V=a.convert(N.type),q=b(N.internalFormat,ne,V,N.normalized,N.colorSpace),ie=i.get(s),ve=i.get(N);if(ve.__renderTarget=s,!ie.__hasExternalTextures){const oe=Math.max(1,s.width>>$),ae=Math.max(1,s.height>>$);k===e.TEXTURE_3D||k===e.TEXTURE_2D_ARRAY?t.texImage3D(k,$,q,oe,ae,s.depth,0,ne,V,null):t.texImage2D(k,$,q,oe,ae,0,ne,V,null)}t.bindFramebuffer(e.FRAMEBUFFER,x),ct(s)?l.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,O,k,ve.__webglTexture,0,$e(s)):(k===e.TEXTURE_2D||k>=e.TEXTURE_CUBE_MAP_POSITIVE_X&&k<=e.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&e.framebufferTexture2D(e.FRAMEBUFFER,O,k,ve.__webglTexture,$),t.bindFramebuffer(e.FRAMEBUFFER,null)}function nt(x,s,N){if(e.bindRenderbuffer(e.RENDERBUFFER,x),s.depthBuffer){const O=s.depthTexture,k=O&&O.isDepthTexture?O.type:null,$=T(s.stencilBuffer,k),ne=s.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;ct(s)?l.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,$e(s),$,s.width,s.height):N?e.renderbufferStorageMultisample(e.RENDERBUFFER,$e(s),$,s.width,s.height):e.renderbufferStorage(e.RENDERBUFFER,$,s.width,s.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,ne,e.RENDERBUFFER,x)}else{const O=s.textures;for(let k=0;k<O.length;k++){const $=O[k],ne=a.convert($.format,$.colorSpace),V=a.convert($.type),q=b($.internalFormat,ne,V,$.normalized,$.colorSpace);ct(s)?l.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,$e(s),q,s.width,s.height):N?e.renderbufferStorageMultisample(e.RENDERBUFFER,$e(s),q,s.width,s.height):e.renderbufferStorage(e.RENDERBUFFER,q,s.width,s.height)}}e.bindRenderbuffer(e.RENDERBUFFER,null)}function Ie(x,s,N){const O=s.isWebGLCubeRenderTarget===!0;if(t.bindFramebuffer(e.FRAMEBUFFER,x),!(s.depthTexture&&s.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");const k=i.get(s.depthTexture);if(k.__renderTarget=s,(!k.__webglTexture||s.depthTexture.image.width!==s.width||s.depthTexture.image.height!==s.height)&&(s.depthTexture.image.width=s.width,s.depthTexture.image.height=s.height,s.depthTexture.needsUpdate=!0),O){if(k.__webglInit===void 0&&(k.__webglInit=!0,s.depthTexture.addEventListener("dispose",P)),k.__webglTexture===void 0){k.__webglTexture=e.createTexture(),t.bindTexture(e.TEXTURE_CUBE_MAP,k.__webglTexture),Ve(e.TEXTURE_CUBE_MAP,s.depthTexture);const ie=a.convert(s.depthTexture.format),ve=a.convert(s.depthTexture.type);let oe;s.depthTexture.format===dn?oe=e.DEPTH_COMPONENT24:s.depthTexture.format===on&&(oe=e.DEPTH24_STENCIL8);for(let ae=0;ae<6;ae++)e.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ae,0,oe,s.width,s.height,0,ie,ve,null)}}else Z(s.depthTexture,0);const $=k.__webglTexture,ne=$e(s),V=O?e.TEXTURE_CUBE_MAP_POSITIVE_X+N:e.TEXTURE_2D,q=s.depthTexture.format===on?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;if(s.depthTexture.format===dn)ct(s)?l.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,q,V,$,0,ne):e.framebufferTexture2D(e.FRAMEBUFFER,q,V,$,0);else if(s.depthTexture.format===on)ct(s)?l.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,q,V,$,0,ne):e.framebufferTexture2D(e.FRAMEBUFFER,q,V,$,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function We(x){const s=i.get(x),N=x.isWebGLCubeRenderTarget===!0;if(s.__boundDepthTexture!==x.depthTexture){const O=x.depthTexture;if(s.__depthDisposeCallback&&s.__depthDisposeCallback(),O){const k=()=>{delete s.__boundDepthTexture,delete s.__depthDisposeCallback,O.removeEventListener("dispose",k)};O.addEventListener("dispose",k),s.__depthDisposeCallback=k}s.__boundDepthTexture=O}if(x.depthTexture&&!s.__autoAllocateDepthBuffer)if(N)for(let O=0;O<6;O++)Ie(s.__webglFramebuffer[O],x,O);else{const O=x.texture.mipmaps;O&&O.length>0?Ie(s.__webglFramebuffer[0],x,0):Ie(s.__webglFramebuffer,x,0)}else if(N){s.__webglDepthbuffer=[];for(let O=0;O<6;O++)if(t.bindFramebuffer(e.FRAMEBUFFER,s.__webglFramebuffer[O]),s.__webglDepthbuffer[O]===void 0)s.__webglDepthbuffer[O]=e.createRenderbuffer(),nt(s.__webglDepthbuffer[O],x,!1);else{const k=x.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,$=s.__webglDepthbuffer[O];e.bindRenderbuffer(e.RENDERBUFFER,$),e.framebufferRenderbuffer(e.FRAMEBUFFER,k,e.RENDERBUFFER,$)}}else{const O=x.texture.mipmaps;if(O&&O.length>0?t.bindFramebuffer(e.FRAMEBUFFER,s.__webglFramebuffer[0]):t.bindFramebuffer(e.FRAMEBUFFER,s.__webglFramebuffer),s.__webglDepthbuffer===void 0)s.__webglDepthbuffer=e.createRenderbuffer(),nt(s.__webglDepthbuffer,x,!1);else{const k=x.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,$=s.__webglDepthbuffer;e.bindRenderbuffer(e.RENDERBUFFER,$),e.framebufferRenderbuffer(e.FRAMEBUFFER,k,e.RENDERBUFFER,$)}}t.bindFramebuffer(e.FRAMEBUFFER,null)}function Ge(x,s,N){const O=i.get(x);s!==void 0&&Me(O.__webglFramebuffer,x,x.texture,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,0),N!==void 0&&We(x)}function ye(x){const s=x.texture,N=i.get(x),O=i.get(s);x.addEventListener("dispose",m);const k=x.textures,$=x.isWebGLCubeRenderTarget===!0,ne=k.length>1;if(ne||(O.__webglTexture===void 0&&(O.__webglTexture=e.createTexture()),O.__version=s.version,o.memory.textures++),$){N.__webglFramebuffer=[];for(let V=0;V<6;V++)if(s.mipmaps&&s.mipmaps.length>0){N.__webglFramebuffer[V]=[];for(let q=0;q<s.mipmaps.length;q++)N.__webglFramebuffer[V][q]=e.createFramebuffer()}else N.__webglFramebuffer[V]=e.createFramebuffer()}else{if(s.mipmaps&&s.mipmaps.length>0){N.__webglFramebuffer=[];for(let V=0;V<s.mipmaps.length;V++)N.__webglFramebuffer[V]=e.createFramebuffer()}else N.__webglFramebuffer=e.createFramebuffer();if(ne)for(let V=0,q=k.length;V<q;V++){const ie=i.get(k[V]);ie.__webglTexture===void 0&&(ie.__webglTexture=e.createTexture(),o.memory.textures++)}if(x.samples>0&&ct(x)===!1){N.__webglMultisampledFramebuffer=e.createFramebuffer(),N.__webglColorRenderbuffer=[],t.bindFramebuffer(e.FRAMEBUFFER,N.__webglMultisampledFramebuffer);for(let V=0;V<k.length;V++){const q=k[V];N.__webglColorRenderbuffer[V]=e.createRenderbuffer(),e.bindRenderbuffer(e.RENDERBUFFER,N.__webglColorRenderbuffer[V]);const ie=a.convert(q.format,q.colorSpace),ve=a.convert(q.type),oe=b(q.internalFormat,ie,ve,q.normalized,q.colorSpace,x.isXRRenderTarget===!0),ae=$e(x);e.renderbufferStorageMultisample(e.RENDERBUFFER,ae,oe,x.width,x.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+V,e.RENDERBUFFER,N.__webglColorRenderbuffer[V])}e.bindRenderbuffer(e.RENDERBUFFER,null),x.depthBuffer&&(N.__webglDepthRenderbuffer=e.createRenderbuffer(),nt(N.__webglDepthRenderbuffer,x,!0)),t.bindFramebuffer(e.FRAMEBUFFER,null)}}if($){t.bindTexture(e.TEXTURE_CUBE_MAP,O.__webglTexture),Ve(e.TEXTURE_CUBE_MAP,s);for(let V=0;V<6;V++)if(s.mipmaps&&s.mipmaps.length>0)for(let q=0;q<s.mipmaps.length;q++)Me(N.__webglFramebuffer[V][q],x,s,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+V,q);else Me(N.__webglFramebuffer[V],x,s,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+V,0);c(s)&&M(e.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(ne){for(let V=0,q=k.length;V<q;V++){const ie=k[V],ve=i.get(ie);let oe=e.TEXTURE_2D;(x.isWebGL3DRenderTarget||x.isWebGLArrayRenderTarget)&&(oe=x.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),t.bindTexture(oe,ve.__webglTexture),Ve(oe,ie),Me(N.__webglFramebuffer,x,ie,e.COLOR_ATTACHMENT0+V,oe,0),c(ie)&&M(oe)}t.unbindTexture()}else{let V=e.TEXTURE_2D;if((x.isWebGL3DRenderTarget||x.isWebGLArrayRenderTarget)&&(V=x.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),t.bindTexture(V,O.__webglTexture),Ve(V,s),s.mipmaps&&s.mipmaps.length>0)for(let q=0;q<s.mipmaps.length;q++)Me(N.__webglFramebuffer[q],x,s,e.COLOR_ATTACHMENT0,V,q);else Me(N.__webglFramebuffer,x,s,e.COLOR_ATTACHMENT0,V,0);c(s)&&M(V),t.unbindTexture()}x.depthBuffer&&We(x)}function st(x){const s=x.textures;for(let N=0,O=s.length;N<O;N++){const k=s[N];if(c(k)){const $=R(x),ne=i.get(k).__webglTexture;t.bindTexture($,ne),M($),t.unbindTexture()}}}const lt=[],ut=[];function pt(x){if(x.samples>0){if(ct(x)===!1){const s=x.textures,N=x.width,O=x.height;let k=e.COLOR_BUFFER_BIT;const $=x.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,ne=i.get(x),V=s.length>1;if(V)for(let ie=0;ie<s.length;ie++)t.bindFramebuffer(e.FRAMEBUFFER,ne.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+ie,e.RENDERBUFFER,null),t.bindFramebuffer(e.FRAMEBUFFER,ne.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+ie,e.TEXTURE_2D,null,0);t.bindFramebuffer(e.READ_FRAMEBUFFER,ne.__webglMultisampledFramebuffer);const q=x.texture.mipmaps;q&&q.length>0?t.bindFramebuffer(e.DRAW_FRAMEBUFFER,ne.__webglFramebuffer[0]):t.bindFramebuffer(e.DRAW_FRAMEBUFFER,ne.__webglFramebuffer);for(let ie=0;ie<s.length;ie++){if(x.resolveDepthBuffer&&(x.depthBuffer&&(k|=e.DEPTH_BUFFER_BIT),x.stencilBuffer&&x.resolveStencilBuffer&&(k|=e.STENCIL_BUFFER_BIT)),V){e.framebufferRenderbuffer(e.READ_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.RENDERBUFFER,ne.__webglColorRenderbuffer[ie]);const ve=i.get(s[ie]).__webglTexture;e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,ve,0)}e.blitFramebuffer(0,0,N,O,0,0,N,O,k,e.NEAREST),f===!0&&(lt.length=0,ut.length=0,lt.push(e.COLOR_ATTACHMENT0+ie),x.depthBuffer&&x.resolveDepthBuffer===!1&&(lt.push($),ut.push($),e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,ut)),e.invalidateFramebuffer(e.READ_FRAMEBUFFER,lt))}if(t.bindFramebuffer(e.READ_FRAMEBUFFER,null),t.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),V)for(let ie=0;ie<s.length;ie++){t.bindFramebuffer(e.FRAMEBUFFER,ne.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+ie,e.RENDERBUFFER,ne.__webglColorRenderbuffer[ie]);const ve=i.get(s[ie]).__webglTexture;t.bindFramebuffer(e.FRAMEBUFFER,ne.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+ie,e.TEXTURE_2D,ve,0)}t.bindFramebuffer(e.DRAW_FRAMEBUFFER,ne.__webglMultisampledFramebuffer)}else if(x.depthBuffer&&x.resolveDepthBuffer===!1&&f){const s=x.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,[s])}}}function $e(x){return Math.min(r.maxSamples,x.samples)}function ct(x){const s=i.get(x);return x.samples>0&&n.has("WEBGL_multisampled_render_to_texture")===!0&&s.__useRenderToTexture!==!1}function L(x){const s=o.render.frame;_.get(x)!==s&&(_.set(x,s),x.update())}function _t(x,s){const N=x.colorSpace,O=x.format,k=x.type;return x.isCompressedTexture===!0||x.isVideoTexture===!0||N!==Mt&&N!==rn&&(Qe.getTransfer(N)===Je?(O!==Gt||k!==Dt)&&ke("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):Ze("WebGLTextures: Unsupported texture color space:",N)),s}function He(x){return typeof HTMLImageElement<"u"&&x instanceof HTMLImageElement?(d.width=x.naturalWidth||x.width,d.height=x.naturalHeight||x.height):typeof VideoFrame<"u"&&x instanceof VideoFrame?(d.width=x.displayWidth,d.height=x.displayHeight):(d.width=x.width,d.height=x.height),d}this.allocateTextureUnit=W,this.resetTextureUnits=J,this.getTextureUnits=Y,this.setTextureUnits=z,this.setTexture2D=Z,this.setTexture2DArray=le,this.setTexture3D=_e,this.setTextureCube=be,this.rebindTextures=Ge,this.setupRenderTarget=ye,this.updateRenderTargetMipmap=st,this.updateMultisampleRenderTarget=pt,this.setupDepthRenderbuffer=We,this.setupFrameBufferTexture=Me,this.useMultisampledRTT=ct,this.isReversedDepthBuffer=function(){return t.buffers.depth.getReversed()}}function mu(e,n){function t(i,r=rn){let a;const o=Qe.getTransfer(r);if(i===Dt)return e.UNSIGNED_BYTE;if(i===nr)return e.UNSIGNED_SHORT_4_4_4_4;if(i===ir)return e.UNSIGNED_SHORT_5_5_5_1;if(i===Ro)return e.UNSIGNED_INT_5_9_9_9_REV;if(i===Co)return e.UNSIGNED_INT_10F_11F_11F_REV;if(i===Po)return e.BYTE;if(i===Lo)return e.SHORT;if(i===Gn)return e.UNSIGNED_SHORT;if(i===or)return e.INT;if(i===en)return e.UNSIGNED_INT;if(i===Kt)return e.FLOAT;if(i===Jt)return e.HALF_FLOAT;if(i===wo)return e.ALPHA;if(i===Do)return e.RGB;if(i===Gt)return e.RGBA;if(i===dn)return e.DEPTH_COMPONENT;if(i===on)return e.DEPTH_STENCIL;if(i===Uo)return e.RED;if(i===tr)return e.RED_INTEGER;if(i===un)return e.RG;if(i===er)return e.RG_INTEGER;if(i===$a)return e.RGBA_INTEGER;if(i===Xn||i===qn||i===Kn||i===jn)if(o===Je)if(a=n.get("WEBGL_compressed_texture_s3tc_srgb"),a!==null){if(i===Xn)return a.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===qn)return a.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===Kn)return a.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===jn)return a.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(a=n.get("WEBGL_compressed_texture_s3tc"),a!==null){if(i===Xn)return a.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===qn)return a.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===Kn)return a.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===jn)return a.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===Ii||i===Fi||i===yi||i===Oi)if(a=n.get("WEBGL_compressed_texture_pvrtc"),a!==null){if(i===Ii)return a.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===Fi)return a.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===yi)return a.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===Oi)return a.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===Gi||i===Bi||i===ki||i===Hi||i===Vi||i===ci||i===zi)if(a=n.get("WEBGL_compressed_texture_etc"),a!==null){if(i===Gi||i===Bi)return o===Je?a.COMPRESSED_SRGB8_ETC2:a.COMPRESSED_RGB8_ETC2;if(i===ki)return o===Je?a.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:a.COMPRESSED_RGBA8_ETC2_EAC;if(i===Hi)return a.COMPRESSED_R11_EAC;if(i===Vi)return a.COMPRESSED_SIGNED_R11_EAC;if(i===ci)return a.COMPRESSED_RG11_EAC;if(i===zi)return a.COMPRESSED_SIGNED_RG11_EAC}else return null;if(i===Wi||i===Xi||i===qi||i===Ki||i===ji||i===Yi||i===Ji||i===Zi||i===Qi||i===$i||i===ea||i===ta||i===na||i===ia)if(a=n.get("WEBGL_compressed_texture_astc"),a!==null){if(i===Wi)return o===Je?a.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:a.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===Xi)return o===Je?a.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:a.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===qi)return o===Je?a.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:a.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===Ki)return o===Je?a.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:a.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===ji)return o===Je?a.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:a.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===Yi)return o===Je?a.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:a.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===Ji)return o===Je?a.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:a.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===Zi)return o===Je?a.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:a.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===Qi)return o===Je?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:a.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===$i)return o===Je?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:a.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===ea)return o===Je?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:a.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===ta)return o===Je?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:a.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===na)return o===Je?a.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:a.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===ia)return o===Je?a.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:a.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===aa||i===ra||i===oa)if(a=n.get("EXT_texture_compression_bptc"),a!==null){if(i===aa)return o===Je?a.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:a.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===ra)return a.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===oa)return a.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===sa||i===ca||i===li||i===la)if(a=n.get("EXT_texture_compression_rgtc"),a!==null){if(i===sa)return a.COMPRESSED_RED_RGTC1_EXT;if(i===ca)return a.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===li)return a.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===la)return a.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===Rn?e.UNSIGNED_INT_24_8:e[i]!==void 0?e[i]:null}return{convert:t}}const gu=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,_u=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class bu{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(n,t){if(this.texture===null){const i=new ar(n.texture);(n.depthNear!==t.depthNear||n.depthFar!==t.depthFar)&&(this.depthNear=n.depthNear,this.depthFar=n.depthFar),this.texture=i}}getMesh(n){if(this.texture!==null&&this.mesh===null){const t=n.cameras[0].viewport,i=new Ht({vertexShader:gu,fragmentShader:_u,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new yt(new rr(20,20),i)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class vu extends qr{constructor(n,t){super();const i=this;let r=null,a=1,o=null,l="local-floor",f=1,d=null,_=null,g=null,u=null,v=null,A=null;const D=typeof XRWebGLBinding<"u",h=new bu,c={},M=t.getContextAttributes();let R=null,b=null;const T=[],E=[],P=new gt;let m=null;const S=new Tn;S.viewport=new vt;const I=new Tn;I.viewport=new vt;const U=[S,I],B=new Kr;let J=null,Y=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(K){let te=T[K];return te===void 0&&(te=new Wn,T[K]=te),te.getTargetRaySpace()},this.getControllerGrip=function(K){let te=T[K];return te===void 0&&(te=new Wn,T[K]=te),te.getGripSpace()},this.getHand=function(K){let te=T[K];return te===void 0&&(te=new Wn,T[K]=te),te.getHandSpace()};function z(K){const te=E.indexOf(K.inputSource);if(te===-1)return;const Q=T[te];Q!==void 0&&(Q.update(K.inputSource,K.frame,d||o),Q.dispatchEvent({type:K.type,data:K.inputSource}))}function W(){r.removeEventListener("select",z),r.removeEventListener("selectstart",z),r.removeEventListener("selectend",z),r.removeEventListener("squeeze",z),r.removeEventListener("squeezestart",z),r.removeEventListener("squeezeend",z),r.removeEventListener("end",W),r.removeEventListener("inputsourceschange",H);for(let K=0;K<T.length;K++){const te=E[K];te!==null&&(E[K]=null,T[K].disconnect(te))}J=null,Y=null,h.reset();for(const K in c)delete c[K];n.setRenderTarget(R),v=null,u=null,g=null,r=null,b=null,Ve.stop(),i.isPresenting=!1,n.setPixelRatio(m),n.setSize(P.width,P.height,!1),i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(K){a=K,i.isPresenting===!0&&ke("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(K){l=K,i.isPresenting===!0&&ke("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return d||o},this.setReferenceSpace=function(K){d=K},this.getBaseLayer=function(){return u!==null?u:v},this.getBinding=function(){return g===null&&D&&(g=new XRWebGLBinding(r,t)),g},this.getFrame=function(){return A},this.getSession=function(){return r},this.setSession=async function(K){if(r=K,r!==null){if(R=n.getRenderTarget(),r.addEventListener("select",z),r.addEventListener("selectstart",z),r.addEventListener("selectend",z),r.addEventListener("squeeze",z),r.addEventListener("squeezestart",z),r.addEventListener("squeezeend",z),r.addEventListener("end",W),r.addEventListener("inputsourceschange",H),M.xrCompatible!==!0&&await t.makeXRCompatible(),m=n.getPixelRatio(),n.getSize(P),D&&"createProjectionLayer"in XRWebGLBinding.prototype){let Q=null,Re=null,Ce=null;M.depth&&(Ce=M.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,Q=M.stencil?on:dn,Re=M.stencil?Rn:en);const Me={colorFormat:t.RGBA8,depthFormat:Ce,scaleFactor:a};g=this.getBinding(),u=g.createProjectionLayer(Me),r.updateRenderState({layers:[u]}),n.setPixelRatio(1),n.setSize(u.textureWidth,u.textureHeight,!1),b=new It(u.textureWidth,u.textureHeight,{format:Gt,type:Dt,depthTexture:new An(u.textureWidth,u.textureHeight,Re,void 0,void 0,void 0,void 0,void 0,void 0,Q),stencilBuffer:M.stencil,colorSpace:n.outputColorSpace,samples:M.antialias?4:0,resolveDepthBuffer:u.ignoreDepthValues===!1,resolveStencilBuffer:u.ignoreDepthValues===!1})}else{const Q={antialias:M.antialias,alpha:!0,depth:M.depth,stencil:M.stencil,framebufferScaleFactor:a};v=new XRWebGLLayer(r,t,Q),r.updateRenderState({baseLayer:v}),n.setPixelRatio(1),n.setSize(v.framebufferWidth,v.framebufferHeight,!1),b=new It(v.framebufferWidth,v.framebufferHeight,{format:Gt,type:Dt,colorSpace:n.outputColorSpace,stencilBuffer:M.stencil,resolveDepthBuffer:v.ignoreDepthValues===!1,resolveStencilBuffer:v.ignoreDepthValues===!1})}b.isXRRenderTarget=!0,this.setFoveation(f),d=null,o=await r.requestReferenceSpace(l),Ve.setContext(r),Ve.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(r!==null)return r.environmentBlendMode},this.getDepthTexture=function(){return h.getDepthTexture()};function H(K){for(let te=0;te<K.removed.length;te++){const Q=K.removed[te],Re=E.indexOf(Q);Re>=0&&(E[Re]=null,T[Re].disconnect(Q))}for(let te=0;te<K.added.length;te++){const Q=K.added[te];let Re=E.indexOf(Q);if(Re===-1){for(let Me=0;Me<T.length;Me++)if(Me>=E.length){E.push(Q),Re=Me;break}else if(E[Me]===null){E[Me]=Q,Re=Me;break}if(Re===-1)break}const Ce=T[Re];Ce&&Ce.connect(Q)}}const Z=new we,le=new we;function _e(K,te,Q){Z.setFromMatrixPosition(te.matrixWorld),le.setFromMatrixPosition(Q.matrixWorld);const Re=Z.distanceTo(le),Ce=te.projectionMatrix.elements,Me=Q.projectionMatrix.elements,nt=Ce[14]/(Ce[10]-1),Ie=Ce[14]/(Ce[10]+1),We=(Ce[9]+1)/Ce[5],Ge=(Ce[9]-1)/Ce[5],ye=(Ce[8]-1)/Ce[0],st=(Me[8]+1)/Me[0],lt=nt*ye,ut=nt*st,pt=Re/(-ye+st),$e=pt*-ye;if(te.matrixWorld.decompose(K.position,K.quaternion,K.scale),K.translateX($e),K.translateZ(pt),K.matrixWorld.compose(K.position,K.quaternion,K.scale),K.matrixWorldInverse.copy(K.matrixWorld).invert(),Ce[10]===-1)K.projectionMatrix.copy(te.projectionMatrix),K.projectionMatrixInverse.copy(te.projectionMatrixInverse);else{const ct=nt+pt,L=Ie+pt,_t=lt-$e,He=ut+(Re-$e),x=We*Ie/L*ct,s=Ge*Ie/L*ct;K.projectionMatrix.makePerspective(_t,He,x,s,ct,L),K.projectionMatrixInverse.copy(K.projectionMatrix).invert()}}function be(K,te){te===null?K.matrixWorld.copy(K.matrix):K.matrixWorld.multiplyMatrices(te.matrixWorld,K.matrix),K.matrixWorldInverse.copy(K.matrixWorld).invert()}this.updateCamera=function(K){if(r===null)return;let te=K.near,Q=K.far;h.texture!==null&&(h.depthNear>0&&(te=h.depthNear),h.depthFar>0&&(Q=h.depthFar)),B.near=I.near=S.near=te,B.far=I.far=S.far=Q,(J!==B.near||Y!==B.far)&&(r.updateRenderState({depthNear:B.near,depthFar:B.far}),J=B.near,Y=B.far),B.layers.mask=K.layers.mask|6,S.layers.mask=B.layers.mask&-5,I.layers.mask=B.layers.mask&-3;const Re=K.parent,Ce=B.cameras;be(B,Re);for(let Me=0;Me<Ce.length;Me++)be(Ce[Me],Re);Ce.length===2?_e(B,S,I):B.projectionMatrix.copy(S.projectionMatrix),Ee(K,B,Re)};function Ee(K,te,Q){Q===null?K.matrix.copy(te.matrixWorld):(K.matrix.copy(Q.matrixWorld),K.matrix.invert(),K.matrix.multiply(te.matrixWorld)),K.matrix.decompose(K.position,K.quaternion,K.scale),K.updateMatrixWorld(!0),K.projectionMatrix.copy(te.projectionMatrix),K.projectionMatrixInverse.copy(te.projectionMatrixInverse),K.isPerspectiveCamera&&(K.fov=jr*2*Math.atan(1/K.projectionMatrix.elements[5]),K.zoom=1)}this.getCamera=function(){return B},this.getFoveation=function(){if(!(u===null&&v===null))return f},this.setFoveation=function(K){f=K,u!==null&&(u.fixedFoveation=K),v!==null&&v.fixedFoveation!==void 0&&(v.fixedFoveation=K)},this.hasDepthSensing=function(){return h.texture!==null},this.getDepthSensingMesh=function(){return h.getMesh(B)},this.getCameraTexture=function(K){return c[K]};let Ke=null;function ot(K,te){if(_=te.getViewerPose(d||o),A=te,_!==null){const Q=_.views;v!==null&&(n.setRenderTargetFramebuffer(b,v.framebuffer),n.setRenderTarget(b));let Re=!1;Q.length!==B.cameras.length&&(B.cameras.length=0,Re=!0);for(let Ie=0;Ie<Q.length;Ie++){const We=Q[Ie];let Ge=null;if(v!==null)Ge=v.getViewport(We);else{const st=g.getViewSubImage(u,We);Ge=st.viewport,Ie===0&&(n.setRenderTargetTextures(b,st.colorTexture,st.depthStencilTexture),n.setRenderTarget(b))}let ye=U[Ie];ye===void 0&&(ye=new Tn,ye.layers.enable(Ie),ye.viewport=new vt,U[Ie]=ye),ye.matrix.fromArray(We.transform.matrix),ye.matrix.decompose(ye.position,ye.quaternion,ye.scale),ye.projectionMatrix.fromArray(We.projectionMatrix),ye.projectionMatrixInverse.copy(ye.projectionMatrix).invert(),ye.viewport.set(Ge.x,Ge.y,Ge.width,Ge.height),Ie===0&&(B.matrix.copy(ye.matrix),B.matrix.decompose(B.position,B.quaternion,B.scale)),Re===!0&&B.cameras.push(ye)}const Ce=r.enabledFeatures;if(Ce&&Ce.includes("depth-sensing")&&r.depthUsage=="gpu-optimized"&&D){g=i.getBinding();const Ie=g.getDepthInformation(Q[0]);Ie&&Ie.isValid&&Ie.texture&&h.init(Ie,r.renderState)}if(Ce&&Ce.includes("camera-access")&&D){n.state.unbindTexture(),g=i.getBinding();for(let Ie=0;Ie<Q.length;Ie++){const We=Q[Ie].camera;if(We){let Ge=c[We];Ge||(Ge=new ar,c[We]=Ge);const ye=g.getCameraImage(We);Ge.sourceTexture=ye}}}}for(let Q=0;Q<T.length;Q++){const Re=E[Q],Ce=T[Q];Re!==null&&Ce!==void 0&&Ce.update(Re,te,d||o)}Ke&&Ke(K,te),te.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:te}),A=null}const Ve=new Mr;Ve.setAnimationLoop(ot),this.setAnimationLoop=function(K){Ke=K},this.dispose=function(){}}}const xu=new Ft,Dr=new Fe;Dr.set(-1,0,0,0,1,0,0,0,1);function Eu(e,n){function t(h,c){h.matrixAutoUpdate===!0&&h.updateMatrix(),c.value.copy(h.matrix)}function i(h,c){c.color.getRGB(h.fogColor.value,cr(e)),c.isFog?(h.fogNear.value=c.near,h.fogFar.value=c.far):c.isFogExp2&&(h.fogDensity.value=c.density)}function r(h,c,M,R,b){c.isNodeMaterial?c.uniformsNeedUpdate=!1:c.isMeshBasicMaterial?a(h,c):c.isMeshLambertMaterial?(a(h,c),c.envMap&&(h.envMapIntensity.value=c.envMapIntensity)):c.isMeshToonMaterial?(a(h,c),g(h,c)):c.isMeshPhongMaterial?(a(h,c),_(h,c),c.envMap&&(h.envMapIntensity.value=c.envMapIntensity)):c.isMeshStandardMaterial?(a(h,c),u(h,c),c.isMeshPhysicalMaterial&&v(h,c,b)):c.isMeshMatcapMaterial?(a(h,c),A(h,c)):c.isMeshDepthMaterial?a(h,c):c.isMeshDistanceMaterial?(a(h,c),D(h,c)):c.isMeshNormalMaterial?a(h,c):c.isLineBasicMaterial?(o(h,c),c.isLineDashedMaterial&&l(h,c)):c.isPointsMaterial?f(h,c,M,R):c.isSpriteMaterial?d(h,c):c.isShadowMaterial?(h.color.value.copy(c.color),h.opacity.value=c.opacity):c.isShaderMaterial&&(c.uniformsNeedUpdate=!1)}function a(h,c){h.opacity.value=c.opacity,c.color&&h.diffuse.value.copy(c.color),c.emissive&&h.emissive.value.copy(c.emissive).multiplyScalar(c.emissiveIntensity),c.map&&(h.map.value=c.map,t(c.map,h.mapTransform)),c.alphaMap&&(h.alphaMap.value=c.alphaMap,t(c.alphaMap,h.alphaMapTransform)),c.bumpMap&&(h.bumpMap.value=c.bumpMap,t(c.bumpMap,h.bumpMapTransform),h.bumpScale.value=c.bumpScale,c.side===Et&&(h.bumpScale.value*=-1)),c.normalMap&&(h.normalMap.value=c.normalMap,t(c.normalMap,h.normalMapTransform),h.normalScale.value.copy(c.normalScale),c.side===Et&&h.normalScale.value.negate()),c.displacementMap&&(h.displacementMap.value=c.displacementMap,t(c.displacementMap,h.displacementMapTransform),h.displacementScale.value=c.displacementScale,h.displacementBias.value=c.displacementBias),c.emissiveMap&&(h.emissiveMap.value=c.emissiveMap,t(c.emissiveMap,h.emissiveMapTransform)),c.specularMap&&(h.specularMap.value=c.specularMap,t(c.specularMap,h.specularMapTransform)),c.alphaTest>0&&(h.alphaTest.value=c.alphaTest);const M=n.get(c),R=M.envMap,b=M.envMapRotation;R&&(h.envMap.value=R,h.envMapRotation.value.setFromMatrix4(xu.makeRotationFromEuler(b)).transpose(),R.isCubeTexture&&R.isRenderTargetTexture===!1&&h.envMapRotation.value.premultiply(Dr),h.reflectivity.value=c.reflectivity,h.ior.value=c.ior,h.refractionRatio.value=c.refractionRatio),c.lightMap&&(h.lightMap.value=c.lightMap,h.lightMapIntensity.value=c.lightMapIntensity,t(c.lightMap,h.lightMapTransform)),c.aoMap&&(h.aoMap.value=c.aoMap,h.aoMapIntensity.value=c.aoMapIntensity,t(c.aoMap,h.aoMapTransform))}function o(h,c){h.diffuse.value.copy(c.color),h.opacity.value=c.opacity,c.map&&(h.map.value=c.map,t(c.map,h.mapTransform))}function l(h,c){h.dashSize.value=c.dashSize,h.totalSize.value=c.dashSize+c.gapSize,h.scale.value=c.scale}function f(h,c,M,R){h.diffuse.value.copy(c.color),h.opacity.value=c.opacity,h.size.value=c.size*M,h.scale.value=R*.5,c.map&&(h.map.value=c.map,t(c.map,h.uvTransform)),c.alphaMap&&(h.alphaMap.value=c.alphaMap,t(c.alphaMap,h.alphaMapTransform)),c.alphaTest>0&&(h.alphaTest.value=c.alphaTest)}function d(h,c){h.diffuse.value.copy(c.color),h.opacity.value=c.opacity,h.rotation.value=c.rotation,c.map&&(h.map.value=c.map,t(c.map,h.mapTransform)),c.alphaMap&&(h.alphaMap.value=c.alphaMap,t(c.alphaMap,h.alphaMapTransform)),c.alphaTest>0&&(h.alphaTest.value=c.alphaTest)}function _(h,c){h.specular.value.copy(c.specular),h.shininess.value=Math.max(c.shininess,1e-4)}function g(h,c){c.gradientMap&&(h.gradientMap.value=c.gradientMap)}function u(h,c){h.metalness.value=c.metalness,c.metalnessMap&&(h.metalnessMap.value=c.metalnessMap,t(c.metalnessMap,h.metalnessMapTransform)),h.roughness.value=c.roughness,c.roughnessMap&&(h.roughnessMap.value=c.roughnessMap,t(c.roughnessMap,h.roughnessMapTransform)),c.envMap&&(h.envMapIntensity.value=c.envMapIntensity)}function v(h,c,M){h.ior.value=c.ior,c.sheen>0&&(h.sheenColor.value.copy(c.sheenColor).multiplyScalar(c.sheen),h.sheenRoughness.value=c.sheenRoughness,c.sheenColorMap&&(h.sheenColorMap.value=c.sheenColorMap,t(c.sheenColorMap,h.sheenColorMapTransform)),c.sheenRoughnessMap&&(h.sheenRoughnessMap.value=c.sheenRoughnessMap,t(c.sheenRoughnessMap,h.sheenRoughnessMapTransform))),c.clearcoat>0&&(h.clearcoat.value=c.clearcoat,h.clearcoatRoughness.value=c.clearcoatRoughness,c.clearcoatMap&&(h.clearcoatMap.value=c.clearcoatMap,t(c.clearcoatMap,h.clearcoatMapTransform)),c.clearcoatRoughnessMap&&(h.clearcoatRoughnessMap.value=c.clearcoatRoughnessMap,t(c.clearcoatRoughnessMap,h.clearcoatRoughnessMapTransform)),c.clearcoatNormalMap&&(h.clearcoatNormalMap.value=c.clearcoatNormalMap,t(c.clearcoatNormalMap,h.clearcoatNormalMapTransform),h.clearcoatNormalScale.value.copy(c.clearcoatNormalScale),c.side===Et&&h.clearcoatNormalScale.value.negate())),c.dispersion>0&&(h.dispersion.value=c.dispersion),c.iridescence>0&&(h.iridescence.value=c.iridescence,h.iridescenceIOR.value=c.iridescenceIOR,h.iridescenceThicknessMinimum.value=c.iridescenceThicknessRange[0],h.iridescenceThicknessMaximum.value=c.iridescenceThicknessRange[1],c.iridescenceMap&&(h.iridescenceMap.value=c.iridescenceMap,t(c.iridescenceMap,h.iridescenceMapTransform)),c.iridescenceThicknessMap&&(h.iridescenceThicknessMap.value=c.iridescenceThicknessMap,t(c.iridescenceThicknessMap,h.iridescenceThicknessMapTransform))),c.transmission>0&&(h.transmission.value=c.transmission,h.transmissionSamplerMap.value=M.texture,h.transmissionSamplerSize.value.set(M.width,M.height),c.transmissionMap&&(h.transmissionMap.value=c.transmissionMap,t(c.transmissionMap,h.transmissionMapTransform)),h.thickness.value=c.thickness,c.thicknessMap&&(h.thicknessMap.value=c.thicknessMap,t(c.thicknessMap,h.thicknessMapTransform)),h.attenuationDistance.value=c.attenuationDistance,h.attenuationColor.value.copy(c.attenuationColor)),c.anisotropy>0&&(h.anisotropyVector.value.set(c.anisotropy*Math.cos(c.anisotropyRotation),c.anisotropy*Math.sin(c.anisotropyRotation)),c.anisotropyMap&&(h.anisotropyMap.value=c.anisotropyMap,t(c.anisotropyMap,h.anisotropyMapTransform))),h.specularIntensity.value=c.specularIntensity,h.specularColor.value.copy(c.specularColor),c.specularColorMap&&(h.specularColorMap.value=c.specularColorMap,t(c.specularColorMap,h.specularColorMapTransform)),c.specularIntensityMap&&(h.specularIntensityMap.value=c.specularIntensityMap,t(c.specularIntensityMap,h.specularIntensityMapTransform))}function A(h,c){c.matcap&&(h.matcap.value=c.matcap)}function D(h,c){const M=n.get(c).light;h.referencePosition.value.setFromMatrixPosition(M.matrixWorld),h.nearDistance.value=M.shadow.camera.near,h.farDistance.value=M.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:r}}function Su(e,n,t,i){let r={},a={},o=[];const l=e.getParameter(e.MAX_UNIFORM_BUFFER_BINDINGS);function f(b,T){const E=T.program;i.uniformBlockBinding(b,E)}function d(b,T){let E=r[b.id];E===void 0&&(h(b),E=_(b),r[b.id]=E,b.addEventListener("dispose",M));const P=T.program;i.updateUBOMapping(b,P);const m=n.render.frame;a[b.id]!==m&&(u(b),a[b.id]=m)}function _(b){const T=g();b.__bindingPointIndex=T;const E=e.createBuffer(),P=b.__size,m=b.usage;return e.bindBuffer(e.UNIFORM_BUFFER,E),e.bufferData(e.UNIFORM_BUFFER,P,m),e.bindBuffer(e.UNIFORM_BUFFER,null),e.bindBufferBase(e.UNIFORM_BUFFER,T,E),E}function g(){for(let b=0;b<l;b++)if(o.indexOf(b)===-1)return o.push(b),b;return Ze("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function u(b){const T=r[b.id],E=b.uniforms,P=b.__cache;e.bindBuffer(e.UNIFORM_BUFFER,T);for(let m=0,S=E.length;m<S;m++){const I=E[m];if(Array.isArray(I))for(let U=0,B=I.length;U<B;U++)v(I[U],m,U,P);else v(I,m,0,P)}e.bindBuffer(e.UNIFORM_BUFFER,null)}function v(b,T,E,P){if(D(b,T,E,P)===!0){const m=b.__offset,S=b.value;if(Array.isArray(S)){let I=0;for(let U=0;U<S.length;U++){const B=S[U],J=c(B);A(B,b.__data,I),typeof B!="number"&&typeof B!="boolean"&&!B.isMatrix3&&!ArrayBuffer.isView(B)&&(I+=J.storage/Float32Array.BYTES_PER_ELEMENT)}}else A(S,b.__data,0);e.bufferSubData(e.UNIFORM_BUFFER,m,b.__data)}}function A(b,T,E){typeof b=="number"||typeof b=="boolean"?T[0]=b:b.isMatrix3?(T[0]=b.elements[0],T[1]=b.elements[1],T[2]=b.elements[2],T[3]=0,T[4]=b.elements[3],T[5]=b.elements[4],T[6]=b.elements[5],T[7]=0,T[8]=b.elements[6],T[9]=b.elements[7],T[10]=b.elements[8],T[11]=0):ArrayBuffer.isView(b)?T.set(new b.constructor(b.buffer,b.byteOffset,T.length)):b.toArray(T,E)}function D(b,T,E,P){const m=b.value,S=T+"_"+E;if(P[S]===void 0)return typeof m=="number"||typeof m=="boolean"?P[S]=m:ArrayBuffer.isView(m)?P[S]=m.slice():P[S]=m.clone(),!0;{const I=P[S];if(typeof m=="number"||typeof m=="boolean"){if(I!==m)return P[S]=m,!0}else{if(ArrayBuffer.isView(m))return!0;if(I.equals(m)===!1)return I.copy(m),!0}}return!1}function h(b){const T=b.uniforms;let E=0;const P=16;for(let S=0,I=T.length;S<I;S++){const U=Array.isArray(T[S])?T[S]:[T[S]];for(let B=0,J=U.length;B<J;B++){const Y=U[B],z=Array.isArray(Y.value)?Y.value:[Y.value];for(let W=0,H=z.length;W<H;W++){const Z=z[W],le=c(Z),_e=E%P,be=_e%le.boundary,Ee=_e+be;E+=be,Ee!==0&&P-Ee<le.storage&&(E+=P-Ee),Y.__data=new Float32Array(le.storage/Float32Array.BYTES_PER_ELEMENT),Y.__offset=E,E+=le.storage}}}const m=E%P;return m>0&&(E+=P-m),b.__size=E,b.__cache={},this}function c(b){const T={boundary:0,storage:0};return typeof b=="number"||typeof b=="boolean"?(T.boundary=4,T.storage=4):b.isVector2?(T.boundary=8,T.storage=8):b.isVector3||b.isColor?(T.boundary=16,T.storage=12):b.isVector4?(T.boundary=16,T.storage=16):b.isMatrix3?(T.boundary=48,T.storage=48):b.isMatrix4?(T.boundary=64,T.storage=64):b.isTexture?ke("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(b)?(T.boundary=16,T.storage=b.byteLength):ke("WebGLRenderer: Unsupported uniform value type.",b),T}function M(b){const T=b.target;T.removeEventListener("dispose",M);const E=o.indexOf(T.__bindingPointIndex);o.splice(E,1),e.deleteBuffer(r[T.id]),delete r[T.id],delete a[T.id]}function R(){for(const b in r)e.deleteBuffer(r[b]);o=[],r={},a={}}return{bind:f,update:d,dispose:R}}const Tu=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]);let Pt=null;function Mu(){return Pt===null&&(Pt=new Yr(Tu,16,16,un,Jt),Pt.name="DFG_LUT",Pt.minFilter=mt,Pt.magFilter=mt,Pt.wrapS=yn,Pt.wrapT=yn,Pt.generateMipmaps=!1,Pt.needsUpdate=!0),Pt}class cp{constructor(n={}){const{canvas:t=Vr(),context:i=null,depth:r=!0,stencil:a=!1,alpha:o=!1,antialias:l=!1,premultipliedAlpha:f=!0,preserveDrawingBuffer:d=!1,powerPreference:_="default",failIfMajorPerformanceCaveat:g=!1,reversedDepthBuffer:u=!1,outputBufferType:v=Dt}=n;this.isWebGLRenderer=!0;let A;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");A=i.getContextAttributes().alpha}else A=o;const D=v,h=new Set([$a,er,tr]),c=new Set([Dt,en,Gn,Rn,nr,ir]),M=new Uint32Array(4),R=new Int32Array(4),b=new we;let T=null,E=null;const P=[],m=[];let S=null;this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=Nt,this.toneMappingExposure=1,this.transmissionResolutionScale=1;const I=this;let U=!1,B=null,J=null,Y=null,z=null;this._outputColorSpace=ln;let W=0,H=0,Z=null,le=-1,_e=null;const be=new vt,Ee=new vt;let Ke=null;const ot=new Be(0);let Ve=0,K=t.width,te=t.height,Q=1,Re=null,Ce=null;const Me=new vt(0,0,K,te),nt=new vt(0,0,K,te);let Ie=!1;const We=new Ja;let Ge=!1,ye=!1;const st=new Ft,lt=new we,ut=new vt,pt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let $e=!1;function ct(){return Z===null?Q:1}let L=i;function _t(p,w){return t.getContext(p,w)}try{const p={alpha:!0,depth:r,stencil:a,antialias:l,premultipliedAlpha:f,preserveDrawingBuffer:d,powerPreference:_,failIfMajorPerformanceCaveat:g};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${zr}`),t.addEventListener("webglcontextlost",et,!1),t.addEventListener("webglcontextrestored",je,!1),t.addEventListener("webglcontextcreationerror",At,!1),L===null){const w="webgl2";if(L=_t(w,p),L===null)throw _t(w)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}}catch(p){throw Ze("WebGLRenderer: "+p.message),p}let He,x,s,N,O,k,$,ne,V,q,ie,ve,oe,ae,Te,Ae,Pe,C,ee,X,re,de,j;function ge(){He=new Mf(L),He.init(),re=new mu(L,He),x=new gf(L,He,n,re),s=new pu(L,He),x.reversedDepthBuffer&&u&&s.buffers.depth.setReversed(!0),J=L.createFramebuffer(),Y=L.createFramebuffer(),z=L.createFramebuffer(),N=new Cf(L),O=new $d,k=new hu(L,He,s,O,x,re,N),$=new Tf(I),ne=new ws(L),de=new hf(L,ne),V=new Af(L,ne,N,de),q=new Lf(L,V,ne,de,N),C=new Pf(L,x,k),Te=new _f(O),ie=new Qd(I,$,He,x,de,Te),ve=new Eu(I,O),oe=new tu,ae=new su(He),Pe=new pf(I,$,s,q,A,f),Ae=new uu(I,q,x),j=new Su(L,N,x,s),ee=new mf(L,He,N),X=new Rf(L,He,N),N.programs=ie.programs,I.capabilities=x,I.extensions=He,I.properties=O,I.renderLists=oe,I.shadowMap=Ae,I.state=s,I.info=N}ge(),D!==Dt&&(S=new Df(D,t.width,t.height,l,r,a));const he=new vu(I,L);this.xr=he,this.getContext=function(){return L},this.getContextAttributes=function(){return L.getContextAttributes()},this.forceContextLoss=function(){const p=He.get("WEBGL_lose_context");p&&p.loseContext()},this.forceContextRestore=function(){const p=He.get("WEBGL_lose_context");p&&p.restoreContext()},this.getPixelRatio=function(){return Q},this.setPixelRatio=function(p){p!==void 0&&(Q=p,this.setSize(K,te,!1))},this.getSize=function(p){return p.set(K,te)},this.setSize=function(p,w,G=!0){if(he.isPresenting){ke("WebGLRenderer: Can't change size while VR device is presenting.");return}K=p,te=w,t.width=Math.floor(p*Q),t.height=Math.floor(w*Q),G===!0&&(t.style.width=p+"px",t.style.height=w+"px"),S!==null&&S.setSize(t.width,t.height),this.setViewport(0,0,p,w)},this.getDrawingBufferSize=function(p){return p.set(K*Q,te*Q).floor()},this.setDrawingBufferSize=function(p,w,G){K=p,te=w,Q=G,t.width=Math.floor(p*G),t.height=Math.floor(w*G),this.setViewport(0,0,p,w)},this.setEffects=function(p){if(D===Dt){Ze("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(p){for(let w=0;w<p.length;w++)if(p[w].isOutputPass===!0){ke("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}S.setEffects(p||[])},this.getCurrentViewport=function(p){return p.copy(be)},this.getViewport=function(p){return p.copy(Me)},this.setViewport=function(p,w,G,F){p.isVector4?Me.set(p.x,p.y,p.z,p.w):Me.set(p,w,G,F),s.viewport(be.copy(Me).multiplyScalar(Q).round())},this.getScissor=function(p){return p.copy(nt)},this.setScissor=function(p,w,G,F){p.isVector4?nt.set(p.x,p.y,p.z,p.w):nt.set(p,w,G,F),s.scissor(Ee.copy(nt).multiplyScalar(Q).round())},this.getScissorTest=function(){return Ie},this.setScissorTest=function(p){s.setScissorTest(Ie=p)},this.setOpaqueSort=function(p){Re=p},this.setTransparentSort=function(p){Ce=p},this.getClearColor=function(p){return p.copy(Pe.getClearColor())},this.setClearColor=function(){Pe.setClearColor(...arguments)},this.getClearAlpha=function(){return Pe.getClearAlpha()},this.setClearAlpha=function(){Pe.setClearAlpha(...arguments)},this.clear=function(p=!0,w=!0,G=!0){let F=0;if(p){let y=!1;if(Z!==null){const fe=Z.texture.format;y=h.has(fe)}if(y){const fe=Z.texture.type,pe=c.has(fe),ce=Pe.getClearColor(),me=Pe.getClearAlpha(),xe=ce.r,Le=ce.g,Ue=ce.b;pe?(M[0]=xe,M[1]=Le,M[2]=Ue,M[3]=me,L.clearBufferuiv(L.COLOR,0,M)):(R[0]=xe,R[1]=Le,R[2]=Ue,R[3]=me,L.clearBufferiv(L.COLOR,0,R))}else F|=L.COLOR_BUFFER_BIT}w&&(F|=L.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),G&&(F|=L.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),F!==0&&L.clear(F)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(p){p.setRenderer(this),B=p},this.dispose=function(){t.removeEventListener("webglcontextlost",et,!1),t.removeEventListener("webglcontextrestored",je,!1),t.removeEventListener("webglcontextcreationerror",At,!1),Pe.dispose(),oe.dispose(),ae.dispose(),O.dispose(),$.dispose(),q.dispose(),de.dispose(),j.dispose(),ie.dispose(),he.dispose(),he.removeEventListener("sessionstart",Si),he.removeEventListener("sessionend",Ti),Zt.stop()};function et(p){p.preventDefault(),wi("WebGLRenderer: Context Lost."),U=!0}function je(){wi("WebGLRenderer: Context Restored."),U=!1;const p=N.autoReset,w=Ae.enabled,G=Ae.autoUpdate,F=Ae.needsUpdate,y=Ae.type;ge(),N.autoReset=p,Ae.enabled=w,Ae.autoUpdate=G,Ae.needsUpdate=F,Ae.type=y}function At(p){Ze("WebGLRenderer: A WebGL context could not be created. Reason: ",p.statusMessage)}function Rt(p){const w=p.target;w.removeEventListener("dispose",Rt),Fr(w)}function Fr(p){yr(p),O.remove(p)}function yr(p){const w=O.get(p).programs;w!==void 0&&(w.forEach(function(G){ie.releaseProgram(G)}),p.isShaderMaterial&&ie.releaseShaderCache(p))}this.renderBufferDirect=function(p,w,G,F,y,fe){w===null&&(w=pt);const pe=y.isMesh&&y.matrixWorld.determinantAffine()<0,ce=Br(p,w,G,F,y);s.setMaterial(F,pe);let me=G.index,xe=1;if(F.wireframe===!0){if(me=V.getWireframeAttribute(G),me===void 0)return;xe=2}const Le=G.drawRange,Ue=G.attributes.position;let Se=Le.start*xe,ze=(Le.start+Le.count)*xe;fe!==null&&(Se=Math.max(Se,fe.start*xe),ze=Math.min(ze,(fe.start+fe.count)*xe)),me!==null?(Se=Math.max(Se,0),ze=Math.min(ze,me.count)):Ue!=null&&(Se=Math.max(Se,0),ze=Math.min(ze,Ue.count));const it=ze-Se;if(it<0||it===1/0)return;de.setup(y,F,ce,G,me);let tt,Xe=ee;if(me!==null&&(tt=ne.get(me),Xe=X,Xe.setIndex(tt)),y.isMesh)F.wireframe===!0?(s.setLineWidth(F.wireframeLinewidth*ct()),Xe.setMode(L.LINES)):Xe.setMode(L.TRIANGLES);else if(y.isLine){let ht=F.linewidth;ht===void 0&&(ht=1),s.setLineWidth(ht*ct()),y.isLineSegments?Xe.setMode(L.LINES):y.isLineLoop?Xe.setMode(L.LINE_LOOP):Xe.setMode(L.LINE_STRIP)}else y.isPoints?Xe.setMode(L.POINTS):y.isSprite&&Xe.setMode(L.TRIANGLES);if(y.isBatchedMesh)if(He.get("WEBGL_multi_draw"))Xe.renderMultiDraw(y._multiDrawStarts,y._multiDrawCounts,y._multiDrawCount);else{const ht=y._multiDrawStarts,ue=y._multiDrawCounts,xt=y._multiDrawCount,Oe=me?ne.get(me).bytesPerElement:1,St=O.get(F).currentProgram.getUniforms();for(let Ct=0;Ct<xt;Ct++)St.setValue(L,"_gl_DrawID",Ct),Xe.render(ht[Ct]/Oe,ue[Ct])}else if(y.isInstancedMesh)Xe.renderInstances(Se,it,y.count);else if(G.isInstancedBufferGeometry){const ht=G._maxInstanceCount!==void 0?G._maxInstanceCount:1/0,ue=Math.min(G.instanceCount,ht);Xe.renderInstances(Se,it,ue)}else Xe.render(Se,it)};function Ei(p,w,G){p.transparent===!0&&p.side===Ut&&p.forceSinglePass===!1?(p.side=Et,p.needsUpdate=!0,Ln(p,w,G),p.side=fn,p.needsUpdate=!0,Ln(p,w,G),p.side=Ut):Ln(p,w,G)}this.compile=function(p,w,G=null){G===null&&(G=p),E=ae.get(G),E.init(w),m.push(E),G.traverseVisible(function(y){y.isLight&&y.layers.test(w.layers)&&(E.pushLight(y),y.castShadow&&E.pushShadow(y))}),p!==G&&p.traverseVisible(function(y){y.isLight&&y.layers.test(w.layers)&&(E.pushLight(y),y.castShadow&&E.pushShadow(y))}),E.setupLights();const F=new Set;return p.traverse(function(y){if(!(y.isMesh||y.isPoints||y.isLine||y.isSprite))return;const fe=y.material;if(fe)if(Array.isArray(fe))for(let pe=0;pe<fe.length;pe++){const ce=fe[pe];Ei(ce,G,y),F.add(ce)}else Ei(fe,G,y),F.add(fe)}),E=m.pop(),F},this.compileAsync=function(p,w,G=null){const F=this.compile(p,w,G);return new Promise(y=>{function fe(){if(F.forEach(function(pe){O.get(pe).currentProgram.isReady()&&F.delete(pe)}),F.size===0){y(p);return}setTimeout(fe,10)}He.get("KHR_parallel_shader_compile")!==null?fe():setTimeout(fe,10)})};let Vn=null;function Or(p){Vn&&Vn(p)}function Si(){Zt.stop()}function Ti(){Zt.start()}const Zt=new Mr;Zt.setAnimationLoop(Or),typeof self<"u"&&Zt.setContext(self),this.setAnimationLoop=function(p){Vn=p,he.setAnimationLoop(p),p===null?Zt.stop():Zt.start()},he.addEventListener("sessionstart",Si),he.addEventListener("sessionend",Ti),this.render=function(p,w){if(w!==void 0&&w.isCamera!==!0){Ze("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(U===!0)return;B!==null&&B.renderStart(p,w);const G=he.enabled===!0&&he.isPresenting===!0,F=S!==null&&(Z===null||G)&&S.begin(I,Z);if(p.matrixWorldAutoUpdate===!0&&p.updateMatrixWorld(),w.parent===null&&w.matrixWorldAutoUpdate===!0&&w.updateMatrixWorld(),he.enabled===!0&&he.isPresenting===!0&&(S===null||S.isCompositing()===!1)&&(he.cameraAutoUpdate===!0&&he.updateCamera(w),w=he.getCamera()),p.isScene===!0&&p.onBeforeRender(I,p,w,Z),E=ae.get(p,m.length),E.init(w),E.state.textureUnits=k.getTextureUnits(),m.push(E),st.multiplyMatrices(w.projectionMatrix,w.matrixWorldInverse),We.setFromProjectionMatrix(st,Di,w.reversedDepth),ye=this.localClippingEnabled,Ge=Te.init(this.clippingPlanes,ye),T=oe.get(p,P.length),T.init(),P.push(T),he.enabled===!0&&he.isPresenting===!0){const pe=I.xr.getDepthSensingMesh();pe!==null&&zn(pe,w,-1/0,I.sortObjects)}zn(p,w,0,I.sortObjects),T.finish(),I.sortObjects===!0&&T.sort(Re,Ce,w.reversedDepth),$e=he.enabled===!1||he.isPresenting===!1||he.hasDepthSensing()===!1,$e&&Pe.addToRenderList(T,p),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),Ge===!0&&Te.beginShadows();const y=E.state.shadowsArray;if(Ae.render(y,p,w),Ge===!0&&Te.endShadows(),(F&&S.hasRenderPass())===!1){const pe=T.opaque,ce=T.transmissive;if(E.setupLights(),w.isArrayCamera){const me=w.cameras;if(ce.length>0)for(let xe=0,Le=me.length;xe<Le;xe++){const Ue=me[xe];Ai(pe,ce,p,Ue)}$e&&Pe.render(p);for(let xe=0,Le=me.length;xe<Le;xe++){const Ue=me[xe];Mi(T,p,Ue,Ue.viewport)}}else ce.length>0&&Ai(pe,ce,p,w),$e&&Pe.render(p),Mi(T,p,w)}Z!==null&&H===0&&(k.updateMultisampleRenderTarget(Z),k.updateRenderTargetMipmap(Z)),F&&S.end(I),p.isScene===!0&&p.onAfterRender(I,p,w),de.resetDefaultState(),le=-1,_e=null,m.pop(),m.length>0?(E=m[m.length-1],k.setTextureUnits(E.state.textureUnits),Ge===!0&&Te.setGlobalState(I.clippingPlanes,E.state.camera)):E=null,P.pop(),P.length>0?T=P[P.length-1]:T=null,B!==null&&B.renderEnd()};function zn(p,w,G,F){if(p.visible===!1)return;if(p.layers.test(w.layers)){if(p.isGroup)G=p.renderOrder;else if(p.isLOD)p.autoUpdate===!0&&p.update(w);else if(p.isLightProbeGrid)E.pushLightProbeGrid(p);else if(p.isLight)E.pushLight(p),p.castShadow&&E.pushShadow(p);else if(p.isSprite){if(!p.frustumCulled||We.intersectsSprite(p)){F&&ut.setFromMatrixPosition(p.matrixWorld).applyMatrix4(st);const pe=q.update(p),ce=p.material;ce.visible&&T.push(p,pe,ce,G,ut.z,null)}}else if((p.isMesh||p.isLine||p.isPoints)&&(!p.frustumCulled||We.intersectsObject(p))){const pe=q.update(p),ce=p.material;if(F&&(p.boundingSphere!==void 0?(p.boundingSphere===null&&p.computeBoundingSphere(),ut.copy(p.boundingSphere.center)):(pe.boundingSphere===null&&pe.computeBoundingSphere(),ut.copy(pe.boundingSphere.center)),ut.applyMatrix4(p.matrixWorld).applyMatrix4(st)),Array.isArray(ce)){const me=pe.groups;for(let xe=0,Le=me.length;xe<Le;xe++){const Ue=me[xe],Se=ce[Ue.materialIndex];Se&&Se.visible&&T.push(p,pe,Se,G,ut.z,Ue)}}else ce.visible&&T.push(p,pe,ce,G,ut.z,null)}}const fe=p.children;for(let pe=0,ce=fe.length;pe<ce;pe++)zn(fe[pe],w,G,F)}function Mi(p,w,G,F){const{opaque:y,transmissive:fe,transparent:pe}=p;E.setupLightsView(G),Ge===!0&&Te.setGlobalState(I.clippingPlanes,G),F&&s.viewport(be.copy(F)),y.length>0&&Pn(y,w,G),fe.length>0&&Pn(fe,w,G),pe.length>0&&Pn(pe,w,G),s.buffers.depth.setTest(!0),s.buffers.depth.setMask(!0),s.buffers.color.setMask(!0),s.setPolygonOffset(!1)}function Ai(p,w,G,F){if((G.isScene===!0?G.overrideMaterial:null)!==null)return;if(E.state.transmissionRenderTarget[F.id]===void 0){const Se=He.has("EXT_color_buffer_half_float")||He.has("EXT_color_buffer_float");E.state.transmissionRenderTarget[F.id]=new It(1,1,{generateMipmaps:!0,type:Se?Jt:Dt,minFilter:qt,samples:Math.max(4,x.samples),stencilBuffer:a,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:Qe.workingColorSpace})}const fe=E.state.transmissionRenderTarget[F.id],pe=F.viewport||be;fe.setSize(pe.z*I.transmissionResolutionScale,pe.w*I.transmissionResolutionScale);const ce=I.getRenderTarget(),me=I.getActiveCubeFace(),xe=I.getActiveMipmapLevel();I.setRenderTarget(fe),I.getClearColor(ot),Ve=I.getClearAlpha(),Ve<1&&I.setClearColor(16777215,.5),I.clear(),$e&&Pe.render(G);const Le=I.toneMapping;I.toneMapping=Nt;const Ue=F.viewport;if(F.viewport!==void 0&&(F.viewport=void 0),E.setupLightsView(F),Ge===!0&&Te.setGlobalState(I.clippingPlanes,F),Pn(p,G,F),k.updateMultisampleRenderTarget(fe),k.updateRenderTargetMipmap(fe),He.has("WEBGL_multisampled_render_to_texture")===!1){let Se=!1;for(let ze=0,it=w.length;ze<it;ze++){const tt=w[ze],{object:Xe,geometry:ht,material:ue,group:xt}=tt;if(ue.side===Ut&&Xe.layers.test(F.layers)){const Oe=ue.side;ue.side=Et,ue.needsUpdate=!0,Ri(Xe,G,F,ht,ue,xt),ue.side=Oe,ue.needsUpdate=!0,Se=!0}}Se===!0&&(k.updateMultisampleRenderTarget(fe),k.updateRenderTargetMipmap(fe))}I.setRenderTarget(ce,me,xe),I.setClearColor(ot,Ve),Ue!==void 0&&(F.viewport=Ue),I.toneMapping=Le}function Pn(p,w,G){const F=w.isScene===!0?w.overrideMaterial:null;for(let y=0,fe=p.length;y<fe;y++){const pe=p[y],{object:ce,geometry:me,group:xe}=pe;let Le=pe.material;Le.allowOverride===!0&&F!==null&&(Le=F),ce.layers.test(G.layers)&&Ri(ce,w,G,me,Le,xe)}}function Ri(p,w,G,F,y,fe){p.onBeforeRender(I,w,G,F,y,fe),p.modelViewMatrix.multiplyMatrices(G.matrixWorldInverse,p.matrixWorld),p.normalMatrix.getNormalMatrix(p.modelViewMatrix),y.onBeforeRender(I,w,G,F,p,fe),y.transparent===!0&&y.side===Ut&&y.forceSinglePass===!1?(y.side=Et,y.needsUpdate=!0,I.renderBufferDirect(G,w,F,y,p,fe),y.side=fn,y.needsUpdate=!0,I.renderBufferDirect(G,w,F,y,p,fe),y.side=Ut):I.renderBufferDirect(G,w,F,y,p,fe),p.onAfterRender(I,w,G,F,y,fe)}function Ln(p,w,G){w.isScene!==!0&&(w=pt);const F=O.get(p),y=E.state.lights,fe=E.state.shadowsArray,pe=y.state.version,ce=ie.getParameters(p,y.state,fe,w,G,E.state.lightProbeGridArray),me=ie.getProgramCacheKey(ce);let xe=F.programs;F.environment=p.isMeshStandardMaterial||p.isMeshLambertMaterial||p.isMeshPhongMaterial?w.environment:null,F.fog=w.fog;const Le=p.isMeshStandardMaterial||p.isMeshLambertMaterial&&!p.envMap||p.isMeshPhongMaterial&&!p.envMap;F.envMap=$.get(p.envMap||F.environment,Le),F.envMapRotation=F.environment!==null&&p.envMap===null?w.environmentRotation:p.envMapRotation,xe===void 0&&(p.addEventListener("dispose",Rt),xe=new Map,F.programs=xe);let Ue=xe.get(me);if(Ue!==void 0){if(F.currentProgram===Ue&&F.lightsStateVersion===pe)return Pi(p,ce),Ue}else ce.uniforms=ie.getUniforms(p),B!==null&&p.isNodeMaterial&&B.build(p,G,ce),p.onBeforeCompile(ce,I),Ue=ie.acquireProgram(ce,me),xe.set(me,Ue),F.uniforms=ce.uniforms;const Se=F.uniforms;return(!p.isShaderMaterial&&!p.isRawShaderMaterial||p.clipping===!0)&&(Se.clippingPlanes=Te.uniform),Pi(p,ce),F.needsLights=Hr(p),F.lightsStateVersion=pe,F.needsLights&&(Se.ambientLightColor.value=y.state.ambient,Se.lightProbe.value=y.state.probe,Se.directionalLights.value=y.state.directional,Se.directionalLightShadows.value=y.state.directionalShadow,Se.spotLights.value=y.state.spot,Se.spotLightShadows.value=y.state.spotShadow,Se.rectAreaLights.value=y.state.rectArea,Se.ltc_1.value=y.state.rectAreaLTC1,Se.ltc_2.value=y.state.rectAreaLTC2,Se.pointLights.value=y.state.point,Se.pointLightShadows.value=y.state.pointShadow,Se.hemisphereLights.value=y.state.hemi,Se.directionalShadowMatrix.value=y.state.directionalShadowMatrix,Se.spotLightMatrix.value=y.state.spotLightMatrix,Se.spotLightMap.value=y.state.spotLightMap,Se.pointShadowMatrix.value=y.state.pointShadowMatrix),F.lightProbeGrid=E.state.lightProbeGridArray.length>0,F.currentProgram=Ue,F.uniformsList=null,Ue}function Ci(p){if(p.uniformsList===null){const w=p.currentProgram.getUniforms();p.uniformsList=Fn.seqWithValue(w.seq,p.uniforms)}return p.uniformsList}function Pi(p,w){const G=O.get(p);G.outputColorSpace=w.outputColorSpace,G.batching=w.batching,G.batchingColor=w.batchingColor,G.instancing=w.instancing,G.instancingColor=w.instancingColor,G.instancingMorph=w.instancingMorph,G.skinning=w.skinning,G.morphTargets=w.morphTargets,G.morphNormals=w.morphNormals,G.morphColors=w.morphColors,G.morphTargetsCount=w.morphTargetsCount,G.numClippingPlanes=w.numClippingPlanes,G.numIntersection=w.numClipIntersection,G.vertexAlphas=w.vertexAlphas,G.vertexTangents=w.vertexTangents,G.toneMapping=w.toneMapping}function Gr(p,w){if(p.length===0)return null;if(p.length===1)return p[0].texture!==null?p[0]:null;b.setFromMatrixPosition(w.matrixWorld);for(let G=0,F=p.length;G<F;G++){const y=p[G];if(y.texture!==null&&y.boundingBox.containsPoint(b))return y}return null}function Br(p,w,G,F,y){w.isScene!==!0&&(w=pt),k.resetTextureUnits();const fe=w.fog,pe=F.isMeshStandardMaterial||F.isMeshLambertMaterial||F.isMeshPhongMaterial?w.environment:null,ce=Z===null?I.outputColorSpace:Z.isXRRenderTarget===!0?Z.texture.colorSpace:Qe.workingColorSpace,me=F.isMeshStandardMaterial||F.isMeshLambertMaterial&&!F.envMap||F.isMeshPhongMaterial&&!F.envMap,xe=$.get(F.envMap||pe,me),Le=F.vertexColors===!0&&!!G.attributes.color&&G.attributes.color.itemSize===4,Ue=!!G.attributes.tangent&&(!!F.normalMap||F.anisotropy>0),Se=!!G.morphAttributes.position,ze=!!G.morphAttributes.normal,it=!!G.morphAttributes.color;let tt=Nt;F.toneMapped&&(Z===null||Z.isXRRenderTarget===!0)&&(tt=I.toneMapping);const Xe=G.morphAttributes.position||G.morphAttributes.normal||G.morphAttributes.color,ht=Xe!==void 0?Xe.length:0,ue=O.get(F),xt=E.state.lights;if(Ge===!0&&(ye===!0||p!==_e)){const Ye=p===_e&&F.id===le;Te.setState(F,p,Ye)}let Oe=!1;F.version===ue.__version?(ue.needsLights&&ue.lightsStateVersion!==xt.state.version||ue.outputColorSpace!==ce||y.isBatchedMesh&&ue.batching===!1||!y.isBatchedMesh&&ue.batching===!0||y.isBatchedMesh&&ue.batchingColor===!0&&y.colorTexture===null||y.isBatchedMesh&&ue.batchingColor===!1&&y.colorTexture!==null||y.isInstancedMesh&&ue.instancing===!1||!y.isInstancedMesh&&ue.instancing===!0||y.isSkinnedMesh&&ue.skinning===!1||!y.isSkinnedMesh&&ue.skinning===!0||y.isInstancedMesh&&ue.instancingColor===!0&&y.instanceColor===null||y.isInstancedMesh&&ue.instancingColor===!1&&y.instanceColor!==null||y.isInstancedMesh&&ue.instancingMorph===!0&&y.morphTexture===null||y.isInstancedMesh&&ue.instancingMorph===!1&&y.morphTexture!==null||ue.envMap!==xe||F.fog===!0&&ue.fog!==fe||ue.numClippingPlanes!==void 0&&(ue.numClippingPlanes!==Te.numPlanes||ue.numIntersection!==Te.numIntersection)||ue.vertexAlphas!==Le||ue.vertexTangents!==Ue||ue.morphTargets!==Se||ue.morphNormals!==ze||ue.morphColors!==it||ue.toneMapping!==tt||ue.morphTargetsCount!==ht||!!ue.lightProbeGrid!=E.state.lightProbeGridArray.length>0)&&(Oe=!0):(Oe=!0,ue.__version=F.version);let St=ue.currentProgram;Oe===!0&&(St=Ln(F,w,y),B&&F.isNodeMaterial&&B.onUpdateProgram(F,St,ue));let Ct=!1,Vt=!1,tn=!1;const qe=St.getUniforms(),at=ue.uniforms;if(s.useProgram(St.program)&&(Ct=!0,Vt=!0,tn=!0),F.id!==le&&(le=F.id,Vt=!0),ue.needsLights){const Ye=Gr(E.state.lightProbeGridArray,y);ue.lightProbeGrid!==Ye&&(ue.lightProbeGrid=Ye,Vt=!0)}if(Ct||_e!==p){s.buffers.depth.getReversed()&&p.reversedDepth!==!0&&(p._reversedDepth=!0,p.updateProjectionMatrix()),qe.setValue(L,"projectionMatrix",p.projectionMatrix),qe.setValue(L,"viewMatrix",p.matrixWorldInverse);const Wt=qe.map.cameraPosition;Wt!==void 0&&Wt.setValue(L,lt.setFromMatrixPosition(p.matrixWorld)),x.logarithmicDepthBuffer&&qe.setValue(L,"logDepthBufFC",2/(Math.log(p.far+1)/Math.LN2)),(F.isMeshPhongMaterial||F.isMeshToonMaterial||F.isMeshLambertMaterial||F.isMeshBasicMaterial||F.isMeshStandardMaterial||F.isShaderMaterial)&&qe.setValue(L,"isOrthographic",p.isOrthographicCamera===!0),_e!==p&&(_e=p,Vt=!0,tn=!0)}if(ue.needsLights&&(xt.state.directionalShadowMap.length>0&&qe.setValue(L,"directionalShadowMap",xt.state.directionalShadowMap,k),xt.state.spotShadowMap.length>0&&qe.setValue(L,"spotShadowMap",xt.state.spotShadowMap,k),xt.state.pointShadowMap.length>0&&qe.setValue(L,"pointShadowMap",xt.state.pointShadowMap,k)),y.isSkinnedMesh){qe.setOptional(L,y,"bindMatrix"),qe.setOptional(L,y,"bindMatrixInverse");const Ye=y.skeleton;Ye&&(Ye.boneTexture===null&&Ye.computeBoneTexture(),qe.setValue(L,"boneTexture",Ye.boneTexture,k))}y.isBatchedMesh&&(qe.setOptional(L,y,"batchingTexture"),qe.setValue(L,"batchingTexture",y._matricesTexture,k),qe.setOptional(L,y,"batchingIdTexture"),qe.setValue(L,"batchingIdTexture",y._indirectTexture,k),qe.setOptional(L,y,"batchingColorTexture"),y._colorsTexture!==null&&qe.setValue(L,"batchingColorTexture",y._colorsTexture,k));const zt=G.morphAttributes;if((zt.position!==void 0||zt.normal!==void 0||zt.color!==void 0)&&C.update(y,G,St),(Vt||ue.receiveShadow!==y.receiveShadow)&&(ue.receiveShadow=y.receiveShadow,qe.setValue(L,"receiveShadow",y.receiveShadow)),(F.isMeshStandardMaterial||F.isMeshLambertMaterial||F.isMeshPhongMaterial)&&F.envMap===null&&w.environment!==null&&(at.envMapIntensity.value=w.environmentIntensity),at.dfgLUT!==void 0&&(at.dfgLUT.value=Mu()),Vt){if(qe.setValue(L,"toneMappingExposure",I.toneMappingExposure),ue.needsLights&&kr(at,tn),fe&&F.fog===!0&&ve.refreshFogUniforms(at,fe),ve.refreshMaterialUniforms(at,F,Q,te,E.state.transmissionRenderTarget[p.id]),ue.needsLights&&ue.lightProbeGrid){const Ye=ue.lightProbeGrid;at.probesSH.value=Ye.texture,at.probesMin.value.copy(Ye.boundingBox.min),at.probesMax.value.copy(Ye.boundingBox.max),at.probesResolution.value.copy(Ye.resolution)}Fn.upload(L,Ci(ue),at,k)}if(F.isShaderMaterial&&F.uniformsNeedUpdate===!0&&(Fn.upload(L,Ci(ue),at,k),F.uniformsNeedUpdate=!1),F.isSpriteMaterial&&qe.setValue(L,"center",y.center),qe.setValue(L,"modelViewMatrix",y.modelViewMatrix),qe.setValue(L,"normalMatrix",y.normalMatrix),qe.setValue(L,"modelMatrix",y.matrixWorld),F.uniformsGroups!==void 0){const Ye=F.uniformsGroups;for(let Wt=0,nn=Ye.length;Wt<nn;Wt++){const Li=Ye[Wt];j.update(Li,St),j.bind(Li,St)}}return St}function kr(p,w){p.ambientLightColor.needsUpdate=w,p.lightProbe.needsUpdate=w,p.directionalLights.needsUpdate=w,p.directionalLightShadows.needsUpdate=w,p.pointLights.needsUpdate=w,p.pointLightShadows.needsUpdate=w,p.spotLights.needsUpdate=w,p.spotLightShadows.needsUpdate=w,p.rectAreaLights.needsUpdate=w,p.hemisphereLights.needsUpdate=w}function Hr(p){return p.isMeshLambertMaterial||p.isMeshToonMaterial||p.isMeshPhongMaterial||p.isMeshStandardMaterial||p.isShadowMaterial||p.isShaderMaterial&&p.lights===!0}this.getActiveCubeFace=function(){return W},this.getActiveMipmapLevel=function(){return H},this.getRenderTarget=function(){return Z},this.setRenderTargetTextures=function(p,w,G){const F=O.get(p);F.__autoAllocateDepthBuffer=p.resolveDepthBuffer===!1,F.__autoAllocateDepthBuffer===!1&&(F.__useRenderToTexture=!1),O.get(p.texture).__webglTexture=w,O.get(p.depthTexture).__webglTexture=F.__autoAllocateDepthBuffer?void 0:G,F.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(p,w){const G=O.get(p);G.__webglFramebuffer=w,G.__useDefaultFramebuffer=w===void 0},this.setRenderTarget=function(p,w=0,G=0){Z=p,W=w,H=G;let F=null,y=!1,fe=!1;if(p){const ce=O.get(p);if(ce.__useDefaultFramebuffer!==void 0){s.bindFramebuffer(L.FRAMEBUFFER,ce.__webglFramebuffer),be.copy(p.viewport),Ee.copy(p.scissor),Ke=p.scissorTest,s.viewport(be),s.scissor(Ee),s.setScissorTest(Ke),le=-1;return}else if(ce.__webglFramebuffer===void 0)k.setupRenderTarget(p);else if(ce.__hasExternalTextures)k.rebindTextures(p,O.get(p.texture).__webglTexture,O.get(p.depthTexture).__webglTexture);else if(p.depthBuffer){const Le=p.depthTexture;if(ce.__boundDepthTexture!==Le){if(Le!==null&&O.has(Le)&&(p.width!==Le.image.width||p.height!==Le.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");k.setupDepthRenderbuffer(p)}}const me=p.texture;(me.isData3DTexture||me.isDataArrayTexture||me.isCompressedArrayTexture)&&(fe=!0);const xe=O.get(p).__webglFramebuffer;p.isWebGLCubeRenderTarget?(Array.isArray(xe[w])?F=xe[w][G]:F=xe[w],y=!0):p.samples>0&&k.useMultisampledRTT(p)===!1?F=O.get(p).__webglMultisampledFramebuffer:Array.isArray(xe)?F=xe[G]:F=xe,be.copy(p.viewport),Ee.copy(p.scissor),Ke=p.scissorTest}else be.copy(Me).multiplyScalar(Q).floor(),Ee.copy(nt).multiplyScalar(Q).floor(),Ke=Ie;if(G!==0&&(F=J),s.bindFramebuffer(L.FRAMEBUFFER,F)&&s.drawBuffers(p,F),s.viewport(be),s.scissor(Ee),s.setScissorTest(Ke),y){const ce=O.get(p.texture);L.framebufferTexture2D(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_CUBE_MAP_POSITIVE_X+w,ce.__webglTexture,G)}else if(fe){const ce=w;for(let me=0;me<p.textures.length;me++){const xe=O.get(p.textures[me]);L.framebufferTextureLayer(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0+me,xe.__webglTexture,G,ce)}}else if(p!==null&&G!==0){const ce=O.get(p.texture);L.framebufferTexture2D(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,ce.__webglTexture,G)}le=-1},this.readRenderTargetPixels=function(p,w,G,F,y,fe,pe,ce=0){if(!(p&&p.isWebGLRenderTarget)){Ze("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let me=O.get(p).__webglFramebuffer;if(p.isWebGLCubeRenderTarget&&pe!==void 0&&(me=me[pe]),me){s.bindFramebuffer(L.FRAMEBUFFER,me);try{const xe=p.textures[ce],Le=xe.format,Ue=xe.type;if(p.textures.length>1&&L.readBuffer(L.COLOR_ATTACHMENT0+ce),!x.textureFormatReadable(Le)){Ze("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!x.textureTypeReadable(Ue)){Ze("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}w>=0&&w<=p.width-F&&G>=0&&G<=p.height-y&&L.readPixels(w,G,F,y,re.convert(Le),re.convert(Ue),fe)}finally{const xe=Z!==null?O.get(Z).__webglFramebuffer:null;s.bindFramebuffer(L.FRAMEBUFFER,xe)}}},this.readRenderTargetPixelsAsync=async function(p,w,G,F,y,fe,pe,ce=0){if(!(p&&p.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let me=O.get(p).__webglFramebuffer;if(p.isWebGLCubeRenderTarget&&pe!==void 0&&(me=me[pe]),me)if(w>=0&&w<=p.width-F&&G>=0&&G<=p.height-y){s.bindFramebuffer(L.FRAMEBUFFER,me);const xe=p.textures[ce],Le=xe.format,Ue=xe.type;if(p.textures.length>1&&L.readBuffer(L.COLOR_ATTACHMENT0+ce),!x.textureFormatReadable(Le))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!x.textureTypeReadable(Ue))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");const Se=L.createBuffer();L.bindBuffer(L.PIXEL_PACK_BUFFER,Se),L.bufferData(L.PIXEL_PACK_BUFFER,fe.byteLength,L.STREAM_READ),L.readPixels(w,G,F,y,re.convert(Le),re.convert(Ue),0);const ze=Z!==null?O.get(Z).__webglFramebuffer:null;s.bindFramebuffer(L.FRAMEBUFFER,ze);const it=L.fenceSync(L.SYNC_GPU_COMMANDS_COMPLETE,0);return L.flush(),await Wr(L,it,4),L.bindBuffer(L.PIXEL_PACK_BUFFER,Se),L.getBufferSubData(L.PIXEL_PACK_BUFFER,0,fe),L.deleteBuffer(Se),L.deleteSync(it),fe}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(p,w=null,G=0){const F=Math.pow(2,-G),y=Math.floor(p.image.width*F),fe=Math.floor(p.image.height*F),pe=w!==null?w.x:0,ce=w!==null?w.y:0;k.setTexture2D(p,0),L.copyTexSubImage2D(L.TEXTURE_2D,G,0,0,pe,ce,y,fe),s.unbindTexture()},this.copyTextureToTexture=function(p,w,G=null,F=null,y=0,fe=0){let pe,ce,me,xe,Le,Ue,Se,ze,it;const tt=p.isCompressedTexture?p.mipmaps[fe]:p.image;if(G!==null)pe=G.max.x-G.min.x,ce=G.max.y-G.min.y,me=G.isBox3?G.max.z-G.min.z:1,xe=G.min.x,Le=G.min.y,Ue=G.isBox3?G.min.z:0;else{const at=Math.pow(2,-y);pe=Math.floor(tt.width*at),ce=Math.floor(tt.height*at),p.isDataArrayTexture?me=tt.depth:p.isData3DTexture?me=Math.floor(tt.depth*at):me=1,xe=0,Le=0,Ue=0}F!==null?(Se=F.x,ze=F.y,it=F.z):(Se=0,ze=0,it=0);const Xe=re.convert(w.format),ht=re.convert(w.type);let ue;w.isData3DTexture?(k.setTexture3D(w,0),ue=L.TEXTURE_3D):w.isDataArrayTexture||w.isCompressedArrayTexture?(k.setTexture2DArray(w,0),ue=L.TEXTURE_2D_ARRAY):(k.setTexture2D(w,0),ue=L.TEXTURE_2D),s.activeTexture(L.TEXTURE0),s.pixelStorei(L.UNPACK_FLIP_Y_WEBGL,w.flipY),s.pixelStorei(L.UNPACK_PREMULTIPLY_ALPHA_WEBGL,w.premultiplyAlpha),s.pixelStorei(L.UNPACK_ALIGNMENT,w.unpackAlignment);const xt=s.getParameter(L.UNPACK_ROW_LENGTH),Oe=s.getParameter(L.UNPACK_IMAGE_HEIGHT),St=s.getParameter(L.UNPACK_SKIP_PIXELS),Ct=s.getParameter(L.UNPACK_SKIP_ROWS),Vt=s.getParameter(L.UNPACK_SKIP_IMAGES);s.pixelStorei(L.UNPACK_ROW_LENGTH,tt.width),s.pixelStorei(L.UNPACK_IMAGE_HEIGHT,tt.height),s.pixelStorei(L.UNPACK_SKIP_PIXELS,xe),s.pixelStorei(L.UNPACK_SKIP_ROWS,Le),s.pixelStorei(L.UNPACK_SKIP_IMAGES,Ue);const tn=p.isDataArrayTexture||p.isData3DTexture,qe=w.isDataArrayTexture||w.isData3DTexture;if(p.isDepthTexture){const at=O.get(p),zt=O.get(w),Ye=O.get(at.__renderTarget),Wt=O.get(zt.__renderTarget);s.bindFramebuffer(L.READ_FRAMEBUFFER,Ye.__webglFramebuffer),s.bindFramebuffer(L.DRAW_FRAMEBUFFER,Wt.__webglFramebuffer);for(let nn=0;nn<me;nn++)tn&&(L.framebufferTextureLayer(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,O.get(p).__webglTexture,y,Ue+nn),L.framebufferTextureLayer(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,O.get(w).__webglTexture,fe,it+nn)),L.blitFramebuffer(xe,Le,pe,ce,Se,ze,pe,ce,L.DEPTH_BUFFER_BIT,L.NEAREST);s.bindFramebuffer(L.READ_FRAMEBUFFER,null),s.bindFramebuffer(L.DRAW_FRAMEBUFFER,null)}else if(y!==0||p.isRenderTargetTexture||O.has(p)){const at=O.get(p),zt=O.get(w);s.bindFramebuffer(L.READ_FRAMEBUFFER,Y),s.bindFramebuffer(L.DRAW_FRAMEBUFFER,z);for(let Ye=0;Ye<me;Ye++)tn?L.framebufferTextureLayer(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,at.__webglTexture,y,Ue+Ye):L.framebufferTexture2D(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,at.__webglTexture,y),qe?L.framebufferTextureLayer(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,zt.__webglTexture,fe,it+Ye):L.framebufferTexture2D(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,zt.__webglTexture,fe),y!==0?L.blitFramebuffer(xe,Le,pe,ce,Se,ze,pe,ce,L.COLOR_BUFFER_BIT,L.NEAREST):qe?L.copyTexSubImage3D(ue,fe,Se,ze,it+Ye,xe,Le,pe,ce):L.copyTexSubImage2D(ue,fe,Se,ze,xe,Le,pe,ce);s.bindFramebuffer(L.READ_FRAMEBUFFER,null),s.bindFramebuffer(L.DRAW_FRAMEBUFFER,null)}else qe?p.isDataTexture||p.isData3DTexture?L.texSubImage3D(ue,fe,Se,ze,it,pe,ce,me,Xe,ht,tt.data):w.isCompressedArrayTexture?L.compressedTexSubImage3D(ue,fe,Se,ze,it,pe,ce,me,Xe,tt.data):L.texSubImage3D(ue,fe,Se,ze,it,pe,ce,me,Xe,ht,tt):p.isDataTexture?L.texSubImage2D(L.TEXTURE_2D,fe,Se,ze,pe,ce,Xe,ht,tt.data):p.isCompressedTexture?L.compressedTexSubImage2D(L.TEXTURE_2D,fe,Se,ze,tt.width,tt.height,Xe,tt.data):L.texSubImage2D(L.TEXTURE_2D,fe,Se,ze,pe,ce,Xe,ht,tt);s.pixelStorei(L.UNPACK_ROW_LENGTH,xt),s.pixelStorei(L.UNPACK_IMAGE_HEIGHT,Oe),s.pixelStorei(L.UNPACK_SKIP_PIXELS,St),s.pixelStorei(L.UNPACK_SKIP_ROWS,Ct),s.pixelStorei(L.UNPACK_SKIP_IMAGES,Vt),fe===0&&w.generateMipmaps&&L.generateMipmap(ue),s.unbindTexture()},this.initRenderTarget=function(p){O.get(p).__webglFramebuffer===void 0&&k.setupRenderTarget(p)},this.initTexture=function(p){p.isCubeTexture?k.setTextureCube(p,0):p.isData3DTexture?k.setTexture3D(p,0):p.isDataArrayTexture||p.isCompressedArrayTexture?k.setTexture2DArray(p,0):k.setTexture2D(p,0),s.unbindTexture()},this.resetState=function(){W=0,H=0,Z=null,s.reset(),de.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Di}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(n){this._outputColorSpace=n;const t=this.getContext();t.drawingBufferColorSpace=Qe._getDrawingBufferColorSpace(n),t.unpackColorSpace=Qe._getUnpackColorSpace()}}function lp(e,n=!1){const t=e[0].index!==null,i=new Set(Object.keys(e[0].attributes)),r=new Set(Object.keys(e[0].morphAttributes)),a={},o={},l=e[0].morphTargetsRelative,f=new hn;let d=0;for(let _=0;_<e.length;++_){const g=e[_];let u=0;if(t!==(g.index!==null))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+_+". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."),null;for(const v in g.attributes){if(!i.has(v))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+_+'. All geometries must have compatible attributes; make sure "'+v+'" attribute exists among all geometries, or in none of them.'),null;a[v]===void 0&&(a[v]=[]),a[v].push(g.attributes[v]),u++}if(u!==i.size)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+_+". Make sure all geometries have the same number of attributes."),null;if(l!==g.morphTargetsRelative)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+_+". .morphTargetsRelative must be consistent throughout all geometries."),null;for(const v in g.morphAttributes){if(!r.has(v))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+_+".  .morphAttributes must be consistent throughout all geometries."),null;o[v]===void 0&&(o[v]=[]),o[v].push(g.morphAttributes[v])}if(n){let v;if(t)v=g.index.count;else if(g.attributes.position!==void 0)v=g.attributes.position.count;else return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+_+". The geometry must have either an index or a position attribute"),null;f.addGroup(d,v,_),d+=v}}if(t){let _=0;const g=[];for(let u=0;u<e.length;++u){const v=e[u].index;for(let A=0;A<v.count;++A)g.push(v.getX(A)+_);_+=e[u].attributes.position.count}f.setIndex(g)}for(const _ in a){const g=za(a[_]);if(!g)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+_+" attribute."),null;f.setAttribute(_,g)}for(const _ in o){const g=o[_][0].length;if(g!==0){f.morphAttributes=f.morphAttributes||{},f.morphAttributes[_]=[];for(let u=0;u<g;++u){const v=[];for(let D=0;D<o[_].length;++D)v.push(o[_][D][u]);const A=za(v);if(!A)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+_+" morphAttribute."),null;f.morphAttributes[_].push(A)}}}return f}function za(e){let n,t,i,r=-1,a=0;for(let d=0;d<e.length;++d){const _=e[d];if(n===void 0&&(n=_.array.constructor),n!==_.array.constructor)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."),null;if(t===void 0&&(t=_.itemSize),t!==_.itemSize)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."),null;if(i===void 0&&(i=_.normalized),i!==_.normalized)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."),null;if(r===-1&&(r=_.gpuType),r!==_.gpuType)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."),null;a+=_.count*t}const o=new n(a),l=new Yt(o,t,i);let f=0;for(let d=0;d<e.length;++d){const _=e[d];if(_.isInterleavedBufferAttribute){const g=f/t;for(let u=0,v=_.count;u<v;u++)for(let A=0;A<t;A++){const D=_.getComponent(u,A);l.setComponent(u+g,A,D)}}else o.set(_.array,f);f+=_.count*t}return r!==void 0&&(l.gpuType=r),l}function fp(e,n=1e-4){n=Math.max(n,Number.EPSILON);const t={},i=e.getIndex(),r=e.getAttribute("position"),a=i?i.count:r.count;let o=0;const l=Object.keys(e.attributes),f={},d={},_=[],g=["getX","getY","getZ","getW"],u=["setX","setY","setZ","setW"];for(let M=0,R=l.length;M<R;M++){const b=l[M],T=e.attributes[b];f[b]=new T.constructor(new T.array.constructor(T.count*T.itemSize),T.itemSize,T.normalized);const E=e.morphAttributes[b];E&&(d[b]||(d[b]=[]),E.forEach((P,m)=>{const S=new P.array.constructor(P.count*P.itemSize);d[b][m]=new P.constructor(S,P.itemSize,P.normalized)}))}const v=n*.5,A=Math.log10(1/n),D=Math.pow(10,A),h=v*D;for(let M=0;M<a;M++){const R=i?i.getX(M):M;let b="";for(let T=0,E=l.length;T<E;T++){const P=l[T],m=e.getAttribute(P),S=m.itemSize;for(let I=0;I<S;I++)b+=`${~~(m[g[I]](R)*D+h)},`}if(b in t)_.push(t[b]);else{for(let T=0,E=l.length;T<E;T++){const P=l[T],m=e.getAttribute(P),S=e.morphAttributes[P],I=m.itemSize,U=f[P],B=d[P];for(let J=0;J<I;J++){const Y=g[J],z=u[J];if(U[z](o,m[Y](R)),S)for(let W=0,H=S.length;W<H;W++)B[W][z](o,S[W][Y](R))}}t[b]=o,_.push(o),o++}}const c=e.clone();for(const M in e.attributes){const R=f[M];if(c.setAttribute(M,new R.constructor(R.array.slice(0,o*R.itemSize),R.itemSize,R.normalized)),M in d)for(let b=0;b<d[M].length;b++){const T=d[M][b];c.morphAttributes[M][b]=new T.constructor(T.array.slice(0,o*T.itemSize),T.itemSize,T.normalized)}}return c.setIndex(_),c}function Wa(e,n){if(n===is)return console.warn("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles."),e;if(n===ui||n===br){let t=e.getIndex();if(t===null){const o=[],l=e.getAttribute("position");if(l!==void 0){for(let f=0;f<l.count;f++)o.push(f);e.setIndex(o),t=e.getIndex()}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible."),e}const i=t.count-2,r=[];if(n===ui)for(let o=1;o<=i;o++)r.push(t.getX(0)),r.push(t.getX(o)),r.push(t.getX(o+1));else for(let o=0;o<i;o++)o%2===0?(r.push(t.getX(o)),r.push(t.getX(o+1)),r.push(t.getX(o+2))):(r.push(t.getX(o+2)),r.push(t.getX(o+1)),r.push(t.getX(o)));r.length/3!==i&&console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles.");const a=e.clone();return a.setIndex(r),a.clearGroups(),a}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:",n),e}function Au(e){const n=new Map,t=new Map,i=e.clone();return Ur(e,i,function(r,a){n.set(a,r),t.set(r,a)}),i.traverse(function(r){if(!r.isSkinnedMesh)return;const a=r,o=n.get(r),l=o.skeleton.bones;a.skeleton=o.skeleton.clone(),a.bindMatrix.copy(o.bindMatrix),a.skeleton.bones=l.map(function(f){return t.get(f)}),a.bind(a.skeleton,a.bindMatrix)}),i}function Ur(e,n,t){t(e,n);for(let i=0;i<e.children.length;i++)Ur(e.children[i],n.children[i],t)}let Ru=class extends as{constructor(n){super(n),this.dracoLoader=null,this.ktx2Loader=null,this.meshoptDecoder=null,this.pluginCallbacks=[],this.register(function(t){return new Du(t)}),this.register(function(t){return new Uu(t)}),this.register(function(t){return new Hu(t)}),this.register(function(t){return new Vu(t)}),this.register(function(t){return new zu(t)}),this.register(function(t){return new Iu(t)}),this.register(function(t){return new Fu(t)}),this.register(function(t){return new yu(t)}),this.register(function(t){return new Ou(t)}),this.register(function(t){return new wu(t)}),this.register(function(t){return new Gu(t)}),this.register(function(t){return new Nu(t)}),this.register(function(t){return new ku(t)}),this.register(function(t){return new Bu(t)}),this.register(function(t){return new Pu(t)}),this.register(function(t){return new Xa(t,Ne.EXT_MESHOPT_COMPRESSION)}),this.register(function(t){return new Xa(t,Ne.KHR_MESHOPT_COMPRESSION)}),this.register(function(t){return new Wu(t)})}load(n,t,i,r){const a=this;let o;if(this.resourcePath!=="")o=this.resourcePath;else if(this.path!==""){const d=Mn.extractUrlBase(n);o=Mn.resolveURL(d,this.path)}else o=Mn.extractUrlBase(n);this.manager.itemStart(n);const l=function(d){r?r(d):console.error(d),a.manager.itemError(n),a.manager.itemEnd(n)},f=new vr(this.manager);f.setPath(this.path),f.setResponseType("arraybuffer"),f.setRequestHeader(this.requestHeader),f.setWithCredentials(this.withCredentials),f.load(n,function(d){try{a.parse(d,o,function(_){t(_),a.manager.itemEnd(n)},l)}catch(_){l(_)}},i,l)}setDRACOLoader(n){return this.dracoLoader=n,this}setKTX2Loader(n){return this.ktx2Loader=n,this}setMeshoptDecoder(n){return this.meshoptDecoder=n,this}register(n){return this.pluginCallbacks.indexOf(n)===-1&&this.pluginCallbacks.push(n),this}unregister(n){return this.pluginCallbacks.indexOf(n)!==-1&&this.pluginCallbacks.splice(this.pluginCallbacks.indexOf(n),1),this}parse(n,t,i,r){let a;const o={},l={},f=new TextDecoder;if(typeof n=="string")a=JSON.parse(n);else if(n instanceof ArrayBuffer)if(f.decode(new Uint8Array(n,0,4))===Nr){try{o[Ne.KHR_BINARY_GLTF]=new Xu(n)}catch(g){r&&r(g);return}a=JSON.parse(o[Ne.KHR_BINARY_GLTF].content)}else a=JSON.parse(f.decode(n));else a=n;if(a.asset===void 0||a.asset.version[0]<2){r&&r(new Error("THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported."));return}const d=new ap(a,{path:t||this.resourcePath||"",crossOrigin:this.crossOrigin,requestHeader:this.requestHeader,manager:this.manager,ktx2Loader:this.ktx2Loader,meshoptDecoder:this.meshoptDecoder});d.fileLoader.setRequestHeader(this.requestHeader);for(let _=0;_<this.pluginCallbacks.length;_++){const g=this.pluginCallbacks[_](d);g.name||console.error("THREE.GLTFLoader: Invalid plugin found: missing name"),l[g.name]=g,o[g.name]=!0}if(a.extensionsUsed)for(let _=0;_<a.extensionsUsed.length;++_){const g=a.extensionsUsed[_],u=a.extensionsRequired||[];switch(g){case Ne.KHR_MATERIALS_UNLIT:o[g]=new Lu;break;case Ne.KHR_DRACO_MESH_COMPRESSION:o[g]=new qu(a,this.dracoLoader);break;case Ne.KHR_TEXTURE_TRANSFORM:o[g]=new Ku;break;case Ne.KHR_MESH_QUANTIZATION:o[g]=new ju;break;default:u.indexOf(g)>=0&&l[g]===void 0&&console.warn('THREE.GLTFLoader: Unknown extension "'+g+'".')}}d.setExtensions(o),d.setPlugins(l),d.parse(i,r)}parseAsync(n,t){const i=this;return new Promise(function(r,a){i.parse(n,t,r,a)})}};function Cu(){let e={};return{get:function(n){return e[n]},add:function(n,t){e[n]=t},remove:function(n){delete e[n]},removeAll:function(){e={}}}}function rt(e,n,t){const i=e.json.materials[n];return i.extensions&&i.extensions[t]?i.extensions[t]:null}const Ne={KHR_BINARY_GLTF:"KHR_binary_glTF",KHR_DRACO_MESH_COMPRESSION:"KHR_draco_mesh_compression",KHR_LIGHTS_PUNCTUAL:"KHR_lights_punctual",KHR_MATERIALS_CLEARCOAT:"KHR_materials_clearcoat",KHR_MATERIALS_DISPERSION:"KHR_materials_dispersion",KHR_MATERIALS_IOR:"KHR_materials_ior",KHR_MATERIALS_SHEEN:"KHR_materials_sheen",KHR_MATERIALS_SPECULAR:"KHR_materials_specular",KHR_MATERIALS_TRANSMISSION:"KHR_materials_transmission",KHR_MATERIALS_IRIDESCENCE:"KHR_materials_iridescence",KHR_MATERIALS_ANISOTROPY:"KHR_materials_anisotropy",KHR_MATERIALS_UNLIT:"KHR_materials_unlit",KHR_MATERIALS_VOLUME:"KHR_materials_volume",KHR_TEXTURE_BASISU:"KHR_texture_basisu",KHR_TEXTURE_TRANSFORM:"KHR_texture_transform",KHR_MESH_QUANTIZATION:"KHR_mesh_quantization",KHR_MATERIALS_EMISSIVE_STRENGTH:"KHR_materials_emissive_strength",EXT_MATERIALS_BUMP:"EXT_materials_bump",EXT_TEXTURE_WEBP:"EXT_texture_webp",EXT_TEXTURE_AVIF:"EXT_texture_avif",EXT_MESHOPT_COMPRESSION:"EXT_meshopt_compression",KHR_MESHOPT_COMPRESSION:"KHR_meshopt_compression",EXT_MESH_GPU_INSTANCING:"EXT_mesh_gpu_instancing"};class Pu{constructor(n){this.parser=n,this.name=Ne.KHR_LIGHTS_PUNCTUAL,this.cache={refs:{},uses:{}}}_markDefs(){const n=this.parser,t=this.parser.json.nodes||[];for(let i=0,r=t.length;i<r;i++){const a=t[i];a.extensions&&a.extensions[this.name]&&a.extensions[this.name].light!==void 0&&n._addNodeRef(this.cache,a.extensions[this.name].light)}}_loadLight(n){const t=this.parser,i="light:"+n;let r=t.cache.get(i);if(r)return r;const a=t.json,f=((a.extensions&&a.extensions[this.name]||{}).lights||[])[n];let d;const _=new Be(16777215);f.color!==void 0&&_.setRGB(f.color[0],f.color[1],f.color[2],Mt);const g=f.range!==void 0?f.range:0;switch(f.type){case"directional":d=new ss(_),d.target.position.set(0,0,-1),d.add(d.target);break;case"point":d=new os(_),d.distance=g;break;case"spot":d=new rs(_),d.distance=g,f.spot=f.spot||{},f.spot.innerConeAngle=f.spot.innerConeAngle!==void 0?f.spot.innerConeAngle:0,f.spot.outerConeAngle=f.spot.outerConeAngle!==void 0?f.spot.outerConeAngle:Math.PI/4,d.angle=f.spot.outerConeAngle,d.penumbra=1-f.spot.innerConeAngle/f.spot.outerConeAngle,d.target.position.set(0,0,-1),d.add(d.target);break;default:throw new Error("THREE.GLTFLoader: Unexpected light type: "+f.type)}return d.position.set(0,0,0),Lt(d,f),f.intensity!==void 0&&(d.intensity=f.intensity),d.name=t.createUniqueName(f.name||"light_"+n),r=Promise.resolve(d),t.cache.add(i,r),r}getDependency(n,t){if(n==="light")return this._loadLight(t)}createNodeAttachment(n){const t=this,i=this.parser,a=i.json.nodes[n],l=(a.extensions&&a.extensions[this.name]||{}).light;return l===void 0?null:this._loadLight(l).then(function(f){return i._getNodeRef(t.cache,l,f)})}}class Lu{constructor(){this.name=Ne.KHR_MATERIALS_UNLIT}getMaterialType(){return sn}extendParams(n,t,i){const r=[];n.color=new Be(1,1,1),n.opacity=1;const a=t.pbrMetallicRoughness;if(a){if(Array.isArray(a.baseColorFactor)){const o=a.baseColorFactor;n.color.setRGB(o[0],o[1],o[2],Mt),n.opacity=o[3]}a.baseColorTexture!==void 0&&r.push(i.assignTexture(n,"map",a.baseColorTexture,ln))}return Promise.all(r)}}class wu{constructor(n){this.parser=n,this.name=Ne.KHR_MATERIALS_EMISSIVE_STRENGTH}extendMaterialParams(n,t){const i=rt(this.parser,n,this.name);return i===null||i.emissiveStrength!==void 0&&(t.emissiveIntensity=i.emissiveStrength),Promise.resolve()}}class Du{constructor(n){this.parser=n,this.name=Ne.KHR_MATERIALS_CLEARCOAT}getMaterialType(n){return rt(this.parser,n,this.name)!==null?Ot:null}extendMaterialParams(n,t){const i=rt(this.parser,n,this.name);if(i===null)return Promise.resolve();const r=[];if(i.clearcoatFactor!==void 0&&(t.clearcoat=i.clearcoatFactor),i.clearcoatTexture!==void 0&&r.push(this.parser.assignTexture(t,"clearcoatMap",i.clearcoatTexture)),i.clearcoatRoughnessFactor!==void 0&&(t.clearcoatRoughness=i.clearcoatRoughnessFactor),i.clearcoatRoughnessTexture!==void 0&&r.push(this.parser.assignTexture(t,"clearcoatRoughnessMap",i.clearcoatRoughnessTexture)),i.clearcoatNormalTexture!==void 0&&(r.push(this.parser.assignTexture(t,"clearcoatNormalMap",i.clearcoatNormalTexture)),i.clearcoatNormalTexture.scale!==void 0)){const a=i.clearcoatNormalTexture.scale;t.clearcoatNormalScale=new gt(a,a)}return Promise.all(r)}}class Uu{constructor(n){this.parser=n,this.name=Ne.KHR_MATERIALS_DISPERSION}getMaterialType(n){return rt(this.parser,n,this.name)!==null?Ot:null}extendMaterialParams(n,t){const i=rt(this.parser,n,this.name);return i===null||(t.dispersion=i.dispersion!==void 0?i.dispersion:0),Promise.resolve()}}class Nu{constructor(n){this.parser=n,this.name=Ne.KHR_MATERIALS_IRIDESCENCE}getMaterialType(n){return rt(this.parser,n,this.name)!==null?Ot:null}extendMaterialParams(n,t){const i=rt(this.parser,n,this.name);if(i===null)return Promise.resolve();const r=[];return i.iridescenceFactor!==void 0&&(t.iridescence=i.iridescenceFactor),i.iridescenceTexture!==void 0&&r.push(this.parser.assignTexture(t,"iridescenceMap",i.iridescenceTexture)),i.iridescenceIor!==void 0&&(t.iridescenceIOR=i.iridescenceIor),t.iridescenceThicknessRange===void 0&&(t.iridescenceThicknessRange=[100,400]),i.iridescenceThicknessMinimum!==void 0&&(t.iridescenceThicknessRange[0]=i.iridescenceThicknessMinimum),i.iridescenceThicknessMaximum!==void 0&&(t.iridescenceThicknessRange[1]=i.iridescenceThicknessMaximum),i.iridescenceThicknessTexture!==void 0&&r.push(this.parser.assignTexture(t,"iridescenceThicknessMap",i.iridescenceThicknessTexture)),Promise.all(r)}}class Iu{constructor(n){this.parser=n,this.name=Ne.KHR_MATERIALS_SHEEN}getMaterialType(n){return rt(this.parser,n,this.name)!==null?Ot:null}extendMaterialParams(n,t){const i=rt(this.parser,n,this.name);if(i===null)return Promise.resolve();const r=[];if(t.sheenColor=new Be(0,0,0),t.sheenRoughness=0,t.sheen=1,i.sheenColorFactor!==void 0){const a=i.sheenColorFactor;t.sheenColor.setRGB(a[0],a[1],a[2],Mt)}return i.sheenRoughnessFactor!==void 0&&(t.sheenRoughness=i.sheenRoughnessFactor),i.sheenColorTexture!==void 0&&r.push(this.parser.assignTexture(t,"sheenColorMap",i.sheenColorTexture,ln)),i.sheenRoughnessTexture!==void 0&&r.push(this.parser.assignTexture(t,"sheenRoughnessMap",i.sheenRoughnessTexture)),Promise.all(r)}}class Fu{constructor(n){this.parser=n,this.name=Ne.KHR_MATERIALS_TRANSMISSION}getMaterialType(n){return rt(this.parser,n,this.name)!==null?Ot:null}extendMaterialParams(n,t){const i=rt(this.parser,n,this.name);if(i===null)return Promise.resolve();const r=[];return i.transmissionFactor!==void 0&&(t.transmission=i.transmissionFactor),i.transmissionTexture!==void 0&&r.push(this.parser.assignTexture(t,"transmissionMap",i.transmissionTexture)),Promise.all(r)}}class yu{constructor(n){this.parser=n,this.name=Ne.KHR_MATERIALS_VOLUME}getMaterialType(n){return rt(this.parser,n,this.name)!==null?Ot:null}extendMaterialParams(n,t){const i=rt(this.parser,n,this.name);if(i===null)return Promise.resolve();const r=[];t.thickness=i.thicknessFactor!==void 0?i.thicknessFactor:0,i.thicknessTexture!==void 0&&r.push(this.parser.assignTexture(t,"thicknessMap",i.thicknessTexture)),t.attenuationDistance=i.attenuationDistance||1/0;const a=i.attenuationColor||[1,1,1];return t.attenuationColor=new Be().setRGB(a[0],a[1],a[2],Mt),Promise.all(r)}}class Ou{constructor(n){this.parser=n,this.name=Ne.KHR_MATERIALS_IOR}getMaterialType(n){return rt(this.parser,n,this.name)!==null?Ot:null}extendMaterialParams(n,t){const i=rt(this.parser,n,this.name);return i===null||(t.ior=i.ior!==void 0?i.ior:1.5,t.ior===0&&(t.ior=1e3)),Promise.resolve()}}class Gu{constructor(n){this.parser=n,this.name=Ne.KHR_MATERIALS_SPECULAR}getMaterialType(n){return rt(this.parser,n,this.name)!==null?Ot:null}extendMaterialParams(n,t){const i=rt(this.parser,n,this.name);if(i===null)return Promise.resolve();const r=[];t.specularIntensity=i.specularFactor!==void 0?i.specularFactor:1,i.specularTexture!==void 0&&r.push(this.parser.assignTexture(t,"specularIntensityMap",i.specularTexture));const a=i.specularColorFactor||[1,1,1];return t.specularColor=new Be().setRGB(a[0],a[1],a[2],Mt),i.specularColorTexture!==void 0&&r.push(this.parser.assignTexture(t,"specularColorMap",i.specularColorTexture,ln)),Promise.all(r)}}class Bu{constructor(n){this.parser=n,this.name=Ne.EXT_MATERIALS_BUMP}getMaterialType(n){return rt(this.parser,n,this.name)!==null?Ot:null}extendMaterialParams(n,t){const i=rt(this.parser,n,this.name);if(i===null)return Promise.resolve();const r=[];return t.bumpScale=i.bumpFactor!==void 0?i.bumpFactor:1,i.bumpTexture!==void 0&&r.push(this.parser.assignTexture(t,"bumpMap",i.bumpTexture)),Promise.all(r)}}class ku{constructor(n){this.parser=n,this.name=Ne.KHR_MATERIALS_ANISOTROPY}getMaterialType(n){return rt(this.parser,n,this.name)!==null?Ot:null}extendMaterialParams(n,t){const i=rt(this.parser,n,this.name);if(i===null)return Promise.resolve();const r=[];return i.anisotropyStrength!==void 0&&(t.anisotropy=i.anisotropyStrength),i.anisotropyRotation!==void 0&&(t.anisotropyRotation=i.anisotropyRotation),i.anisotropyTexture!==void 0&&r.push(this.parser.assignTexture(t,"anisotropyMap",i.anisotropyTexture)),Promise.all(r)}}class Hu{constructor(n){this.parser=n,this.name=Ne.KHR_TEXTURE_BASISU}loadTexture(n){const t=this.parser,i=t.json,r=i.textures[n];if(!r.extensions||!r.extensions[this.name])return null;const a=r.extensions[this.name],o=t.options.ktx2Loader;if(!o){if(i.extensionsRequired&&i.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures");return null}return t.loadTextureImage(n,a.source,o)}}class Vu{constructor(n){this.parser=n,this.name=Ne.EXT_TEXTURE_WEBP}loadTexture(n){const t=this.name,i=this.parser,r=i.json,a=r.textures[n];if(!a.extensions||!a.extensions[t])return null;const o=a.extensions[t],l=r.images[o.source];let f=i.textureLoader;if(l.uri){const d=i.options.manager.getHandler(l.uri);d!==null&&(f=d)}return i.loadTextureImage(n,o.source,f)}}class zu{constructor(n){this.parser=n,this.name=Ne.EXT_TEXTURE_AVIF}loadTexture(n){const t=this.name,i=this.parser,r=i.json,a=r.textures[n];if(!a.extensions||!a.extensions[t])return null;const o=a.extensions[t],l=r.images[o.source];let f=i.textureLoader;if(l.uri){const d=i.options.manager.getHandler(l.uri);d!==null&&(f=d)}return i.loadTextureImage(n,o.source,f)}}class Xa{constructor(n,t){this.name=t,this.parser=n}loadBufferView(n){const t=this.parser.json,i=t.bufferViews[n];if(i.extensions&&i.extensions[this.name]){const r=i.extensions[this.name],a=this.parser.getDependency("buffer",r.buffer),o=this.parser.options.meshoptDecoder;if(!o||!o.supported){if(t.extensionsRequired&&t.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files");return null}return a.then(function(l){const f=r.byteOffset||0,d=r.byteLength||0,_=r.count,g=r.byteStride,u=new Uint8Array(l,f,d);return o.decodeGltfBufferAsync?o.decodeGltfBufferAsync(_,g,u,r.mode,r.filter).then(function(v){return v.buffer}):o.ready.then(function(){const v=new ArrayBuffer(_*g);return o.decodeGltfBuffer(new Uint8Array(v),_,g,u,r.mode,r.filter),v})})}else return null}}class Wu{constructor(n){this.name=Ne.EXT_MESH_GPU_INSTANCING,this.parser=n}createNodeMesh(n){const t=this.parser.json,i=t.nodes[n];if(!i.extensions||!i.extensions[this.name]||i.mesh===void 0)return null;const r=t.meshes[i.mesh];for(const d of r.primitives)if(d.mode!==Tt.TRIANGLES&&d.mode!==Tt.TRIANGLE_STRIP&&d.mode!==Tt.TRIANGLE_FAN&&d.mode!==void 0)return null;const o=i.extensions[this.name].attributes,l=[],f={};for(const d in o)l.push(this.parser.getDependency("accessor",o[d]).then(_=>(f[d]=_,f[d])));return l.length<1?null:(l.push(this.parser.createNodeMesh(n)),Promise.all(l).then(d=>{const _=d.pop(),g=_.isGroup?_.children:[_],u=d[0].count,v=[];for(const A of g){const D=new Ft,h=new we,c=new xr,M=new we(1,1,1),R=new cs(A.geometry,A.material,u);for(let b=0;b<u;b++)f.TRANSLATION&&h.fromBufferAttribute(f.TRANSLATION,b),f.ROTATION&&c.fromBufferAttribute(f.ROTATION,b),f.SCALE&&M.fromBufferAttribute(f.SCALE,b),R.setMatrixAt(b,D.compose(h,c,M));for(const b in f)if(b==="_COLOR_0"){const T=f[b];R.instanceColor=new ls(T.array,T.itemSize,T.normalized)}else b!=="TRANSLATION"&&b!=="ROTATION"&&b!=="SCALE"&&A.geometry.setAttribute(b,f[b]);Er.prototype.copy.call(R,A),this.parser.assignFinalMaterial(R),v.push(R)}return _.isGroup?(_.clear(),_.add(...v),_):v[0]}))}}const Nr="glTF",vn=12,qa={JSON:1313821514,BIN:5130562};class Xu{constructor(n){this.name=Ne.KHR_BINARY_GLTF,this.content=null,this.body=null;const t=new DataView(n,0,vn),i=new TextDecoder;if(this.header={magic:i.decode(new Uint8Array(n.slice(0,4))),version:t.getUint32(4,!0),length:t.getUint32(8,!0)},this.header.magic!==Nr)throw new Error("THREE.GLTFLoader: Unsupported glTF-Binary header.");if(this.header.version<2)throw new Error("THREE.GLTFLoader: Legacy binary file detected.");const r=this.header.length-vn,a=new DataView(n,vn);let o=0;for(;o<r;){const l=a.getUint32(o,!0);o+=4;const f=a.getUint32(o,!0);if(o+=4,f===qa.JSON){const d=new Uint8Array(n,vn+o,l);this.content=i.decode(d)}else if(f===qa.BIN){const d=vn+o;this.body=n.slice(d,d+l)}o+=l}if(this.content===null)throw new Error("THREE.GLTFLoader: JSON content not found.")}}class qu{constructor(n,t){if(!t)throw new Error("THREE.GLTFLoader: No DRACOLoader instance provided.");this.name=Ne.KHR_DRACO_MESH_COMPRESSION,this.json=n,this.dracoLoader=t,this.dracoLoader.preload()}decodePrimitive(n,t){const i=this.json,r=this.dracoLoader,a=n.extensions[this.name].bufferView,o=n.extensions[this.name].attributes,l={},f={},d={};for(const _ in o){const g=mi[_]||_.toLowerCase();l[g]=o[_]}for(const _ in n.attributes){const g=mi[_]||_.toLowerCase();if(o[_]!==void 0){const u=i.accessors[n.attributes[_]],v=cn[u.componentType];d[g]=v.name,f[g]=u.normalized===!0}}return t.getDependency("bufferView",a).then(function(_){return new Promise(function(g,u){r.decodeDracoFile(_,function(v){for(const A in v.attributes){const D=v.attributes[A],h=f[A];h!==void 0&&(D.normalized=h)}g(v)},l,d,Mt,u)})})}}class Ku{constructor(){this.name=Ne.KHR_TEXTURE_TRANSFORM}extendTexture(n,t){return(t.texCoord===void 0||t.texCoord===n.channel)&&t.offset===void 0&&t.rotation===void 0&&t.scale===void 0||(n=n.clone(),t.texCoord!==void 0&&(n.channel=t.texCoord),t.offset!==void 0&&n.offset.fromArray(t.offset),t.rotation!==void 0&&(n.rotation=t.rotation),t.scale!==void 0&&n.repeat.fromArray(t.scale),n.needsUpdate=!0),n}}class ju{constructor(){this.name=Ne.KHR_MESH_QUANTIZATION}}class Ir extends Cs{constructor(n,t,i,r){super(n,t,i,r)}copySampleValue_(n){const t=this.resultBuffer,i=this.sampleValues,r=this.valueSize,a=n*r*3+r;for(let o=0;o!==r;o++)t[o]=i[a+o];return t}interpolate_(n,t,i,r){const a=this.resultBuffer,o=this.sampleValues,l=this.valueSize,f=l*2,d=l*3,_=r-t,g=(i-t)/_,u=g*g,v=u*g,A=n*d,D=A-d,h=-2*v+3*u,c=v-u,M=1-h,R=c-u+g;for(let b=0;b!==l;b++){const T=o[D+b+l],E=o[D+b+f]*_,P=o[A+b+l],m=o[A+b]*_;a[b]=M*T+R*E+h*P+c*m}return a}}const Yu=new xr;class Ju extends Ir{interpolate_(n,t,i,r){const a=super.interpolate_(n,t,i,r);return Yu.fromArray(a).normalize().toArray(a),a}}const Tt={POINTS:0,LINES:1,LINE_LOOP:2,LINE_STRIP:3,TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6},cn={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},Ka={9728:Bt,9729:mt,9984:Qa,9985:Un,9986:xn,9987:qt},ja={33071:yn,33648:Za,10497:On},ri={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16},mi={POSITION:"position",NORMAL:"normal",TANGENT:"tangent",TEXCOORD_0:"uv",TEXCOORD_1:"uv1",TEXCOORD_2:"uv2",TEXCOORD_3:"uv3",COLOR_0:"color",WEIGHTS_0:"skinWeight",JOINTS_0:"skinIndex"},Xt={scale:"scale",translation:"position",rotation:"quaternion",weights:"morphTargetInfluences"},Zu={CUBICSPLINE:void 0,LINEAR:Tr,STEP:As},oi={OPAQUE:"OPAQUE",MASK:"MASK",BLEND:"BLEND"};function Qu(e){return e.DefaultMaterial===void 0&&(e.DefaultMaterial=new Sr({color:16777215,emissive:0,metalness:1,roughness:1,transparent:!1,depthTest:!0,side:fn})),e.DefaultMaterial}function Qt(e,n,t){for(const i in t.extensions)e[i]===void 0&&(n.userData.gltfExtensions=n.userData.gltfExtensions||{},n.userData.gltfExtensions[i]=t.extensions[i])}function Lt(e,n){n.extras!==void 0&&(typeof n.extras=="object"?Object.assign(e.userData,n.extras):console.warn("THREE.GLTFLoader: Ignoring primitive type .extras, "+n.extras))}function $u(e,n,t){let i=!1,r=!1,a=!1;for(let d=0,_=n.length;d<_;d++){const g=n[d];if(g.POSITION!==void 0&&(i=!0),g.NORMAL!==void 0&&(r=!0),g.COLOR_0!==void 0&&(a=!0),i&&r&&a)break}if(!i&&!r&&!a)return Promise.resolve(e);const o=[],l=[],f=[];for(let d=0,_=n.length;d<_;d++){const g=n[d];if(i){const u=g.POSITION!==void 0?t.getDependency("accessor",g.POSITION):e.attributes.position;o.push(u)}if(r){const u=g.NORMAL!==void 0?t.getDependency("accessor",g.NORMAL):e.attributes.normal;l.push(u)}if(a){const u=g.COLOR_0!==void 0?t.getDependency("accessor",g.COLOR_0):e.attributes.color;f.push(u)}}return Promise.all([Promise.all(o),Promise.all(l),Promise.all(f)]).then(function(d){const _=d[0],g=d[1],u=d[2];return i&&(e.morphAttributes.position=_),r&&(e.morphAttributes.normal=g),a&&(e.morphAttributes.color=u),e.morphTargetsRelative=!0,e})}function ep(e,n){if(e.updateMorphTargets(),n.weights!==void 0)for(let t=0,i=n.weights.length;t<i;t++)e.morphTargetInfluences[t]=n.weights[t];if(n.extras&&Array.isArray(n.extras.targetNames)){const t=n.extras.targetNames;if(e.morphTargetInfluences.length===t.length){e.morphTargetDictionary={};for(let i=0,r=t.length;i<r;i++)e.morphTargetDictionary[t[i]]=i}else console.warn("THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.")}}function tp(e){let n;const t=e.extensions&&e.extensions[Ne.KHR_DRACO_MESH_COMPRESSION];if(t?n="draco:"+t.bufferView+":"+t.indices+":"+si(t.attributes):n=e.indices+":"+si(e.attributes)+":"+e.mode,e.targets!==void 0)for(let i=0,r=e.targets.length;i<r;i++)n+=":"+si(e.targets[i]);return n}function si(e){let n="";const t=Object.keys(e).sort();for(let i=0,r=t.length;i<r;i++)n+=t[i]+":"+e[t[i]]+";";return n}function gi(e){switch(e){case Int8Array:return 1/127;case Uint8Array:return 1/255;case Int16Array:return 1/32767;case Uint16Array:return 1/65535;default:throw new Error("THREE.GLTFLoader: Unsupported normalized accessor component type.")}}function np(e){return e.search(/\.jpe?g($|\?)/i)>0||e.search(/^data\:image\/jpeg/)===0?"image/jpeg":e.search(/\.webp($|\?)/i)>0||e.search(/^data\:image\/webp/)===0?"image/webp":e.search(/\.ktx2($|\?)/i)>0||e.search(/^data\:image\/ktx2/)===0?"image/ktx2":"image/png"}const ip=new Ft;class ap{constructor(n={},t={}){this.json=n,this.extensions={},this.plugins={},this.options=t,this.cache=new Cu,this.associations=new Map,this.primitiveCache={},this.nodeCache={},this.meshCache={refs:{},uses:{}},this.cameraCache={refs:{},uses:{}},this.lightCache={refs:{},uses:{}},this.sourceCache={},this.textureCache={},this.nodeNamesUsed={};let i=!1,r=-1,a=!1,o=-1;if(typeof navigator<"u"&&typeof navigator.userAgent<"u"){const l=navigator.userAgent;i=/^((?!chrome|android).)*safari/i.test(l)===!0;const f=l.match(/Version\/(\d+)/);r=i&&f?parseInt(f[1],10):-1,a=l.indexOf("Firefox")>-1,o=a?l.match(/Firefox\/([0-9]+)\./)[1]:-1}typeof createImageBitmap>"u"||i&&r<17||a&&o<98?this.textureLoader=new fs(this.options.manager):this.textureLoader=new ds(this.options.manager),this.textureLoader.setCrossOrigin(this.options.crossOrigin),this.textureLoader.setRequestHeader(this.options.requestHeader),this.fileLoader=new vr(this.options.manager),this.fileLoader.setResponseType("arraybuffer"),this.options.crossOrigin==="use-credentials"&&this.fileLoader.setWithCredentials(!0)}setExtensions(n){this.extensions=n}setPlugins(n){this.plugins=n}parse(n,t){const i=this,r=this.json,a=this.extensions;this.cache.removeAll(),this.nodeCache={},this._invokeAll(function(o){return o._markDefs&&o._markDefs()}),Promise.all(this._invokeAll(function(o){return o.beforeRoot&&o.beforeRoot()})).then(function(){return Promise.all([i.getDependencies("scene"),i.getDependencies("animation"),i.getDependencies("camera")])}).then(function(o){const l={scene:o[0][r.scene||0],scenes:o[0],animations:o[1],cameras:o[2],asset:r.asset,parser:i,userData:{}};return Qt(a,l,r),Lt(l,r),Promise.all(i._invokeAll(function(f){return f.afterRoot&&f.afterRoot(l)})).then(function(){for(const f of l.scenes)f.updateMatrixWorld();n(l)})}).catch(t)}_markDefs(){const n=this.json.nodes||[],t=this.json.skins||[],i=this.json.meshes||[];for(let r=0,a=t.length;r<a;r++){const o=t[r].joints;for(let l=0,f=o.length;l<f;l++)n[o[l]].isBone=!0}for(let r=0,a=n.length;r<a;r++){const o=n[r];o.mesh!==void 0&&(this._addNodeRef(this.meshCache,o.mesh),o.skin!==void 0&&(i[o.mesh].isSkinnedMesh=!0)),o.camera!==void 0&&this._addNodeRef(this.cameraCache,o.camera)}}_addNodeRef(n,t){t!==void 0&&(n.refs[t]===void 0&&(n.refs[t]=n.uses[t]=0),n.refs[t]++)}_getNodeRef(n,t,i){if(n.refs[t]<=1)return i;const r=i.clone(),a=(o,l)=>{const f=this.associations.get(o);f!=null&&this.associations.set(l,f);for(const[d,_]of o.children.entries())a(_,l.children[d])};return a(i,r),r.name+="_instance_"+n.uses[t]++,r}_invokeOne(n){const t=Object.values(this.plugins);t.push(this);for(let i=0;i<t.length;i++){const r=n(t[i]);if(r)return r}return null}_invokeAll(n){const t=Object.values(this.plugins);t.unshift(this);const i=[];for(let r=0;r<t.length;r++){const a=n(t[r]);a&&i.push(a)}return i}getDependency(n,t){const i=n+":"+t;let r=this.cache.get(i);if(!r){switch(n){case"scene":r=this.loadScene(t);break;case"node":r=this._invokeOne(function(a){return a.loadNode&&a.loadNode(t)});break;case"mesh":r=this._invokeOne(function(a){return a.loadMesh&&a.loadMesh(t)});break;case"accessor":r=this.loadAccessor(t);break;case"bufferView":r=this._invokeOne(function(a){return a.loadBufferView&&a.loadBufferView(t)});break;case"buffer":r=this.loadBuffer(t);break;case"material":r=this._invokeOne(function(a){return a.loadMaterial&&a.loadMaterial(t)});break;case"texture":r=this._invokeOne(function(a){return a.loadTexture&&a.loadTexture(t)});break;case"skin":r=this.loadSkin(t);break;case"animation":r=this._invokeOne(function(a){return a.loadAnimation&&a.loadAnimation(t)});break;case"camera":r=this.loadCamera(t);break;default:if(r=this._invokeOne(function(a){return a!=this&&a.getDependency&&a.getDependency(n,t)}),!r)throw new Error("Unknown type: "+n);break}this.cache.add(i,r)}return r}getDependencies(n){let t=this.cache.get(n);if(!t){const i=this,r=this.json[n+(n==="mesh"?"es":"s")]||[];t=Promise.all(r.map(function(a,o){return i.getDependency(n,o)})),this.cache.add(n,t)}return t}loadBuffer(n){const t=this.json.buffers[n],i=this.fileLoader;if(t.type&&t.type!=="arraybuffer")throw new Error("THREE.GLTFLoader: "+t.type+" buffer type is not supported.");if(t.uri===void 0&&n===0)return Promise.resolve(this.extensions[Ne.KHR_BINARY_GLTF].body);const r=this.options;return new Promise(function(a,o){i.load(Mn.resolveURL(t.uri,r.path),a,void 0,function(){o(new Error('THREE.GLTFLoader: Failed to load buffer "'+t.uri+'".'))})})}loadBufferView(n){const t=this.json.bufferViews[n];return this.getDependency("buffer",t.buffer).then(function(i){const r=t.byteLength||0,a=t.byteOffset||0;return i.slice(a,a+r)})}loadAccessor(n){const t=this,i=this.json,r=this.json.accessors[n];if(r.bufferView===void 0&&r.sparse===void 0){const o=ri[r.type],l=cn[r.componentType],f=r.normalized===!0,d=new l(r.count*o);return Promise.resolve(new Yt(d,o,f))}const a=[];return r.bufferView!==void 0?a.push(this.getDependency("bufferView",r.bufferView)):a.push(null),r.sparse!==void 0&&(a.push(this.getDependency("bufferView",r.sparse.indices.bufferView)),a.push(this.getDependency("bufferView",r.sparse.values.bufferView))),Promise.all(a).then(function(o){const l=o[0],f=ri[r.type],d=cn[r.componentType],_=d.BYTES_PER_ELEMENT,g=_*f,u=r.byteOffset||0,v=r.bufferView!==void 0?i.bufferViews[r.bufferView].byteStride:void 0,A=r.normalized===!0;let D,h;if(v&&v!==g){const c=Math.floor(u/v),M="InterleavedBuffer:"+r.bufferView+":"+r.componentType+":"+c+":"+r.count;let R=t.cache.get(M);R||(D=new d(l,c*v,r.count*v/_),R=new us(D,v/_),t.cache.add(M,R)),h=new Rs(R,f,u%v/_,A)}else l===null?D=new d(r.count*f):D=new d(l,u,r.count*f),h=new Yt(D,f,A);if(r.sparse!==void 0){const c=ri.SCALAR,M=cn[r.sparse.indices.componentType],R=r.sparse.indices.byteOffset||0,b=r.sparse.values.byteOffset||0,T=new M(o[1],R,r.sparse.count*c),E=new d(o[2],b,r.sparse.count*f);l!==null&&(h=new Yt(h.array.slice(),h.itemSize,h.normalized)),h.normalized=!1;for(let P=0,m=T.length;P<m;P++){const S=T[P];if(h.setX(S,E[P*f]),f>=2&&h.setY(S,E[P*f+1]),f>=3&&h.setZ(S,E[P*f+2]),f>=4&&h.setW(S,E[P*f+3]),f>=5)throw new Error("THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.")}h.normalized=A}return h})}loadTexture(n){const t=this.json,i=this.options,a=t.textures[n].source,o=t.images[a];let l=this.textureLoader;if(o.uri){const f=i.manager.getHandler(o.uri);f!==null&&(l=f)}return this.loadTextureImage(n,a,l)}loadTextureImage(n,t,i){const r=this,a=this.json,o=a.textures[n],l=a.images[t],f=(l.uri||l.bufferView)+":"+o.sampler;if(this.textureCache[f])return this.textureCache[f];const d=this.loadImageSource(t,i).then(function(_){_.flipY=!1,_.name=o.name||l.name||"",_.name===""&&typeof l.uri=="string"&&l.uri.startsWith("data:image/")===!1&&(_.name=l.uri);const u=(a.samplers||{})[o.sampler]||{};return _.magFilter=Ka[u.magFilter]||mt,_.minFilter=Ka[u.minFilter]||qt,_.wrapS=ja[u.wrapS]||On,_.wrapT=ja[u.wrapT]||On,_.generateMipmaps=!_.isCompressedTexture&&_.minFilter!==Bt&&_.minFilter!==mt,r.associations.set(_,{textures:n}),_}).catch(function(){return null});return this.textureCache[f]=d,d}loadImageSource(n,t){const i=this,r=this.json,a=this.options;if(this.sourceCache[n]!==void 0)return this.sourceCache[n].then(g=>g.clone());const o=r.images[n],l=self.URL||self.webkitURL;let f=o.uri||"",d=!1;if(o.bufferView!==void 0)f=i.getDependency("bufferView",o.bufferView).then(function(g){d=!0;const u=new Blob([g],{type:o.mimeType});return f=l.createObjectURL(u),f});else if(o.uri===void 0)throw new Error("THREE.GLTFLoader: Image "+n+" is missing URI and bufferView");const _=Promise.resolve(f).then(function(g){return new Promise(function(u,v){let A=u;t.isImageBitmapLoader===!0&&(A=function(D){const h=new di(D);h.needsUpdate=!0,u(h)}),t.load(Mn.resolveURL(g,a.path),A,void 0,v)})}).then(function(g){return d===!0&&l.revokeObjectURL(f),Lt(g,o),g.userData.mimeType=o.mimeType||np(o.uri),g}).catch(function(g){throw console.error("THREE.GLTFLoader: Couldn't load texture",f),g});return this.sourceCache[n]=_,_}assignTexture(n,t,i,r){const a=this;return this.getDependency("texture",i.index).then(function(o){if(!o)return null;if(i.texCoord!==void 0&&i.texCoord>0&&(o=o.clone(),o.channel=i.texCoord),a.extensions[Ne.KHR_TEXTURE_TRANSFORM]){const l=i.extensions!==void 0?i.extensions[Ne.KHR_TEXTURE_TRANSFORM]:void 0;if(l){const f=a.associations.get(o);o=a.extensions[Ne.KHR_TEXTURE_TRANSFORM].extendTexture(o,l),a.associations.set(o,f)}}return r!==void 0&&(o.colorSpace=r),n[t]=o,o})}assignFinalMaterial(n){const t=n.geometry;let i=n.material;const r=t.attributes.tangent===void 0,a=t.attributes.color!==void 0,o=t.attributes.normal===void 0;if(n.isPoints){const l="PointsMaterial:"+i.uuid;let f=this.cache.get(l);f||(f=new ps,Zn.prototype.copy.call(f,i),f.color.copy(i.color),f.map=i.map,f.sizeAttenuation=!1,this.cache.add(l,f)),i=f}else if(n.isLine){const l="LineBasicMaterial:"+i.uuid;let f=this.cache.get(l);f||(f=new hs,Zn.prototype.copy.call(f,i),f.color.copy(i.color),f.map=i.map,this.cache.add(l,f)),i=f}if(r||a||o){let l="ClonedMaterial:"+i.uuid+":";r&&(l+="derivative-tangents:"),a&&(l+="vertex-colors:"),o&&(l+="flat-shading:");let f=this.cache.get(l);f||(f=i.clone(),a&&(f.vertexColors=!0),o&&(f.flatShading=!0),r&&(f.normalScale&&(f.normalScale.y*=-1),f.clearcoatNormalScale&&(f.clearcoatNormalScale.y*=-1)),this.cache.add(l,f),this.associations.set(f,this.associations.get(i))),i=f}n.material=i}getMaterialType(){return Sr}loadMaterial(n){const t=this,i=this.json,r=this.extensions,a=i.materials[n];let o;const l={},f=a.extensions||{},d=[];if(f[Ne.KHR_MATERIALS_UNLIT]){const g=r[Ne.KHR_MATERIALS_UNLIT];o=g.getMaterialType(),d.push(g.extendParams(l,a,t))}else{const g=a.pbrMetallicRoughness||{};if(l.color=new Be(1,1,1),l.opacity=1,Array.isArray(g.baseColorFactor)){const u=g.baseColorFactor;l.color.setRGB(u[0],u[1],u[2],Mt),l.opacity=u[3]}g.baseColorTexture!==void 0&&d.push(t.assignTexture(l,"map",g.baseColorTexture,ln)),l.metalness=g.metallicFactor!==void 0?g.metallicFactor:1,l.roughness=g.roughnessFactor!==void 0?g.roughnessFactor:1,g.metallicRoughnessTexture!==void 0&&(d.push(t.assignTexture(l,"metalnessMap",g.metallicRoughnessTexture)),d.push(t.assignTexture(l,"roughnessMap",g.metallicRoughnessTexture))),o=this._invokeOne(function(u){return u.getMaterialType&&u.getMaterialType(n)}),d.push(Promise.all(this._invokeAll(function(u){return u.extendMaterialParams&&u.extendMaterialParams(n,l)})))}a.doubleSided===!0&&(l.side=Ut);const _=a.alphaMode||oi.OPAQUE;if(_===oi.BLEND?(l.transparent=!0,l.depthWrite=!1):(l.transparent=!1,_===oi.MASK&&(l.alphaTest=a.alphaCutoff!==void 0?a.alphaCutoff:.5)),a.normalTexture!==void 0&&o!==sn&&(d.push(t.assignTexture(l,"normalMap",a.normalTexture)),l.normalScale=new gt(1,1),a.normalTexture.scale!==void 0)){const g=a.normalTexture.scale;l.normalScale.set(g,g)}if(a.occlusionTexture!==void 0&&o!==sn&&(d.push(t.assignTexture(l,"aoMap",a.occlusionTexture)),a.occlusionTexture.strength!==void 0&&(l.aoMapIntensity=a.occlusionTexture.strength)),a.emissiveFactor!==void 0&&o!==sn){const g=a.emissiveFactor;l.emissive=new Be().setRGB(g[0],g[1],g[2],Mt)}return a.emissiveTexture!==void 0&&o!==sn&&d.push(t.assignTexture(l,"emissiveMap",a.emissiveTexture,ln)),Promise.all(d).then(function(){const g=new o(l);return a.name&&(g.name=a.name),Lt(g,a),t.associations.set(g,{materials:n}),a.extensions&&Qt(r,g,a),g})}createUniqueName(n){const t=ms.sanitizeNodeName(n||"");return t in this.nodeNamesUsed?t+"_"+ ++this.nodeNamesUsed[t]:(this.nodeNamesUsed[t]=0,t)}loadGeometries(n){const t=this,i=this.extensions,r=this.primitiveCache;function a(l){return i[Ne.KHR_DRACO_MESH_COMPRESSION].decodePrimitive(l,t).then(function(f){return Ya(f,l,t)})}const o=[];for(let l=0,f=n.length;l<f;l++){const d=n[l],_=tp(d),g=r[_];if(g)o.push(g.promise);else{let u;d.extensions&&d.extensions[Ne.KHR_DRACO_MESH_COMPRESSION]?u=a(d):u=Ya(new hn,d,t),r[_]={primitive:d,promise:u},o.push(u)}}return Promise.all(o)}loadMesh(n){const t=this,i=this.json,r=this.extensions,a=i.meshes[n],o=a.primitives,l=[];for(let f=0,d=o.length;f<d;f++){const _=o[f].material===void 0?Qu(this.cache):this.getDependency("material",o[f].material);l.push(_)}return l.push(t.loadGeometries(o)),Promise.all(l).then(function(f){const d=f.slice(0,f.length-1),_=f[f.length-1],g=[];for(let v=0,A=_.length;v<A;v++){const D=_[v],h=o[v];let c;const M=d[v];if(h.mode===Tt.TRIANGLES||h.mode===Tt.TRIANGLE_STRIP||h.mode===Tt.TRIANGLE_FAN||h.mode===void 0)c=a.isSkinnedMesh===!0?new gs(D,M):new yt(D,M),c.isSkinnedMesh===!0&&c.normalizeSkinWeights(),h.mode===Tt.TRIANGLE_STRIP?c.geometry=Wa(c.geometry,br):h.mode===Tt.TRIANGLE_FAN&&(c.geometry=Wa(c.geometry,ui));else if(h.mode===Tt.LINES)c=new _s(D,M);else if(h.mode===Tt.LINE_STRIP)c=new bs(D,M);else if(h.mode===Tt.LINE_LOOP)c=new vs(D,M);else if(h.mode===Tt.POINTS)c=new xs(D,M);else throw new Error("THREE.GLTFLoader: Primitive mode unsupported: "+h.mode);Object.keys(c.geometry.morphAttributes).length>0&&ep(c,a),c.name=t.createUniqueName(a.name||"mesh_"+n),Lt(c,a),h.extensions&&Qt(r,c,h),t.assignFinalMaterial(c),g.push(c)}for(let v=0,A=g.length;v<A;v++)t.associations.set(g[v],{meshes:n,primitives:v});if(g.length===1)return a.extensions&&Qt(r,g[0],a),g[0];const u=new Qn;a.extensions&&Qt(r,u,a),t.associations.set(u,{meshes:n});for(let v=0,A=g.length;v<A;v++)u.add(g[v]);return u})}loadCamera(n){let t;const i=this.json.cameras[n],r=i[i.type];if(!r){console.warn("THREE.GLTFLoader: Missing camera parameters.");return}return i.type==="perspective"?t=new Tn(Es.radToDeg(r.yfov),r.aspectRatio||1,r.znear||1,r.zfar||2e6):i.type==="orthographic"&&(t=new _i(-r.xmag,r.xmag,r.ymag,-r.ymag,r.znear,r.zfar)),i.name&&(t.name=this.createUniqueName(i.name)),Lt(t,i),Promise.resolve(t)}loadSkin(n){const t=this.json.skins[n],i=[];for(let r=0,a=t.joints.length;r<a;r++)i.push(this._loadNodeShallow(t.joints[r]));return t.inverseBindMatrices!==void 0?i.push(this.getDependency("accessor",t.inverseBindMatrices)):i.push(null),Promise.all(i).then(function(r){const a=r.pop(),o=r,l=[],f=[];for(let d=0,_=o.length;d<_;d++){const g=o[d];if(g){l.push(g);const u=new Ft;a!==null&&u.fromArray(a.array,d*16),f.push(u)}else console.warn('THREE.GLTFLoader: Joint "%s" could not be found.',t.joints[d])}return new Ss(l,f)})}loadAnimation(n){const t=this.json,i=this,r=t.animations[n],a=r.name?r.name:"animation_"+n,o=[],l=[],f=[],d=[],_=[];for(let g=0,u=r.channels.length;g<u;g++){const v=r.channels[g],A=r.samplers[v.sampler],D=v.target,h=D.node,c=r.parameters!==void 0?r.parameters[A.input]:A.input,M=r.parameters!==void 0?r.parameters[A.output]:A.output;D.node!==void 0&&(o.push(this.getDependency("node",h)),l.push(this.getDependency("accessor",c)),f.push(this.getDependency("accessor",M)),d.push(A),_.push(D))}return Promise.all([Promise.all(o),Promise.all(l),Promise.all(f),Promise.all(d),Promise.all(_)]).then(function(g){const u=g[0],v=g[1],A=g[2],D=g[3],h=g[4],c=[];for(let R=0,b=u.length;R<b;R++){const T=u[R],E=v[R],P=A[R],m=D[R],S=h[R];if(T===void 0)continue;T.updateMatrix&&T.updateMatrix();const I=i._createAnimationTracks(T,E,P,m,S);if(I)for(let U=0;U<I.length;U++)c.push(I[U])}const M=new Ts(a,void 0,c);return Lt(M,r),M})}createNodeMesh(n){const t=this.json,i=this,r=t.nodes[n];return r.mesh===void 0?null:i.getDependency("mesh",r.mesh).then(function(a){const o=i._getNodeRef(i.meshCache,r.mesh,a);return r.weights!==void 0&&o.traverse(function(l){if(l.isMesh)for(let f=0,d=r.weights.length;f<d;f++)l.morphTargetInfluences[f]=r.weights[f]}),o})}loadNode(n){const t=this.json,i=this,r=t.nodes[n],a=i._loadNodeShallow(n),o=[],l=r.children||[];for(let d=0,_=l.length;d<_;d++)o.push(i.getDependency("node",l[d]));const f=r.skin===void 0?Promise.resolve(null):i.getDependency("skin",r.skin);return Promise.all([a,Promise.all(o),f]).then(function(d){const _=d[0],g=d[1],u=d[2];u!==null&&_.traverse(function(v){v.isSkinnedMesh&&v.bind(u,ip)});for(let v=0,A=g.length;v<A;v++)_.add(g[v]);if(_.userData.pivot!==void 0&&g.length>0){const v=_.userData.pivot,A=g[0];_.pivot=new we().fromArray(v),_.position.x-=v[0],_.position.y-=v[1],_.position.z-=v[2],A.position.set(0,0,0),delete _.userData.pivot}return _})}_loadNodeShallow(n){const t=this.json,i=this.extensions,r=this;if(this.nodeCache[n]!==void 0)return this.nodeCache[n];const a=t.nodes[n],o=a.name?r.createUniqueName(a.name):"",l=[],f=r._invokeOne(function(d){return d.createNodeMesh&&d.createNodeMesh(n)});return f&&l.push(f),a.camera!==void 0&&l.push(r.getDependency("camera",a.camera).then(function(d){return r._getNodeRef(r.cameraCache,a.camera,d)})),r._invokeAll(function(d){return d.createNodeAttachment&&d.createNodeAttachment(n)}).forEach(function(d){l.push(d)}),this.nodeCache[n]=Promise.all(l).then(function(d){let _;if(a.isBone===!0?_=new Ms:d.length>1?_=new Qn:d.length===1?_=d[0]:_=new Er,_!==d[0])for(let g=0,u=d.length;g<u;g++)_.add(d[g]);if(a.name&&(_.userData.name=a.name,_.name=o),Lt(_,a),a.extensions&&Qt(i,_,a),a.matrix!==void 0){const g=new Ft;g.fromArray(a.matrix),_.applyMatrix4(g)}else a.translation!==void 0&&_.position.fromArray(a.translation),a.rotation!==void 0&&_.quaternion.fromArray(a.rotation),a.scale!==void 0&&_.scale.fromArray(a.scale);if(!r.associations.has(_))r.associations.set(_,{});else if(a.mesh!==void 0&&r.meshCache.refs[a.mesh]>1){const g=r.associations.get(_);r.associations.set(_,{...g})}return r.associations.get(_).nodes=n,_}),this.nodeCache[n]}loadScene(n){const t=this.extensions,i=this.json.scenes[n],r=this,a=new Qn;i.name&&(a.name=r.createUniqueName(i.name)),Lt(a,i),i.extensions&&Qt(t,a,i);const o=i.nodes||[],l=[];for(let f=0,d=o.length;f<d;f++)l.push(r.getDependency("node",o[f]));return Promise.all(l).then(function(f){for(let _=0,g=f.length;_<g;_++){const u=f[_];u.parent!==null?a.add(Au(u)):a.add(u)}const d=_=>{const g=new Map;for(const[u,v]of r.associations)(u instanceof Zn||u instanceof di)&&g.set(u,v);return _.traverse(u=>{const v=r.associations.get(u);v!=null&&g.set(u,v)}),g};return r.associations=d(a),a})}_createAnimationTracks(n,t,i,r,a){const o=[],l=n.name?n.name:n.uuid,f=[];function d(v){v.morphTargetInfluences&&f.push(v.name?v.name:v.uuid)}Xt[a.path]===Xt.weights?(d(n),n.isGroup&&n.children.forEach(d)):f.push(l);let _;switch(Xt[a.path]){case Xt.weights:_=ba;break;case Xt.rotation:_=va;break;case Xt.translation:case Xt.scale:_=_a;break;default:i.itemSize===1?_=ba:_=_a;break}const g=r.interpolation!==void 0?Zu[r.interpolation]:Tr,u=this._getArrayFromAccessor(i);for(let v=0,A=f.length;v<A;v++){const D=new _(f[v]+"."+Xt[a.path],t.array,u,g);r.interpolation==="CUBICSPLINE"&&this._createCubicSplineTrackInterpolant(D),o.push(D)}return o}_getArrayFromAccessor(n){let t=n.array;if(n.normalized){const i=gi(t.constructor),r=new Float32Array(t.length);for(let a=0,o=t.length;a<o;a++)r[a]=t[a]*i;t=r}return t}_createCubicSplineTrackInterpolant(n){n.createInterpolant=function(i){const r=this instanceof va?Ju:Ir;return new r(this.times,this.values,this.getValueSize()/3,i)},n.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline=!0}}function rp(e,n,t){const i=n.attributes,r=new Ps;if(i.POSITION!==void 0){const l=t.json.accessors[i.POSITION],f=l.min,d=l.max;if(f!==void 0&&d!==void 0){if(r.set(new we(f[0],f[1],f[2]),new we(d[0],d[1],d[2])),l.normalized){const _=gi(cn[l.componentType]);r.min.multiplyScalar(_),r.max.multiplyScalar(_)}}else{console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.");return}}else return;const a=n.targets;if(a!==void 0){const l=new we,f=new we;for(let d=0,_=a.length;d<_;d++){const g=a[d];if(g.POSITION!==void 0){const u=t.json.accessors[g.POSITION],v=u.min,A=u.max;if(v!==void 0&&A!==void 0){if(f.setX(Math.max(Math.abs(v[0]),Math.abs(A[0]))),f.setY(Math.max(Math.abs(v[1]),Math.abs(A[1]))),f.setZ(Math.max(Math.abs(v[2]),Math.abs(A[2]))),u.normalized){const D=gi(cn[u.componentType]);f.multiplyScalar(D)}l.max(f)}else console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.")}}r.expandByVector(l)}e.boundingBox=r;const o=new Ls;r.getCenter(o.center),o.radius=r.min.distanceTo(r.max)/2,e.boundingSphere=o}function Ya(e,n,t){const i=n.attributes,r=[];function a(o,l){return t.getDependency("accessor",o).then(function(f){e.setAttribute(l,f)})}for(const o in i){const l=mi[o]||o.toLowerCase();l in e.attributes||r.push(a(i[o],l))}if(n.indices!==void 0&&!e.index){const o=t.getDependency("accessor",n.indices).then(function(l){e.setIndex(l)});r.push(o)}return Qe.workingColorSpace!==Mt&&"COLOR_0"in i&&console.warn(`THREE.GLTFLoader: Converting vertex colors from "srgb-linear" to "${Qe.workingColorSpace}" not supported.`),Lt(e,n),rp(e,n,t),Promise.all(r).then(function(){return n.targets!==void 0?$u(e,n.targets,t):e})}var op=(function(){var e="b9H79Tebbbe8Fv9Gbb9Gvuuuuueu9Giuuub9Geueu9Giuuueuixkbeeeddddillviebeoweuecj:Gdkr;Neqo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9KW9J9V9KW9wWVtW949c919M9MWVbeY9TW79O9V9Wt9F9KW9J9V9KW69U9KW949c919M9MWVbdE9TW79O9V9Wt9F9KW9J9V9KW69U9KW949tWG91W9U9JWbiL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9p9JtblK9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9r919HtbvL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVT949WboY9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVJ9V29VVbrl79IV9Rbwq:VZkdbk:XYi5ud9:du8Jjjjjbcj;kb9Rgv8Kjjjjbc9:hodnalTmbcuhoaiRbbgrc;WeGc:Ge9hmbarcsGgwce0mbc9:hoalcufadcd4cbawEgDadfgrcKcaawEgqaraq0Egk6mbaicefhxcj;abad9Uc;WFbGcjdadca0EhmaialfgPar9Rgoadfhsavaoadz:jjjjbgzceVhHcbhOdndninaeaO9nmeaPax9RaD6mdamaeaO9RaOamfgoae6EgAcsfglc9WGhCabaOad2fhXaAcethQaxaDfhiaOaeaoaeao6E9RhLalcl4cifcd4hKazcj;cbfaAfhYcbh8AazcjdfhEaHh3incbh5dnawTmbaxa8Acd4fRbbh5kcbh8Eazcj;cbfhqinaih8Fdndndndna5a8Ecet4ciGgoc9:fPdebdkaPa8F9RaA6mrazcj;cbfa8EaA2fa8FaAz:jjjjb8Aa8FaAfhixdkazcj;cbfa8EaA2fcbaAz:kjjjb8Aa8FhixekaPa8F9RaK6mva8FaKfhidnaCTmbaPai9RcK6mbaocdtc:q:G:cjbfcj:G:cjbawEhaczhrcbhlinargoc9Wfghaqfhrdndndndndndnaaa8Fahco4fRbbalcoG4ciGcdtfydbPDbedvivvvlvkar9cb83bwar9cb83bbxlkarcbaiRbdai8Xbb9c:c:qj:bw9:9c:q;c1:I1e:d9c:b:c:e1z9:gg9cjjjjjz:dg8J9qE86bbaqaofgrcGfcbaicdfa8J9c8N1:NfghRbbag9cjjjjjw:dg8J9qE86bbarcVfcbaha8J9c8M1:NfghRbbag9cjjjjjl:dg8J9qE86bbarc7fcbaha8J9c8L1:NfghRbbag9cjjjjjd:dg8J9qE86bbarctfcbaha8J9c8K1:NfghRbbag9cjjjjje:dg8J9qE86bbarc91fcbaha8J9c8J1:NfghRbbag9cjjjj;ab:dg8J9qE86bbarc4fcbaha8J9cg1:NfghRbbag9cjjjja:dg8J9qE86bbarc93fcbaha8J9ch1:NfghRbbag9cjjjjz:dgg9qE86bbarc94fcbahag9ca1:NfghRbbai8Xbe9c:c:qj:bw9:9c:q;c1:I1e:d9c:b:c:e1z9:gg9cjjjjjz:dg8J9qE86bbarc95fcbaha8J9c8N1:NfgiRbbag9cjjjjjw:dg8J9qE86bbarc96fcbaia8J9c8M1:NfgiRbbag9cjjjjjl:dg8J9qE86bbarc97fcbaia8J9c8L1:NfgiRbbag9cjjjjjd:dg8J9qE86bbarc98fcbaia8J9c8K1:NfgiRbbag9cjjjjje:dg8J9qE86bbarc99fcbaia8J9c8J1:NfgiRbbag9cjjjj;ab:dg8J9qE86bbarc9:fcbaia8J9cg1:NfgiRbbag9cjjjja:dg8J9qE86bbarcufcbaia8J9ch1:NfgiRbbag9cjjjjz:dgg9qE86bbaiag9ca1:NfhixikaraiRblaiRbbghco4g8Ka8KciSg8KE86bbaqaofgrcGfaiclfa8Kfg8KRbbahcl4ciGg8La8LciSg8LE86bbarcVfa8Ka8Lfg8KRbbahcd4ciGg8La8LciSg8LE86bbarc7fa8Ka8Lfg8KRbbahciGghahciSghE86bbarctfa8Kahfg8KRbbaiRbeghco4g8La8LciSg8LE86bbarc91fa8Ka8Lfg8KRbbahcl4ciGg8La8LciSg8LE86bbarc4fa8Ka8Lfg8KRbbahcd4ciGg8La8LciSg8LE86bbarc93fa8Ka8Lfg8KRbbahciGghahciSghE86bbarc94fa8Kahfg8KRbbaiRbdghco4g8La8LciSg8LE86bbarc95fa8Ka8Lfg8KRbbahcl4ciGg8La8LciSg8LE86bbarc96fa8Ka8Lfg8KRbbahcd4ciGg8La8LciSg8LE86bbarc97fa8Ka8Lfg8KRbbahciGghahciSghE86bbarc98fa8KahfghRbbaiRbigico4g8Ka8KciSg8KE86bbarc99faha8KfghRbbaicl4ciGg8Ka8KciSg8KE86bbarc9:faha8KfghRbbaicd4ciGg8Ka8KciSg8KE86bbarcufaha8KfgrRbbaiciGgiaiciSgiE86bbaraifhixdkaraiRbwaiRbbghcl4g8Ka8KcsSg8KE86bbaqaofgrcGfaicwfa8Kfg8KRbbahcsGghahcsSghE86bbarcVfa8KahfghRbbaiRbeg8Kcl4g8La8LcsSg8LE86bbarc7faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarctfaha8KfghRbbaiRbdg8Kcl4g8La8LcsSg8LE86bbarc91faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc4faha8KfghRbbaiRbig8Kcl4g8La8LcsSg8LE86bbarc93faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc94faha8KfghRbbaiRblg8Kcl4g8La8LcsSg8LE86bbarc95faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc96faha8KfghRbbaiRbvg8Kcl4g8La8LcsSg8LE86bbarc97faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc98faha8KfghRbbaiRbog8Kcl4g8La8LcsSg8LE86bbarc99faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc9:faha8KfghRbbaiRbrgicl4g8Ka8KcsSg8KE86bbarcufaha8KfgrRbbaicsGgiaicsSgiE86bbaraifhixekarai8Pbw83bwarai8Pbb83bbaiczfhikdnaoaC9pmbalcdfhlaoczfhraPai9RcL0mekkaoaC6moaimexokaCmva8FTmvkaqaAfhqa8Ecefg8Ecl9hmbkdndndndnawTmbasa8Acd4fRbbgociGPlbedrbkaATmdaza8Afh8Fazcj;cbfhhcbh8EaEhaina8FRbbhraahocbhlinaoahalfRbbgqce4cbaqceG9R7arfgr86bbaoadfhoaAalcefgl9hmbkaacefhaa8Fcefh8FahaAfhha8Ecefg8Ecl9hmbxikkaATmeaza8Afhaazcj;cbfhhcbhoceh8EaYh8FinaEaofhlaa8Vbbhrcbhoinala8FaofRbbcwtahaofRbbgqVc;:FiGce4cbaqceG9R7arfgr87bbaladfhlaLaocefgofmbka8FaQfh8FcdhoaacdfhaahaQfhha8EceGhlcbh8EalmbxdkkaATmbaocl4h8Eaza8AfRbbhqcwhoa3hlinalRbbaotaqVhqalcefhlaocwfgoca9hmbkcbhhaEh8FaYhainazcj;cbfahfRbbhrcwhoaahlinalRbbaotarVhralaAfhlaocwfgoca9hmbkara8E94aq7hqcbhoa8Fhlinalaqao486bbalcefhlaocwfgoca9hmbka8Fadfh8FaacefhaahcefghaA9hmbkkaEclfhEa3clfh3a8Aclfg8Aad6mbkaXazcjdfaAad2z:jjjjb8AazazcjdfaAcufad2fadz:jjjjb8AaAaOfhOaihxaimbkc9:hoxdkcbc99aPax9RakSEhoxekc9:hokavcj;kbf8Kjjjjbaok:ysezu8Jjjjjbc;ae9Rgv8Kjjjjbc9:hodnalaeci9UgrcHf6mbcuhoaiRbbgwc;WeGc;Ge9hmbawcsGgDce0mbavc;abfcFecjez:kjjjb8Aav9cu83iUav9cu83i8Wav9cu83iyav9cu83iaav9cu83iKav9cu83izav9cu83iwav9cu83ibaialfc9WfhqaicefgwarfhldnaeTmbcmcsaDceSEhkcbhxcbhmcbhrcbhicbhoindnalaq9nmbc9:hoxikdndnawRbbgDc;Ve0mbavc;abfaoaDcu7gPcl4fcsGcitfgsydlhzasydbhHdndnaDcsGgsak9pmbavaiaPfcsGcdtfydbaxasEhDaxasTgOfhxxekdndnascsSmbcehOasc987asamffcefhDxekalcefhDal8SbbgscFeGhPdndnascu9mmbaDhlxekalcvfhlaPcFbGhPcrhsdninaD8SbbgOcFbGastaPVhPaOcu9kmeaDcefhDascrfgsc8J9hmbxdkkaDcefhlkcehOaPce4cbaPceG9R7amfhDkaDhmkavc;abfaocitfgsaDBdbasazBdlavaicdtfaDBdbavc;abfaocefcsGcitfgsaHBdbasaDBdlaocdfhoaOaifhidnadcd9hmbabarcetfgsaH87ebasclfaD87ebascdfaz87ebxdkabarcdtfgsaHBdbascwfaDBdbasclfazBdbxekdnaDcpe0mbavaiaqaDcsGfRbbgscl4gP9RcsGcdtfydbaxcefgOaPEhDavaias9RcsGcdtfydbaOaPTgzfgOascsGgPEhsaPThPdndnadcd9hmbabarcetfgHax87ebaHclfas87ebaHcdfaD87ebxekabarcdtfgHaxBdbaHcwfasBdbaHclfaDBdbkavaicdtfaxBdbavc;abfaocitfgHaDBdbaHaxBdlavaicefgicsGcdtfaDBdbavc;abfaocefcsGcitfgHasBdbaHaDBdlavaiazfgicsGcdtfasBdbavc;abfaocdfcsGcitfgDaxBdbaDasBdlaocifhoaiaPfhiaOaPfhxxekaxcbalRbbgsEgHaDc;:eSgDfhOascsGhAdndnascl4gCmbaOcefhzxekaOhzavaiaC9RcsGcdtfydbhOkdndnaAmbazcefhxxekazhxavaias9RcsGcdtfydbhzkdndnaDTmbalcefhDxekalcdfhDal8SbegPcFeGhsdnaPcu9kmbalcofhHascFbGhscrhldninaD8SbbgPcFbGaltasVhsaPcu9kmeaDcefhDalcrfglc8J9hmbkaHhDxekaDcefhDkasce4cbasceG9R7amfgmhHkdndnaCcsSmbaDhsxekaDcefhsaD8SbbglcFeGhPdnalcu9kmbaDcvfhOaPcFbGhPcrhldninas8SbbgDcFbGaltaPVhPaDcu9kmeascefhsalcrfglc8J9hmbkaOhsxekascefhskaPce4cbaPceG9R7amfgmhOkdndnaAcsSmbashlxekascefhlas8SbbgDcFeGhPdnaDcu9kmbascvfhzaPcFbGhPcrhDdninal8SbbgscFbGaDtaPVhPascu9kmealcefhlaDcrfgDc8J9hmbkazhlxekalcefhlkaPce4cbaPceG9R7amfgmhzkdndnadcd9hmbabarcetfgDaH87ebaDclfaz87ebaDcdfaO87ebxekabarcdtfgDaHBdbaDcwfazBdbaDclfaOBdbkavc;abfaocitfgDaOBdbaDaHBdlavaicdtfaHBdbavc;abfaocefcsGcitfgDazBdbaDaOBdlavaicefgicsGcdtfaOBdbavc;abfaocdfcsGcitfgDaHBdbaDazBdlavaiaCTaCcsSVfgicsGcdtfazBdbaiaATaAcsSVfhiaocifhokawcefhwaocsGhoaicsGhiarcifgrae6mbkkcbc99alaqSEhokavc;aef8Kjjjjbaok:clevu8Jjjjjbcz9Rhvdnalaecvf9pmbc9:skdnaiRbbc;:eGc;qeSmbcuskav9cb83iwaicefhoaialfc98fhrdnaeTmbdnadcdSmbcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcdtfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgiBdbalaiBdbawcefgwae9hmbxdkkcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcetfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgi87ebalaiBdbawcefgwae9hmbkkcbc99aoarSEk:Lvoeue99dud99eud99dndnadcl9hmbaeTmeindndnabcdfgd8Sbb:Yab8Sbbgi:Ygl:l:tabcefgv8Sbbgo:Ygr:l:tgwJbb;:9cawawNJbbbbawawJbbbb9GgDEgq:mgkaqaicb9iEalMgwawNakaqaocb9iEarMgqaqNMM:r:vglNJbbbZJbbb:;aDEMgr:lJbbb9p9DTmbar:Ohixekcjjjj94hikadai86bbdndnaqalNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkavad86bbdndnawalNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohdxekcjjjj94hdkabad86bbabclfhbaecufgembxdkkaeTmbindndnabclfgd8Ueb:Yab8Uebgi:Ygl:l:tabcdfgv8Uebgo:Ygr:l:tgwJb;:FSawawNJbbbbawawJbbbb9GgDEgq:mgkaqaicb9iEalMgwawNakaqaocb9iEarMgqaqNMM:r:vglNJbbbZJbbb:;aDEMgr:lJbbb9p9DTmbar:Ohixekcjjjj94hikadai87ebdndnaqalNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkavad87ebdndnawalNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohdxekcjjjj94hdkabad87ebabcwfhbaecufgembkkk:4ioiue99dud99dud99dnaeTmbcbhiabhlindndnal8Uebgv:YgoJ:ji:1Salcof8UebgrciVgw:Y:vgDNJbbbZJbbb:;avcu9kEMgq:lJbbb9p9DTmbaq:Ohkxekcjjjj94hkkalclf8Uebhvalcdf8UebhxalarcefciGcetfak87ebdndnax:YgqaDNJbbbZJbbb:;axcu9kEMgm:lJbbb9p9DTmbam:Ohxxekcjjjj94hxkabaiarciGgkfcd7cetfax87ebdndnav:YgmaDNJbbbZJbbb:;avcu9kEMgP:lJbbb9p9DTmbaP:Ohvxekcjjjj94hvkalarcufciGcetfav87ebdndnawaw2:ZgPaPMaoaoN:taqaqN:tamamN:tgoJbbbbaoJbbbb9GE:raDNJbbbZMgD:lJbbb9p9DTmbaD:Ohrxekcjjjj94hrkalakcetfar87ebalcwfhlaiclfhiaecufgembkkk9mbdnadcd4ae2gdTmbinababydbgecwtcw91:Yaece91cjjj98Gcjjj;8if::NUdbabclfhbadcufgdmbkkk:Tvirud99eudndnadcl9hmbaeTmeindndnabRbbgiabcefgl8Sbbgvabcdfgo8Sbbgrf9R:YJbbuJabcifgwRbbgdce4adVgDcd4aDVgDcl4aDVgD:Z:vgqNJbbbZMgk:lJbbb9p9DTmbak:Ohxxekcjjjj94hxkaoax86bbdndnaraif:YaqNJbbbZMgk:lJbbb9p9DTmbak:Ohoxekcjjjj94hokalao86bbdndnavaifar9R:YaqNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikabai86bbdndnaDadcetGadceGV:ZaqNJbbbZMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkawad86bbabclfhbaecufgembxdkkaeTmbindndnab8Vebgiabcdfgl8Uebgvabclfgo8Uebgrf9R:YJbFu9habcofgw8Vebgdce4adVgDcd4aDVgDcl4aDVgDcw4aDVgD:Z:vgqNJbbbZMgk:lJbbb9p9DTmbak:Ohxxekcjjjj94hxkaoax87ebdndnaraif:YaqNJbbbZMgk:lJbbb9p9DTmbak:Ohoxekcjjjj94hokalao87ebdndnavaifar9R:YaqNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikabai87ebdndnaDadcetGadceGV:ZaqNJbbbZMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkawad87ebabcwfhbaecufgembkkk9teiucbcbyd:K:G:cjbgeabcifc98GfgbBd:K:G:cjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;LeeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiclfaeclfydbBdbaicwfaecwfydbBdbaicxfaecxfydbBdbaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk;aeedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdbaicxfalBdbaicwfalBdbaiclfalBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabkk83dbcj:Gdk8Kbbbbdbbblbbbwbbbbbbbebbbdbbblbbbwbbbbc:K:Gdkl8W:qbb",n="b9H79TebbbeKl9Gbb9Gvuuuuueu9Giuuub9Geueuixkbbebeeddddilve9Weeeviebeoweuecj:Gdkr;Neqo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9KW9J9V9KW9wWVtW949c919M9MWVbdY9TW79O9V9Wt9F9KW9J9V9KW69U9KW949c919M9MWVblE9TW79O9V9Wt9F9KW9J9V9KW69U9KW949tWG91W9U9JWbvL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9p9JtboK9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9r919HtbrL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVT949WbwY9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVJ9V29VVbDl79IV9Rbqq:W9Dklbzik94evu8Jjjjjbcz9Rhbcbheincbhdcbhiinabcwfadfaicjuaead4ceGglE86bbaialfhiadcefgdcw9hmbkaeai86b:q:W:cjbaecitab8Piw83i:q:G:cjbaecefgecjd9hmbkk:JBl8Aud97dur978Jjjjjbcj;kb9Rgv8Kjjjjbc9:hodnalTmbcuhoaiRbbgrc;WeGc:Ge9hmbarcsGgwce0mbc9:hoalcufadcd4cbawEgDadfgrcKcaawEgqaraq0Egk6mbaialfgxar9RhodnadTgmmbavaoad;8qbbkaicefhPcj;abad9Uc;WFbGcjdadca0EhsdndndnadTmbaoadfhzcbhHinaeaH9nmdaxaP9RaD6miabaHad2fhOaPaDfhAasaeaH9RaHasfae6EgCcsfgocl4cifcd4hXavcj;cbfaoc9WGgQcetfhLavcj;cbfaQci2fhKavcj;cbfaQfhYcbh8Aaoc;ab6hEincbh3dnawTmbaPa8Acd4fRbbh3kcbh5avcj;cbfh8Eindndndndna3a5cet4ciGgoc9:fPdebdkaxaA9RaQ6mwdnaQTmbavcj;cbfa5aQ2faAaQ;8qbbkaAaCfhAxdkaQTmeavcj;cbfa5aQ2fcbaQ;8kbxekaxaA9RaX6moaoclVcbawEhraAaXfhocbhidnaEmbaxao9Rc;Gb6mbcbhlina8EalfhidndndndndndnaAalco4fRbbgqciGarfPDbedibledibkaipxbbbbbbbbbbbbbbbbpklbxlkaiaopbblaopbbbg8Fclp:mea8FpmbzeHdOiAlCvXoQrLg8Fcdp:mea8FpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogapxiiiiiiiiiiiiiiiip8Jg8Fp5b9cjF;8;4;W;G;ab9:9cU1:Nghcitpbi:q:G:cjbahRb:q:W:cjbghpsa8Fp5e9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPaaa8Fp9spklbahaoclffagRb:q:W:cjbfhoxikaiaopbbwaopbbbg8Fclp:mea8FpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogapxssssssssssssssssp8Jg8Fp5b9cjF;8;4;W;G;ab9:9cU1:Nghcitpbi:q:G:cjbahRb:q:W:cjbghpsa8Fp5e9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPaaa8Fp9spklbahaocwffagRb:q:W:cjbfhoxdkaiaopbbbpklbaoczfhoxekaiaopbbdaoRbbghcitpbi:q:G:cjbahRb:q:W:cjbghpsaoRbeggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPpklbahaocdffagRb:q:W:cjbfhokdndndndndndnaqcd4ciGarfPDbedibledibkaiczfpxbbbbbbbbbbbbbbbbpklbxlkaiczfaopbblaopbbbg8Fclp:mea8FpmbzeHdOiAlCvXoQrLg8Fcdp:mea8FpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogapxiiiiiiiiiiiiiiiip8Jg8Fp5b9cjF;8;4;W;G;ab9:9cU1:Nghcitpbi:q:G:cjbahRb:q:W:cjbghpsa8Fp5e9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPaaa8Fp9spklbahaoclffagRb:q:W:cjbfhoxikaiczfaopbbwaopbbbg8Fclp:mea8FpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogapxssssssssssssssssp8Jg8Fp5b9cjF;8;4;W;G;ab9:9cU1:Nghcitpbi:q:G:cjbahRb:q:W:cjbghpsa8Fp5e9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPaaa8Fp9spklbahaocwffagRb:q:W:cjbfhoxdkaiczfaopbbbpklbaoczfhoxekaiczfaopbbdaoRbbghcitpbi:q:G:cjbahRb:q:W:cjbghpsaoRbeggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPpklbahaocdffagRb:q:W:cjbfhokdndndndndndnaqcl4ciGarfPDbedibledibkaicafpxbbbbbbbbbbbbbbbbpklbxlkaicafaopbblaopbbbg8Fclp:mea8FpmbzeHdOiAlCvXoQrLg8Fcdp:mea8FpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogapxiiiiiiiiiiiiiiiip8Jg8Fp5b9cjF;8;4;W;G;ab9:9cU1:Nghcitpbi:q:G:cjbahRb:q:W:cjbghpsa8Fp5e9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPaaa8Fp9spklbahaoclffagRb:q:W:cjbfhoxikaicafaopbbwaopbbbg8Fclp:mea8FpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogapxssssssssssssssssp8Jg8Fp5b9cjF;8;4;W;G;ab9:9cU1:Nghcitpbi:q:G:cjbahRb:q:W:cjbghpsa8Fp5e9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPaaa8Fp9spklbahaocwffagRb:q:W:cjbfhoxdkaicafaopbbbpklbaoczfhoxekaicafaopbbdaoRbbghcitpbi:q:G:cjbahRb:q:W:cjbghpsaoRbeggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPpklbahaocdffagRb:q:W:cjbfhokdndndndndndnaqco4arfPDbedibledibkaic8Wfpxbbbbbbbbbbbbbbbbpklbxlkaic8Wfaopbblaopbbbg8Fclp:mea8FpmbzeHdOiAlCvXoQrLg8Fcdp:mea8FpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogapxiiiiiiiiiiiiiiiip8Jg8Fp5b9cjF;8;4;W;G;ab9:9cU1:Ngicitpbi:q:G:cjbaiRb:q:W:cjbgipsa8Fp5e9cjF;8;4;W;G;ab9:9cU1:Ngqcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPaaa8Fp9spklbaiaoclffaqRb:q:W:cjbfhoxikaic8Wfaopbbwaopbbbg8Fclp:mea8FpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogapxssssssssssssssssp8Jg8Fp5b9cjF;8;4;W;G;ab9:9cU1:Ngicitpbi:q:G:cjbaiRb:q:W:cjbgipsa8Fp5e9cjF;8;4;W;G;ab9:9cU1:Ngqcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPaaa8Fp9spklbaiaocwffaqRb:q:W:cjbfhoxdkaic8Wfaopbbbpklbaoczfhoxekaic8WfaopbbdaoRbbgicitpbi:q:G:cjbaiRb:q:W:cjbgipsaoRbegqcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPpklbaiaocdffaqRb:q:W:cjbfhokalc;abfhialcjefaQ0meaihlaxao9Rc;Fb0mbkkdnaiaQ9pmbaici4hlinaxao9RcK6mwa8EaifhqdndndndndndnaAaico4fRbbalcoG4ciGarfPDbedibledibkaqpxbbbbbbbbbbbbbbbbpkbbxlkaqaopbblaopbbbg8Fclp:mea8FpmbzeHdOiAlCvXoQrLg8Fcdp:mea8FpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogapxiiiiiiiiiiiiiiiip8Jg8Fp5b9cjF;8;4;W;G;ab9:9cU1:Nghcitpbi:q:G:cjbahRb:q:W:cjbghpsa8Fp5e9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPaaa8Fp9spkbbahaoclffagRb:q:W:cjbfhoxikaqaopbbwaopbbbg8Fclp:mea8FpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogapxssssssssssssssssp8Jg8Fp5b9cjF;8;4;W;G;ab9:9cU1:Nghcitpbi:q:G:cjbahRb:q:W:cjbghpsa8Fp5e9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPaaa8Fp9spkbbahaocwffagRb:q:W:cjbfhoxdkaqaopbbbpkbbaoczfhoxekaqaopbbdaoRbbghcitpbi:q:G:cjbahRb:q:W:cjbghpsaoRbeggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPpkbbahaocdffagRb:q:W:cjbfhokalcdfhlaiczfgiaQ6mbkkaohAaoTmoka8EaQfh8Ea5cefg5cl9hmbkdndndndnawTmbaza8Acd4fRbbglciGPlbedwbkaQTmdavcjdfa8Afhlava8Afpbdbh8Jcbhoinalavcj;cbfaofpblbg8KaYaofpblbg8LpmbzeHdOiAlCvXoQrLg8MaLaofpblbg8NaKaofpblbgypmbzeHdOiAlCvXoQrLg8PpmbezHdiOAlvCXorQLg8Fcep9Ta8Fpxeeeeeeeeeeeeeeeegap9op9Hp9rg8Fa8Jp9Ug8Jp9Abbbaladfgla8Ja8Fa8Fpmlvorlvorlvorlvorp9Ug8Jp9Abbbaladfgla8Ja8Fa8FpmwDqkwDqkwDqkwDqkp9Ug8Jp9Abbbaladfgla8Ja8Fa8FpmxmPsxmPsxmPsxmPsp9Ug8Jp9Abbbaladfgla8Ja8Ma8PpmwDKYqk8AExm35Ps8E8Fg8Fcep9Ta8Faap9op9Hp9rg8Fp9Ug8Jp9Abbbaladfgla8Ja8Fa8Fpmlvorlvorlvorlvorp9Ug8Jp9Abbbaladfgla8Ja8Fa8FpmwDqkwDqkwDqkwDqkp9Ug8Jp9Abbbaladfgla8Ja8Fa8FpmxmPsxmPsxmPsxmPsp9Ug8Jp9Abbbaladfgla8Ja8Ka8LpmwKDYq8AkEx3m5P8Es8Fg8Ka8NaypmwKDYq8AkEx3m5P8Es8Fg8LpmbezHdiOAlvCXorQLg8Fcep9Ta8Faap9op9Hp9rg8Fp9Ug8Jp9Abbbaladfgla8Ja8Fa8Fpmlvorlvorlvorlvorp9Ug8Jp9Abbbaladfgla8Ja8Fa8FpmwDqkwDqkwDqkwDqkp9Ug8Jp9Abbbaladfgla8Ja8Fa8FpmxmPsxmPsxmPsxmPsp9Ug8Jp9Abbbaladfgla8Ja8Ka8LpmwDKYqk8AExm35Ps8E8Fg8Fcep9Ta8Faap9op9Hp9rg8Fp9Ugap9Abbbaladfglaaa8Fa8Fpmlvorlvorlvorlvorp9Ugap9Abbbaladfglaaa8Fa8FpmwDqkwDqkwDqkwDqkp9Ugap9Abbbaladfglaaa8Fa8FpmxmPsxmPsxmPsxmPsp9Ug8Jp9AbbbaladfhlaoczfgoaQ6mbxikkaQTmeavcjdfa8Afhlava8Afpbdbh8Jcbhoinalavcj;cbfaofpblbg8KaYaofpblbg8LpmbzeHdOiAlCvXoQrLg8MaLaofpblbg8NaKaofpblbgypmbzeHdOiAlCvXoQrLg8PpmbezHdiOAlvCXorQLg8Fcep:nea8Fpxebebebebebebebebgap9op:bep9rg8Fa8Jp:oeg8Jp9Abbbaladfgla8Ja8Fa8Fpmlvorlvorlvorlvorp:oeg8Jp9Abbbaladfgla8Ja8Fa8FpmwDqkwDqkwDqkwDqkp:oeg8Jp9Abbbaladfgla8Ja8Fa8FpmxmPsxmPsxmPsxmPsp:oeg8Jp9Abbbaladfgla8Ja8Ma8PpmwDKYqk8AExm35Ps8E8Fg8Fcep:nea8Faap9op:bep9rg8Fp:oeg8Jp9Abbbaladfgla8Ja8Fa8Fpmlvorlvorlvorlvorp:oeg8Jp9Abbbaladfgla8Ja8Fa8FpmwDqkwDqkwDqkwDqkp:oeg8Jp9Abbbaladfgla8Ja8Fa8FpmxmPsxmPsxmPsxmPsp:oeg8Jp9Abbbaladfgla8Ja8Ka8LpmwKDYq8AkEx3m5P8Es8Fg8Ka8NaypmwKDYq8AkEx3m5P8Es8Fg8LpmbezHdiOAlvCXorQLg8Fcep:nea8Faap9op:bep9rg8Fp:oeg8Jp9Abbbaladfgla8Ja8Fa8Fpmlvorlvorlvorlvorp:oeg8Jp9Abbbaladfgla8Ja8Fa8FpmwDqkwDqkwDqkwDqkp:oeg8Jp9Abbbaladfgla8Ja8Fa8FpmxmPsxmPsxmPsxmPsp:oeg8Jp9Abbbaladfgla8Ja8Ka8LpmwDKYqk8AExm35Ps8E8Fg8Fcep:nea8Faap9op:bep9rg8Fp:oegap9Abbbaladfglaaa8Fa8Fpmlvorlvorlvorlvorp:oegap9Abbbaladfglaaa8Fa8FpmwDqkwDqkwDqkwDqkp:oegap9Abbbaladfglaaa8Fa8FpmxmPsxmPsxmPsxmPsp:oeg8Jp9AbbbaladfhlaoczfgoaQ6mbxdkkaQTmbcbhocbalcl4gl9Rc8FGhiavcjdfa8Afhrava8Afpbdbhainaravcj;cbfaofpblbg8JaYaofpblbg8KpmbzeHdOiAlCvXoQrLg8LaLaofpblbg8MaKaofpblbg8NpmbzeHdOiAlCvXoQrLgypmbezHdiOAlvCXorQLg8Faip:Rea8Falp:Tep9qg8Faap9rgap9Abbbaradfgraaa8Fa8Fpmlvorlvorlvorlvorp9rgap9Abbbaradfgraaa8Fa8FpmwDqkwDqkwDqkwDqkp9rgap9Abbbaradfgraaa8Fa8FpmxmPsxmPsxmPsxmPsp9rgap9Abbbaradfgraaa8LaypmwDKYqk8AExm35Ps8E8Fg8Faip:Rea8Falp:Tep9qg8Fp9rgap9Abbbaradfgraaa8Fa8Fpmlvorlvorlvorlvorp9rgap9Abbbaradfgraaa8Fa8FpmwDqkwDqkwDqkwDqkp9rgap9Abbbaradfgraaa8Fa8FpmxmPsxmPsxmPsxmPsp9rgap9Abbbaradfgraaa8Ja8KpmwKDYq8AkEx3m5P8Es8Fg8Ja8Ma8NpmwKDYq8AkEx3m5P8Es8Fg8KpmbezHdiOAlvCXorQLg8Faip:Rea8Falp:Tep9qg8Fp9rgap9Abbbaradfgraaa8Fa8Fpmlvorlvorlvorlvorp9rgap9Abbbaradfgraaa8Fa8FpmwDqkwDqkwDqkwDqkp9rgap9Abbbaradfgraaa8Fa8FpmxmPsxmPsxmPsxmPsp9rgap9Abbbaradfgraaa8Ja8KpmwDKYqk8AExm35Ps8E8Fg8Faip:Rea8Falp:Tep9qg8Fp9rgap9Abbbaradfgraaa8Fa8Fpmlvorlvorlvorlvorp9rgap9Abbbaradfgraaa8Fa8FpmwDqkwDqkwDqkwDqkp9rgap9Abbbaradfgraaa8Fa8FpmxmPsxmPsxmPsxmPsp9rgap9AbbbaradfhraoczfgoaQ6mbkka8Aclfg8Aad6mbkdnaCad2goTmbaOavcjdfao;8qbbkdnammbavavcjdfaCcufad2fad;8qbbkaCaHfhHc9:hoaAhPaAmbxlkkaeTmbaDalfhrcbhocuhlinaralaD9RglfaD6mdasaeao9Raoasfae6Eaofgoae6mbkaial9RhPkcbc99axaP9RakSEhoxekc9:hokavcj;kbf8Kjjjjbaokwbz:bjjjbkNsezu8Jjjjjbc;ae9Rgv8Kjjjjbc9:hodnalaeci9UgrcHf6mbcuhoaiRbbgwc;WeGc;Ge9hmbawcsGgDce0mbavc;abfcFecje;8kbav9cu83iUav9cu83i8Wav9cu83iyav9cu83iaav9cu83iKav9cu83izav9cu83iwav9cu83ibaialfc9WfhqaicefgwarfhldnaeTmbcmcsaDceSEhkcbhxcbhmcbhrcbhicbhoindnalaq9nmbc9:hoxikdndnawRbbgDc;Ve0mbavc;abfaoaDcu7gPcl4fcsGcitfgsydlhzasydbhHdndnaDcsGgsak9pmbavaiaPfcsGcdtfydbaxasEhDaxasTgOfhxxekdndnascsSmbcehOasc987asamffcefhDxekalcefhDal8SbbgscFeGhPdndnascu9mmbaDhlxekalcvfhlaPcFbGhPcrhsdninaD8SbbgOcFbGastaPVhPaOcu9kmeaDcefhDascrfgsc8J9hmbxdkkaDcefhlkcehOaPce4cbaPceG9R7amfhDkaDhmkavc;abfaocitfgsaDBdbasazBdlavaicdtfaDBdbavc;abfaocefcsGcitfgsaHBdbasaDBdlaocdfhoaOaifhidnadcd9hmbabarcetfgsaH87ebasclfaD87ebascdfaz87ebxdkabarcdtfgsaHBdbascwfaDBdbasclfazBdbxekdnaDcpe0mbavaiaqaDcsGfRbbgscl4gP9RcsGcdtfydbaxcefgOaPEhDavaias9RcsGcdtfydbaOaPTgzfgOascsGgPEhsaPThPdndnadcd9hmbabarcetfgHax87ebaHclfas87ebaHcdfaD87ebxekabarcdtfgHaxBdbaHcwfasBdbaHclfaDBdbkavaicdtfaxBdbavc;abfaocitfgHaDBdbaHaxBdlavaicefgicsGcdtfaDBdbavc;abfaocefcsGcitfgHasBdbaHaDBdlavaiazfgicsGcdtfasBdbavc;abfaocdfcsGcitfgDaxBdbaDasBdlaocifhoaiaPfhiaOaPfhxxekaxcbalRbbgsEgHaDc;:eSgDfhOascsGhAdndnascl4gCmbaOcefhzxekaOhzavaiaC9RcsGcdtfydbhOkdndnaAmbazcefhxxekazhxavaias9RcsGcdtfydbhzkdndnaDTmbalcefhDxekalcdfhDal8SbegPcFeGhsdnaPcu9kmbalcofhHascFbGhscrhldninaD8SbbgPcFbGaltasVhsaPcu9kmeaDcefhDalcrfglc8J9hmbkaHhDxekaDcefhDkasce4cbasceG9R7amfgmhHkdndnaCcsSmbaDhsxekaDcefhsaD8SbbglcFeGhPdnalcu9kmbaDcvfhOaPcFbGhPcrhldninas8SbbgDcFbGaltaPVhPaDcu9kmeascefhsalcrfglc8J9hmbkaOhsxekascefhskaPce4cbaPceG9R7amfgmhOkdndnaAcsSmbashlxekascefhlas8SbbgDcFeGhPdnaDcu9kmbascvfhzaPcFbGhPcrhDdninal8SbbgscFbGaDtaPVhPascu9kmealcefhlaDcrfgDc8J9hmbkazhlxekalcefhlkaPce4cbaPceG9R7amfgmhzkdndnadcd9hmbabarcetfgDaH87ebaDclfaz87ebaDcdfaO87ebxekabarcdtfgDaHBdbaDcwfazBdbaDclfaOBdbkavc;abfaocitfgDaOBdbaDaHBdlavaicdtfaHBdbavc;abfaocefcsGcitfgDazBdbaDaOBdlavaicefgicsGcdtfaOBdbavc;abfaocdfcsGcitfgDaHBdbaDazBdlavaiaCTaCcsSVfgicsGcdtfazBdbaiaATaAcsSVfhiaocifhokawcefhwaocsGhoaicsGhiarcifgrae6mbkkcbc99alaqSEhokavc;aef8Kjjjjbaok:clevu8Jjjjjbcz9Rhvdnalaecvf9pmbc9:skdnaiRbbc;:eGc;qeSmbcuskav9cb83iwaicefhoaialfc98fhrdnaeTmbdnadcdSmbcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcdtfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgiBdbalaiBdbawcefgwae9hmbxdkkcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcetfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgi87ebalaiBdbawcefgwae9hmbkkcbc99aoarSEk;Toio97eue97aec98Ghedndnadcl9hmbaeTmecbhdinababpbbbgicKp:RecKp:Sep;6eglaicwp:RecKp:Sep;6ealp;Geaiczp:RecKp:Sep;6egvp;Gep;Kep;Legopxbbbbbbbbbbbbbbbbp:2egralpxbbbjbbbjbbbjbbbjgwp9op9rp;Keglpxbb;:9cbb;:9cbb;:9cbb;:9calalp;Meaoaop;Meavaravawp9op9rp;Keglalp;Mep;Kep;Kep;Jep;Negvp;Mepxbbn0bbn0bbn0bbn0grp;KepxFbbbFbbbFbbbFbbbp9oaipxbbbFbbbFbbbFbbbFp9op9qalavp;Mearp;Kecwp:RepxbFbbbFbbbFbbbFbbp9op9qaoavp;Mearp;Keczp:RepxbbFbbbFbbbFbbbFbp9op9qpkbbabczfhbadclfgdae6mbxdkkaeTmbcbhdinabczfgDaDpbbbgipxbbbbbbFFbbbbbbFFgwp9oabpbbbgoaipmbediwDqkzHOAKY8AEgvczp:Reczp:Sep;6eglaoaipmlvorxmPsCXQL358E8FpxFubbFubbFubbFubbp9op;6eavczp:Sep;6egvp;Gealp;Gep;Kep;Legipxbbbbbbbbbbbbbbbbp:2egralpxbbbjbbbjbbbjbbbjgqp9op9rp;Keglpxb;:FSb;:FSb;:FSb;:FSalalp;Meaiaip;Meavaravaqp9op9rp;Keglalp;Mep;Kep;Kep;Jep;Negvp;Mepxbbn0bbn0bbn0bbn0grp;KepxFFbbFFbbFFbbFFbbp9oaiavp;Mearp;Keczp:Rep9qgialavp;Mearp;KepxFFbbFFbbFFbbFFbbp9oglpmwDKYqk8AExm35Ps8E8Fp9qpkbbabaoawp9oaialpmbezHdiOAlvCXorQLp9qpkbbabcafhbadclfgdae6mbkkk;2ileue97euo97dnaec98GgiTmbcbheinabcKfpx:ji:1S:ji:1S:ji:1S:ji:1SabpbbbglabczfgvpbbbgopmlvorxmPsCXQL358E8Fgrczp:Segwpxibbbibbbibbbibbbp9qp;6egDp;NegqaDaDp;MegDaDp;KealaopmbediwDqkzHOAKY8AEgDczp:Reczp:Sep;6eglalp;MeaDczp:Sep;6egoaop;Mearczp:Reczp:Sep;6egrarp;Mep;Kep;Kep;Lepxbbbbbbbbbbbbbbbbp:4ep;Jep;Mepxbbn0bbn0bbn0bbn0gDp;KepxFFbbFFbbFFbbFFbbgkp9oaqaop;MeaDp;Keczp:Rep9qgoaqalp;MeaDp;Keakp9oaqarp;MeaDp;Keczp:Rep9qgDpmwDKYqk8AExm35Ps8E8Fglp5eawclp:RegqpEi:T:j83ibavalp5baqpEd:T:j83ibabcwfaoaDpmbezHdiOAlvCXorQLgDp5eaqpEe:T:j83ibabaDp5baqpEb:T:j83ibabcafhbaeclfgeai6mbkkkuee97dnadcd4ae2c98GgeTmbcbhdinababpbbbgicwp:Recwp:Sep;6eaicep:SepxbbjFbbjFbbjFbbjFp9opxbbjZbbjZbbjZbbjZp:Uep;Mepkbbabczfhbadclfgdae6mbkkk:Sodw97euaec98Ghedndnadcl9hmbaeTmecbhdinabpxbbuJbbuJbbuJbbuJabpbbbgicKp:TeglaicYp:Tep9qgvcdp:Teavp9qgvclp:Teavp9qgop;6ep;Negvaicwp:RecKp:SegraipxFbbbFbbbFbbbFbbbgwp9ogDp:Uep;6ep;Mepxbbn0bbn0bbn0bbn0gqp;Kecwp:RepxbFbbbFbbbFbbbFbbp9oavaDarp:Xeaiczp:RecKp:Segip:Uep;6ep;Meaqp;Keawp9op9qavaDaraip:Uep:Xep;6ep;Meaqp;Keczp:RepxbbFbbbFbbbFbbbFbp9op9qavaoalcep:Rep9oalpxebbbebbbebbbebbbp9op9qp;6ep;Meaqp;KecKp:Rep9qpkbbabczfhbadclfgdae6mbxdkkaeTmbcbhdinabczfgkpxbFu9hbFu9hbFu9hbFu9habpbbbglakpbbbgrpmlvorxmPsCXQL358E8Fgvczp:TegqavcHp:Tep9qgicdp:Teaip9qgiclp:Teaip9qgicwp:Teaip9qgop;6ep;NegialarpmbediwDqkzHOAKY8AEgDpxFFbbFFbbFFbbFFbbglp9ograDczp:Segwp:Ueavczp:Reczp:SegDp:Xep;6ep;Mepxbbn0bbn0bbn0bbn0gvp;Kealp9oaiarawaDp:Uep:Xep;6ep;Meavp;Keczp:Rep9qgwaiaoaqcep:Rep9oaqpxebbbebbbebbbebbbp9op9qp;6ep;Meavp;Keczp:ReaiaDarp:Uep;6ep;Meavp;Kealp9op9qgipmwDKYqk8AExm35Ps8E8FpkbbabawaipmbezHdiOAlvCXorQLpkbbabcafhbadclfgdae6mbkkk9teiucbcbydj:G:cjbgeabcifc98GfgbBdj:G:cjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaikkxebcj:Gdklz:zbb",t=new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,3,2,0,0,5,3,1,0,1,12,1,0,10,22,2,12,0,65,0,65,0,65,0,252,10,0,0,11,7,0,65,0,253,15,26,11]),i=new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);if(typeof WebAssembly!="object")return{supported:!1};var r=WebAssembly.validate(t)?l(n):l(e),a,o=WebAssembly.instantiate(r,{}).then(function(c){a=c.instance,a.exports.__wasm_call_ctors()});function l(c){for(var M=new Uint8Array(c.length),R=0;R<c.length;++R){var b=c.charCodeAt(R);M[R]=b>96?b-97:b>64?b-39:b+4}for(var T=0,R=0;R<c.length;++R)M[T++]=M[R]<60?i[M[R]]:(M[R]-60)*64+M[++R];return M.buffer.slice(0,T)}function f(c,M,R,b,T,E,P){var m=c.exports.sbrk,S=b+3&-4,I=m(S*T),U=m(E.length),B=new Uint8Array(c.exports.memory.buffer);B.set(E,U);var J=M(I,b,T,U,E.length);if(J==0&&P&&P(I,S,T),R.set(B.subarray(I,I+b*T)),m(I-m(0)),J!=0)throw new Error("Malformed buffer data: "+J)}var d={NONE:"",OCTAHEDRAL:"meshopt_decodeFilterOct",QUATERNION:"meshopt_decodeFilterQuat",EXPONENTIAL:"meshopt_decodeFilterExp",COLOR:"meshopt_decodeFilterColor"},_={ATTRIBUTES:"meshopt_decodeVertexBuffer",TRIANGLES:"meshopt_decodeIndexBuffer",INDICES:"meshopt_decodeIndexSequence"},g=[],u=0;function v(c){var M={object:new Worker(c),pending:0,requests:{}};return M.object.onmessage=function(R){var b=R.data;M.pending-=b.count,M.requests[b.id][b.action](b.value),delete M.requests[b.id]},M}function A(c){for(var M="self.ready = WebAssembly.instantiate(new Uint8Array(["+new Uint8Array(r)+"]), {}).then(function(result) { result.instance.exports.__wasm_call_ctors(); return result.instance; });self.onmessage = "+h.name+";"+f.toString()+h.toString(),R=new Blob([M],{type:"text/javascript"}),b=URL.createObjectURL(R),T=g.length;T<c;++T)g[T]=v(b);for(var T=c;T<g.length;++T)g[T].object.postMessage({});g.length=c,URL.revokeObjectURL(b)}function D(c,M,R,b,T){for(var E=g[0],P=1;P<g.length;++P)g[P].pending<E.pending&&(E=g[P]);return new Promise(function(m,S){var I=new Uint8Array(R),U=++u;E.pending+=c,E.requests[U]={resolve:m,reject:S},E.object.postMessage({id:U,count:c,size:M,source:I,mode:b,filter:T},[I.buffer])})}function h(c){var M=c.data;self.ready.then(function(R){if(!M.id)return self.close();try{var b=new Uint8Array(M.count*M.size);f(R,R.exports[M.mode],b,M.count,M.size,M.source,R.exports[M.filter]),self.postMessage({id:M.id,count:M.count,action:"resolve",value:b},[b.buffer])}catch(T){self.postMessage({id:M.id,count:M.count,action:"reject",value:T})}})}return{ready:o,supported:!0,useWorkers:function(c){A(c)},decodeVertexBuffer:function(c,M,R,b,T){f(a,a.exports.meshopt_decodeVertexBuffer,c,M,R,b,a.exports[d[T]])},decodeIndexBuffer:function(c,M,R,b){f(a,a.exports.meshopt_decodeIndexBuffer,c,M,R,b)},decodeIndexSequence:function(c,M,R,b){f(a,a.exports.meshopt_decodeIndexSequence,c,M,R,b)},decodeGltfBuffer:function(c,M,R,b,T,E){f(a,a.exports[_[T]],c,M,R,b,a.exports[d[E]])},decodeGltfBufferAsync:function(c,M,R,b,T){return g.length>0?D(c,M,R,_[b],d[T]):o.then(function(){var E=new Uint8Array(c*M);return f(a,a.exports[_[b]],E,c,M,R,a.exports[d[T]]),E})}}})();class up extends Ru{constructor(n){super(n),this.setMeshoptDecoder(op)}}function pp(){return{height:0,normal:{x:0,y:1,z:0},surface:"pavement",offCourse:!1}}export{up as G,Sa as P,cp as W,Au as a,Rr as b,pp as c,fp as d,lp as m};
