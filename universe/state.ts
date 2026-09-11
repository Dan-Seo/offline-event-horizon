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
/** The keys the engine rewrites with a new value on every frame. A snapshot that differs only
 *  in these is no news to anything but the readouts. `learning` and `gas` belong here as well:
 *  both are rebuilt each snapshot, learning moves whenever the camera does, and the weather
 *  clock inside gas advances on every unpaused frame. */
export const LIVE_KEYS = [
  "fps",
  "frameMs",
  "drawCalls",
  "triangles",
  "particles",
  "velocity",
  "distance",
  "sectors",
  "selectionX",
  "selectionY",
  "selectionVisible",
  "time",
  "learning",
  "gas",
] as const satisfies readonly (keyof UniverseSnapshot)[];
const live = new Set<string>(LIVE_KEYS);
// `experiment` and `relativity` are rebuilt by their models on every snapshot, so identity
// says nothing about them; both are flat records of numbers and booleans.
const unchanged = (a: unknown, b: unknown) =>
  a === b ||
  (typeof a === "object" &&
    typeof b === "object" &&
    a !== null &&
    b !== null &&
    Object.entries(a).every(
      ([key, value]) => value === (b as Record<string, unknown>)[key],
    ));
/** Whether two snapshots differ anywhere outside LIVE_KEYS. */
export const changedOutsideLive = (
  previous: UniverseSnapshot,
  next: UniverseSnapshot,
) =>
  (Object.keys(next) as (keyof UniverseSnapshot)[]).some(
    (key) => !live.has(key) && !unchanged(previous[key], next[key]),
  );
