import fs from "node:fs/promises";
await fs.mkdir("public/fonts", { recursive: true });
for (const [name, url] of [
  [
    "dm-sans-latin.woff2",
    "https://fonts.gstatic.com/s/dmsans/v17/rP2Yp2ywxg089UriI5-g4vlH9VoD8Cmcqbu0-K4.woff2",
  ],
  [
    "manrope-latin.woff2",
    "https://fonts.gstatic.com/s/manrope/v20/xn7gYHE41ni1AdIRggexSg.woff2",
  ],
  [
    "DM-Sans-OFL.txt",
    "https://raw.githubusercontent.com/google/fonts/main/ofl/dmsans/OFL.txt",
  ],
  [
    "Manrope-OFL.txt",
    "https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/OFL.txt",
  ],
]) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Font source returned ${response.status}`);
  await fs.writeFile(
    `public/fonts/${name}`,
    new Uint8Array(await response.arrayBuffer()),
  );
}
