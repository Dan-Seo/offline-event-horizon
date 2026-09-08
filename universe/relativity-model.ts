/** Schwarzschild vacuum, r_s = c = 1. No Kerr spin or quantum interior.
 * See docs/RELATIVITY.md for the tetrad, derivation and numerical limits.
 * This module deliberately has no rendering dependencies.
 */
export const GR = {
  horizon: 1,
  photonSphere: 1.5,
  isco: 3,
  criticalImpact: Math.sqrt(27) / 2,
  observerCutoff: 0.2,
  rayCutoff: 0.04,
  skyRadius: 90,
  step: 0.06,
  maxSteps: 480,
} as const;
export type V3 = [number, number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a: V3, b: V3, scale = 1): V3 => [
  a[0] + b[0] * scale,
  a[1] + b[1] * scale,
  a[2] + b[2] * scale,
];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length3 = (a: V3) => Math.sqrt(dot(a, a));
export function freefallRadius(start: number, properTime: number) {
  return Math.pow(Math.max(0, Math.pow(start, 1.5) - 1.5 * properTime), 2 / 3);
}
export function remainingProperTime(radius: number) {
  return (2 / 3) * Math.pow(Math.max(0, radius), 1.5);
}
/** Future radial null slopes in ingoing Painlevé–Gullstrand coordinates. */
export function radialLightSlopes(radius: number) {
  const flow = Math.sqrt(1 / radius);
  return { inward: -1 - flow, outward: 1 - flow };
}
/** Local geodesic-deviation eigenvalues, units c²/r_s², per unit separation. */
export function tidalEigenvalues(radius: number): V3 {
  const radial = 1 / radius ** 3;
  return [radial, -radial / 2, -radial / 2];
}
export type NullRay = { p: V3; v: V3; energy: number; angular: V3; l2: number };
/** Past-directed photon with unit frequency in the E=1 radial infaller's frame.
 * PG tetrad u=(1,-sqrt(1/r),0,0), e_r=(0,1,0,0): k=-u+n^i e_i.
 * The conserved Killing energy is negative for rays arriving from our infinity.
 */
export function infallerRay(radius: number, outward: V3, sight: V3): NullRay {
  const p = outward.map((x) => x * radius) as V3;
  const flow = Math.sqrt(1 / radius);
  const v = add(sight, outward, flow);
  const angular = cross(p, v);
  return {
    p,
    v,
    energy: -1 - flow * dot(outward, sight),
    angular,
    l2: dot(angular, angular),
  };
}
export function rayInvariant(ray: NullRay) {
  return dot(ray.v, ray.v) - ray.l2 / length3(ray.p) ** 3;
}
function acceleration(p: V3, l2: number): V3 {
  const a = (-1.5 * l2) / Math.max(1e-15, length3(p) ** 5);
  return p.map((x) => x * a) as V3;
}
/** RK4 of the exact pseudo-Cartesian spatial null-geodesic equation:
 * x'' = -(3/2) L² x/r⁵. Affine parameter, not Newtonian time.
 */
export function stepNullRay(ray: NullRay, h: number) {
  const a1 = acceleration(ray.p, ray.l2);
  const v2 = add(ray.v, a1, h / 2),
    p2 = add(ray.p, ray.v, h / 2);
  const a2 = acceleration(p2, ray.l2);
  const v3 = add(ray.v, a2, h / 2),
    p3 = add(ray.p, v2, h / 2);
  const a3 = acceleration(p3, ray.l2);
  const v4 = add(ray.v, a3, h),
    p4 = add(ray.p, v3, h);
  const a4 = acceleration(p4, ray.l2);
  ray.p = add(ray.p, add(add(add(ray.v, v2, 2), v3, 2), v4), h / 6);
  ray.v = add(ray.v, add(add(add(a1, a2, 2), a3, 2), a4), h / 6);
}
export function traceNullRay(
  ray: NullRay,
  step: number = GR.step,
  limit: number = GR.maxSteps,
) {
  let steps = 0;
  while (
    steps < limit &&
    length3(ray.p) > GR.rayCutoff &&
    length3(ray.p) < GR.skyRadius
  ) {
    const r = length3(ray.p);
    const h =
      (step * r) /
      Math.max(0.2, length3(ray.v), 2 * Math.sqrt(ray.l2 / r ** 3));
    stepNullRay(ray, h);
    steps++;
  }
  return {
    ray,
    steps,
    escaped: length3(ray.p) >= GR.skyRadius && ray.energy < 0,
    captured: length3(ray.p) <= GR.rayCutoff,
  };
}
/** Frequency at observer / frequency in circular Keplerian emitter's frame. */
export function diskFrequencyShift(
  radius: number,
  pastEnergy: number,
  axialAngularMomentum: number,
) {
  const omega = Math.sqrt(0.5 / radius ** 3);
  return (
    Math.sqrt(1 - 1.5 / radius) / (-pastEnergy + omega * axialAngularMomentum)
  );
}
