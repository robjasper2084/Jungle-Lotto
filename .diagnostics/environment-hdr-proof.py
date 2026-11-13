import pathlib
root=pathlib.Path(__file__).parent
for name in ['environment-browser.mjs','environment-delivery-proof.mjs']:
 p=root/name;t=p.read_text();old=r'/\.glb$/i';assert t.count(old)==1,(name,t.count(old));t=t.replace(old,r'/\.(?:glb|hdr)$/i',1)
 if name=='environment-browser.mjs':t=t.replace('Every observed GLB body must match the served source','Every observed GLB/HDR body must match the served source')
 p.write_text(t)
print('Read-only EOF/byte/SHA-256 observation now also covers the HDR request identified in the baseline-phone trace. No blanket abort filtering or source changes.')
