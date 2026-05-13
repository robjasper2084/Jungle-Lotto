const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT || 8096);
const root = path.join(__dirname, "..", "public");
const base = "/lottomind-secret-sauce";

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4"
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "content-type": type,
    "cache-control": "no-store"
  });
  res.end(body);
}

function fileForUrl(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split("?")[0]);
  if (cleanPath === "/" || cleanPath === "") return path.join(root, base, "index.html");
  if (!cleanPath.startsWith(base)) return null;
  const relative = cleanPath.slice(1);
  const direct = path.join(root, relative);
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
  return path.join(root, base, "index.html");
}

http
  .createServer((req, res) => {
    const filePath = fileForUrl(req.url || "/");
    if (!filePath) return send(res, 404, "Not found");
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(root))) return send(res, 403, "Forbidden");
    fs.readFile(resolved, (error, data) => {
      if (error) return send(res, 404, "Not found");
      send(res, 200, data, types[path.extname(resolved).toLowerCase()] || "application/octet-stream");
    });
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`LottoMind static preview on http://127.0.0.1:${port}${base}/`);
  });
