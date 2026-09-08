import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve("out");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".glb": "model/gltf-binary",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(
    new URL(req.url, "http://localhost").pathname,
  );
  let file = path.resolve(
    root,
    "." + (pathname === "/" ? "/index.html" : pathname),
  );
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  if (!fs.existsSync(file) && fs.existsSync(file + ".html")) file += ".html";
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404).end("Not found");
    return;
  }
  res.writeHead(200, {
    "Content-Type": mime[path.extname(file)] || "application/octet-stream",
    "Cache-Control": "no-cache",
  });
  fs.createReadStream(file).pipe(res);
});
server.listen(4173, "0.0.0.0", () =>
  console.log("Production preview: http://localhost:4173"),
);
