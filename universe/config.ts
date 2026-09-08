export type Quality = "ULTRA" | "HIGH" | "BALANCED" | "BATTERY";
export const QUALITY = {
  ULTRA: { dpr: 1.75, particles: 160000, asteroids: 7000, steps: 72 },
  HIGH: { dpr: 1.5, particles: 80000, asteroids: 4000, steps: 52 },
  BALANCED: { dpr: 1.15, particles: 36000, asteroids: 1800, steps: 32 },
  BATTERY: { dpr: 0.85, particles: 12000, asteroids: 650, steps: 18 },
} as const;
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
export function sectorSeed(x: number, y: number, z: number) {
  return (
    (Math.imul(x, 73856093) ^
      Math.imul(y, 19349663) ^
      Math.imul(z, 83492791) ^
      81726) >>>
    0
  );
}
