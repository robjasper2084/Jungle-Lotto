"""Extract only authoring data from the user's downloaded Unity car package."""
import gzip, json, shutil, tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'art/elmwood/hdrp-lab-car'
SOURCE = Path.home() / 'AppData/Roaming/Unity/Asset Store-5.x/URPLabStudio/3D ModelsVehiclesLand/HDRP Lab Car Free - Realistic Car Model.unitypackage'
index = json.loads((OUT / 'package-index.json').read_text())
selected = {}
for guid, item in index.items():
    path = item['path']
    if (path.endswith('LabCoupe_MD.fbx') or path.endswith('LabCoupe_Env.prefab')
        or '/Materials/Lab/' in path or '/Textures/' in path and path.endswith(('.png', '.jpg'))
        or path.endswith('HDRPLab_ReadMe.pdf')):
        target = (OUT / 'source' / path).resolve()
        if not target.is_relative_to((OUT / 'source').resolve()):
            raise ValueError('Unsafe package path')
        selected[guid] = target
with gzip.open(SOURCE, 'rb') as stream, tarfile.open(fileobj=stream, mode='r|') as archive:
    for member in archive:
        guid, _, name = member.name.partition('/')
        if guid not in selected or name not in ('asset', 'asset.meta'):
            continue
        target = selected[guid]
        if name == 'asset.meta': target = Path(str(target) + '.meta')
        target.parent.mkdir(parents=True, exist_ok=True)
        with archive.extractfile(member) as src, target.open('wb') as dst:
            shutil.copyfileobj(src, dst)
print(f'Extracted {len(selected)} authoring assets; no package scripts executed.')
