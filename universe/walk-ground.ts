import { terrainHeight } from "./approach-terrain.ts";
export const NACRE_ENTRY_Z = 0.126;

/** Matches the actual two triangles in each regional terrain grid cell. */
export function groundHeight(kind: number, x: number, z: number) {
  const sphere = (a: number, b: number) =>
    Math.sqrt(Math.max(0, 1 - a * a - b * b)) - 1;
  if (Math.abs(x) >= 0.31 || Math.abs(z) >= 0.31) return sphere(x, z);
  const step = 0.62 / 100;
  const gx = (x + 0.31) / step,
    gz = (0.31 - z) / step;
  const ix = Math.floor(gx),
    iz = Math.floor(gz),
    u = gx - ix,
    v = gz - iz;
  const px = -0.31 + ix * step,
    pz = 0.31 - iz * step;
  const height = (a: number, b: number) =>
    sphere(a, b) + terrainHeight(kind, a, b);
  const a = height(px, pz),
    b = height(px, pz - step);
  const c = height(px + step, pz - step),
    d = height(px + step, pz);
  const h =
    u + v <= 1
      ? a * (1 - u - v) + b * v + d * u
      : b * (1 - u) + c * (u + v - 1) + d * (1 - v);
  return Math.max(sphere(x, z), h);
}

export function lagoonHeight(x: number, z: number) {
  return Math.hypot(x, z) < 0.152
    ? Math.sqrt(1 - x * x - z * z) - 1 + 0.021
    : -10;
}
