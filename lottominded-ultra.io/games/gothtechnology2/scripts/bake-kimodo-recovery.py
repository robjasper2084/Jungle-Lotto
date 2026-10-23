import ast,hashlib,json
from pathlib import Path
import numpy as np
p=Path(__file__).resolve().parents[1]
s=p/'swoop-source/art/kimodo-recovery/motion.npz'
names=json.loads((p/'swoop-source/art/kimodo-recovery/skeleton.json').read_text());idx={n:i for i,(n,_) in enumerate(names)}
j=np.load(s)['posed_joints'];rows=[]
lo,hi=60,96
for f in np.linspace(lo,hi,37):
 q=j[int(f)];rise=float(np.clip((q[idx['Hips'],1]-j[lo,idx['Hips'],1])/(j[hi,idx['Hips'],1]-j[lo,idx['Hips'],1]),0,1));row=[rise]
 x=q[idx['LeftLeg']]-q[idx['RightLeg']];x[1]=0;x=x/np.linalg.norm(x);z=np.cross(x,[0,1,0])
 for side in ['Left','Right']:
  shoulder,elbow,hand=(q[idx[side+n]] for n in ['Arm','ForeArm','Hand']);length=np.linalg.norm(elbow-shoulder)+np.linalg.norm(hand-elbow);d=(hand-shoulder)/length
  row.extend([float(np.dot(d,x)),float(d[1]),float(np.dot(d,z))])
 rows.append(np.round(row,5).tolist())
# Avoid root height noise making a rising rider dip back toward the pavement.
for i in range(1,len(rows)):rows[i][0]=max(rows[i][0],rows[i-1][0])
(p/'ride-core/src/kimodoRecoveryData.ts').write_text('// Kimodo SOMA-RP-v1.2 recovery frames 60-96, resampled at runtime.\nexport const RECOVERY_SAMPLES = '+json.dumps(rows,separators=(',',':'))+';\n')
art=p/'swoop-source/art/kimodo-recovery';art.mkdir(exist_ok=True,parents=True)
(art/'manifest.json').write_text(json.dumps({'generator':'NVIDIA Kimodo-SOMA-RP-v1.2','seed':93,'duration_seconds':5,'diffusion_steps':100,'source':str(s),'sha256':hashlib.sha256(s.read_bytes()).hexdigest(),'frames':[60,96],'fps':30,'runtime':'Hip-rise curve and shoulder-relative hand directions, fitted by existing IK. Fall translation and wheel physics retained. Recovery uses existing game duration.','prompt':'A person falls gently onto one hip, rolls onto one side, plants a palm, then pushes up from one knee to stand steadily upright with both feet planted'},indent=2))
print('Baked',len(rows),'recovery samples')
