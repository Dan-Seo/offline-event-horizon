/** Artistic metres; shared by free-flight recovery and the rendered ocean floor. */
export const OCEAN_RADIUS = 48000;
export function seaHeight(x: number, z: number) {
  return Math.sqrt(Math.max(0, OCEAN_RADIUS ** 2 - x * x - z * z)) - OCEAN_RADIUS + 0.3;
}
export function seaFloor(x: number, z: number) {
  return seaHeight(x, z) - 64 - 13 * Math.sin(x * 0.003) * Math.cos(z * 0.004);
}
export function signedSeaDepth(x: number, y: number, z: number) {
  return seaHeight(x, z) - y;
}
export function submersion(depth: number, width = 1.5) {
  const t = Math.max(0, Math.min(1, depth / width));
  return t * t * (3 - 2 * t);
}
/** Authoritative Float32 mesh data, consumed directly by MirrorSea and recovery. */
export const SEA_RINGS = 128, SEA_SLICES = 192, SEA_EXTENT = 46000;
export const seaMesh = (() => {
  const water = new Float32Array((SEA_RINGS + 1) * (SEA_SLICES + 1) * 3);
  const floor = new Float32Array(water.length), indices: number[] = [];
  for (let j = 0; j <= SEA_RINGS; j++) for (let i = 0; i <= SEA_SLICES; i++) {
    const r = SEA_EXTENT * (j / SEA_RINGS) ** 2.5, a = i / SEA_SLICES * Math.PI * 2;
    const k = (j * (SEA_SLICES + 1) + i) * 3;
    water[k] = Math.cos(a) * r; water[k + 2] = Math.sin(a) * r;
    water[k + 1] = seaHeight(water[k], water[k + 2]);
    floor[k] = water[k]; floor[k + 2] = water[k + 2];
    floor[k + 1] = seaFloor(water[k], water[k + 2]) - 0.15;
  }
  for (let j = 0; j < SEA_RINGS; j++) for (let i = 0; i < SEA_SLICES; i++) {
    const a = j * (SEA_SLICES + 1) + i, b = a + SEA_SLICES + 1;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  return { water, floor, indices: new Uint32Array(indices) };
})();

/** Barycentric height of the actual indexed triangles, including Float32 rounding.
 * Polar lookup examines at most 18 triangles; no whole-mesh scan per flight tick. */
export function renderedSeaFloor(x: number, z: number) {
  const radius = Math.hypot(x, z);
  if (radius < 1e-8) return seaMesh.floor[1];
  const ring = Math.floor((radius / SEA_EXTENT) ** 0.4 * SEA_RINGS);
  const slice = Math.floor(((Math.atan2(z, x) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * SEA_SLICES);
  const p = seaMesh.floor;
  for (let j = Math.max(0, ring - 1); j <= Math.min(SEA_RINGS - 1, ring + 1); j++) {
    for (let offset = -1; offset <= 1; offset++) {
      const i = (slice + offset + SEA_SLICES) % SEA_SLICES;
      for (let t = 0; t < 2; t++) {
        const k = (j * SEA_SLICES + i) * 6 + t * 3;
        const a = seaMesh.indices[k] * 3, b = seaMesh.indices[k + 1] * 3, c = seaMesh.indices[k + 2] * 3;
        const bx = p[b] - p[a], bz = p[b + 2] - p[a + 2];
        const cx = p[c] - p[a], cz = p[c + 2] - p[a + 2];
        const det = bx * cz - bz * cx;
        if (Math.abs(det) < 1e-15) continue;
        const dx = x - p[a], dz = z - p[a + 2];
        const u = (dx * cz - dz * cx) / det, v = (bx * dz - bz * dx) / det;
        if (u >= -1e-10 && v >= -1e-10 && u + v <= 1 + 1e-10)
          return p[a + 1] + u * (p[b + 1] - p[a + 1]) + v * (p[c + 1] - p[a + 1]);
      }
    }
  }
  return seaFloor(x, z); // Outside the rendered cap; never used by its 30 km recovery domain.
}

/** Local coordinates have origin at the regional north surface, not body centre. */
export function regionalDomain(local: { x: number; y: number; z: number }, extent = 0.4) {
  return Number.isFinite(local.x + local.y + local.z) && local.y + 1 > 0 &&
    Math.hypot(local.x, local.z) < extent;
}

export const SURFACE_EXTINCTION = 0.085;
export function surfaceTransmission(depth: number, viewCosine: number) {
  return Math.exp(-SURFACE_EXTINCTION * Math.max(0, depth) / Math.max(0.15, Math.abs(viewCosine)));
}
/** Solve a radial ray against a height field without substituting water for ground. */
export function oceanRadialFloor(x: number, y: number, z: number,
  height: (x: number, z: number) => number, radius: number, clearance: number) {
  if (y <= 0) return radius;
  let lo = radius * 0.8, hi = radius * 1.2;
  for (let i = 0; i < 42; i++) {
    const r = (lo + hi) / 2;
    if (y * r - radius < height(x * r, z * r)) lo = r;
    else hi = r;
  }
  return hi + clearance;
}
