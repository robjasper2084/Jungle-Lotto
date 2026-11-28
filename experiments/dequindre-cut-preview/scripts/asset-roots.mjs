/** A namespace is selected by its most specific prefix. Within that namespace
 * the listed directories are an explicit priority overlay, never another game. */
export function orderedAssetRoots(roots){
 const seen=new Set();
 return roots.map(root=>{
  if(typeof root.prefix!=='string'||!root.prefix.startsWith('/')||!root.prefix.endsWith('/')||seen.has(root.prefix))throw Error('Asset namespaces require unique slash-delimited prefixes');
  seen.add(root.prefix);
  const directories=root.directories??(root.directory?[root.directory]:[]);
  if(!directories.length||directories.some(directory=>typeof directory!=='string'))throw Error('Asset namespace needs an explicit source directory');
  if(new Set(directories).size!==directories.length)throw Error('Asset overlay source directory is repeated');
  return {...root,directories:[...directories]};
 }).sort((a,b)=>b.prefix.length-a.prefix.length);
}

export function assetRootForPath(ordered,pathname){
 const root=ordered.find(candidate=>pathname.startsWith(candidate.prefix));
 // The broad Belle mount must never stand in for an unmapped source namespace.
 return root?.prefix==='/'&&pathname.startsWith('/__swoop-assets__/')?undefined:root;
}
