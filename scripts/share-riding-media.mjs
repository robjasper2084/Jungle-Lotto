import {readFile,readdir,writeFile,unlink} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';

async function textFiles(root){
  const files=[];
  for(const e of await readdir(root,{withFileTypes:true})){
    const path=resolve(root,e.name);
    if(e.isDirectory())files.push(...await textFiles(path));
    else if(/\.(?:js|html|json|css)$/.test(e.name))files.push(path);
  }
  return files;
}
async function matchingModel(a,b,root){
  const [left,right]=await Promise.all([readFile(a),readFile(b)]);
  if(!left.equals(right))return false;
  if(left.length<28||left.readUInt32LE(0)!==0x46546c67)return false;
  const gltf=JSON.parse(left.toString('utf8',20,20+left.readUInt32LE(12)));
  for(const image of gltf.images??[]){
    if(!image.uri)continue;
    if(/^(?:[a-z]+:|\/)/i.test(image.uri))return false;
    const paths=[a,b].map(p=>resolve(dirname(p),decodeURIComponent(image.uri)));
    if(paths.some(p=>!p.startsWith(resolve(root)+sep)))return false;
    const [x,y]=await Promise.all(paths.map(p=>readFile(p)));
    if(!x.equals(y))return false;
  }
  return true;
}

// Assembly-only sharing preserves source/standalone packages and compares all
// model and texture bytes before moving a loader to the other game's copy.
export async function shareRidingMedia(root){
  const pack=resolve(root,'lottominded-ultra.io/games/gothtechnology2');
  const swoop=resolve(pack,'arcade/swoop-detroit'),elmwood=resolve(pack,'arcade/elmwood-explorer');
  let saved=0,files=0;
  async function rewriteAndRemove(textRoot,from,to,duplicates){
    const edits=[];
    for(const path of await textFiles(textRoot)){
      const input=await readFile(path,'utf8'),output=input.replaceAll(from,to);
      if(input!==output)edits.push({path,input,output});
    }
    if(!edits.length)return;
    for(const edit of edits){await writeFile(edit.path,edit.output);saved-=Buffer.byteLength(edit.output)-Buffer.byteLength(edit.input);}
    for(const path of duplicates){saved+=(await readFile(path)).length;await unlink(path);files++;}
  }
  const names=['cherry-blossom-1','cherry-blossom-2','american-robin','cherry-petal'];
  const nature=names.map(name=>({a:resolve(swoop,'exports/nature',name+'.glb'),b:resolve(elmwood,'exports/nature',name+'.glb')}));
  if((await Promise.all(nature.map(p=>matchingModel(p.a,p.b,root)))).every(Boolean))
    await rewriteAndRemove(elmwood,'./exports/nature/','../swoop-detroit/exports/nature/',nature.map(p=>p.b));
  const movie=resolve(swoop,'exports/polish/detroit-commercial.mp4'),canonical=resolve(pack,'assets/commercials/detroit-commercial-01.mp4');
  if((await readFile(movie)).equals(await readFile(canonical)))
    await rewriteAndRemove(swoop,'./exports/polish/detroit-commercial.mp4','../../assets/commercials/detroit-commercial-01.mp4',[movie]);
  const mapName='elmwood-explorer.json.gz',copy=resolve(swoop,'love-tag',mapName),map=resolve(elmwood,'love-tag',mapName);
  if((await readFile(copy)).equals(await readFile(map))){
    let used=false;
    for(const path of await textFiles(swoop))if((await readFile(path,'utf8')).includes(mapName)){used=true;break;}
    if(!used){saved+=(await readFile(copy)).length;await unlink(copy);files++;}
  }
  console.log(`Shared ${files} matching riding media assets; saved ${(saved/1048576).toFixed(1)} MiB.`);
  return {files,saved};
}
