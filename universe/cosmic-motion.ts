/** Presentation seconds and body radii; decorative orbits are not ephemerides. */
export const OCEAN_CAP = {
  radius: 48000,
  scale: 0.9996,
  extraRecess: 70,
  fullNorthCosine: Math.sqrt(1 - (30000 / 48000) ** 2),
  outerNorthCosine: 0.70,
  // Inverse of the preserved Orpheus world rotation about X.
  localNorth: [0, Math.cos(0.5), -Math.sin(0.5)] as const,
};

export function satellitePosition(time: number, index: number, out: { x: number; y: number; z: number }) {
  const radius = 3.05 + index * 0.72;
  const angle = (Number.isFinite(time) ? time : 0) * 0.085 / Math.pow(radius / 3.05, 1.5) + index * 2.39996;
  const inclination = 0.22 + index * 0.13;
  out.x = radius * Math.cos(angle);
  out.y = radius * Math.sin(angle) * Math.sin(inclination);
  out.z = radius * Math.sin(angle) * Math.cos(inclination);
  return out;
}

/** Thin point-lens image equation theta - 1/theta = beta (Einstein units).
 * Weak-field illustration only, never a strong-field Schwarzschild ray solver. */
export function stellarImages(beta: number) {
  const b = Math.max(0, Number.isFinite(beta) ? beta : 0);
  const positive = (b + Math.hypot(b, 2)) / 2;
  return { positive, negative: -1 / positive };
}
