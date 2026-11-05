"""Serve the real Unity WebGL build on this computer."""
import argparse
import functools
import json
import pathlib
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parents[1]
WEB = ROOT / "Builds" / "WebGL"

def prepare_launcher():
    build = WEB / "Build"
    loader = next(build.glob("*.loader.js"))
    data = next(build.glob("*.data"))
    framework = next(build.glob("*.framework.js"))
    wasm = next(build.glob("*.wasm"))
    config = {
        "dataUrl": "Build/" + data.name,
        "frameworkUrl": "Build/" + framework.name,
        "codeUrl": "Build/" + wasm.name,
        "streamingAssetsUrl": "StreamingAssets",
        "companyName": "Digital Static",
        "productName": "Swoop Detroit - Bloom Through Gloom",
        "productVersion": "0.1",
        "matchWebGLToCanvasSize": True,
        "devicePixelRatio": 1,
    }
    html = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Swoop Detroit — Bloom Through Gloom | Unity</title>
<style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:#151b17;color:#eeeade;font-family:Arial,sans-serif}
body{display:flex;flex-direction:column}
header{height:45px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 18px;border-bottom:1px solid #39433a;gap:12px}
header strong{font-size:13px;letter-spacing:.07em}header span{font-size:11px;color:#bec1b7}
main{position:relative;flex:1;min-height:0;overflow:hidden;background:#d9ddd3}
canvas{display:block;width:100%;height:100%;outline:none}
#loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#18231c}
.load{width:min(480px,80%)}.load h1{font-size:38px;letter-spacing:-1px;margin:0 0 18px}
.load p{line-height:1.5;color:#cbd0c3;font-size:14px}
progress{width:100%;height:8px;accent-color:#e2e4d9;margin:12px 0}
#status{font-size:12px;color:#bdc7b7}
footer{min-height:34px;flex:none;padding:9px 18px;font-size:11px;color:#bfc4b9;display:flex;justify-content:space-between;gap:12px}
button{border:0;background:transparent;color:inherit;cursor:pointer;font:inherit;padding:0}
@media(max-width:600px){header span{display:none}footer{font-size:10px}header strong{font-size:11px}}
</style></head><body>
<header><strong>SWOOP DETROIT · BLOOM THROUGH GLOOM</strong><span>Unity 3D · Local playable prototype</span></header>
<main><canvas id="unity-canvas" width="1280" height="720" tabindex="0" aria-label="Swoop Detroit Unity game"></canvas>
<div id="loading"><div class="load"><h1>Ride into the music.</h1>
<p>The flower corridor, waterfront and live performance are loading.<br>The original clip's soundtrack starts when you begin.</p>
<progress id="progress" max="1" value="0"></progress><div id="status" role="status">Loading Unity…</div>
</div></div></main>
<footer><span>Click game to focus · WASD ride · Space hop · C camera · V performance · Esc pause</span>
<button id="full" title="Fullscreen game">FULLSCREEN ↗</button></footer>
<script>
const canvas=document.getElementById('unity-canvas');
const status=document.getElementById('status');
const loading=document.getElementById('loading');
const config=__CONFIG__;
window.bloomPreview={state:'loading',progress:0,errors:[]};
config.showBanner=(message,type)=>{if(type==='error'){bloomPreview.errors.push(message);status.textContent=message;}};
const script=document.createElement('script');script.src=__LOADER__;
script.onerror=()=>{status.textContent='The local build could not load. Restart Open-Browser-Preview.cmd.';bloomPreview.state='error';};
script.onload=()=>createUnityInstance(canvas,config,p=>{
    bloomPreview.progress=p;document.getElementById('progress').value=p;
    status.textContent=p<.9?'Loading scene · '+Math.round(p*100)+'%':'Preparing the garden…';
}).then(instance=>{
    window.unityInstance=instance;bloomPreview.state='ready';
    loading.style.display='none';canvas.focus();
}).catch(error=>{status.textContent=String(error);bloomPreview.state='error';bloomPreview.errors.push(String(error));});
document.head.appendChild(script);
canvas.addEventListener('pointerdown',()=>canvas.focus());
document.getElementById('full').onclick=()=>{if(window.unityInstance)unityInstance.SetFullscreen(1);};
</script></body></html>
"""
    html = html.replace("__CONFIG__", json.dumps(config)).replace("__LOADER__", json.dumps("Build/" + loader.name))
    portal = ROOT / "SourceArt" / "jazz_portal.html"
    if portal.exists():
        html = portal.read_text(encoding="utf-8").replace("__CONFIG__", json.dumps(config)).replace("__LOADER__", json.dumps("Build/" + loader.name))
    (WEB / "index.html").write_text(html, encoding="utf-8")
    (ROOT / "QA" / "browser-build-files.json").write_text(json.dumps(config, indent=2), encoding="utf-8")

class PreviewHandler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".wasm": "application/wasm", ".data": "application/octet-stream"}
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def send_head(self):
        self.byte_range = None
        path = pathlib.Path(self.translate_path(self.path))
        requested = self.headers.get("Range", "")
        if path.suffix.lower() != ".mp4" or not requested or not path.is_file():
            return super().send_head()
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", requested)
        size = path.stat().st_size
        if not match or not any(match.groups()):
            self.send_error(416)
            return None
        first, last = match.groups()
        start = int(first) if first else max(0, size-int(last))
        end = min(size-1, int(last)) if first and last else size-1
        if start > end or start >= size:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return None
        source = path.open("rb")
        source.seek(start)
        self.byte_range = end-start+1
        self.send_response(206)
        self.send_header("Content-Type", "video/mp4")
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(self.byte_range))
        self.end_headers()
        return source

    def copyfile(self, source, outputfile):
        if self.byte_range is None:
            return super().copyfile(source, outputfile)
        remaining = self.byte_range
        while remaining:
            chunk = source.read(min(65536, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8229)
    parser.add_argument("--prepare-only", action="store_true")
    parser.add_argument("--classic", action="store_true", help="Serve the preserved pre-portal WebGL build")
    args = parser.parse_args()
    portal = ROOT / "Builds" / "JazzPortal"
    if not args.classic and (portal / "index.html").is_file():
        WEB = portal
    else:
        prepare_launcher()
    if not args.prepare_only:
        handler = functools.partial(PreviewHandler, directory=str(WEB))
        server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
        print(f"Swoop Detroit Unity WebGL: http://127.0.0.1:{args.port}/", flush=True)
        server.serve_forever()
