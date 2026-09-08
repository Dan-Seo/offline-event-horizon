import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const url = process.env.QA_URL || "https://offline-vastness.vercel.app";
const assets = [
  "poster.jpg",
  "assets/cathedral.glb",
  "assets/cathedral-low.glb",
  "fonts/dm-sans-latin.woff2",
  "fonts/manrope-latin.woff2",
];
const sha = (buffer) => createHash("sha256").update(buffer).digest("hex");
const results = await Promise.all(
  assets.map(async (path) => {
    const response = await fetch(`${url}/${path}`),
      remote = Buffer.from(await response.arrayBuffer());
    const local = await fs.readFile(`public/${path}`);
    assert.equal(response.status, 200, path);
    assert.equal(sha(remote), sha(local), path + " matches committed asset");
    return {
      path,
      status: response.status,
      bytes: remote.length,
      type: response.headers.get("content-type"),
      sha256: sha(remote),
    };
  }),
);
await fs.mkdir("artifacts", { recursive: true });
await fs.writeFile(
  "artifacts/sanctuary-production-assets.json",
  JSON.stringify({ url, assets: results }, null, 2),
);
console.log(JSON.stringify(results, null, 2));
