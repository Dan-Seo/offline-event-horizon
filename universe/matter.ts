import * as T from "three/webgpu";
import {
  Fn,
  If,
  cameraWorldMatrix,
  float,
  instanceIndex,
  instancedArray,
  length,
  max,
  positionLocal,
  pow,
  uniform,
  uv,
  vec3,
  vec4,
  attribute,
  mix,
  smoothstep,
} from "three/tsl";
import { clamp, QUALITY, seeded, type Quality } from "./config";
// The simulation has a moving local domain. Rebasing changes representation, not trajectories.
// Positions/velocities remain on the GPU; only a handful of field uniforms cross each frame.
export class MatterField {
  mesh: T.Mesh;
  count = 80000;
  computeMs = 0;
  fieldActive = false;
  domain = 6000;
  private anchor = new T.Vector3();
  private initialized = false;
  private scale = uniform(6000);
  private rebase = uniform(new T.Vector3());
  private ratio = uniform(1);
  private dt = uniform(0);
  private field = uniform(new T.Vector3(0, 0, -0.35));
  private force = uniform(0);
  private seed = uniform(new T.Vector3(4, 4, 4));
  private seedStrength = uniform(0);
  private shelter = uniform(0);
  private stirring = uniform(new T.Vector3());
  private gentleness = uniform(0);
  private compute?: T.ComputeNode;
  private positions: Float32Array;
  private velocities: Float32Array;
  private geometry: T.InstancedBufferGeometry;
  constructor(
    scene: T.Scene,
    private gpu: boolean,
  ) {
    const maxCount = gpu ? 160000 : 5000,
      random = seeded(8726);
    this.positions = new Float32Array(maxCount * 3);
    this.velocities = new Float32Array(maxCount * 3);
    const hues = new Float32Array(maxCount * 3),
      sizes = new Float32Array(maxCount);
    for (let i = 0; i < maxCount; i++) {
      this.positions.set(
        [(random() - 0.5) * 2, (random() - 0.5) * 2, (random() - 0.5) * 2],
        i * 3,
      );
      const c = new T.Color().setHSL(
        random() < 0.15 ? 0.52 : 0.11,
        0.14,
        0.45 + random() * 0.35,
      );
      c.toArray(hues, i * 3);
      sizes[i] = 0.00025 + Math.pow(random(), 8) * 0.0013;
    }
    const g = (this.geometry = new T.InstancedBufferGeometry()),
      quad = new T.PlaneGeometry(1, 1);
    g.index = quad.index;
    g.attributes = { ...quad.attributes };
    g.setAttribute("aDust", new T.InstancedBufferAttribute(this.positions, 3));
    g.setAttribute("aHue", new T.InstancedBufferAttribute(hues, 3));
    g.setAttribute("aSize", new T.InstancedBufferAttribute(sizes, 1));
    let position: T.Node<"vec3"> = attribute<"vec3">("aDust", "vec3");
    if (gpu) {
      const positions = instancedArray(this.positions.slice(), "vec3"),
        velocities = instancedArray(maxCount, "vec3");
      this.compute = Fn(() => {
        const p = positions.element(instanceIndex),
          v = velocities.element(instanceIndex);
        p.assign(p.mul(this.ratio).add(this.rebase));
        v.mulAssign(this.ratio);
        const toField = this.field.sub(p),
          toSeed = this.seed.sub(p);
        const fieldForce = toField
          .div(pow(toField.dot(toField).add(0.025), 1.5))
          .mul(this.force)
          .mul(0.012);
        const seedForce = toSeed
          .div(pow(toSeed.dot(toSeed).add(0.012), 1.5))
          .mul(this.seedStrength)
          .mul(0.016);
        const orbit = vec3(toSeed.z.negate(), 0, toSeed.x)
          .mul(this.seedStrength)
          .mul(0.08);
        const nearby = float(1).sub(smoothstep(0.05, 0.36, length(p)));
        const wake = this.stirring.mul(nearby).mul(this.shelter).mul(0.18);
        v.addAssign(
          fieldForce.add(seedForce).add(orbit).add(wake).mul(this.dt),
        );
        v.mulAssign(pow(0.998, this.dt.mul(60)));
        p.addAssign(v.mul(this.dt));
        If(p.x.abs().greaterThan(1), () => {
          p.x.assign(p.x.sign().negate().mul(0.99));
          v.assign(vec3(0));
        });
        If(p.y.abs().greaterThan(1), () => {
          p.y.assign(p.y.sign().negate().mul(0.99));
          v.assign(vec3(0));
        });
        If(p.z.abs().greaterThan(1), () => {
          p.z.assign(p.z.sign().negate().mul(0.99));
          v.assign(vec3(0));
        });
      })().compute(this.count);
      position = positions.toAttribute();
    }
    const material = new T.MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
    });
    material.positionNode = position
      .mul(this.scale)
      .add(
        cameraWorldMatrix.mul(
          vec4(
            positionLocal.xy.mul(attribute("aSize", "float")).mul(this.scale),
            0,
            0,
          ),
        ).xyz,
      );
    material.colorNode = mix(
      attribute<"vec3">("aHue", "vec3"),
      vec3(0.23, 0.52, 0.45),
      this.shelter.mul(0.7),
    ).mul(0.8);
    material.opacityNode = pow(
      max(0, float(1).sub(length(uv().sub(0.5).mul(2)))),
      2,
    )
      .mul(float(1).sub(smoothEdge(position)))
      .mul(mix(0.48, 0.11, this.shelter))
      .mul(this.gentleness.mul(0.35).add(0.65));
    this.mesh = new T.Mesh(g, material);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.setQuality("HIGH");
  }
  prepare(renderer: T.WebGPURenderer) {
    if (this.compute) renderer.compute(this.compute);
  }
  setQuality(q: Quality) {
    this.count = this.gpu
      ? QUALITY[q].particles
      : Math.min(5000, QUALITY[q].particles);
    this.geometry.instanceCount = this.count;
    this.compute?.setCount(this.count);
  }
  update(
    renderer: T.WebGPURenderer,
    position: T.Vector3,
    rotation: T.Quaternion,
    clearance: number,
    dt: number,
    force: number,
    seed?: T.Vector3,
    sanctuary = 0,
    stillness = 0,
    velocity = new T.Vector3(),
  ) {
    const size = clamp(Math.max(200, clearance) * 0.7, 300, 60000),
      next = this.domain + (size - this.domain) * Math.min(1, dt * 1.8 + 0.01);
    this.rebase.value.copy(this.anchor).sub(position).divideScalar(next);
    this.ratio.value = this.domain / next;
    if (!this.initialized) {
      this.rebase.value.set(0, 0, 0);
      this.initialized = true;
    }
    this.domain = next;
    this.anchor.copy(position);
    this.scale.value = next;
    this.dt.value = dt;
    this.shelter.value = sanctuary;
    this.gentleness.value = stillness;
    this.stirring.value.copy(velocity).divideScalar(next).clampLength(0, 0.3);
    this.field.value.set(0, 0, -0.35).applyQuaternion(rotation);
    this.force.value = force;
    this.fieldActive = force !== 0;
    if (seed) {
      this.seed.value.copy(seed).sub(position).divideScalar(next);
      this.seedStrength.value = this.seed.value.length() < 2 ? 1 : 0;
    } else this.seedStrength.value = 0;
    const start = performance.now();
    if (this.compute) renderer.compute(this.compute);
    else {
      const p = this.positions,
        v = this.velocities,
        shift = this.rebase.value,
        r = this.ratio.value,
        s = this.seed.value,
        f = this.field.value;
      for (let i = 0; i < this.count; i++) {
        const j = i * 3;
        p[j] = p[j] * r + shift.x;
        p[j + 1] = p[j + 1] * r + shift.y;
        p[j + 2] = p[j + 2] * r + shift.z;
        const dx = f.x - p[j],
          dy = f.y - p[j + 1],
          dz = f.z - p[j + 2],
          a =
            (force * 0.012) /
            Math.pow(dx * dx + dy * dy + dz * dz + 0.025, 1.5);
        const sx = s.x - p[j],
          sy = s.y - p[j + 1],
          sz = s.z - p[j + 2],
          b =
            (this.seedStrength.value * 0.016) /
            Math.pow(sx * sx + sy * sy + sz * sz + 0.012, 1.5);
        const near = clamp(
          (0.36 - Math.hypot(p[j], p[j + 1], p[j + 2])) / 0.31,
        );
        const wake = near * near * (3 - 2 * near) * sanctuary * 0.18;
        v[j] =
          (v[j] * r +
            (dx * a +
              sx * b -
              sz * 0.08 * this.seedStrength.value +
              this.stirring.value.x * wake) *
              dt) *
          Math.pow(0.998, dt * 60);
        v[j + 1] =
          (v[j + 1] * r +
            (dy * a + sy * b + this.stirring.value.y * wake) * dt) *
          Math.pow(0.998, dt * 60);
        v[j + 2] =
          (v[j + 2] * r +
            (dz * a +
              sz * b +
              sx * 0.08 * this.seedStrength.value +
              this.stirring.value.z * wake) *
              dt) *
          Math.pow(0.998, dt * 60);
        for (let k = 0; k < 3; k++) {
          p[j + k] += v[j + k] * dt;
          if (Math.abs(p[j + k]) > 1) {
            p[j + k] = -Math.sign(p[j + k]) * 0.99;
            v[j + k] = 0;
          }
        }
      }
      this.geometry.attributes.aDust.needsUpdate = true;
    }
    this.computeMs = performance.now() - start;
  }
  dispose() {
    this.compute?.dispose();
  }
}
function smoothEdge(p: T.Node<"vec3">) {
  return max(p.x.abs(), max(p.y.abs(), p.z.abs())).smoothstep(0.7, 1);
}
