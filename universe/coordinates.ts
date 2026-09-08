import * as T from "three/webgpu";
// CPU positions retain double precision. GPU geometry stays local to each body.
// Beyond the local domain, a continuous radial map preserves angular size.
export const LOCAL_DOMAIN = 250000;
export const SECTOR_SIZE = 600000;
export function mappedDistance(distance: number) {
  return distance <= LOCAL_DOMAIN
    ? distance
    : LOCAL_DOMAIN * (1 + Math.log1p((distance - LOCAL_DOMAIN) / LOCAL_DOMAIN));
}
export function placeRelative(
  object: T.Object3D,
  position: T.Vector3,
  observer: T.Vector3,
  scale = 1,
) {
  object.position.copy(position).sub(observer);
  const d = object.position.length();
  const k = d > 0 ? mappedDistance(d) / d : 1;
  object.position.multiplyScalar(k);
  object.scale.setScalar(scale * k);
  return k;
}
