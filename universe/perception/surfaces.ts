import * as T from "three/webgpu";
export type SurfaceKind =
  | "terrain"
  | "water"
  | "vegetation"
  | "rock"
  | "sand"
  | "ice"
  | "creature";
export const CLASS_ID: Record<SurfaceKind, number> = {
  terrain: 1,
  water: 2,
  vegetation: 3,
  rock: 4,
  sand: 5,
  ice: 6,
  creature: 7,
};
export function markSurface<M extends T.Mesh>(
  mesh: M,
  kind: SurfaceKind,
  contact = false,
): M {
  mesh.userData.sensorKind = kind;
  mesh.userData.contact = contact;
  return mesh;
}
export function sensorSurfaces(scene: T.Scene) {
  const result: T.Mesh[] = [];
  scene.traverse((o) => {
    if (o instanceof T.Mesh && o.userData.sensorKind) result.push(o);
  });
  return result;
}
export function visibleInTree(o: T.Object3D) {
  for (let p: T.Object3D | null = o; p; p = p.parent)
    if (!p.visible) return false;
  return true;
}
