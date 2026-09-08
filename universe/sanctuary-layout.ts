import { Vector3 } from "three/webgpu";

// All five places share the same local surface, inside the existing floating-origin universe.
// Distances are artistic metres. They are not separate scenes or timed destinations.
export const HOME = new Vector3(0, 22, 460);
export const HOME_PITCH = 0.095;
export const SEA_RADIUS = 48000;
export type SanctuaryId =
  | "last-light"
  | "moonfall"
  | "forest"
  | "veil"
  | "living-sky";
export type SanctuaryPlace = {
  id: SanctuaryId;
  name: string;
  kind: string;
  position: Vector3;
  arrival: Vector3;
  gaze: Vector3;
  radius: number;
};
export const SANCTUARIES: SanctuaryPlace[] = [
  {
    id: "last-light",
    name: "THE LAST LIGHT",
    kind: "A sea that holds the sky",
    position: new Vector3(0, 0, 0),
    arrival: HOME.clone(),
    gaze: new Vector3(-280, 165, -2300),
    radius: 1600,
  },
  {
    id: "moonfall",
    name: "MOONFALL",
    kind: "Water, falling into stars",
    position: new Vector3(-2100, 0, -3100),
    arrival: new Vector3(-1750, 70, -1660),
    gaze: new Vector3(-2100, 230, -3180),
    radius: 1350,
  },
  {
    id: "forest",
    name: "THE BREATHING FOREST",
    kind: "Stay. The light will find you.",
    position: new Vector3(1900, 0, -1750),
    arrival: new Vector3(1840, 44, -1070),
    gaze: new Vector3(1930, 185, -1840),
    radius: 1050,
  },
  {
    id: "veil",
    name: "THE VEIL",
    kind: "A garden held by clouds",
    position: new Vector3(2900, 620, -4700),
    arrival: new Vector3(2770, 785, -3880),
    gaze: new Vector3(2880, 845, -4720),
    radius: 1200,
  },
  {
    id: "living-sky",
    name: "THE LIVING SKY",
    kind: "A thousand quiet lives",
    position: new Vector3(-900, 940, -6700),
    arrival: new Vector3(-930, 865, -6000),
    gaze: new Vector3(-1050, 1140, -7030),
    radius: 1350,
  },
];
export function localPresence(p: Vector3) {
  const height = Math.hypot(p.x, p.y + SEA_RADIUS, p.z) - SEA_RADIUS;
  return (
    Math.max(0, Math.min(1, 1 - (height - 1800) / 6500)) *
    Math.max(0, Math.min(1, 1 - (Math.hypot(p.x, p.z) - 14000) / 16000))
  );
}
