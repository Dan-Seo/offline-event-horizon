/** Deterministic regional terrain, in units of the parent planet's radius. */
export function terrainHeight(kind: number, x: number, z: number) {
  const waves = Math.sin(x * 39 + Math.sin(z * 23)) * Math.cos(z * 31 - x * 7);
  const grain = Math.sin(x * 117 + z * 29) * Math.sin(z * 93 - x * 43);
  const edge = Math.max(0, 1 - Math.max(Math.abs(x), Math.abs(z)) / 0.31);
  const envelope = Math.min(1, edge * 9);
  let height = 0;
  if (kind === 2) {
    const bend = x + Math.sin(z * 19) * 0.017;
    const wall = Math.max(0, Math.min(1, (Math.abs(bend) - 0.018) / 0.047));
    height =
      wall *
        wall *
        (3 - 2 * wall) *
        (0.035 + Math.sin(z * 75) * 0.004 + waves * 0.005) +
      grain * 0.0007;
  } else if (kind === 9) {
    const dune = Math.sin(x * 62 + Math.sin(z * 18) * 1.8);
    height = (dune * 0.5 + 0.5) ** 2 * 0.019 + waves * 0.004;
  } else if (kind === 6) {
    const r = Math.hypot(x, z);
    height =
      Math.exp(-(((r - 0.12) / 0.052) ** 2)) * 0.039 +
      waves * 0.004 +
      Math.abs(grain) * 0.0015;
  } else if (kind === 10) {
    height = Math.max(0, Math.hypot(x, z) - 0.085) * 0.18 + waves * 0.006;
  } else {
    height = 0.012 + waves * 0.007 + grain * 0.001;
  }
  // Bury the outer rim in the parent globe; no raised square edge from orbit.
  return -0.01 + (0.026 + Math.max(-0.004, height)) * envelope;
}

/** Radial clearance fitted to the same spherical cap used by the render mesh. */
export function terrainClearance(
  kind: number,
  x: number,
  y: number,
  z: number,
) {
  if (Math.abs(x) > 0.3 || Math.abs(z) > 0.3 || y < 0.8) return 1.013;
  let radius = 1.025;
  for (let i = 0; i < 5; i++) {
    const px = x * radius,
      pz = z * radius,
      r2 = px * px + pz * pz;
    const water =
      kind === 10 && r2 < 0.152 ** 2
        ? 0.021
        : kind === 6 && r2 < 0.093 ** 2
          ? 0.024
          : -1;
    const h = Math.max(0.012, water, terrainHeight(kind, px, pz));
    radius = Math.sqrt(r2 + (Math.sqrt(Math.max(0, 1 - r2)) + h) ** 2);
  }
  return radius + 0.0012;
}
