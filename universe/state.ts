import type { Quality } from "./config";
export type UniverseSnapshot = {
  ready: boolean;
  backend: string;
  paused: boolean;
  mode: string;
  quiet: boolean;
  selected: string | null;
  selectedKind: string;
  selectionX: number;
  selectionY: number;
  selectionVisible: boolean;
  nearest: string;
  quality: Quality;
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  particles: number;
  dpr: number;
  sectors: number;
  distance: number;
  velocity: number;
  speedDial: number;
  seeds: number;
  field: boolean;
  time: number;
};
export const initialSnapshot: UniverseSnapshot = {
  ready: false,
  backend: "Initializing",
  paused: false,
  mode: "FREE",
  quiet: false,
  selected: null,
  selectedKind: "",
  selectionX: 0,
  selectionY: 0,
  selectionVisible: false,
  nearest: "ORPHEUS IV",
  quality: "HIGH",
  fps: 0,
  frameMs: 0,
  drawCalls: 0,
  triangles: 0,
  particles: 0,
  dpr: 1,
  sectors: 1,
  distance: 0,
  velocity: 0,
  speedDial: 1,
  seeds: 0,
  field: false,
  time: 0,
};
