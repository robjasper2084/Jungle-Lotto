import copy,importlib.util,json,struct,tempfile,unittest,zlib
from pathlib import Path
spec=importlib.util.spec_from_file_location('canvas_audit',Path(__file__).with_name('audit.py'));audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
def chunk(name,body): return struct.pack('>I',len(body))+name+body+struct.pack('>I',zlib.crc32(name+body)&0xffffffff)
def png(w,h,pixels): return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(b'\0'+pixels[i*w*4:(i+1)*w*4] for i in range(h))))+chunk(b'IEND',b'')
class Offline(unittest.TestCase):
 def test_exact_rgba(self):
  pixels=bytes([1,2,3,255,9,8,7,255]);w,h,rows=audit.decode_png(png(2,1,pixels),(2,1));self.assertEqual((w,h,rows),(2,1,[pixels]))
 def test_one_channel(self):
  self.assertEqual(audit.difference(bytes([0,1,2,255]),bytes([0,1,3,255])),{'changedBytes':1,'changedPixels':1,'maxDifference':1})
 def test_crc_and_truncation(self):
  data=png(1,1,bytes([1,2,3,255]));bad=bytearray(data);bad[-1]^=1
  for x in [bad,data[:-1],data+b'junk']:
   with self.assertRaises(ValueError): audit.decode_png(x)
 def test_wrong_declared_dimensions(self):
  with self.assertRaises(ValueError): audit.decode_png(png(1,1,bytes(4)),(2,1))
 def test_zlib_expansion_is_bounded(self):
  data=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1,1,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(bytes(10000)))+chunk(b'IEND',b'')
  with self.assertRaises(ValueError): audit.decode_png(data)
 def test_composition_prior_readback_negative(self):
  s=json.loads(Path(__file__).with_name('schedule.json').read_text());self.assertTrue(audit.validate_schedule(s));s['checkpoints'][0]['readbacksPerCanvasBefore']=1
  with self.assertRaises(ValueError): audit.validate_schedule(s)
 def test_native_region_detects_exact_pixel(self):
  w,h=840,290;pixels=bytearray([40,57,65,255])*(w*h);i=(1*w+421)*4;pixels[i:i+4]=bytes([255,0,255,255]);d=audit.decode_png(png(w,h,pixels));a=audit.region(d,{'x':0,'y':0,'width':420,'height':290});b=audit.region(d,{'x':420,'y':0,'width':420,'height':290});self.assertEqual(audit.difference(a,b)['changedPixels'],1)
 def composition_fixture(self,id='p2-latest'):
  row={'name':id+'.png','kind':'png','bytes':123,'sha256':'a'*64};rects=[{'x':10,'y':10,'width':420,'height':290},{'x':450,'y':10,'width':420,'height':290}]
  if id=='p1-visible': rects.append({'x':890,'y':10,'width':420,'height':290})
  return {'id':id,'rectangles':rects,'file':dict(row)},{row['name']:row}
 def test_actual_composition_guard_rejects_a_against_a(self):
  c,ledger=self.composition_fixture();self.assertTrue(audit.validate_composition_binding(c,'p2-latest',ledger));c['rectangles'][1]=dict(c['rectangles'][0])
  with self.assertRaises(ValueError): audit.validate_composition_binding(c,'p2-latest',ledger)
 def test_actual_composition_guard_rejects_reused_png_and_forged_receipt(self):
  for change in ['name','bytes','sha256']:
   c,ledger=self.composition_fixture('p1-visible');self.assertTrue(audit.validate_composition_binding(c,'p1-visible',ledger));c['file'][change]='p2-latest.png' if change=='name' else 124 if change=='bytes' else 'b'*64
   with self.assertRaises(ValueError): audit.validate_composition_binding(c,'p1-visible',ledger)
 def test_first_capture_revision_is_retained_without_inventing_a_pin(self):
  m=json.loads(Path(__file__).with_name('manifest.json').read_text());p=m['runtime']['browserLanes'];revision='b'*40;r={'version':{'product':p['swiftshader']['product'],'revision':'@'+revision},'revisionBinding':{'policy':'observe-first-capture','revision':revision,'previouslyVerified':False,'sameBrowserForBothSources':True}}
  self.assertEqual(audit.validate_browser_binding(r,'swiftshader',p)['revision'],revision)
  for key,value in [('product',p['metal']['product']),('revision','unknown')]:
   bad=copy.deepcopy(r);bad['version'][key]=value
   with self.assertRaises(ValueError): audit.validate_browser_binding(bad,'swiftshader',p)
 def test_final_audit_consumes_reserved_capacity_and_never_overwrites(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);(root/'capture-status.json').write_bytes(bytes(200));m={'bounds':{'outputBytes':1000,'ancillaryBytes':1000,'reservedAuditBytes':500}};result=audit.write_audit_report(root,{'passed':True,'auditCompleted':True},m,{'checkpoints':[]});self.assertTrue(result['passed']);self.assertLessEqual(sum(p.stat().st_size for p in root.iterdir()),1000)
   with self.assertRaises(ValueError): audit.write_audit_report(root,{'passed':True},m,{'checkpoints':[]})
 def test_final_audit_no_room_creates_no_out_of_cap_fallback(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);(root/'capture-status.json').write_bytes(bytes(990));m={'bounds':{'outputBytes':1000,'ancillaryBytes':1000,'reservedAuditBytes':500}};result=audit.write_audit_report(root,{'passed':True,'auditCompleted':True},m,{'checkpoints':[]});self.assertFalse(result['passed']);self.assertEqual([p.name for p in root.iterdir()],['capture-status.json'])
if __name__=='__main__': unittest.main()
