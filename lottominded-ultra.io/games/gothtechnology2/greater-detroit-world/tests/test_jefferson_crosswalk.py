import importlib.util, unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('j',ROOT/'tools/jefferson_crosswalk.py')
j=importlib.util.module_from_spec(spec);spec.loader.exec_module(j)
def feature(fid,lon=-83.004,lat=42.344):
    return {'id':fid,'properties':{'objectid':fid},'geometry':{'type':'Polygon','coordinates':[[[lon,lat],[lon+.00025,lat],[lon+.00025,lat+.0002],[lon,lat+.0002],[lon,lat]]]}}
def game(f):
    return {'id':str(f['id']),'points':[list(j.project(*p)) for p in f['geometry']['coordinates'][0]]}
class Tests(unittest.TestCase):
    def test_exact_matches_not_release(self):
        f=feature(38712);r=j.match([f],{'buildings':[game(f)]},{'buildings':[]})
        self.assertEqual(r['uniqueCandidates'],1)
        self.assertGreater(r['armory']['candidates'][0]['IoU'],.999)
        self.assertFalse(r['collisionChanged']);self.assertFalse(r['releaseApproved'])
    def test_missing_proxy(self):
        f=feature(38712);r=j.match([f],{'buildings':[]},{'buildings':[]})
        self.assertEqual(r['unresolvedCount'],1)
    def test_duplicate_proxy(self):
        f=feature(38712);g=game(f)
        r=j.match([f],{'buildings':[g,{**g,'id':'copy'}]},{'buildings':[]})
        self.assertEqual(r['uniqueCandidates'],0)
    def test_one_proxy_cannot_claim_two_sources(self):
        f=feature(38712);second=feature(600)
        r=j.match([f,second],{'buildings':[game(f)]},{'buildings':[]})
        self.assertEqual(r['uniqueCandidates'],0)
        self.assertEqual(len(r['reuseConflicts']),1)
    def test_origin(self):
        self.assertEqual(j.project(-83.00175,42.34680),(0,0))
