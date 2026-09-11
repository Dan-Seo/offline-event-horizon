import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHandler } from "../scripts/serve.mjs";

// The preview server carries the deployed headers, so local QA sees the production CSP.
const { headers } = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
const deployed = (source: string, key: string) =>
  headers
    .find((rule: { source: string }) => rule.source === source)
    .headers.find((header: { key: string }) => header.key === key).value;
const request = (port: number, target: string) =>
  new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }>(
    (resolve, reject) => {
      const req = http.request({ port, path: target, agent: false }, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode!, headers: res.headers, body }),
        );
      });
      req.on("error", reject);
      req.end();
    },
  );

test("the preview serves the export, its MIME types and the deployed headers", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vastness-serve-"));
  fs.writeFileSync(path.join(root, "index.html"), "<!doctype html>home");
  fs.writeFileSync(path.join(root, "app.js"), "export const a = 1;\n");
  fs.writeFileSync(path.join(root, "guide.html"), "<!doctype html>guide");
  const server = http.createServer(createHandler(root, headers));
  try {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as { port: number };
    const home = await request(port, "/");
    assert.equal(home.status, 200);
    assert.equal(home.headers["content-type"], "text/html; charset=utf-8");
    assert.equal(
      home.headers["content-security-policy"],
      deployed("/(.*)", "Content-Security-Policy"),
    );
    assert.equal(
      home.headers["x-frame-options"],
      deployed("/(.*)", "X-Frame-Options"),
    );
    const script = await request(port, "/app.js");
    assert.equal(script.headers["content-type"], "text/javascript");
    const guide = await request(port, "/guide");
    assert.equal(guide.status, 200, "an app route resolves to its .html file");
    assert.match(guide.body, /guide/);
    assert.equal((await request(port, "/%")).status, 400);
    // The URL parser resolves plain dot segments away, so escaping needs an encoded separator.
    assert.equal((await request(port, "/%2e%2e%2fpackage.json")).status, 403);
    assert.equal((await request(port, "/../package.json")).status, 404);
    assert.equal((await request(port, "/missing")).status, 404);
  } finally {
    server.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
