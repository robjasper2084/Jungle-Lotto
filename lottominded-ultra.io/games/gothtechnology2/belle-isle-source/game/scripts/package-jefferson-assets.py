#!/usr/bin/env python3
"""Losslessly externalize PNG images shared by a directory of GLB models.

Usage: python3 externalize_glb_images.py INPUT_DIR OUTPUT_DIR
No image decoding/re-encoding, mesh editing, quantization, or simplification.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import json
import struct
from pathlib import Path


def sha(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')


def read_glb(path):
    data=path.read_bytes()
    assert len(data)>=20 and struct.unpack_from('<4sII',data)==(b'glTF',2,len(data)),path
    offset=12;doc=None;binary=None
    while offset<len(data):
        length,kind=struct.unpack_from('<II',data,offset);offset+=8
        chunk=data[offset:offset+length];assert len(chunk)==length
        if kind==0x4e4f534a:doc=json.loads(chunk)
        elif kind==0x004e4942:binary=chunk
        else:raise ValueError('Unsupported GLB chunk type: '+hex(kind))
        offset+=length
    assert doc is not None and binary is not None
    assert len(doc.get('buffers',[]))==1 and 'uri' not in doc['buffers'][0]
    assert 'EXT_meshopt_compression' not in doc.get('extensionsUsed',[])
    return data,doc,binary


def view_bytes(doc,binary,index):
    view=doc['bufferViews'][index]
    assert view.get('buffer',0)==0
    offset=view.get('byteOffset',0);length=view['byteLength']
    out=binary[offset:offset+length];assert len(out)==length
    return out


def references(value):
    out=set()
    if isinstance(value,dict):
        for key,item in value.items():
            if key=='bufferView':out.add(item)
            else:out.update(references(item))
    elif isinstance(value,list):
        for item in value:out.update(references(item))
    return out


def remap_references(value,mapping):
    if isinstance(value,dict):
        for key,item in value.items():
            if key=='bufferView':value[key]=mapping[item]
            else:remap_references(item,mapping)
    elif isinstance(value,list):
        for item in value:remap_references(item,mapping)


def png_dimensions(data):
    assert data[:8]==b'\x89PNG\r\n\x1a\n' and data[12:16]==b'IHDR'
    return struct.unpack_from('>II',data,16)


def pack_glb(doc,binary):
    data=json_bytes(doc);data+=b' '*((-len(data))%4)
    binary+=b'\0'*((-len(binary))%4)
    total=12+8+len(data)+8+len(binary)
    return struct.pack('<4sII',b'glTF',2,total)+struct.pack('<II',len(data),0x4e4f534a)+data+struct.pack('<II',len(binary),0x004e4942)+binary


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input_dir',type=Path)
    parser.add_argument('output_dir',type=Path)
    args=parser.parse_args()
    source=args.input_dir.resolve();output=args.output_dir.resolve()
    (output/'models').mkdir(parents=True,exist_ok=True)
    (output/'textures').mkdir(parents=True,exist_ok=True)
    paths=sorted(source.glob('*.glb'))
    assert paths,'No input GLB files'
    models=[];textures={}
    for path in paths:
        original,source_doc,source_bin=read_glb(path)
        doc=copy.deepcopy(source_doc);image_views=set();image_records=[]
        for index,img in enumerate(source_doc.get('images',[])):
            assert img.get('mimeType')=='image/png' and 'bufferView'in img and 'uri' not in img
            view_index=img['bufferView'];image_views.add(view_index)
            encoded=view_bytes(source_doc,source_bin,view_index);digest=sha(encoded);width,height=png_dimensions(encoded)
            name=digest+'.png';dest=output/'textures'/name
            if dest.exists():assert dest.read_bytes()==encoded
            else:dest.write_bytes(encoded)
            uri='../textures/'+name
            doc['images'][index].pop('bufferView');doc['images'][index]['uri']=uri
            view=source_doc['bufferViews'][view_index]
            image_records.append({'imageIndex':index,'name':img.get('name'),'mimeType':img['mimeType'],'sourceBufferView':view_index,'sourceByteOffset':view.get('byteOffset',0),'byteLength':len(encoded),'sha256':digest,'width':width,'height':height,'uri':uri})
            textures[digest]={'file':'textures/'+name,'sha256':digest,'bytes':len(encoded),'width':width,'height':height,'mimeType':'image/png'}
        other={k:v for k,v in source_doc.items() if k not in ('images','bufferViews')}
        assert not image_views.intersection(references(other)),'An image view is also used by geometry'
        new_bin=bytearray();views=[];mapping={};view_records=[]
        for index,view in enumerate(source_doc['bufferViews']):
            if index in image_views:continue
            new_bin.extend(b'\0'*((-len(new_bin))%4));offset=len(new_bin)
            encoded=view_bytes(source_doc,source_bin,index);new_bin.extend(encoded)
            new_view=copy.deepcopy(view);new_view['buffer']=0;new_view['byteOffset']=offset
            new_index=len(views);mapping[index]=new_index;views.append(new_view)
            view_records.append({'sourceIndex':index,'runtimeIndex':new_index,'byteLength':len(encoded),'sha256':sha(encoded)})
        doc['bufferViews']=views;doc['buffers']=[{'byteLength':len(new_bin)}]
        remap_references(doc,mapping)
        final=pack_glb(doc,bytes(new_bin));destination=output/'models'/path.name
        assert destination.resolve()!=path.resolve()
        destination.write_bytes(final)
        verified,readback,readback_bin=read_glb(destination)
        assert readback==doc
        for proof in view_records:
            a=view_bytes(source_doc,source_bin,proof['sourceIndex']);b=view_bytes(readback,readback_bin,proof['runtimeIndex'])
            assert a==b and sha(b)==proof['sha256']
        for proof in image_records:
            payload=(destination.parent/proof['uri']).read_bytes()
            assert payload==view_bytes(source_doc,source_bin,proof['sourceBufferView'])
        # All non-storage semantics are identical. Accessor buffer-view indices
        # differ only by the recorded old->new mapping.
        expected=copy.deepcopy(source_doc)
        expected.pop('buffers');expected.pop('bufferViews');expected.pop('images',None)
        remap_references(expected,mapping)
        actual=copy.deepcopy(readback)
        actual.pop('buffers');actual.pop('bufferViews');actual.pop('images',None)
        assert expected==actual
        models.append({'file':'models/'+path.name,'sourceFile':path.name,'sourceSha256':sha(original),'runtimeSha256':sha(verified),'sourceBytes':len(original),'runtimeBytes':len(verified),'images':image_records,'bufferViews':view_records,'nonStorageStructureSha256':sha(json_bytes(actual)),'losslessVerified':True})
    manifest={'schemaVersion':1,'format':'glb-external-png-lossless-v1','textureUriPattern':'../textures/<sha256>.png','models':models,'textures':[textures[k] for k in sorted(textures)],'losslessVerified':True,'verification':'Exact source image bytes and every retained bufferView compared after repack. All other glTF structures unchanged apart from recorded bufferView index remapping.'}
    (output/'manifest.json').write_text(json.dumps(manifest,indent=2,sort_keys=True)+'\n')
    print(json.dumps({'models':[{'file':m['file'],'sourceBytes':m['sourceBytes'],'runtimeBytes':m['runtimeBytes'],'sourceSha256':m['sourceSha256'],'runtimeSha256':m['runtimeSha256']} for m in models],'sharedTextures':len(textures),'textureBytes':sum(t['bytes'] for t in textures.values()),'losslessVerified':True},indent=2))


if __name__=='__main__':main()
