export const DURATION = 300;
export const CHAPTERS = [
  {
    name: "WORK",
    start: 0,
    end: 32,
    title: "One last thing.",
    line: "There is always one last thing.",
  },
  {
    name: "DISTORTION",
    start: 32,
    end: 63,
    title: "Something is giving way.",
    line: "Move a little. The world is listening.",
  },
  {
    name: "COLLAPSE",
    start: 63,
    end: 105,
    title: "Let it go.",
    line: "Drag it away.",
  },
  {
    name: "ESCAPE",
    start: 105,
    end: 150,
    title: "A little more distance.",
    line: "It all gets smaller from here.",
  },
  {
    name: "COSMOS",
    start: 150,
    end: 187,
    title: "Room to breathe.",
    line: "There is more space than you remember.",
  },
  {
    name: "CREATION",
    start: 187,
    end: 224,
    title: "Something of your own.",
    line: "Touch the dust. Leave a little possibility.",
  },
  {
    name: "LIFE",
    start: 224,
    end: 268,
    title: "And then, quietly.",
    line: "A world that asks for nothing.",
  },
  {
    name: "SILENCE",
    start: 268,
    end: 300,
    title: "Nothing needs you right now.",
    line: "See you tomorrow.",
  },
] as const;
export type ChapterName = (typeof CHAPTERS)[number]["name"];
export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export function chapterAt(t: number) {
  return Math.max(
    0,
    CHAPTERS.findLastIndex((c) => t >= c.start),
  );
}
export function phases(t: number) {
  return {
    anomaly: smooth(19, 73, t),
    fracture: smooth(67, 107, t),
    escape: smooth(102, 151, t),
    galaxy: smooth(127, 159, t),
    creation: smooth(187, 221, t),
    life: smooth(222, 263, t),
    quiet: smooth(268, 290, t),
  };
}
export type Quality = "ULTRA" | "HIGH" | "BALANCED" | "BATTERY";
export const QUALITY: Record<
  Quality,
  { particles: number; dpr: number; grass: number; bloom: boolean }
> = {
  ULTRA: { particles: 180000, dpr: 1.75, grass: 14000, bloom: true },
  HIGH: { particles: 90000, dpr: 1.5, grass: 8000, bloom: true },
  BALANCED: { particles: 42000, dpr: 1.25, grass: 4500, bloom: true },
  BATTERY: { particles: 14000, dpr: 0.85, grass: 1600, bloom: false },
};
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
