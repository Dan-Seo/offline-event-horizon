import * as T from "three/webgpu";
import {
  attribute,
  cameraWorldMatrix,
  float,
  length,
  max,
  positionLocal,
  pow,
  uniform,
  uv,
  vec4,
} from "three/tsl";
import { seeded } from "./config";
export class StarField {
  group = new T.Group();
  private observer = uniform(new T.Vector3());
  constructor(scene: T.Scene) {
    scene.add(this.group);
    const random = seeded(8917),
      count = 18000;
    const positions = new Float32Array(count * 3),
      colors = new Float32Array(count * 3),
      sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = random() * Math.PI * 2,
        y = random() * 2 - 1,
        rr = Math.sqrt(1 - y * y),
        r = 700000 + random() * 300000;
      const p = new T.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr);
      // A second stellar population traces a tilted, clustered galactic plane.
      if (i > 8000) {
        p.set(
          Math.cos(a),
          (random() - 0.5) * (0.035 + random() * 0.19),
          Math.sin(a),
        )
          .normalize()
          .applyAxisAngle(new T.Vector3(0, 0, 1), 0.32);
      }
      p.multiplyScalar(r).toArray(positions, i * 3);
      const bright = Math.pow(random(), 8),
        color = new T.Color().setHSL(
          random() < 0.22 ? 0.57 : 0.1,
          0.05 + random() * 0.26,
          0.45 + bright * 0.45,
        );
      color.multiplyScalar(0.24 + bright * 2.8).toArray(colors, i * 3);
      sizes[i] = 180 + bright * 1400;
    }
    const geometry = new T.InstancedBufferGeometry(),
      quad = new T.PlaneGeometry(1, 1);
    geometry.index = quad.index;
    geometry.attributes = { ...quad.attributes };
    geometry.instanceCount = count;
    geometry.setAttribute(
      "aStar",
      new T.InstancedBufferAttribute(positions, 3),
    );
    geometry.setAttribute("aColor", new T.InstancedBufferAttribute(colors, 3));
    geometry.setAttribute("aSize", new T.InstancedBufferAttribute(sizes, 1));
    const material = new T.MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
    });
    const base = attribute<"vec3">("aStar", "vec3");
    material.positionNode = base.add(
      cameraWorldMatrix.mul(
        vec4(positionLocal.xy.mul(attribute("aSize", "float")), 0, 0),
      ).xyz,
    );
    const d = length(uv().sub(0.5).mul(2));
    material.colorNode = attribute<"vec3">("aColor", "vec3");
    material.opacityNode = pow(max(0, float(1).sub(d)), 3);
    const mesh = new T.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = -20;
    this.group.add(mesh);
  }
}
