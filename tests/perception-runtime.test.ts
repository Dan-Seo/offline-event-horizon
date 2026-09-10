import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import * as T from "three/webgpu";
import type { Capture } from "../universe/perception/rig.ts";
import type { Analysis, SensorFrame, WorkerRequest, WorkerReply } from "../universe/perception/types.ts";
import { identity } from "../universe/perception/math.ts";
import { ScenicDirector } from "../universe/pilgrim/director.ts";

// Compile the actual runtime for Node, replacing only the GPU rig import.
// No scheduling logic is copied or rewritten; Worker is the mocked transport.
async function loadModule(file: string, mockRig = false) {
  const url = new URL(file, import.meta.url);
  let source = ts.transpileModule(await readFile(url, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  if (mockRig) source = source.replace(/import \{ SensorRig \} from "\.\/rig";/,
    "const SensorRig = globalThis.RuntimeTestRig;");
  source = source.replace(/from "(\.\/[^"]+)"/g,
    (_, name: string) => 'from "' + new URL(name + ".ts", url).href + '"');
  source = source.replaceAll('"three/webgpu"', JSON.stringify(import.meta.resolve("three/webgpu")))
    .replaceAll("import.meta.url", JSON.stringify(url.href));
  return import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
}
const k = { width: 16, height: 16, fx: 12, fy: 12, cx: 8, cy: 8, near: .2, far: 100 };
function analysis(frame: SensorFrame): Analysis {
  return { id: frame.id, timestamp: frame.timestamp, vo: {
    pose: identity(), delta: null, status: "TRACKING", segment: 0,
    features: 20, matched: 20, inliers: 20, ratio: 1, residual: 0, tracks: [],
  }, chosen: { speed: 5, curvature: .02, turn: 0, score: 1, length: 10, safe: true, points: [] },
  cells: [], routes: [], coverage: 1, water: 0, green: 0, sky: 0, ms: 1, points: 1 };
}
class MockRig {
  camera = new T.PerspectiveCamera();
  condition = "CLEAR";
  frames = 0;
  outstanding = 0;
  peak = 0;
  disposed = false;
  throwCapture = false;
  pending: { resolve: () => void; reject: () => void }[] = [];
  sync() {}
  async prepare() {}
  capture(timestamp: number): Promise<Capture> {
    if (this.throwCapture) { this.throwCapture = false; throw new Error("sync capture failure"); }
    const frame: SensorFrame = { id: ++this.frames, timestamp, k, condition: "CLEAR", seed: 1,
      rgb: new Uint8Array(16 * 16 * 4), depth: new Float32Array(16 * 16) };
    this.peak = Math.max(this.peak, ++this.outstanding);
    return new Promise((resolve, reject) => this.pending.push({
      resolve: () => { this.outstanding--; resolve({ frame, normals: new Float32Array(768),
        labels: new Uint8Array(256), camera: this.camera, readbackMs: 1 }); },
      reject: () => { this.outstanding--; reject(new Error("readback failure")); },
    }));
  }
  dispose() { this.disposed = true; }
}
class MockWorker {
  static instances: MockWorker[] = [];
  messages: WorkerRequest[] = [];
  onmessage?: (e: { data: WorkerReply }) => void;
  onerror?: (e: { message: string }) => void;
  onmessageerror?: () => void;
  terminated = false;
  throwPost = false;
  constructor() { MockWorker.instances.push(this); }
  postMessage(message: WorkerRequest) {
    if (this.throwPost) { this.throwPost = false; throw new Error("post failure"); }
    this.messages.push(message);
  }
  terminate() { this.terminated = true; }
  frame() { return this.messages.filter(m => m.type === "frame").at(-1)!; }
  reply(request: Extract<WorkerRequest, { type: "frame" }>, error = false) {
    const { generation, request: id, id: captureId } = request;
    this.onmessage?.({ data: { generation, request: id, id: captureId,
      ...(error ? { type: "error" as const, message: "worker failure" } :
        { type: "analysis" as const, result: analysis(request.frame) }) } });
  }
}
Object.assign(globalThis, { RuntimeTestRig: MockRig, Worker: MockWorker, innerWidth: 1000 });
const { PerceptionRuntime } = await loadModule("../universe/perception/runtime.ts", true) as typeof import("../universe/perception/runtime.ts");
const flush = async () => { await new Promise<void>(resolve => setImmediate(resolve)); };
function setup() {
  const rt = new PerceptionRuntime({} as T.WebGPURenderer, new T.Scene());
  rt.ready = true; rt.enabled = true; rt.lab = true;
  const rig = rt.rig as unknown as MockRig, worker = MockWorker.instances.at(-1)!;
  const tick = (t: number) => rt.tick(t, new T.Vector3(), new T.Vector3(),
    new T.Quaternion(), new T.Vector3(), new T.Vector3(0, 1, 0));
  return { rt, rig, worker, tick };
}
test("reset retains deferred GPU ownership across repeated resets; old capture is discarded", async () => {
  const { rt, rig, worker, tick } = setup();
  tick(0); rt.reset(); tick(.2); rt.reset(); tick(.4);
  assert.equal(rig.frames, 1); assert.equal(rig.peak, 1); assert.equal(rt.busy, true);
  rig.pending.shift()!.resolve(); await flush();
  assert.equal(rt.busy, false); assert.equal(worker.frame(), undefined);
  tick(.6); rig.pending.shift()!.resolve(); await flush();
  rt.recordSequence(); worker.reply(worker.frame());
  assert.equal(rt.busy, false); assert.equal(rt.records.length, 1);
  assert.equal(rt.capture?.frame.id, rt.analysis?.id);
  assert.equal(rt.records[0].truth.timestamp, rt.analysis?.timestamp);
  assert.equal(rt.sequence[0].frame.id, rt.records[0].truth.id);
  assert.equal(rig.peak, 1); rt.dispose();
});
for (const error of [false, true]) test("old " + (error ? "error" : "success") + " settles only its owner", async () => {
  const { rt, rig, worker, tick } = setup();
  let published = 0; rt.onAnalysis = () => published++;
  tick(0); rig.pending.shift()!.resolve(); await flush();
  const old = worker.frame();
  assert.deepEqual(Object.keys(old).sort(), ["frame", "generation", "id", "request", "type"]);
  rt.reset(); tick(.2); assert.equal(rig.frames, 1); assert.equal(rt.busy, true);
  worker.reply(old, error); assert.equal(rt.busy, false); assert.equal(published, 0);
  tick(.4); worker.reply(old); worker.reply(old, true);
  assert.equal(rt.busy, true); tick(.6); assert.equal(rig.frames, 2);
  rig.pending.shift()!.resolve(); await flush();
  const current = worker.frame();
  worker.reply({ ...current, request: old.request });
  worker.reply({ ...current, generation: old.generation }, true);
  worker.reply({ ...current, id: old.id }, true);
  worker.reply(old); worker.reply(old, true);
  assert.equal(rt.busy, true); assert.equal(rt.analysis, undefined); assert.equal(rt.error, "");
  worker.reply(current); worker.reply(current);
  assert.equal(rt.busy, false); assert.equal(published, 1); assert.equal(rt.records.length, 1);
  rt.dispose();
});
test("current worker error, rejected/synchronous capture, and post failure permit recovery", async () => {
  const { rt, rig, worker, tick } = setup();
  tick(0); rig.pending.shift()!.reject(); await flush(); assert.equal(rt.busy, false);
  rig.throwCapture = true; tick(.2); assert.equal(rt.busy, false);
  tick(.4); worker.throwPost = true; rig.pending.shift()!.resolve(); await flush();
  assert.equal(rt.busy, false);
  tick(.6); rig.pending.shift()!.resolve(); await flush(); worker.reply(worker.frame(), true);
  assert.equal(rt.busy, false); assert.equal(rt.records.length, 0);
  tick(.8); rig.pending.shift()!.resolve(); await flush(); worker.reply(worker.frame());
  assert.equal(rt.analysis?.timestamp, .8); assert.equal(rt.records.length, 1); rt.dispose();
});
test("rejected pre-reset capture releases the old owner without publishing an error", async () => {
  const { rt, rig, tick } = setup();
  tick(0); rt.reset(); tick(.2); rig.pending.shift()!.reject(); await flush();
  assert.equal(rt.busy, false); assert.equal(rt.error, "");
  tick(.4); assert.equal(rig.peak, 1); rt.dispose();
  rig.pending.shift()!.resolve(); await flush(); assert.equal(rt.busy, false);
});
for (const readback of [false, true]) test("native worker failure retires transport during " + (readback ? "readback" : "analysis"), async () => {
  const { rt, rig, worker, tick } = setup();
  tick(0);
  if (!readback) { rig.pending.shift()!.resolve(); await flush(); }
  worker.onerror!({ message: "uncaught worker error" });
  assert.equal(worker.terminated, true);
  assert.equal(rt.busy, readback);
  if (readback) { tick(.2); assert.equal(rig.frames, 1); rig.pending.shift()!.resolve(); await flush(); }
  tick(.4); const replacement = MockWorker.instances.at(-1)!;
  worker.onerror!({ message: "late native error" });
  assert.equal(rt.busy, true); assert.equal(replacement.terminated, false);
  rig.pending.shift()!.resolve(); await flush(); replacement.reply(replacement.frame());
  assert.equal(rt.analysis?.timestamp, .4); rt.dispose();
});
test("disabled runtime captures nothing; dispose discards readback and worker results", async () => {
  const { rt, rig, worker, tick } = setup();
  rt.enabled = false; tick(0); assert.equal(rig.frames, 0);
  rt.enabled = true; tick(.2); rt.dispose(); tick(.4);
  rig.pending.shift()!.resolve(); await flush();
  assert.equal(rt.busy, false); assert.equal(worker.frame(), undefined); assert.equal(rt.analysis, undefined);
  const second = setup(); second.tick(0); second.rig.pending.shift()!.resolve(); await flush();
  second.rt.dispose(); second.worker.reply(second.worker.frame());
  assert.equal(second.rt.analysis, undefined); assert.equal(second.rt.busy, false);
});
test("runtime/director integration uses capture clock and immediately invalidates reset views", async () => {
  const { rt, rig, worker, tick } = setup();
  const director = new ScenicDirector(); director.start(0);
  let delivery = 10;
  rt.onAnalysis = a => director.observe(a, delivery);
  rt.onReset = () => director.clearObservation();
  tick(.2); rig.pending.shift()!.resolve(); await flush(); worker.reply(worker.frame());
  assert.equal(director.update(10, .016, false).throttle, 0);
  delivery = 10.2; tick(10.2); rig.pending.shift()!.resolve(); await flush(); worker.reply(worker.frame());
  assert.ok(director.update(10.2, .016, false).throttle > 0);
  rt.reset(); assert.equal(director.update(10.21, .016, false).throttle, 0);
  rt.dispose();
});
test("actual worker success and caught exception echo the complete request identity", async () => {
  const replies: WorkerReply[] = [];
  Object.assign(globalThis, { postMessage: (reply: WorkerReply) => replies.push(reply) });
  await loadModule("../universe/perception/worker.ts");
  const scope = globalThis as unknown as { onmessage: (e: { data: WorkerRequest }) => void };
  const frame: SensorFrame = { id: 7, timestamp: 3, k, condition: "CLEAR", seed: 1,
    rgb: new Uint8Array(1024), depth: new Float32Array(256) };
  const request = { type: "frame" as const, frame, id: 7, generation: 4, request: 9 };
  scope.onmessage({ data: request });
  assert.equal(replies[0].type, "analysis");
  scope.onmessage({ data: { ...request, request: 10, frame: { ...frame, k: undefined! } } });
  assert.equal(replies[1].type, "error");
  for (const [index, reply] of replies.entries()) {
    assert.equal(reply.generation, 4); assert.equal(reply.id, 7); assert.equal(reply.request, 9 + index);
  }
});
test("evaluation IMU derives stationary specific force and known camera acceleration", async () => {
  const { rt, rig, worker, tick } = setup();
  const emit = async (time: number, x: number) => {
    rig.camera.position.set(x, 0, 0);
    tick(time); rig.pending.shift()!.resolve(); await flush();
    const request = worker.frame();
    assert.deepEqual(Object.keys(request).sort(), ["frame", "generation", "id", "request", "type"]);
    assert.equal("imu" in request.frame, false);
    assert.equal("truth" in request.frame, false);
    worker.reply(request);
    return rt.records.at(-1)!.truth;
  };
  const close = (actual: number[], expected: number[]) =>
    actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-10,
      JSON.stringify({ actual, expected })));
  const first = await emit(0, 0), stationary = await emit(1, 0);
  // Camera axes are x right, y down, z forward: upward specific force is -y.
  close(first.imu.acceleration, [0, -9.81, 0]);
  close(stationary.imu.acceleration, [0, -9.81, 0]);
  close(stationary.imu.gyro, [0, 0, 0]);
  const accelerating = await emit(2, 2), next = await emit(3, 6);
  close(accelerating.velocity, [2, 0, 0]);
  close(next.velocity, [4, 0, 0]);
  close(accelerating.imu.acceleration, [2, -9.81, 0]);
  close(next.imu.acceleration, [2, -9.81, 0]);
  close(next.imu.gyro, [0, 0, 0]);
  rt.dispose();
});
test("evaluation gyro derives known-axis camera angular motion in camera coordinates", async () => {
  const axes = [new T.Vector3(1, 0, 0), new T.Vector3(0, 1, 0), new T.Vector3(0, 0, 1)];
  for (const [axisIndex, axis] of axes.entries()) {
    const { rt, rig, worker, tick } = setup();
    tick(0); rig.pending.shift()!.resolve(); await flush(); worker.reply(worker.frame());
    const angle = .3, dt = .5;
    rig.camera.quaternion.setFromAxisAngle(axis, angle);
    tick(dt); rig.pending.shift()!.resolve(); await flush(); worker.reply(worker.frame());
    const truth = rt.records.at(-1)!.truth;
    const expected = [0, 0, 0];
    expected[axisIndex] = angle / dt * (axisIndex === 0 ? 1 : -1);
    truth.imu.gyro.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-10));
    // The gravity-specific force rotates into the new camera frame.
    const gravity = new T.Vector3(0, 9.81, 0)
      .applyQuaternion(new T.Quaternion(...truth.pose.q).invert()).toArray();
    truth.imu.acceleration.forEach((value, i) => assert.ok(Math.abs(value - gravity[i]) < 1e-10));
    rt.dispose();
  }
});
