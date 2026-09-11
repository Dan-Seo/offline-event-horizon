import {
  compose,
  identity,
  inverse,
  robustFit,
  norm,
  rotationAngle,
  type V3,
} from "./math.ts";
import type { Feature, SensorImage, Track, VOResult } from "./types.ts";
const gray = (f: SensorImage) => {
  const g = new Float32Array(f.k.width * f.k.height);
  for (let i = 0; i < g.length; i++)
    g[i] =
      0.299 * f.rgb[i * 4] +
      0.587 * f.rgb[i * 4 + 1] +
      0.114 * f.rgb[i * 4 + 2];
  return g;
};
/** Bilinear read of the cell at (ix, iy), which also touches ix + 1 and iy + 1. Callers keep
 *  their windows inside the image; the clamp is a last line of defence and is the identity for
 *  every in-frame read, so no in-bounds result moves by a bit. */
function sample(a: Float32Array, w: number, x: number, y: number) {
  const ix = Math.min(w - 2, Math.max(0, Math.floor(x))),
    iy = Math.max(0, Math.floor(y)),
    u = x - ix,
    v = y - iy,
    k = Math.min(a.length - w - 2, iy * w + ix);
  return (
    (a[k] * (1 - u) + a[k + 1] * u) * (1 - v) +
    (a[k + w] * (1 - u) + a[k + w + 1] * u) * v
  );
}
function corners(g: Float32Array, w: number, h: number, depth: Float32Array) {
  const choices: Feature[] = [];
  for (let y = 9; y < h - 9; y += 2)
    for (let x = 9; x < w - 9; x += 2) {
      const d = depth[y * w + x];
      if (!(d > 0.1)) continue;
      const neighboring = [
        depth[(y - 1) * w + x - 1],
        depth[(y - 1) * w + x + 1],
        depth[(y + 1) * w + x - 1],
        depth[(y + 1) * w + x + 1],
      ];
      if (neighboring.some((v) => !(v > 0.1) || v > d * 1.2 || v < d / 1.2))
        continue;
      let xx = 0,
        xy = 0,
        yy = 0;
      for (let v = -1; v <= 1; v++)
        for (let u = -1; u <= 1; u++) {
          const i = (y + v) * w + x + u,
            dx = (g[i + 1] - g[i - 1]) * 0.5,
            dy = (g[i + w] - g[i - w]) * 0.5;
          xx += dx * dx;
          xy += dx * dy;
          yy += dy * dy;
        }
      const score = 0.5 * (xx + yy - Math.sqrt((xx - yy) ** 2 + 4 * xy * xy));
      if (score > 2.5) choices.push({ x, y, score });
    }
  choices.sort((a, b) => b.score - a.score);
  const result: Feature[] = [],
    quota = new Uint8Array(24);
  for (const p of choices) {
    const bin =
      Math.min(3, Math.floor((p.y / h) * 4)) * 6 +
      Math.min(5, Math.floor((p.x / w) * 6));
    if (
      quota[bin] >= 8 ||
      result.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 5)
    )
      continue;
    result.push(p);
    quota[bin]++;
    if (result.length === 150) break;
  }
  return result;
}
function patch(g: Float32Array, w: number, x: number, y: number) {
  const a: number[] = [];
  let mean = 0;
  for (let v = -3; v <= 3; v++)
    for (let u = -3; u <= 3; u++) {
      const s = sample(g, w, x + u, y + v);
      a.push(s);
      mean += s;
    }
  mean /= 49;
  const std = Math.sqrt(a.reduce((s, v) => s + (v - mean) ** 2, 0) / 49) + 0.01;
  return { values: a.map((v) => (v - mean) / std), std };
}
function error(p: number[], g: Float32Array, w: number, x: number, y: number) {
  const b = patch(g, w, x, y);
  let s = 0;
  for (let i = 0; i < 49; i++) s += (p[i] - b.values[i]) ** 2;
  return s / 49;
}
function down(g: Float32Array, w: number, h: number) {
  const a = new Float32Array((w / 2) * (h / 2));
  for (let y = 0; y < h / 2; y++)
    for (let x = 0; x < w / 2; x++)
      a[(y * w) / 2 + x] =
        (g[2 * y * w + 2 * x] +
          g[2 * y * w + 2 * x + 1] +
          g[(2 * y + 1) * w + 2 * x] +
          g[(2 * y + 1) * w + 2 * x + 1]) *
        0.25;
  return a;
}
type Pyramid = { image: Float32Array; w: number; h: number }[];
function pyramid(g: Float32Array, w: number, h: number): Pyramid {
  if (w % 4 || h % 4)
    throw new Error(
      `Sensor image ${w}x${h} needs a width and height divisible by 4 for the three-level tracking pyramid`,
    );
  const half = down(g, w, h);
  return [
    { image: g, w, h },
    { image: half, w: w / 2, h: h / 2 },
    { image: down(half, w / 2, h / 2), w: w / 4, h: h / 4 },
  ];
}
/** A 7x7 window with central differences reads c - 4 to c + 4, and a bilinear sample of that
 *  takes the cell at floor(c + 4), so a centre inside this margin keeps every base index within
 *  [1, w - 2] x [1, h - 2] and can never read past the end of the level. */
const windowed = (cx: number, cy: number, w: number, h: number) =>
  cx >= 5 && cy >= 5 && cx <= w - 6 && cy <= h - 6;
function trackLK(x: number, y: number, a: Pyramid, b: Pyramid) {
  let dx = 0,
    dy = 0;
  for (let level = 2; level >= 0; level--) {
    if (level < 2) {
      dx *= 2;
      dy *= 2;
    }
    const { image: previous, w, h } = a[level],
      current = b[level].image,
      factor = 2 ** level,
      px = (x + 0.5) / factor - 0.5,
      py = (y + 0.5) / factor - 0.5;
    if (!windowed(px, py, w, h)) continue;
    for (let iteration = 0; iteration < 18; iteration++) {
      const cx = px + dx,
        cy = py + dy;
      if (!windowed(cx, cy, w, h)) return null;
      let xx = 0,
        xy = 0,
        yy = 0,
        bx = 0,
        by = 0;
      for (let v = -3; v <= 3; v++)
        for (let u = -3; u <= 3; u++) {
          const gx =
              (sample(current, w, cx + u + 1, cy + v) -
                sample(current, w, cx + u - 1, cy + v)) *
              0.5,
            gy =
              (sample(current, w, cx + u, cy + v + 1) -
                sample(current, w, cx + u, cy + v - 1)) *
              0.5;
          const e =
            sample(previous, w, px + u, py + v) -
            sample(current, w, cx + u, cy + v);
          xx += gx * gx;
          xy += gx * gy;
          yy += gy * gy;
          bx += gx * e;
          by += gy * e;
        }
      const determinant = xx * yy - xy * xy;
      if (determinant < 0.001) break;
      const sx = Math.max(
          -2.5,
          Math.min(2.5, (yy * bx - xy * by) / determinant),
        ),
        sy = Math.max(-2.5, Math.min(2.5, (xx * by - xy * bx) / determinant));
      dx += sx;
      dy += sy;
      if (Math.hypot(sx, sy) < 0.015) break;
    }
  }
  const u = x + dx,
    v = y + dy;
  if (!windowed(u, v, a[0].w, a[0].h) || !Number.isFinite(u + v)) return null;
  return { x: u, y: v };
}
function match(p: Feature, a: Pyramid, b: Pyramid) {
  const original = patch(a[0].image, a[0].w, p.x, p.y);
  if (original.std < 2) return null;
  const forward = trackLK(p.x, p.y, a, b);
  if (!forward) return null;
  if (error(original.values, b[0].image, b[0].w, forward.x, forward.y) > 0.55)
    return null;
  const back = trackLK(forward.x, forward.y, b, a);
  if (!back || Math.hypot(back.x - p.x, back.y - p.y) > 0.9) return null;
  return forward;
}
function unproject(f: SensorImage, x: number, y: number): V3 | null {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    u = x - ix,
    v = y - iy,
    i = iy * f.k.width + ix;
  const values = [
    f.depth[i],
    f.depth[i + 1],
    f.depth[i + f.k.width],
    f.depth[i + f.k.width + 1],
  ];
  if (
    values.some((d) => !(d > 0.05 && d < f.k.far)) ||
    Math.max(...values) > Math.min(...values) * 1.25
  )
    return null;
  // Inverse depth is affine on a planar surface in a pinhole image. Do not round subpixel tracks.
  const d =
    1 /
    (((1 - u) * (1 - v)) / values[0] +
      (u * (1 - v)) / values[1] +
      ((1 - u) * v) / values[2] +
      (u * v) / values[3]);
  return [((x - f.k.cx) * d) / f.k.fx, ((y - f.k.cy) * d) / f.k.fy, d];
}
export class RGBDOdometry {
  private previous?: SensorImage;
  private image?: Float32Array;
  private features: Feature[] = [];
  private pose = identity();
  private segment = 0;
  private lost = false;
  reset() {
    this.previous = undefined;
    this.image = undefined;
    this.pose = identity();
    this.features = [];
    this.segment = 0;
    this.lost = false;
  }
  update(frame: SensorImage): VOResult {
    const image = gray(frame),
      { width: w, height: h } = frame.k,
      nextFeatures = corners(image, w, h, frame.depth);
    const result: VOResult = {
      pose: this.pose,
      delta: null,
      status: "STARTING",
      segment: this.segment,
      features: nextFeatures.length,
      matched: 0,
      inliers: 0,
      ratio: 0,
      residual: null,
      tracks: [],
    };
    if (this.previous && this.image) {
      const ac = pyramid(this.image, w, h),
        bc = pyramid(image, w, h),
        source: V3[] = [],
        target: V3[] = [],
        tracks: Track[] = [];
      for (const f of this.features) {
        const p = unproject(this.previous, f.x, f.y);
        if (!p) continue;
        const m = match(f, ac, bc);
        if (!m) continue;
        const q = unproject(frame, m.x, m.y);
        if (!q) continue;
        if (tracks.some((t) => Math.hypot(t.u - m.x, t.v - m.y) < 2)) continue;
        source.push(p);
        target.push(q);
        tracks.push({ x: f.x, y: f.y, u: m.x, v: m.y, inlier: false });
      }
      const fit = robustFit(source, target, frame.id + 31),
        deltaT = frame.timestamp - this.previous.timestamp;
      result.matched = source.length;
      result.inliers = fit.inliers.length;
      result.ratio = fit.inliers.length / Math.max(1, source.length);
      result.tracks = tracks;
      if (
        fit.pose &&
        result.ratio >= 0.4 &&
        norm(fit.pose.p) < Math.max(2, deltaT * 100) &&
        rotationAngle(fit.pose.q) < 0.6 &&
        deltaT < 1
      ) {
        if (this.lost) {
          this.segment++;
          this.pose = identity();
          this.lost = false;
          result.segment = this.segment;
        }
        this.pose = compose(this.pose, inverse(fit.pose));
        result.pose = this.pose;
        result.delta = fit.pose;
        result.status = "TRACKING";
        result.residual = fit.error;
        fit.inliers.forEach((i) => (tracks[i].inlier = true));
      } else {
        result.status = "LOST";
        this.lost = true;
      }
    }
    this.previous = frame;
    this.image = image;
    this.features = nextFeatures;
    return result;
  }
}
