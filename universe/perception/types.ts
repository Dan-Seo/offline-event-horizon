import type { Pose, V3 } from "./math.ts";
export type Condition =
  | "CLEAR"
  | "FOG"
  | "LOW_LIGHT"
  | "REPETITIVE"
  | "REFLECTIVE_WATER"
  | "DYNAMIC"
  | "FAST_MOTION"
  | "RAIN";
export type Intrinsics = {
  width: number;
  height: number;
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  near: number;
  far: number;
};
// This boundary deliberately contains no renderer pose, object IDs, world geometry or destination.
export type SensorFrame = {
  id: number;
  timestamp: number;
  rgb: Uint8Array;
  depth: Float32Array;
  k: Intrinsics;
  condition: Condition;
  seed: number;
};
export type Feature = { x: number; y: number; score: number };
export type Track = {
  x: number;
  y: number;
  u: number;
  v: number;
  inlier: boolean;
};
export type VOResult = {
  pose: Pose;
  delta: Pose | null;
  status: "STARTING" | "TRACKING" | "LOST";
  segment: number;
  features: number;
  matched: number;
  inliers: number;
  ratio: number;
  residual: number | null;
  tracks: Track[];
};
export type MapCell = {
  x: number;
  z: number;
  y: number;
  span: number;
  count: number;
  green: number;
  blue: number;
  age: number;
};
export type Route = {
  turn: number;
  curvature: number;
  speed: number;
  score: number;
  length: number;
  safe: boolean;
  points: V3[];
};
export type Analysis = {
  id: number;
  timestamp: number;
  vo: VOResult;
  cells: MapCell[];
  routes: Route[];
  chosen: Route | null;
  coverage: number;
  water: number;
  green: number;
  sky: number;
  ms: number;
  points: number;
};
export type TruthRecord = {
  id: number;
  timestamp: number;
  pose: Pose;
  velocity: V3;
  imu: { acceleration: V3; gyro: V3 };
  condition: Condition;
};
export type RecordPair = { truth: TruthRecord; estimate: VOResult };

export type TransactionIdentity = { generation: number; request: number; id: number };
export type WorkerRequest =
  | { type: "reset" }
  | ({ type: "frame"; frame: SensorFrame } & TransactionIdentity);
export type WorkerReply = TransactionIdentity & (
  | { type: "analysis"; result: Analysis }
  | { type: "error"; message: string }
);
