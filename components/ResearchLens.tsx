"use client";
import { useEffect, useRef, useState } from "react";
import type { UniverseEngine } from "@/universe/engine";
import { evaluateTrajectory } from "@/universe/perception/metrics";
import type { Condition } from "@/universe/perception/types";
import { copy, type Language } from "@/universe/language";
import { compose, inverse } from "@/universe/perception/math";
const conditions: Condition[] = [
  "CLEAR",
  "FOG",
  "LOW_LIGHT",
  "REPETITIVE",
  "REFLECTIVE_WATER",
  "DYNAMIC",
  "FAST_MOTION",
  "RAIN",
];
export default function ResearchLens({
  engine,
  language,
}: {
  engine: UniverseEngine;
  language: Language;
}) {
  const rgb = useRef<HTMLCanvasElement>(null),
    depth = useRef<HTMLCanvasElement>(null),
    normal = useRef<HTMLCanvasElement>(null),
    labels = useRef<HTMLCanvasElement>(null),
    map = useRef<HTMLCanvasElement>(null),
    plot = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState(engine.pilgrim?.perception?.snapshot()),
    [metric, setMetric] = useState<ReturnType<
      typeof evaluateTrajectory
    > | null>(null),
    [condition, setCondition] = useState<Condition>("CLEAR"),
    [tab, setTab] = useState<"sensors" | "evaluation">("sensors");
  const text = copy[language];
  useEffect(() => {
    const draw = () => {
      const p = engine.pilgrim?.perception;
      if (!p) return;
      setState(p.snapshot());
      const evaluation = evaluateTrajectory(p.records);
      setMetric(evaluation);
      const capture = p.capture;
      if (capture) {
        const { width: w, height: h } = capture.frame.k;
        for (const [ref, kind] of [
          [rgb, "rgb"],
          [depth, "depth"],
          [normal, "normal"],
          [labels, "labels"],
        ] as const) {
          const canvas = ref.current;
          if (!canvas) continue;
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d")!,
            pixels = ctx.createImageData(w, h);
          for (let i = 0; i < w * h; i++) {
            const palette = [
              [0, 0, 0],
              [108, 143, 93],
              [75, 122, 166],
              [151, 187, 98],
              [161, 147, 122],
              [211, 183, 113],
              [163, 215, 228],
              [213, 156, 179],
            ][capture.labels[i]] ?? [0, 0, 0];
            const d = capture.frame.depth[i],
              l = d ? Math.min(1, Math.log1p(d) / Math.log(180)) : 0;
            for (let c = 0; c < 3; c++)
              pixels.data[i * 4 + c] =
                kind === "rgb"
                  ? capture.frame.rgb[i * 4 + c]
                  : kind === "labels"
                    ? palette[c]
                    : kind === "normal"
                      ? (capture.normals[i * 3 + c] * 0.5 + 0.5) * 255
                      : d
                        ? [35 + 180 * l, 170 - 100 * l, 210 - 145 * l][c]
                        : 0;
            pixels.data[i * 4 + 3] = 255;
          }
          ctx.putImageData(pixels, 0, 0);
          if (kind === "rgb" && p.analysis) {
            ctx.lineWidth = 0.65;
            for (const t of p.analysis.vo.tracks) {
              ctx.strokeStyle = t.inlier ? "#e8d69b" : "#cd6666";
              ctx.beginPath();
              ctx.moveTo(t.x, t.y);
              ctx.lineTo(t.u, t.v);
              ctx.stroke();
              ctx.fillStyle = ctx.strokeStyle;
              ctx.fillRect(t.u - 1, t.v - 1, 2, 2);
            }
          }
        }
      }
      if (map.current && p.analysis) {
        const ctx = map.current.getContext("2d")!,
          w = map.current.width,
          h = map.current.height;
        ctx.fillStyle = "#091419";
        ctx.fillRect(0, 0, w, h);
        for (const c of p.analysis.cells) {
          ctx.fillStyle =
            c.span > 3.4
              ? "#97645b"
              : `rgb(${55 + c.green * 75},${93 + c.green * 80},${103 + c.blue * 70})`;
          ctx.fillRect(w / 2 + c.x * 2, h - c.z * 2, 3, 3);
        }
        for (const r of p.analysis.routes) {
          ctx.strokeStyle =
            r === p.analysis.chosen
              ? "#f2d49e"
              : r.safe
                ? "#8dc2bc45"
                : "#b7716440";
          ctx.lineWidth = r === p.analysis.chosen ? 2 : 1;
          ctx.beginPath();
          ctx.moveTo(w / 2, h);
          r.points.forEach((v) => ctx.lineTo(w / 2 + v[0] * 2, h - v[2] * 2));
          ctx.stroke();
        }
      }
      if (plot.current && p.records.length > 1) {
        const ctx = plot.current.getContext("2d")!,
          w = plot.current.width,
          h = plot.current.height;
        ctx.clearRect(0, 0, w, h);
        const segment = p.records.at(-1)!.estimate.segment,
          records = p.records
            .filter(
              (r) =>
                r.estimate.segment === segment &&
                r.estimate.status === "TRACKING",
            )
            .slice(-700);
        if (!records.length) return;
        const origin = records[0],
          truth = records.map(
            (r) => compose(inverse(origin.truth.pose), r.truth.pose).p,
          ),
          estimated = records.map(
            (r) => compose(inverse(origin.estimate.pose), r.estimate.pose).p,
          );
        const extent = Math.max(
            10,
            ...truth.flatMap((v) => [Math.abs(v[0]), Math.abs(v[2])]),
            ...estimated.flatMap((v) => [Math.abs(v[0]), Math.abs(v[2])]),
          ),
          s = (Math.min(w, h) * 0.42) / extent;
        ctx.strokeStyle = "#88c7c6";
        ctx.beginPath();
        truth.forEach((v, i) =>
          i
            ? ctx.lineTo(w / 2 + v[0] * s, h / 2 + v[2] * s)
            : ctx.moveTo(w / 2 + v[0] * s, h / 2 + v[2] * s),
        );
        ctx.stroke();
        // Evaluation-only first-pose alignment. Neither this transform nor truth enters VO.
        ctx.strokeStyle = "#d9be83";
        ctx.beginPath();
        estimated.forEach((v, i) =>
          i
            ? ctx.lineTo(w / 2 + v[0] * s, h / 2 + v[2] * s)
            : ctx.moveTo(w / 2 + v[0] * s, h / 2 + v[2] * s),
        );
        ctx.stroke();
      }
    };
    draw();
    const timer = setInterval(draw, 500);
    return () => clearInterval(timer);
  }, [engine, tab]);
  const download = () => {
    const p = engine.pilgrim?.perception;
    if (!p) return;
    const c = p.capture;
    const data = {
      ...p.export(),
      lastCapture: c
        ? {
            id: c.frame.id,
            timestamp: c.frame.timestamp,
            rgb: Array.from(c.frame.rgb),
            depth: Array.from(c.frame.depth),
            normals: Array.from(c.normals),
            semanticIds: Array.from(c.labels),
            sparseOpticalFlow: p.analysis?.vo.tracks,
          }
        : null,
    };
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(data)], { type: "application/json" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = `vastness-pilgrim-${condition.toLowerCase()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const last = metric?.segments.at(-1),
    number = (n: number | null | undefined, digits = 3) =>
      n == null ? "—" : n.toFixed(digits);
  const downloadSequence = async () => {
    const p = engine.pilgrim?.perception;
    if (!p || p.sequence.length < 2) return;
    const { encodeDataset } = await import("@/universe/perception/dataset");
    const { records: _records, ...metadata } = p.export();
    const bytes = encodeDataset(p.sequence, metadata),
      url = URL.createObjectURL(
        new Blob([bytes as Uint8Array<ArrayBuffer>], {
          type: "application/x-tar",
        }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = `vastness-rgbd-${condition.toLowerCase()}.tar`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <aside className="research-lens" aria-label="Research Lens">
      <div className="lab-heading">
        <span>VASTNESS / 03</span>
        <a href="/">{text.returnWorld} ↗</a>
      </div>
      <h1>Research Lens</h1>
      <p className="lab-lead">{text.lensLead}</p>
      <p className="lab-boundary">RGB-D baseline · {text.lensBoundary}</p>
      <div className="lab-run-controls">
        <button onClick={() => engine.action("carry")}>{text.carry}</button>
        <button onClick={() => engine.action("rest")}>{text.rest}</button>
        <button onClick={() => engine.resetLab(condition)}>
          {text.resetRun}
        </button>
      </div>
      <label className="lab-condition">
        {text.sensorCondition}
        <select
          aria-label={text.sensorCondition}
          value={condition}
          onChange={(e) => {
            const c = e.target.value as Condition;
            setCondition(c);
            engine.pilgrim?.perception?.setCondition(c);
          }}
        >
          {conditions.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <div className="lab-status" data-tracking={state?.status}>
        <b>{state?.status ?? "PREPARING"}</b>
        <span>
          {engine.state.backend} · 192 × 128 · ≤ {state?.frequency ?? 8} Hz
        </span>
      </div>
      <div className="lab-tabs">
        <button
          aria-pressed={tab === "sensors"}
          onClick={() => setTab("sensors")}
        >
          SENSORS + PLANNER
        </button>
        <button
          aria-pressed={tab === "evaluation"}
          onClick={() => setTab("evaluation")}
        >
          ESTIMATE + TRUTH
        </button>
      </div>
      {tab === "sensors" ? (
        <>
          <div className="sensor-grid">
            <figure>
              <canvas ref={rgb} />
              <figcaption>RGB · measured sparse flow</figcaption>
            </figure>
            <figure>
              <canvas ref={depth} />
              <figcaption>DEPTH · axial, 0 = invalid</figcaption>
            </figure>
            <figure>
              <canvas ref={normal} />
              <figcaption>TRUTH · view normals</figcaption>
            </figure>
            <figure>
              <canvas ref={labels} />
              <figcaption>TRUTH · semantic IDs</figcaption>
            </figure>
          </div>
          <figure className="map-view">
            <canvas ref={map} width={340} height={160} />
            <figcaption>
              PLANNER · observed local geometry / candidate routes
            </figcaption>
          </figure>
          <p className="lab-caption">{text.sensorTruth}</p>
        </>
      ) : (
        <>
          <figure className="trajectory-view">
            <canvas ref={plot} width={340} height={180} />
            <figcaption>
              <span className="truth-key">GROUND TRUTH</span>
              <span className="estimate-key">
                ESTIMATE · first-pose alignment
              </span>
            </figcaption>
          </figure>
          <div className="lab-metrics">
            <div>
              <small>ATE / units</small>
              <b>{number(last?.ate)}</b>
            </div>
            <div>
              <small>RPE / 1 second</small>
              <b>{number(last?.rpeTranslation)}</b>
            </div>
            <div>
              <small>RPE rotation / °</small>
              <b>
                {number(
                  last?.rpeRotation == null
                    ? null
                    : (last.rpeRotation * 180) / Math.PI,
                  2,
                )}
              </b>
            </div>
            <div>
              <small>TRACKING COVERAGE</small>
              <b>{number((metric?.trackingFraction ?? 0) * 100, 1)}%</b>
            </div>
          </div>
          <p className="lab-caption">
            {last?.alignment ?? "Waiting for enough motion."} ·{" "}
            {last?.rpePairs ?? 0} relative pairs. The plot shows the latest
            segment in each trajectory’s first camera frame, with no scale fit.
            Numerical ATE uses all segment poses. Losses are never bridged.
          </p>
        </>
      )}
      <dl className="lab-stats">
        <div>
          <dt>Features / inliers</dt>
          <dd>
            {state?.features ?? 0} / {state?.inliers ?? 0}
          </dd>
        </div>
        <div>
          <dt>Inlier ratio</dt>
          <dd>{number((state?.ratio ?? 0) * 100, 0)}%</dd>
        </div>
        <div>
          <dt>Local cells / points</dt>
          <dd>
            {state?.mapCells ?? 0} / {state?.points ?? 0}
          </dd>
        </div>
        <div>
          <dt>Worker / dropped</dt>
          <dd>
            {number(state?.analysisMs, 0)} ms / {state?.dropped ?? 0}
          </dd>
        </div>
        <div>
          <dt>Capture / segment</dt>
          <dd>
            {state?.captures ?? 0} / {state?.segment ?? 0}
          </dd>
        </div>
      </dl>
      {state?.error && (
        <p role="alert" className="lab-error">
          {state.error}
        </p>
      )}
      <button className="lab-export" onClick={download}>
        {text.lensExport} ↓
      </button>
      <div className="lab-run-controls lab-recording">
        <button
          disabled={state?.recording || !state?.ready}
          onClick={() => engine.pilgrim?.perception?.recordSequence()}
        >
          {state?.recording ? `${state.recordedFrames} / 32` : text.recordFrames}
        </button>
        <button
          disabled={state?.recording || (state?.recordedFrames ?? 0) < 2}
          onClick={() => void downloadSequence()}
        >
          {text.downloadSequence}
        </button>
      </div>
      <p className="lab-caption">{text.recordingNote}</p>
      <details>
        <summary>{text.modelBoundaries}</summary>
        <p>
          Calibrated opaque RGB uses the artwork’s geometry with simplified
          appearance. Artistic fog, bloom and transparent foliage are excluded.
          Depth is ideal unless a chosen condition corrupts it. RAIN and DYNAMIC
          are image-space stressors. Synthetic IMU uses sensor-rate
          pose/velocity differences, not a hardware sensor model. Semantic IDs
          and normals are evaluation truth. Local mapping fuses only consecutive
          valid estimates; loss clears map history. Contact recovery uses
          privileged geometry. No global SLAM, loop closure or absolute
          relocalization.
        </p>
        <a
          href="https://github.com/Dan-Seo/offline-event-horizon/blob/main/docs/PILGRIM.md"
          target="_blank"
          rel="noreferrer"
        >
          Model, equations & evaluation ↗
        </a>
      </details>
    </aside>
  );
}
