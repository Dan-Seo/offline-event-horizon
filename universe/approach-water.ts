import * as T from "three/webgpu";
import {
  cameraPosition,
  color,
  float,
  max,
  mix,
  mx_noise_float,
  normalWorld,
  positionLocal,
  positionWorld,
  reflector,
  sin,
  vec2,
  vec3,
} from "three/tsl";
import type { Quality } from "./config";
import { markSurface } from "./perception/surfaces";

/** A local spherical lagoon, with a tangent reflection plane following the observer. */
export class RegionalLagoon {
  mesh: T.Mesh;
  private mirror = reflector({
    resolutionScale: 0.4,
    bounces: false,
    samples: 0,
  });
  private normal = new T.Vector3();
  private axis = new T.Vector3(0, 0, 1);
  constructor(
    root: T.Group,
    time: T.Node<"float">,
    viewer: T.Node<"vec3">,
    motion: T.Node<"float">,
  ) {
    const geometry = new T.RingGeometry(0.00001, 0.152, 160, 28);
    const p = geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        z = p.getY(i);
      p.setXYZ(i, x, Math.sqrt(1 - x * x - z * z) - 1 + 0.021, z);
    }
    geometry.computeVertexNormals();
    const material = new T.MeshBasicNodeMaterial({ side: T.DoubleSide });
    const a = positionLocal.x
      .mul(740)
      .add(positionLocal.z.mul(410))
      .add(time.mul(0.17));
    const b = positionLocal.x
      .mul(-390)
      .add(positionLocal.z.mul(860))
      .sub(time.mul(0.11));
    const noise = mx_noise_float(
      positionLocal.mul(2300).add(vec3(time.mul(0.008), 0, 0)),
    );
    this.mirror.target.rotation.x = -Math.PI / 2;
    root.add(this.mirror.target);
    this.mirror.uvNode = this.mirror.uvNode!.add(
      vec2(
        a.cos().mul(0.0011).add(b.cos().mul(0.0005)),
        b.sin().mul(0.0006),
      ).add(noise.mul(0.00015)),
    );
    const view = cameraPosition.sub(positionWorld).normalize();
    const fresnel = float(1)
      .sub(max(0, view.dot(normalWorld).abs()))
      .pow(5)
      .mul(0.65)
      .add(0.28);
    const r = positionLocal.xz.sub(viewer.xz).length();
    const response = r
      .mul(-170)
      .exp()
      .mul(motion)
      .mul(
        sin(r.mul(760).sub(time.mul(1.8)))
          .mul(0.5)
          .add(0.5),
      );
    material.colorNode = mix(
      color(0x041b20),
      this.mirror.rgb.mul(vec3(0.68, 0.89, 0.91)),
      fresnel,
    ).add(color(0x70d4ad).mul(response.mul(0.4)));
    this.mesh = markSurface(new T.Mesh(geometry, material), "water");
    root.add(this.mesh);
  }
  update(local: T.Vector3) {
    const x = T.MathUtils.clamp(local.x, -0.15, 0.15),
      z = T.MathUtils.clamp(local.z, -0.15, 0.15);
    const y = Math.sqrt(1 - x * x - z * z);
    this.mirror.target.position.set(x, y - 1 + 0.021, z);
    this.normal.set(x, y, z).normalize();
    this.mirror.target.quaternion.setFromUnitVectors(this.axis, this.normal);
  }
  setQuality(quality: Quality) {
    this.mirror.reflector.resolutionScale = {
      ULTRA: 1,
      HIGH: 0.65,
      BALANCED: 0.45,
      BATTERY: 0.3,
    }[quality];
  }
  dispose() {
    this.mirror.dispose();
  }
}
