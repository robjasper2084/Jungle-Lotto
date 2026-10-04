import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdir,writeFile,copyFile,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..'),art=resolve(root,'art/studio-retail/higgsfield'),out=resolve(root,'public/exports/polish');
await mkdir(art,{recursive:true});await mkdir(out,{recursive:true});
const require=createRequire(resolve(process.argv[2],'package.json')),sharp=require('sharp');
const jobs=[
 {id:'85ee3f5e-7072-45c9-8ded-12276335c381',url:'https://d8j0ntlcm91z4.cloudfront.net/user_2vm1zUlZVo7Zg51Fx2ETKBgAmnM/hf_20261003_152937_85ee3f5e-7072-45c9-8ded-12276335c381.png',tiles:['walnut','charcoal','plaster','cotton']},
 {id:'6cbd9464-03bd-4aa3-991e-d5ed32a6187a',url:'https://d8j0ntlcm91z4.cloudfront.net/user_2vm1zUlZVo7Zg51Fx2ETKBgAmnM/hf_20261003_152945_6cbd9464-03bd-4aa3-991e-d5ed32a6187a.png',tiles:['travertine','brass','linen','brick']},
];
for(const job of jobs){
 const path=resolve(art,job.id+'.png');let atlas;try{atlas=await readFile(path);}catch{const r=await fetch(job.url);if(!r.ok)throw Error('Higgsfield download failed '+r.status);atlas=Buffer.from(await r.arrayBuffer());await writeFile(path,atlas);}
 const m=await sharp(atlas).metadata();const w=Math.floor(m.width/2),h=Math.floor(m.height/2);
 for(const [i,name]of job.tiles.entries()){
  const tile=await sharp(atlas).extract({left:(i%2)*w+4,top:Math.floor(i/2)*h+4,width:w-8,height:h-8}).resize(768,768).png().toBuffer();await writeFile(resolve(art,name+'.png'),tile);
  // Albedo-derived fine detail, an authored approximation rather than measured height.
  const {data,info}=await sharp(tile).greyscale().raw().toBuffer({resolveWithObject:true}),normal=Buffer.alloc(info.width*info.height*3);
  const at=(x,y)=>data[((y+info.height)%info.height)*info.width+(x+info.width)%info.width]/255;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const nx=(at(x-1,y)-at(x+1,y))*.7,ny=(at(x,y-1)-at(x,y+1))*.7,length=Math.hypot(nx,ny,1),n=(y*info.width+x)*3;normal[n]=Math.round((nx/length*.5+.5)*255);normal[n+1]=Math.round((ny/length*.5+.5)*255);normal[n+2]=Math.round((1/length*.5+.5)*255);}
  await sharp(normal,{raw:{width:info.width,height:info.height,channels:3}}).png().toFile(resolve(art,name+'-normal.png'));
 }
}
await writeFile(resolve(art,'provenance.json'),JSON.stringify({provider:'Higgsfield',model:'gpt_image_2_5',approvedCreditLimit:.5,jobs,processing:'Equal quadrants cropped 4 pixels; resize 768; albedo-derived normals. Original supplied artwork preserved.'},null,2));
const cards=[
 ['art/animation-polish/mission-cover.png','GOTHTECH / DETROIT','STORIES START AT 2000 MACK'],
 ['art/route-gallery/serengeti-gallery.png','SERENGETI GALLERIES','ART / MUSIC / PEOPLE'],
 ['art/route-campaign/lottomind-refined.png','LOTTOMIND','YOUR NUMBERS. YOUR WORLD.'],
];
const clips=[];
for(const [i,[image,title,subtitle]]of cards.entries()){
 const fitted=await sharp(resolve(root,image)).resize(1280,720,{fit:'cover'}).modulate({brightness:.52}).png().toBuffer();const svg=Buffer.from(`<svg width="1280" height="720"><rect x="45" y="45" width="1190" height="630" fill="none" stroke="#d3b769" stroke-width="2"/><text x="90" y="490" fill="#f4edcf" font-family="Arial" font-size="62" font-weight="bold">${title}</text><text x="90" y="550" fill="#d1ddc9" font-family="Arial" font-size="29" letter-spacing="4">${subtitle}</text><text x="90" y="610" fill="#e4cb7e" font-family="Arial" font-size="18">GOTHTECH PRODUCTION / ORIGINAL STUDIO PROMO</text></svg>`);const still=resolve(art,'promo-'+i+'.png');await sharp(fitted).composite([{input:svg}]).png().toFile(still);const clip=resolve(art,'promo-'+i+'.mp4');clips.push(clip);
 const r=spawnSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-loop','1','-i',still,'-vf',"scale=1408:792,crop=1280:720:x='64+20*sin(t)':y='36+12*cos(t)',fade=t=in:st=0:d=0.3,fade=t=out:st=3.7:d=0.3",'-t','4','-r','24','-an','-c:v','libx264','-preset','fast','-crf','22','-pix_fmt','yuv420p',clip],{stdio:'inherit'});if(r.status!==0)throw Error('Promo encoding failed');
}
const concat=resolve(art,'promo-clips.txt');await writeFile(concat,clips.map(p=>"file '"+p.replaceAll('\\','/')+"'").join('\n'));
const r=spawnSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',concat,'-c','copy','-movflags','+faststart',resolve(out,'gothtech-studio-promo.mp4')],{stdio:'inherit'});if(r.status!==0)throw Error('Promo assembly failed');
await copyFile(resolve(root,'../assets/commercials/detroit-commercial-01.mp4'),resolve(out,'detroit-commercial.mp4'));console.log('Higgsfield: 8 material skins + normals; original 12-second studio promo and supplied Detroit commercial prepared.');
