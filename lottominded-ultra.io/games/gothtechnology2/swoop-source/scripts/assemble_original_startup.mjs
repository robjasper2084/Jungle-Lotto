import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=resolve(import.meta.dirname,'..'),art=resolve(root,'art/cinematics'),out=resolve(root,'public/exports/polish');
await mkdir(out,{recursive:true});
function run(args){const p=spawnSync('ffmpeg',['-y','-hide_banner','-loglevel','error',...args],{stdio:'inherit'});if(p.status!==0)throw Error('Original startup encoding failed');}
const encode=['-an','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart'];
const normalize='scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,fps=24,format=yuv420p';
run(['-framerate','24','-i',resolve(art,'original-art/frame-%04d.png'),'-frames:v','120','-vf',normalize,...encode,resolve(art,'original-art.mp4')]);
const captures=[
 {name:'gameplay-cut',source:'gameplay-fdfe283d-64c5-4c47-bc35-95276cfa3a87.mp4',start:0,description:'Actual four-player race recording, original rider, Atwater Street'},
 {name:'gameplay-cut-air',source:'gameplay-fdfe283d-64c5-4c47-bc35-95276cfa3a87.mp4',start:5,description:'Actual four-player race recording, in-game camera transition'},
 {name:'gameplay-woman',source:'gameplay-d10ed2c9-b366-433b-94ef-26efdd611ad2.mp4',start:0,description:'Actual woman rider, player two, side tracking replay'},
 {name:'gameplay-dog',source:'gameplay-5792c82a-bff1-4da3-94ce-d4ba701cf62c.mp4',start:0,description:'Actual free ride with Boerboel; live Come command used while riding'},
];
for(const c of captures)run(['-ss',String(c.start),'-i',resolve(art,c.source),'-vf',normalize,'-t','5',...encode,resolve(art,c.name+'.mp4')]);
run(['-i',resolve(art,'rivals-higgsfield.mp4'),'-vf',normalize,'-t','5',...encode,resolve(art,'rivals.mp4')]);
const edits=[
 {name:'swoop-intro-15',duration:15,shots:['original-art','rivals','gameplay-woman']},
 {name:'swoop-intro-30',duration:30,shots:['original-art','rivals','gameplay-cut','gameplay-woman','gameplay-cut-air','gameplay-dog']},
];
for(const edit of edits){const args=edit.shots.flatMap(name=>['-i',resolve(art,name+'.mp4')]);const filters=[];let previous='0:v';for(let i=1;i<edit.shots.length;i++){const next='blend'+i;filters.push(`[${previous}][${i}:v]xfade=transition=fade:duration=0.3:offset=${(i*4.7).toFixed(1)}[${next}]`);previous=next;}filters.push(`[${previous}]tpad=stop_mode=clone:stop_duration=${((edit.shots.length-1)*.3).toFixed(1)},fade=t=in:st=0:d=0.3,fade=t=out:st=${edit.duration-.35}:d=0.35[film]`);run([...args,'-filter_complex',filters.join(';'),'-map','[film]','-t',String(edit.duration),...encode,resolve(out,edit.name+'.mp4')]);}
await writeFile(resolve(art,'original-edit-manifest.json'),JSON.stringify({fps:24,resolution:[1280,720],silent:true,blender:'5.2.1 LTS',master:'Swoop_Original_Group_Startup.blend',originalImage:'public/art/swoop-rivals-master.png',higgsfield:{job:'2d51f750-413a-4790-8fe5-776e8d906c4b',type:'Free Genjutsu motion transfer',duration:5},captures,edits,transitionSeconds:.3,arrivalPreserved:'public/exports/polish/gothtech-arrival-15.mp4',notes:'Gameplay is captured from this runtime with its real physics, map, characters and replay cameras. Original artwork remains unaltered in the Blender opening shot. AI footage does not represent gameplay.'},null,2));
console.log('ORIGINAL_STARTUP_WITH_GAMEPLAY_OK / 15s + 30s');
