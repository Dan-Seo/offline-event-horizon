import type { Quality } from "./config";
export type UniverseSnapshot = {
  ready: boolean;
  sanctuary: string;
  backend: string;
  paused: boolean;
  mode: string;
  quiet: boolean;
  selected: string | null;
  selectedId: string;
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
  learning: { look: number; move: number; speed: number };
  encounter: string;
  approach: string;
  walking: boolean;
  walkAvailable: boolean;
  pilgrim: boolean;
  carrying: boolean;
  resting: boolean;
  pilgrimAvailable: boolean;
  gas: { active: number; released: number; absorbed: number; time: number };
  relativity: {
    active: boolean;
    ended: boolean;
    radius: number;
    properTime: number;
    rate: number;
    radialTide: number;
    outwardLight: number;
  };
  relativityLoading: boolean;
  relativityError: boolean;
  experiment: {
    active: number;
    absorbed: number;
    escaped: number;
    launched: number;
    gravity: number;
  };
};
export const initialSnapshot: UniverseSnapshot = {
  ready: false,
  sanctuary: "last-light",
  backend: "Initializing",
  paused: false,
  mode: "FREE",
  quiet: false,
  selected: null,
  selectedId: "",
  selectedKind: "",
  selectionX: 0,
  selectionY: 0,
  selectionVisible: false,
  nearest: "THE LAST LIGHT",
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
  learning: { look: 0, move: 0, speed: 0 },
  encounter: "",
  approach: "",
  walking: false,
  walkAvailable: false,
  pilgrim: false,
  carrying: false,
  resting: true,
  pilgrimAvailable: true,
  gas: { active: 0, released: 0, absorbed: 0, time: 0 },
  relativity: {
    active: false,
    ended: false,
    radius: 6,
    properTime: 0,
    rate: 1,
    radialTide: 0,
    outwardLight: 0,
  },
  relativityLoading: false,
  relativityError: false,
  experiment: { active: 0, absorbed: 0, escaped: 0, launched: 0, gravity: 1 },
};
