export type V3 = [number, number, number];
export type Q4 = [number, number, number, number];
export type Pose = { p: V3; q: Q4 };
export const identity = (): Pose => ({ p: [0, 0, 0], q: [0, 0, 0, 1] });
export const add = (a: V3, b: V3): V3 => a.map((v, i) => v + b[i]) as V3;
export const sub = (a: V3, b: V3): V3 => a.map((v, i) => v - b[i]) as V3;
export const scale = (a: V3, s: number): V3 => a.map((v) => v * s) as V3;
export const norm = (a: V3) => Math.hypot(...a);
export const dot = (a: V3, b: V3) => a.reduce((s, v, i) => s + v * b[i], 0);
export const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const conjugate = (q: Q4): Q4 => [-q[0], -q[1], -q[2], q[3]];
export function multiply(a: Q4, b: Q4): Q4 {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}
export function rotate(q: Q4, v: V3): V3 {
  const t = scale(cross([q[0], q[1], q[2]], v), 2);
  return add(v, add(scale(t, q[3]), cross([q[0], q[1], q[2]], t)));
}
export const transform = (p: Pose, v: V3): V3 => add(rotate(p.q, v), p.p);
export const inverse = (p: Pose): Pose => ({
  q: conjugate(p.q),
  p: rotate(conjugate(p.q), scale(p.p, -1)),
});
export const compose = (a: Pose, b: Pose): Pose => ({
  p: transform(a, b.p),
  q: multiply(a.q, b.q),
});
export const rotationAngle = (q: Q4) =>
  2 * Math.acos(Math.min(1, Math.abs(q[3]) / Math.hypot(...q)));

/** Largest algebraic eigenvector of a symmetric matrix. Jacobi avoids power iteration's negative-eigenvalue trap. */
function eigen4(input: number[][]) {
  const a = input.map((row) => [...row]),
    v = Array.from({ length: 4 }, (_, i) =>
      Array.from({ length: 4 }, (_, j) => +(i === j)),
    );
  // The matrix carries the square of the cloud's units, so an absolute threshold stops a
  // millimetre-scale fit on its first sweep and might never be reached by an astronomical one.
  const size = Math.hypot(...input.flat()) || 1;
  for (let n = 0; n < 64; n++) {
    let p = 0,
      q = 1;
    for (let i = 0; i < 4; i++)
      for (let j = i + 1; j < 4; j++)
        if (Math.abs(a[i][j]) > Math.abs(a[p][q])) {
          p = i;
          q = j;
        }
    if (Math.abs(a[p][q]) < 1e-12 * size) break;
    const angle = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]),
      c = Math.cos(angle),
      s = Math.sin(angle);
    const pp = a[p][p],
      qq = a[q][q],
      pq = a[p][q];
    a[p][p] = c * c * pp - 2 * s * c * pq + s * s * qq;
    a[q][q] = s * s * pp + 2 * s * c * pq + c * c * qq;
    a[p][q] = a[q][p] = 0;
    for (let k = 0; k < 4; k++) {
      if (k !== p && k !== q) {
        const kp = a[k][p],
          kq = a[k][q];
        a[k][p] = a[p][k] = c * kp - s * kq;
        a[k][q] = a[q][k] = s * kp + c * kq;
      }
      const vp = v[k][p],
        vq = v[k][q];
      v[k][p] = c * vp - s * vq;
      v[k][q] = s * vp + c * vq;
    }
  }
  const k = a
    .map((r, i) => r[i])
    .reduce((best, x, i) => (x > a[best][best] ? i : best), 0);
  return v.map((row) => row[k]);
}

/** Metric, reflection-free rigid alignment. No scale fitting. Maps source into target. */
export function rigidFit(source: V3[], target: V3[]): Pose | null {
  if (source.length !== target.length || source.length < 3) return null;
  const center = (points: V3[]) =>
    scale(
      points.reduce((a, p) => add(a, p), [0, 0, 0] as V3),
      1 / points.length,
    );
  const a = center(source),
    b = center(target),
    H = Array.from({ length: 3 }, () => [0, 0, 0]);
  let spread = 0,
    area = 0,
    targetSpread = 0,
    targetArea = 0;
  const axis = source
    .map((p) => sub(p, a))
    .reduce((s, p) => (dot(p, p) > dot(s, s) ? p : s), [0, 0, 0] as V3);
  const targetAxis = target
    .map((p) => sub(p, b))
    .reduce((s, p) => (dot(p, p) > dot(s, s) ? p : s), [0, 0, 0] as V3);
  for (let k = 0; k < source.length; k++) {
    const s = sub(source[k], a),
      t = sub(target[k], b);
    spread += dot(s, s);
    area += norm(cross(axis, s));
    targetSpread += dot(t, t);
    targetArea += norm(cross(targetAxis, t));
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) H[i][j] += s[i] * t[j];
  }
  if (
    spread < 1e-10 ||
    targetSpread < 1e-10 ||
    area < 1e-9 ||
    targetArea < 1e-9
  )
    return null;
  const [[xx, xy, xz], [yx, yy, yz], [zx, zy, zz]] = H;
  const e = eigen4([
    [xx + yy + zz, yz - zy, zx - xz, xy - yx],
    [yz - zy, xx - yy - zz, xy + yx, zx + xz],
    [zx - xz, xy + yx, -xx + yy - zz, yz + zy],
    [xy - yx, zx + xz, yz + zy, -xx - yy + zz],
  ]);
  const q: Q4 = [e[1], e[2], e[3], e[0]];
  return { q, p: sub(b, rotate(q, a)) };
}

export function robustFit(source: V3[], target: V3[], seed = 31) {
  const n = source.length;
  let best: number[] = [],
    bestError = Infinity;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 90 && n >= 8; i++) {
    const ids = new Set<number>();
    while (ids.size < 3) ids.add(Math.floor(random() * n));
    const s = [...ids],
      pose = rigidFit(
        s.map((k) => source[k]),
        s.map((k) => target[k]),
      );
    if (!pose) continue;
    const inliers: number[] = [];
    let error = 0;
    for (let k = 0; k < n; k++) {
      const e = norm(sub(transform(pose, source[k]), target[k]));
      if (e < 0.045 + 0.009 * source[k][2]) {
        inliers.push(k);
        error += e;
      }
    }
    if (
      inliers.length > best.length ||
      (inliers.length === best.length && error < bestError)
    ) {
      best = inliers;
      bestError = error;
    }
  }
  const pose =
    best.length >= 8
      ? rigidFit(
          best.map((k) => source[k]),
          best.map((k) => target[k]),
        )
      : null;
  return {
    pose,
    inliers: best,
    error: best.length ? bestError / best.length : Infinity,
  };
}
