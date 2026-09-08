import * as T from "three/webgpu";
import { SensorRig, type Capture } from "./rig";
import { evaluateTrajectory } from "./metrics";
import { compose, inverse, rotationAngle, type Pose, type V3 } from "./math";
import type { Analysis, Condition, RecordPair, TruthRecord } from "./types";
import type { RecordedCapture } from "./dataset";
export class PerceptionRuntime {
  readonly rig: SensorRig;
  analysis?: Analysis;
  capture?: Capture;
  enabled = false;
  lab = false;
  busy = false;
  dropped = 0;
  error = "";
  ready = false;
  records: RecordPair[] = [];
  private worker: Worker;
  private due = 0;
  private pendingTruth?: TruthRecord;
  private pendingCapture?: Capture;
  private disposed = false;
  private before?: TruthRecord;
  private generation = 0;
  recording = false;
  readonly sequence: RecordedCapture[] = [];
  onAnalysis?: (a: Analysis) => void;
  frequency = innerWidth < 700 ? 4 : 8;
  constructor(
    private renderer: T.WebGPURenderer,
    scene: T.Scene,
  ) {
    this.rig = new SensorRig(renderer, scene);
    this.worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.onmessage = (event: MessageEvent) => {
      if (event.data.type === "error") {
        this.error = event.data.message;
        this.busy = false;
        return;
      }
      const a = event.data.result as Analysis;
      if (this.disposed || !this.pendingTruth || a.id !== this.pendingTruth.id)
        return;
      this.analysis = a;
      this.busy = false;
      if (this.lab) {
        const pair = { truth: this.pendingTruth, estimate: a.vo };
        this.records.push(pair);
        if (this.records.length > 3600) this.records.shift();
        if (this.pendingCapture?.frame.id === a.id) {
          this.capture = this.pendingCapture;
          if (this.recording) {
            this.sequence.push({
              ...pair,
              frame: this.capture.frame,
              normals: this.capture.normals,
              labels: this.capture.labels,
            });
            if (this.sequence.length >= 32) this.recording = false;
          }
        }
      }
      this.onAnalysis?.(a);
      this.pendingTruth = undefined;
      this.pendingCapture = undefined;
    };
    this.worker.onerror = (e) => {
      this.error = e.message;
      this.busy = false;
    };
  }
  async prepare(
    observer: T.Vector3,
    position: T.Vector3,
    quaternion: T.Quaternion,
  ) {
    this.rig.sync(observer, position, quaternion);
    await this.rig.prepare();
    this.ready = true;
  }
  setCondition(condition: Condition) {
    if (this.rig.condition === condition) return;
    this.rig.condition = condition;
    this.reset();
  }
  reset() {
    this.generation++;
    this.worker.postMessage({ type: "reset" });
    this.analysis = undefined;
    this.capture = undefined;
    this.before = undefined;
    this.pendingTruth = undefined;
    this.pendingCapture = undefined;
    this.records = [];
    this.recording = false;
    this.sequence.length = 0;
    this.busy = false;
    this.due = 0;
  }
  recordSequence() {
    if (!this.lab) return;
    this.sequence.length = 0;
    this.recording = true;
  }
  tick(
    time: number,
    observer: T.Vector3,
    position: T.Vector3,
    quaternion: T.Quaternion,
    velocity: T.Vector3,
    gravityUp: T.Vector3,
  ) {
    if (!this.enabled || !this.ready || this.disposed || time < this.due)
      return;
    this.due = time + 1 / this.frequency;
    if (this.busy) {
      this.dropped++;
      return;
    }
    this.busy = true;
    const generation = this.generation;
    this.rig.sync(observer, position, quaternion);
    const camPosition = this.rig.camera.position.clone().add(observer),
      q = this.rig.camera.quaternion
        .clone()
        .multiply(new T.Quaternion(1, 0, 0, 0));
    const pose: Pose = {
      p: camPosition.toArray() as V3,
      q: q.toArray() as Pose["q"],
    };
    const dt = this.before ? time - this.before.timestamp : 0.2,
      previousVelocity = this.before?.velocity ?? (velocity.toArray() as V3);
    const sensorVelocity = this.before
      ? camPosition
          .clone()
          .sub(new T.Vector3(...this.before.pose.p))
          .divideScalar(Math.max(0.001, dt))
      : velocity.clone();
    const acceleration = sensorVelocity
      .clone()
      .sub(new T.Vector3(...previousVelocity))
      .divideScalar(Math.max(0.001, dt))
      .addScaledVector(gravityUp, 9.81)
      .applyQuaternion(q.clone().invert());
    let dq = this.before
      ? compose(inverse(this.before.pose), pose).q
      : [0, 0, 0, 1];
    if (dq[3] < 0) dq = dq.map((v) => -v);
    const angle = rotationAngle(dq as Pose["q"]),
      length = Math.hypot(dq[0], dq[1], dq[2]);
    const gyro: V3 =
      length > 1e-8
        ? [
            (dq[0] * angle) / length / dt,
            (dq[1] * angle) / length / dt,
            (dq[2] * angle) / length / dt,
          ]
        : [0, 0, 0];
    void this.rig
      .capture(time)
      .then((capture) => {
        if (this.disposed || generation !== this.generation) {
          return;
        }
        const truth: TruthRecord = {
          id: capture.frame.id,
          timestamp: time,
          pose,
          velocity: sensorVelocity.toArray() as V3,
          imu: { acceleration: acceleration.toArray() as V3, gyro },
          condition: capture.frame.condition,
        };
        this.pendingTruth = truth;
        this.before = truth;
        if (this.lab)
          this.pendingCapture = {
            ...capture,
            frame: {
              ...capture.frame,
              rgb: capture.frame.rgb.slice(),
              depth: capture.frame.depth.slice(),
            },
          };
        this.worker.postMessage({ type: "frame", frame: capture.frame }, [
          capture.frame.rgb.buffer,
          capture.frame.depth.buffer,
        ]);
      })
      .catch((e) => {
        if (generation === this.generation) {
          this.error = e instanceof Error ? e.message : String(e);
          this.busy = false;
        }
      });
  }
  snapshot() {
    return {
      recording: this.recording,
      recordedFrames: this.sequence.length,
      calibration: this.rig.calibration,
      frequency: this.frequency,
      ready: this.ready,
      enabled: this.enabled,
      busy: this.busy,
      captures: this.rig.frames,
      dropped: this.dropped,
      error: this.error,
      condition: this.rig.condition,
      analysisMs: this.analysis?.ms ?? 0,
      status: this.analysis?.vo.status ?? "STARTING",
      features: this.analysis?.vo.features ?? 0,
      inliers: this.analysis?.vo.inliers ?? 0,
      ratio: this.analysis?.vo.ratio ?? 0,
      mapCells: this.analysis?.coverage ?? 0,
      points: this.analysis?.points ?? 0,
      route: this.analysis?.chosen ?? null,
      segment: this.analysis?.vo.segment ?? 0,
      pose: this.analysis?.vo.pose ?? null,
      readbackMs: this.capture?.readbackMs ?? null,
    };
  }
  export() {
    return {
      version: "VASTNESS 3.0",
      model:
        "RGB-D Shi–Tomasi / pyramidal LK / RANSAC / Horn baseline — no loop closure",
      seed: this.rig.seed,
      sensor: {
        ...this.rig.k,
        frequency: this.frequency,
        pitch: 0.22,
        extrinsics: {
          translation: [0, 1.2, -0.8],
          pitchDown: 0.22,
          convention:
            "body x right, y up, z backward; camera x right, y down, z forward",
        },
        depth: "axial z; 0 invalid",
        rgb: "opaque calibrated appearance, no artistic post-processing",
        imu: "sensor-rate finite differences; ideal gravity, no bias or noise model",
      },
      condition: this.rig.condition,
      dropped: this.dropped,
      evaluation: evaluateTrajectory(this.records),
      records: this.records,
    };
  }
  dispose() {
    this.disposed = true;
    this.worker.terminate();
    this.rig.dispose();
  }
}
