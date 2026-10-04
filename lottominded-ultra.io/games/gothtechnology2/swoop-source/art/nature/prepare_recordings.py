"""Download the documented CC0 recordings and make small seamless game loops."""
import urllib.request,subprocess,json
from pathlib import Path
root=Path(__file__).resolve().parents[2];art=Path(__file__).resolve().parent;out=root/'public'/'audio'/'nature';out.mkdir(parents=True,exist_ok=True)
items=[('birdsong','799/799143_17200815','Morning Birdsong and Distant Dog Bark in the Park','WhisperingEarth','https://freesound.org/people/WhisperingEarth/sounds/799143/',12),
 ('creek','197/197705_2737063','Water, small stream','peridactyloptrix','https://freesound.org/people/peridactyloptrix/sounds/197705/',5),
 ('waterfall','458/458711_2841496','Waterfall','Fabrizio84','https://freesound.org/people/Fabrizio84/sounds/458711/',30)]
credits=[]
for name,remote,title,author,url,start in items:
 source=art/(name+'-source.mp3')
 if not source.exists():urllib.request.urlretrieve('https://cdn.freesound.org/previews/'+remote+'-hq.mp3',source)
 # Blend the last second with the first second; sample-continuous loop boundary.
 graph=f'[0:a]atrim=start={start}:duration=25,asetpts=PTS-STARTPTS,asplit=2[a][b];[a]atrim=start=1,asetpts=PTS-STARTPTS[tail];[b]atrim=end=1,asetpts=PTS-STARTPTS[head];[tail][head]acrossfade=d=1:c1=tri:c2=tri,alimiter=limit=0.85[out]'
 subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(source),'-filter_complex',graph,'-map','[out]','-ac','1','-ar','44100','-b:a','96k',str(out/(name+'.mp3'))],check=True)
 credits.append({'file':name+'.mp3','title':title,'author':author,'source':url,'license':'CC0 1.0','edit':'25-second excerpt, mono, one-second loop crossfade; no synthetic replacement'})
subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-ss','1.78','-t','0.40','-i',str(art/'big-dog-source.mp3'),'-af','afade=t=in:d=0.005,afade=t=out:st=0.32:d=0.08','-ac','1','-ar','44100','-b:a','128k',str(out/'big-dog-bark.mp3')],check=True)
credits.append({'file':'big-dog-bark.mp3','title':'Angry big dog barking - Close [d15].wav','author':'v23','source':'https://freesound.org/people/v23/sounds/440866/','license':'CC0 1.0','edit':'Single .4-second bark excerpt from a recorded Central Asian Shepherd Dog; mono, faded edges'})
(out/'CREDITS.json').write_text(json.dumps(credits,indent=2))
(out/'CREDITS.txt').write_text('\n\n'.join(f"{c['file']} — {c['title']} by {c['author']}\n{c['source']}\nLicense: {c['license']}\n{c['edit']}" for c in credits))
print('Prepared four recorded CC0 game sounds')
