import * as THREE from "three/webgpu";
import { seeded } from "./timeline";

export function canvasTexture(
  w: number,
  h: number,
  draw: (c: CanvasRenderingContext2D) => void,
) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext("2d");
  if (!c) throw new Error("Canvas is unavailable");
  draw(c);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
export function screenTexture(kind: "main" | "side" | "laptop") {
  return canvasTexture(1536, 864, (c) => {
    c.fillStyle = "#121b20";
    c.fillRect(0, 0, 1536, 864);
    c.fillStyle = "#1c272d";
    c.fillRect(0, 0, 1536, 56);
    c.font = "19px monospace";
    c.fillStyle = "#8a989d";
    c.fillText("A T E L I E R   /   local workspace", 35, 35);
    c.fillStyle = "#4f656d";
    c.fillText("main*     23:48", 1240, 35);
    c.fillStyle = "#0d151b";
    c.fillRect(0, 57, 265, 760);
    c.font = "18px monospace";
    c.fillStyle = "#6d8189";
    [
      "EXPLORER",
      "⌄  tomorrow",
      "   ⌄  src",
      "      universe.ts",
      "      reality.ts",
      "      deadlines.ts",
      "   ⌄  tests",
      "      someday.test.ts",
      "",
      "   package.json",
      "",
      "CHANGES   37",
    ].forEach((t, i) => c.fillText(t, 28, 100 + i * 33));
    c.fillStyle = "#24353e";
    c.fillRect(266, 58, 240, 47);
    c.fillStyle = "#b8c8cd";
    c.fillText(kind === "laptop" ? "deploy.log" : "reality.ts  ×", 289, 88);
    c.fillStyle = "#435861";
    c.fillRect(265, 106, 1271, 1);
    const code =
      kind === "laptop"
        ? [
            ["// deployment #481", "#70818b"],
            ["$ build --production", "#9bbaa9"],
            ["  compiling tomorrow…", "#8ca5b3"],
            ["  37 things left to do", "#b5b0a1"],
            ["  waiting on one more review", "#b88b74"],
            ["", "#fff"],
            ["  BUILD FAILED", "#de977e"],
            ["  try again tomorrow.", "#a5afa9"],
          ]
        : [
            ["// one last thing before I go", "#6b8589"],
            ['import { tomorrow } from "./someday";', "#9ab5c5"],
            ["", "#fff"],
            ["export async function keepGoing() {", "#b8a7ba"],
            ["  const day = await anotherDay();", "#c0c9c6"],
            ["  const energy = 0;", "#c3ad8e"],
            ["", "#fff"],
            ["  while (thereIsMoreToDo) {", "#b8a7ba"],
            ["    await tryAgain();", "#c0c9c6"],
            ["    // probably fine", "#6b8589"],
            ["  }", "#c0c9c6"],
            ["", "#fff"],
            ["  return somethingLikeRest;", "#b4bda0"],
            ["}", "#c0c9c6"],
          ];
    c.font = "22px monospace";
    code.forEach(([s, color], i) => {
      c.fillStyle = "#415762";
      c.fillText(String(i + 1).padStart(2, " "), 286, 155 + i * 33);
      c.fillStyle = color;
      c.fillText(s, 350, 155 + i * 33);
    });
    c.fillStyle = "#0b1218";
    c.fillRect(265, 654, 1271, 168);
    c.fillStyle = "#637981";
    c.font = "17px monospace";
    c.fillText("TERMINAL      PROBLEMS  12      OUTPUT", 289, 686);
    c.fillStyle = "#daa18a";
    c.font = "23px monospace";
    c.fillText("× BUILD FAILED", 289, 734);
    c.fillStyle = "#889b9e";
    c.font = "19px monospace";
    c.fillText(
      "Expected: a quiet evening.   Received: 37 unfinished tasks.",
      289,
      776,
    );
    c.fillStyle = "#23353b";
    c.fillRect(0, 821, 1536, 43);
    c.fillStyle = "#98afb3";
    c.font = "17px monospace";
    c.fillText("↗ main    +37 −2", 26, 849);
    c.fillText("UTF-8     TypeScript     Ln 481, Col 1", 1090, 849);
    if (kind === "side") {
      c.fillStyle = "#111b22";
      c.fillRect(0, 0, 1536, 864);
      c.fillStyle = "#7d949c";
      c.font = "25px monospace";
      c.fillText("N O T I F I C A T I O N S", 95, 90);
      [
        "3 CHANGES REQUESTED",
        "PR #481",
        "CAN WE QUICKLY SYNC?",
        "PRODUCTION INCIDENT",
        "EOD",
        "MONDAY",
      ].forEach((t, i) => {
        c.fillStyle = "#243139";
        c.fillRect(70, 140 + i * 112, 1396, 92);
        c.fillStyle = i === 0 ? "#d1a391" : "#93a7b0";
        c.font = "30px monospace";
        c.fillText(t, 102, 194 + i * 112);
      });
    }
  });
}
export function notificationTexture(text: string) {
  return canvasTexture(768, 176, (c) => {
    c.fillStyle = "#172025";
    c.beginPath();
    c.roundRect(1, 1, 766, 174, 10);
    c.fill();
    c.strokeStyle = "#7f8d8b";
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = "#d2a886";
    c.fillRect(29, 50, 5, 71);
    c.font = "14px monospace";
    c.fillStyle = "#7f969a";
    c.fillText("ONE MORE THING", 57, 47);
    c.font = "35px monospace";
    c.fillStyle = "#e2e0d3";
    c.fillText(text, 56, 105);
    c.font = "17px monospace";
    c.fillStyle = "#849795";
    c.fillText("↗", 719, 43);
  });
}
export function woodTexture() {
  return canvasTexture(1024, 256, (c) => {
    const rand = seeded(48);
    c.fillStyle = "#594331";
    c.fillRect(0, 0, 1024, 256);
    for (let i = 0; i < 1900; i++) {
      const y = rand() * 256;
      c.strokeStyle = `rgba(${rand() > 0.5 ? "17,11,8" : "163,132,92"},${rand() * 0.13})`;
      c.lineWidth = rand() * 1.6;
      c.beginPath();
      c.moveTo(0, y);
      c.bezierCurveTo(
        350,
        y + Math.sin(y) * 5,
        660,
        y - 8,
        1024,
        y + rand() * 3,
      );
      c.stroke();
    }
  });
}
export function cityTexture() {
  return canvasTexture(128, 512, (c) => {
    const rand = seeded(82);
    c.fillStyle = "#111b22";
    c.fillRect(0, 0, 128, 512);
    for (let y = 6; y < 512; y += 15)
      for (let x = 7; x < 128; x += 17) {
        if (rand() > 0.62) {
          c.fillStyle = rand() > 0.35 ? "#6c6954" : "#536976";
          c.globalAlpha = 0.2 + rand() * 0.7;
          c.fillRect(x, y, 5, 8);
        }
      }
    c.globalAlpha = 1;
  });
}
