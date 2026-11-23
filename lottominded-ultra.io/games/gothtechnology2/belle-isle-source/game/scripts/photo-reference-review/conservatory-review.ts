import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {addConservatoryGarden} from '../../src/belle/conservatoryGarden.ts';
import {greenhouseWorld} from '../../src/belle/conservatory.ts';
import {addKoi} from '../../src/belle/waterLife.ts';
import {createWater} from '../../src/belle/water.ts';
import {ParkTerrain} from '../../src/belle/terrain.ts';
import {loadRealisticMaterials,applyRealisticMaterials} from '../../src/belle/realisticMaterials.ts';
const map=await fetch('/belle/map.json').then(r=>r.json()),cfg=map.conservatory;
const scene=new T.Scene();scene.background=new T.Color(0xbad6e9);
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;document.body.append(renderer.domElement);
scene.add(new T.HemisphereLight(0xe8f4ff,0x5d6049,2));const sun=new T.DirectionalLight(0xfff3d6,2.1);sun.position.set(1370,130,1160);scene.add(sun);
const env=await new RGBELoader().loadAsync('/belle/environment/kloppenheim-06-2k.hdr');env.mapping=T.EquirectangularReflectionMapping;scene.environment=env;scene.environmentIntensity=.45;
// Resolve the production texture paths relative to the game root.
const base=document.createElement('base');base.href='/';document.head.append(base);
await loadRealisticMaterials(renderer);
const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/belle/landmarks.glb');
gltf.scene.traverse(o=>{if(!(o instanceof T.Mesh))return;o.visible=o.name.startsWith('107310050_')||o.name.startsWith('koi-pond-lantern_');if(!o.visible)return;for(const m of(Array.isArray(o.material)?o.material:[o.material])){if(m.name==='Conservatory clear panes'){m.transparent=true;m.opacity=.62;m.color.setRGB(.20,.30,.29);m.roughness=.22;m.metalness=.18;m.envMapIntensity=.85;m.depthWrite=false;m.side=T.DoubleSide;}if(m.name.startsWith('Conservatory leaf'))m.side=T.DoubleSide;}});scene.add(gltf.scene);
function poly(points:number[][],y:number,holes:number[][][]=[]){const shape=new T.Shape(points.map(p=>new T.Vector2(p[0],-p[1])));for(const h of holes)shape.holes.push(new T.Path(h.map(p=>new T.Vector2(p[0],-p[1]))));const g=new T.ShapeGeometry(shape);g.rotateX(-Math.PI/2);g.translate(0,y,0);return g;}
const pond=map.water.find(w=>w.id==='hydro-6');scene.add(new T.Mesh(poly([[1250,1090],[1400,1090],[1400,1260],[1250,1260]],2,[pond.points]),new T.MeshStandardMaterial({color:0x82956a,roughness:1})));
const terrain=new ParkTerrain(map),water=createWater(scene,renderer,map,terrain,poly),koi=addKoi(scene),garden=addConservatoryGarden(scene,map);applyRealisticMaterials(scene);
const camera=new T.PerspectiveCamera(62,innerWidth/innerHeight,.08,5000);
const views={fernery:{from:[0,30.9,3.75],to:[0,37.2,3.5]},tropical:{from:[0,-27.1,3.75],to:[0,-34.9,4]},palm:{from:[-8,0,3.75],to:[3,1,6.2]},pond:{from:[22.3,34,4.5],to:[13.9,26,1.2]},pondWide:{from:[24,40,5.5],to:[9,21,4]}};
window.review=(name='fernery',enabled=true)=>{
 const view=views[name],p=greenhouseWorld(cfg,view.from[0],view.from[1]),q=greenhouseWorld(cfg,view.to[0],view.to[1]);camera.position.set(p.x,view.from[2],p.z);camera.lookAt(q.x,view.to[2],q.z);camera.updateProjectionMatrix();camera.updateMatrixWorld();garden.update(p.x,p.z);garden.root.visible=enabled;koi.update(12,p.x,p.z);water.update(12,camera);renderer.render(scene,camera);document.querySelector('#label').textContent=name+' · '+(enabled?'with photo details':'before')+' · local geometry review';return{stats:garden.stats,draws:renderer.info.render.calls,triangles:renderer.info.render.triangles};
};
window.resizeReview=()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();};
window.review();window.READY=true;
