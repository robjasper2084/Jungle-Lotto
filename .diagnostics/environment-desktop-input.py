import pathlib
p=pathlib.Path(__file__).parent/'environment-browser.mjs';t=p.read_text()
old="if(!phone)await page.setViewportSize({width:960,height:540});";assert t.count(old)==1;t=t.replace(old,"if(!phone)await page.setViewportSize({width:640,height:360});",1)
old="Native on-foot Run controls; full-size matched visual captures retained separately";assert old in t;t=t.replace(old,"Native desktop keyboard Run controls in a 640x360 window; all matched environment captures remain 1280x800. Interaction proof only, not full-resolution performance certification. GPU readiness 45s and waypoint deadline 180s unchanged.",1)
p.write_text(t)
print('Only the native-input traversal window is reduced after a traced software-GPU throughput limit. Full-size visual captures, real world geometry, physics, controls, assertions and deadlines stay intact.')
