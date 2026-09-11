import {
  compose,
  inverse,
  norm,
  rigidFit,
  rotationAngle,
  sub,
  transform,
  dot,
  scale,
  type V3,
} from "./math.ts";
import type { RecordPair } from "./types.ts";
const rms = (v: number[]) =>
  v.length ? Math.sqrt(v.reduce((s, x) => s + x * x, 0) / v.length) : null;
// A nearly straight/stationary path cannot constrain a reliable rotational alignment.
// Keep its RPE, but do not report an arbitrary ATE fit as a well-conditioned result.
const hasArea = (points: V3[]) => {
  if (points.length < 3) return false;
  const centered = points.map((p) => sub(p, points[0]));
  const axis = centered.reduce((a, p) => (dot(p, p) > dot(a, a) ? p : a), [
    0, 0, 0,
  ] as V3);
  const length = norm(axis);
  if (length < 0.01) return false;
  const direction = scale(axis, 1 / length);
  const energy = centered.reduce((s, p) => s + dot(p, p), 0);
  const transverse = centered.reduce(
    (s, p) => s + Math.max(0, dot(p, p) - dot(p, direction) ** 2),
    0,
  );
  return transverse / Math.max(1e-12, energy) > 0.0005;
};
export function evaluateTrajectory(records: RecordPair[], interval = 1) {
  const tracked = records.filter((r) => r.estimate.status === "TRACKING");
  const segments = [...new Set(tracked.map((r) => r.estimate.segment))].map(
    (segment) => {
      const pairs = tracked.filter((r) => r.estimate.segment === segment);
      const estimated = pairs.map((p) => p.estimate.pose.p),
        truth = pairs.map((p) => p.truth.pose.p);
      const alignment =
        hasArea(estimated) && hasArea(truth)
          ? rigidFit(estimated, truth)
          : null;
      const translation: number[] = [],
        rotation: number[] = [],
        rpeT: number[] = [],
        rpeR: number[] = [];
      let distance = 0,
        // Timestamps never go back inside a segment, so the partner index only moves forward.
        // Carrying it across samples turns the pairing from a quadratic scan into one pass.
        j = 0;
      for (let i = 0; i < pairs.length; i++) {
        const a = pairs[i];
        if (alignment) {
          translation.push(
            norm(sub(transform(alignment, a.estimate.pose.p), a.truth.pose.p)),
          );
          rotation.push(
            rotationAngle(
              compose(
                inverse(a.truth.pose),
                compose(alignment, a.estimate.pose),
              ).q,
            ),
          );
        }
        if (i) distance += norm(sub(a.truth.pose.p, pairs[i - 1].truth.pose.p));
        j = Math.max(j, i + 1);
        while (
          j < pairs.length &&
          pairs[j].truth.timestamp - a.truth.timestamp < interval
        )
          j++;
        if (
          j >= pairs.length ||
          Math.abs(pairs[j].truth.timestamp - a.truth.timestamp - interval) >
            0.26
        )
          continue;
        const b = pairs[j],
          gt = compose(inverse(a.truth.pose), b.truth.pose),
          est = compose(inverse(a.estimate.pose), b.estimate.pose),
          error = compose(inverse(gt), est);
        rpeT.push(norm(error.p));
        rpeR.push(rotationAngle(error.q));
      }
      const first = pairs[0],
        last = pairs[pairs.length - 1];
      const gt = compose(inverse(first.truth.pose), last.truth.pose),
        est = compose(inverse(first.estimate.pose), last.estimate.pose);
      return {
        segment,
        samples: pairs.length,
        distance,
        alignment: alignment
          ? "SE3 least squares, no scale"
          : "stationary / near-collinear — ATE unavailable",
        ate: rms(translation),
        rotation: rms(rotation),
        rpeTranslation: rms(rpeT),
        rpeRotation: rms(rpeR),
        rpePairs: rpeT.length,
        rpeInterval: interval,
        endpointDrift: norm(sub(gt.p, est.p)),
        driftFraction: distance > 1 ? norm(sub(gt.p, est.p)) / distance : null,
      };
    },
  );
  return {
    samples: records.length,
    tracked: tracked.length,
    lost: records.filter((r) => r.estimate.status === "LOST").length,
    trackingFraction: records.length ? tracked.length / records.length : 0,
    segments,
  };
}
