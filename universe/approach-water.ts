import * as T from "three/webgpu";
import {
  color,
  float,
  mix,
  mx_noise_float,
  normalWorld,
  positionLocal,
  reflector,
  sin,
  vec2,
  vec3,
  uniform,
  attribute,
} from "three/tsl";
import { QUALITY, type Quality } from "./config";
import { markSurface } from "./perception/surfaces";
import { OceanLife } from "./ocean-life";
import { groundHeight, lagoonHeight } from "./walk-ground";
import { submersion, oceanRadialFloor, regionalDomain } from "./ocean-depth";
import { preserveReflectorFramebuffer, waterFresnel, waterSurfaceOptics } from "./ocean-optics";

/** A local spherical lagoon, with a tangent reflection plane following the observer. */
export class RegionalLagoon {
  mesh: T.Mesh;
  private ecosystem: OceanLife;
  private submerged = uniform(0);
  private depth = 0;
  private floor = 0;
  private floorClearance = 0;
  private valid = false;
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
    private radius: number,
  ) {
    preserveReflectorFramebuffer(this.mirror);
    this.ecosystem = new OceanLife(root, time, (x, z) => groundHeight(10, x, z), lagoonHeight, 0.145, 1 / radius, false);
    const geometry = new T.RingGeometry(0.00001, 0.152, 160, 28);
    const p = geometry.getAttribute("position");
    const columns = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        z = p.getY(i);
      p.setXYZ(i, x, Math.sqrt(1 - x * x - z * z) - 1 + 0.021, z);
      columns[i] = Math.max(0, p.getY(i) - groundHeight(10, x, z)) * radius;
    }
    geometry.computeVertexNormals();
    geometry.setAttribute("waterColumn", new T.BufferAttribute(columns, 1));
    const material = new T.MeshBasicNodeMaterial({ side: T.DoubleSide, transparent: true, depthWrite: true });
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
    material.positionNode = positionLocal.add(vec3(0, a.sin().mul(0.08 / radius).add(b.sin().mul(0.035 / radius)), 0));
    this.mirror.target.rotation.x = -Math.PI / 2;
    root.add(this.mirror.target);
    this.mirror.uvNode = this.mirror.uvNode!.add(
      vec2(
        a.cos().mul(0.0011).add(b.cos().mul(0.0005)),
        b.sin().mul(0.0006),
      ).add(noise.mul(0.00015)),
    );
    const { view, fresnel } = waterFresnel(normalWorld);
    const optics = waterSurfaceOptics(float(attribute("waterColumn", "float")), view.dot(normalWorld), fresnel,
      this.mirror.rgb.mul(vec3(0.68, 0.89, 0.91)));
    material.opacityNode = mix(optics.opacity, float(0.6), this.submerged);
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
    const above = optics.color.add(color(0x70d4ad).mul(response.mul(0.4)));
    material.colorNode = mix(above, vec3(0.08, 0.28, 0.31), this.submerged);
    this.mesh = markSurface(new T.Mesh(geometry, material), "water");
    root.add(this.mesh);
  }
  update(local: T.Vector3, time: number, active = true) {
    this.valid = active && regionalDomain(local, 0.152);
    this.ecosystem.update(local, time, active && regionalDomain(local));
    if (!this.valid) {
      this.depth = 0; this.floor = 0; this.floorClearance = 0; this.submerged.value = 0;
      return;
    }
    this.depth = (lagoonHeight(local.x, local.z) - local.y) * this.radius;
    this.floor = groundHeight(10, local.x, local.z);
    const radial = new T.Vector3(local.x, local.y + 1, local.z);
    const distance = radial.length(); radial.normalize();
    this.floorClearance = (distance - oceanRadialFloor(radial.x, radial.y, radial.z, (x, z) => groundHeight(10, x, z), 1, 2 / this.radius)) * this.radius;
    this.submerged.value = submersion(this.depth);
    const x = T.MathUtils.clamp(local.x, -0.15, 0.15),
      z = T.MathUtils.clamp(local.z, -0.15, 0.15);
    const y = Math.sqrt(1 - x * x - z * z);
    this.mirror.target.position.set(x, y - 1 + 0.021, z);
    this.normal.set(x, y, z).normalize();
    this.mirror.target.quaternion.setFromUnitVectors(this.axis, this.normal);
  }
  setQuality(quality: Quality) {
    this.ecosystem.setQuality(quality);
    this.mirror.reflector.resolutionScale = QUALITY[quality].lagoonReflection;
  }
  dispose() {
    this.ecosystem.dispose();
    this.mirror.dispose();
  }
  inspect() { return { valid: this.valid, signedDepth: this.depth, seabedHeight: this.floor, floorClearance: this.floorClearance, submersion: this.submerged.value, ecosystem: this.ecosystem.inspect() }; }
}
