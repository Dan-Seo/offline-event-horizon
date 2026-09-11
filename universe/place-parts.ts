import * as T from "three/webgpu";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

/** A welded icosahedron whose vertices are then moved by `displace`. Welding first, with the
 *  source's normals and uvs dropped, means each shared vertex moves once and the shell stays
 *  closed; the normals are then recomputed from the moved shell. Both callers model an organic
 *  shape rather than a radial profile, so `displace` returns the new position, not a radius. */
export function displacedIcosahedron(
  detail: number,
  displace: (x: number, y: number, z: number) => [number, number, number],
) {
  const source = new T.IcosahedronGeometry(1, detail);
  source.deleteAttribute("normal");
  source.deleteAttribute("uv");
  const g = mergeVertices(source),
    p = g.attributes.position;
  source.dispose();
  for (let i = 0; i < p.count; i++) {
    const [x, y, z] = displace(p.getX(i), p.getY(i), p.getZ(i));
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}
