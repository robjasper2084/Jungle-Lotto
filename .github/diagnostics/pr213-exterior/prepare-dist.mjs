/** Download occurs in the workflow. This verifies the immutable archive before
 * extracting it; it does not rebuild or edit the application. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {artifactPin,sourceSha,sha256,assetPins,modelBounds} from './contract.mjs';

const zip=resolve(process.env.PR213_EXTERIOR_ZIP),metadata=resolve(process.env.PR213_EXTERIOR_ARTIFACT_JSON);
const dist=resolve(process.env.STAGED_LANDMARK_DIST),out=resolve(process.env.STAGED_LANDMARK_OUT);
const artifact=JSON.parse(await readFile(metadata,'utf8'));
assert.equal(artifact.id,artifactPin.id);assert.equal(artifact.name,artifactPin.name);assert.equal(artifact.expired,false);
assert.equal(artifact.workflow_run.id,artifactPin.run);assert.equal(artifact.workflow_run.head_sha,sourceSha);
assert.equal(artifact.digest,'sha256:'+artifactPin.sha256);
assert.equal(sha256(await readFile(zip)),artifactPin.sha256,'The downloaded staged archive differs from the pinned original');
const extraction=JSON.parse(execFileSync('python3',['-c',`
import json,pathlib,stat,sys,zipfile
archive,destination=map(pathlib.Path,sys.argv[1:])
destination.mkdir(parents=True,exist_ok=True)
assert not any(destination.iterdir()), 'Extraction target must be empty'
with zipfile.ZipFile(archive) as z:
    entries=z.infolist()
    assert len(entries)==len({e.filename for e in entries}), 'Duplicate archive entry'
    for e in entries:
        p=pathlib.PurePosixPath(e.filename)
        assert not p.is_absolute() and '..' not in p.parts and '\\\\' not in e.filename, 'Unsafe archive path'
        assert not stat.S_ISLNK(e.external_attr >> 16), 'Archive symlink'
    bad=z.testzip()
    assert bad is None, 'ZIP CRC failure: '+str(bad)
    z.extractall(destination)
    print(json.dumps({'files':len(entries),'uncompressedBytes':sum(e.file_size for e in entries),'allCrcVerified':True}))
`,zip,dist],{encoding:'utf8'}));
const marker=JSON.parse(await readFile(resolve(dist,'staged-landmark-proof-build.json'),'utf8'));
assert.equal(marker.sourceSha,sourceSha);assert.equal(marker.stagedFlag,'VITE_STAGED_BELLE_ARCHITECTURE=1');
assert.equal(marker.indexSha256,artifactPin.indexSha256);assert.equal(sha256(await readFile(resolve(dist,'index.html'))),artifactPin.indexSha256);
const models=[];
for(const [id,pin] of Object.entries(assetPins))models.push(modelBounds(await readFile(resolve(dist,'belle/staged-architecture',pin.file)),id));
await mkdir(out,{recursive:true});
await writeFile(resolve(out,'immutable-input.json'),JSON.stringify({sourceSha,artifact,archiveSha256:artifactPin.sha256,extraction,marker,models,applicationRebuilt:false},null,2)+'\n');
console.log(JSON.stringify({sourceSha,artifactId:artifact.id,archiveSha256:artifactPin.sha256,extraction}));
