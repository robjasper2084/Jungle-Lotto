"""Package the playable Unity world and source-authored launcher into Swoop."""
from pathlib import Path
import hashlib,json,shutil
root=Path(__file__).resolve().parents[1]
build=root/'Builds/JazzPortal'
target=root.parent/'_goth_swoop_release_20260916/lottominded-ultra.io/games/gothtechnology2/swoop-source/public/exports/jazz-stage'
files={suffix:next((build/'Build').glob('*.'+suffix)) for suffix in ['data','framework.js','wasm','loader.js']}
config={'dataUrl':'Build/'+files['data'].name,'frameworkUrl':'Build/'+files['framework.js'].name,'codeUrl':'Build/'+files['wasm'].name,'streamingAssetsUrl':'StreamingAssets','companyName':'Digital Static','productName':'Bloom Through Gloom','productVersion':'jazz-walk-20261011','matchWebGLToCanvasSize':True,'devicePixelRatio':1}
html=(root/'SourceArt/jazz_portal.html').read_text(encoding='utf-8').replace('__CONFIG__',json.dumps(config)).replace('__LOADER__',json.dumps('Build/'+files['loader.js'].name))
(build/'index.html').write_text(html,encoding='utf-8')
target.mkdir(parents=True,exist_ok=True)
shutil.copytree(build/'Build',target/'Build',dirs_exist_ok=True)
shutil.copytree(build/'StreamingAssets',target/'StreamingAssets',dirs_exist_ok=True)
shutil.copy2(build/'index.html',target/'index.html')
manifest={'source':str(build),'integration':'Full viewport playable music world, walking and riding, safe return to the original Detroit session','files':[{'file':str(f.relative_to(build)).replace('\\','/'),'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in [*files.values(),build/'index.html']]}
(target/'SOURCE.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(json.dumps({'target':str(target),'files':len(manifest['files'])}))
