import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".tar": "application/x-tar",
  ".gz": "application/gzip",
  ".glb": "model/gltf-binary",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};
// `headers` is vercel.json's own array. Only its anchored regular-expression `source` form is
// supported, which is all this project uses: /(.*), /assets/(.*), /fonts/(.*).
export function createHandler(root, headers = []) {
  const rules = headers.map((rule) => [
    new RegExp(`^${rule.source}$`),
    Object.fromEntries(rule.headers.map((h) => [h.key, h.value])),
  ]);
  return (req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
    } catch {
      res.writeHead(400).end("Bad request");
      return;
    }
    const production = Object.assign(
      {},
      ...rules.filter(([match]) => match.test(pathname)).map(([, h]) => h),
    );
    let file = path.resolve(
      root,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403, production).end();
      return;
    }
    // Static app routes also have an RSC payload directory with the same name.
    if ((!fs.existsSync(file) || fs.statSync(file).isDirectory()) && fs.existsSync(file + ".html")) file += ".html";
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, production).end("Not found");
      return;
    }
    res.writeHead(200, {
      ...production,
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
      // The preview deliberately keeps nothing, so vercel.json's asset caching does not apply here.
      "Cache-Control": "no-cache",
    });
    fs.createReadStream(file).pipe(res);
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { headers } = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
  http
    .createServer(createHandler(path.resolve("out"), headers))
    .listen(4173, "0.0.0.0", () =>
      console.log("Production preview: http://localhost:4173"),
    );
}
