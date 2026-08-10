import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";

const port = Number(process.env.LOTTOMIND_TRIVIA_PREVIEW_PORT || 8204);
const host = "127.0.0.1";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".mp4": "video/mp4" };

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${host}:${port}`).pathname);
  let file = path.resolve(root, `.${pathname}`);
  if (!file.startsWith(root) || !existsSync(file)) { response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); response.end("Not found"); return; }
  if (statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!existsSync(file)) { response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); response.end("Not found"); return; }
  response.writeHead(200, { "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  createReadStream(file).pipe(response);
}).listen(port, host, () => console.log(`Trivia Vault preview: http://${host}:${port}/lotto%20mind%20refined/games/lottomind-trivia/`));
