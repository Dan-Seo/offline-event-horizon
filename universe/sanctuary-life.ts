import * as T from "three/webgpu";
import {
  Fn,
  If,
  attribute,
  cameraWorldMatrix,
  float,
  instanceIndex,
  instancedArray,
  length,
  max,
  mix,
  normalWorld,
  cameraPosition,
  positionLocal,
  positionWorld,
  pow,
  sin,
  smoothstep,
  uniform,
  uv,
  vec3,
  vec4,
} from "three/tsl";
import { seeded, type Quality } from "./config";
import type { SanctuaryAtmosphere } from "./sanctuary-atmosphere";

/** A damped flow-following school, with real stateful attraction/avoidance.
 * It uses an analytic shared flow, not an O(n²) all-pairs biological model. */
export class SanctuaryLife {
  mesh: T.Mesh;
  creature = new T.Group();
  count = 4096;
  private maxCount: number;
  private positions: Float32Array;
  private velocities: Float32Array;
  private geometry: T.InstancedBufferGeometry;
  private compute?: T.ComputeNode;
  private dt = uniform(0);
  private speed = uniform(0);
  private creaturePosition = new T.Vector3();
  constructor(
    scene: T.Scene,
    private air: SanctuaryAtmosphere,
    private gpu: boolean,
  ) {
    this.maxCount = gpu ? 8192 : 1200;
    this.positions = new Float32Array(this.maxCount * 3);
    this.velocities = new Float32Array(this.maxCount * 3);
    const sizes = new Float32Array(this.maxCount),
      classes = new Float32Array(this.maxCount),
      r = seeded(4891);
    for (let i = 0; i < this.maxCount; i++) {
      const sky = i % 4 < 3,
        a = r() * Math.PI * 2,
        radius = sky ? 400 + r() * 800 : r() * 650;
      this.positions.set(
        [
          (sky ? -900 : 1900) + Math.cos(a) * radius,
          (sky ? 1030 : 110) + (r() - 0.5) * (sky ? 380 : 160),
          (sky ? -6700 : -1750) + Math.sin(a) * radius,
        ],
        i * 3,
      );
      sizes[i] = sky ? 1.7 + r() * 3.9 : 0.2 + r() * 0.8;
      classes[i] = sky ? 0 : 1;
    }
    const g = (this.geometry = new T.InstancedBufferGeometry()),
      quad = new T.PlaneGeometry(1, 1);
    g.index = quad.index;
    g.attributes = { ...quad.attributes };
    g.setAttribute("aLife", new T.InstancedBufferAttribute(this.positions, 3));
    g.setAttribute("aLifeSize", new T.InstancedBufferAttribute(sizes, 1));
    g.setAttribute("aLifeClass", new T.InstancedBufferAttribute(classes, 1));
    let position: T.Node<"vec3"> = attribute<"vec3">("aLife", "vec3");
    if (gpu) {
      const positions = instancedArray(this.positions.slice(), "vec3"),
        velocities = instancedArray(this.maxCount, "vec3");
      this.compute = Fn(() => {
        const p = positions.element(instanceIndex),
          v = velocities.element(instanceIndex),
          i = float(instanceIndex);
        const phase = i.mul(2.39996),
          a = phase.add(air.time.mul(0.025));
        const radius = i.mul(0.618034).fract().mul(720).add(300);
        const target = vec3(
          a.cos().mul(radius).sub(900),
          sin(a.mul(2).add(i.mul(0.003)))
            .mul(175)
            .add(1090),
          a
            .sin()
            .mul(radius)
            .add(sin(a.mul(3)).mul(160))
            .sub(6700),
        ).toVar();
        const stiffness = float(0.018).toVar();
        If(instanceIndex.mod(4).equal(3), () => {
          const home = vec3(
            phase.cos().mul(radius.mul(0.55)).add(1900),
            sin(phase.mul(1.7)).mul(75).add(135),
            phase.sin().mul(radius.mul(0.65)).sub(1750),
          );
          const near = float(1)
            .sub(
              smoothstep(
                500,
                1350,
                length(air.observer.sub(vec3(1900, 80, -1750))),
              ),
            )
            .mul(air.stillness);
          const companion = air.observer.add(
            vec3(
              a
                .cos()
                .mul(24)
                .add(sin(a.mul(2)).mul(7)),
              sin(a.mul(1.7)).mul(12).add(4),
              a.sin().mul(24),
            ),
          );
          target.assign(mix(home, companion, near));
          stiffness.assign(0.04);
        });
        const away = p.sub(air.observer),
          dist2 = away.dot(away).add(1600);
        const avoid = away
          .div(dist2)
          .mul(this.speed.mul(70).add(80))
          .mul(float(1).sub(smoothstep(100, 500, length(away))));
        v.addAssign(target.sub(p).mul(stiffness).add(avoid).mul(this.dt));
        v.mulAssign(this.dt.mul(-0.24).exp());
        p.addAssign(v.mul(this.dt));
      })().compute(this.maxCount);
      position = positions.toAttribute();
    }
    const material = new T.MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
    });
    const size = attribute<"float">("aLifeSize", "float"),
      kind = attribute<"float">("aLifeClass", "float");
    const pulse = sin(air.time.mul(0.8).add(position.y.mul(0.011)))
      .mul(0.25)
      .add(0.75);
    const corner = vec3(
      positionLocal.x,
      positionLocal.y.add(
        sin(
          positionLocal.x
            .mul(5)
            .add(air.time.mul(1.6))
            .add(position.x.mul(0.07)),
        ).mul(0.17),
      ),
      0,
    ).mul(size);
    material.positionNode = position
      .sub(air.observer)
      .add(cameraWorldMatrix.mul(vec4(corner, 0)).xyz);
    material.colorNode = mix(
      vec3(0.19, 0.34, 0.39),
      vec3(0.22, 0.46, 0.27),
      kind,
    )
      .mul(pulse)
      .mul(air.stillness.mul(0.5).add(0.7));
    const d = length(uv().sub(0.5).mul(2));
    material.opacityNode = pow(max(0, float(1).sub(d)), 1.8)
      .mul(0.65)
      .mul(air.presence);
    this.mesh = new T.Mesh(g, material);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.makeCreature();
    scene.add(this.creature);
    this.setQuality("HIGH");
  }
  private makeCreature() {
    const rows = 70,
      cols = 110,
      p: number[] = [],
      uvs: number[] = [],
      indices: number[] = [];
    for (let j = 0; j <= rows; j++)
      for (let i = 0; i <= cols; i++) {
        const u = (i / cols) * 2 - 1,
          v = j / rows,
          span = Math.pow(Math.sin(v * Math.PI), 0.55) * 0.85 + 0.12;
        p.push(
          u * 480 * span,
          (1 - u * u) * 16 + Math.sin(v * Math.PI) * 20,
          (v - 0.5) * 380 + Math.pow(Math.abs(u), 1.6) * 125,
        );
        uvs.push(i / cols, v);
      }
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const a = j * (cols + 1) + i,
          b = a + cols + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.Float32BufferAttribute(p, 3));
    geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const m = new T.MeshBasicNodeMaterial({
      transparent: true,
      side: T.DoubleSide,
      depthWrite: false,
      blending: T.AdditiveBlending,
    });
    const u = uv(),
      t = this.air.time;
    m.positionNode = positionLocal.add(
      vec3(
        0,
        sin(t.mul(0.18).add(u.y.mul(3)))
          .mul(positionLocal.x.abs().div(480).pow(1.6))
          .mul(90),
        0,
      ),
    );
    const edge = pow(
      float(1).sub(
        normalWorld.dot(cameraPosition.sub(positionWorld).normalize()).abs(),
      ),
      2,
    );
    const ribs = pow(
      max(
        0,
        float(1).sub(
          sin(u.x.sub(0.5).abs().mul(80).add(u.y.mul(9)))
            .abs()
            .mul(8),
        ),
      ),
      2,
    );
    const veins = pow(
      max(
        0,
        float(1).sub(
          sin(u.y.mul(60).add(u.x.mul(3)))
            .abs()
            .mul(15),
        ),
      ),
      2,
    );
    m.colorNode = mix(
      vec3(0.08, 0.27, 0.28),
      vec3(0.51, 0.65, 0.53),
      edge.mul(0.7).add(ribs.mul(0.3)),
    );
    m.opacityNode = edge
      .mul(0.22)
      .add(ribs.mul(0.14))
      .add(veins.mul(0.06))
      .add(0.013)
      .mul(this.air.creature);
    const wings = new T.Mesh(geometry, m);
    this.creature.add(wings);
    // A long trailing tail and gossamer threads carry motion beyond the silhouette.
    const tailMat = new T.MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
    });
    tailMat.colorNode = vec3(0.16, 0.39, 0.38);
    tailMat.opacityNode = this.air.creature.mul(0.25);
    tailMat.positionNode = positionLocal.add(
      vec3(
        sin(t.mul(0.19).add(positionLocal.z.mul(0.007)))
          .mul(positionLocal.z.abs())
          .mul(0.06),
        0,
        0,
      ),
    );
    for (let i = -3; i <= 3; i++) {
      const curve = new T.CatmullRomCurve3([
        new T.Vector3(i * 21, 12, 100),
        new T.Vector3(i * 28, -20, 310),
        new T.Vector3(i * 40, -80, 570),
        new T.Vector3(i * 65, -35, 800),
      ]);
      const tail = new T.TubeGeometry(curve, 45, i === 0 ? 1.8 : 0.5, 4, false),
        points = tail.attributes.position;
      for (let j = 0; j <= 45; j++) {
        const center = curve.getPointAt(j / 45),
          taper = Math.pow(1 - j / 45, 1.2);
        for (let k = 0; k <= 4; k++) {
          const n = j * 5 + k;
          points.setXYZ(
            n,
            center.x + (points.getX(n) - center.x) * taper,
            center.y + (points.getY(n) - center.y) * taper,
            center.z + (points.getZ(n) - center.z) * taper,
          );
        }
      }
      tail.computeVertexNormals();
      this.creature.add(new T.Mesh(tail, tailMat));
    }
    this.creature.rotation.set(0.24, 0.18, -0.23);
  }
  prepare(renderer: T.WebGPURenderer) {
    if (this.compute) renderer.compute(this.compute);
  }
  update(
    renderer: T.WebGPURenderer,
    dt: number,
    speed: number,
    event: string,
    eventTime: number,
  ) {
    this.dt.value = dt;
    this.speed.value = Math.min(45, speed);
    this.mesh.visible = this.air.presence.value > 0.02;
    if (this.mesh.visible && dt > 0) {
      if (this.compute) renderer.compute(this.compute);
      else {
        const p = this.positions,
          v = this.velocities,
          t = this.air.time.value,
          o = this.air.observer.value,
          still = this.air.stillness.value;
        const forestNear =
          Math.max(
            0,
            Math.min(
              1,
              (1350 - Math.hypot(o.x - 1900, o.y - 80, o.z + 1750)) / 850,
            ),
          ) * still;
        for (let i = 0; i < this.count; i++) {
          const j = i * 3,
            phase = i * 2.39996,
            a = phase + t * 0.025,
            r = ((i * 0.618034) % 1) * 720 + 300,
            sky = i % 4 < 3;
          let tx = Math.cos(a) * r - 900,
            ty = Math.sin(a * 2 + i * 0.003) * 175 + 1090,
            tz = Math.sin(a) * r + Math.sin(a * 3) * 160 - 6700;
          if (!sky) {
            const near = forestNear;
            tx =
              (Math.cos(phase) * r * 0.55 + 1900) * (1 - near) +
              (o.x + Math.cos(a) * 24 + Math.sin(a * 2) * 7) * near;
            ty =
              (Math.sin(phase * 1.7) * 75 + 135) * (1 - near) +
              (o.y + Math.sin(a * 1.7) * 12 + 4) * near;
            tz =
              (Math.sin(phase) * r * 0.65 - 1750) * (1 - near) +
              (o.z + Math.sin(a) * 24) * near;
          }
          const dx = p[j] - o.x,
            dy = p[j + 1] - o.y,
            dz = p[j + 2] - o.z,
            d2 = dx * dx + dy * dy + dz * dz;
          const avoid =
            ((Math.min(45, speed) * 70 + 80) / (d2 + 1600)) *
            Math.max(0, Math.min(1, (500 - Math.sqrt(d2)) / 400));
          const k = sky ? 0.018 : 0.04,
            damping = Math.exp(-dt * 0.24);
          v[j] = (v[j] + ((tx - p[j]) * k + dx * avoid) * dt) * damping;
          v[j + 1] =
            (v[j + 1] + ((ty - p[j + 1]) * k + dy * avoid) * dt) * damping;
          v[j + 2] =
            (v[j + 2] + ((tz - p[j + 2]) * k + dz * avoid) * dt) * damping;
          p[j] += v[j] * dt;
          p[j + 1] += v[j + 1] * dt;
          p[j + 2] += v[j + 2] * dt;
        }
        this.geometry.attributes.aLife.needsUpdate = true;
      }
    }
    const sea = event === "sea-visitor";
    this.creature.visible =
      this.air.creature.value > 0.001 && this.air.presence.value > 0.1;
    const progress = Math.max(0, eventTime);
    this.creaturePosition.set(
      sea ? -210 - progress * 2 : -900 - progress * 2,
      sea ? -20 + progress * 5 : 1100 + Math.sin(progress * 0.02) * 80,
      sea ? -2050 - progress * 1.8 : -6960,
    );
    this.creature.position
      .copy(this.creaturePosition)
      .sub(this.air.observer.value);
    this.creature.rotation.y = 0.18 + progress * 0.001;
  }
  setQuality(q: Quality) {
    // Interleaving keeps both populations in every quality tier.
    this.count = this.gpu
      ? { ULTRA: 8192, HIGH: 8192, BALANCED: 6144, BATTERY: 4096 }[q]
      : this.maxCount;
    this.geometry.instanceCount = this.count;
    this.compute?.setCount(this.count);
  }
  dispose() {
    this.compute?.dispose();
  }
}
