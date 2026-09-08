import * as T from "three/webgpu";
import {
  attribute,
  cameraWorldMatrix,
  modelWorldMatrixInverse,
  modelScale,
  float,
  length,
  max,
  positionLocal,
  pow,
  uv,
  vec4,
} from "three/tsl";
import { OrbitModel, type ReleaseKind } from "./orbit-model";

// Only 144 interactive tracers need CPU integration. Dense ambient matter stays on GPU.
// Trails contain measured position history, not precomputed curves.
export class OrbitExperiment {
  model = new OrbitModel();
  group = new T.Group();
  private historySize = 80;
  private history = new Float32Array(
    this.model.capacity * this.historySize * 3,
  );
  private generations = new Uint32Array(this.model.capacity);
  private cursors = new Uint16Array(this.model.capacity);
  private lengths = new Uint16Array(this.model.capacity);
  private trailPositions = new Float32Array(
    this.model.capacity * (this.historySize - 1) * 6,
  );
  private trailColors = new Float32Array(this.trailPositions.length);
  private heads = new Float32Array(this.model.capacity * 3);
  private radiance = new Float32Array(this.model.capacity * 3);
  private headGeometry: T.InstancedBufferGeometry;
  private trailGeometry = new T.BufferGeometry();
  private sampleAt = 0;
  constructor() {
    this.trailGeometry.setAttribute(
      "position",
      new T.BufferAttribute(this.trailPositions, 3).setUsage(
        T.DynamicDrawUsage,
      ),
    );
    this.trailGeometry.setAttribute(
      "color",
      new T.BufferAttribute(this.trailColors, 3).setUsage(T.DynamicDrawUsage),
    );
    const line = new T.LineSegments(
      this.trailGeometry,
      new T.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
    );
    line.frustumCulled = false;
    this.group.add(line);
    const quad = new T.PlaneGeometry(1, 1),
      g = (this.headGeometry = new T.InstancedBufferGeometry());
    g.index = quad.index;
    g.attributes = { ...quad.attributes };
    g.setAttribute(
      "aTracer",
      new T.InstancedBufferAttribute(this.heads, 3).setUsage(
        T.DynamicDrawUsage,
      ),
    );
    g.setAttribute(
      "aRadiance",
      new T.InstancedBufferAttribute(this.radiance, 3).setUsage(
        T.DynamicDrawUsage,
      ),
    );
    g.instanceCount = this.model.capacity;
    const material = new T.MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
    });
    // Local-space sprites retain the same horizon-radius scale as the anomaly.
    material.positionNode = attribute<"vec3">("aTracer", "vec3").add(
      modelWorldMatrixInverse.mul(
        cameraWorldMatrix.mul(
          vec4(positionLocal.xy.mul(0.036).mul(modelScale.x), 0, 0),
        ),
      ).xyz,
    );
    material.colorNode = attribute<"vec3">("aRadiance", "vec3").mul(1.9);
    material.opacityNode = pow(
      max(0, float(1).sub(length(uv().sub(0.5).mul(2)))),
      2,
    );
    material.side = T.DoubleSide;
    const mesh = new T.Mesh(g, material);
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.group.visible = false;
  }
  release(kind: ReleaseKind, angle: number) {
    this.model.release(kind, angle);
    this.group.visible = true;
  }
  update(dt: number) {
    this.model.advance(dt);
    const model = this.model,
      t = model.time;
    if (!model.launched) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    const sample = t - this.sampleAt >= 1 / 30;
    if (sample) this.sampleAt = t;
    let vertex = 0;
    for (let i = 0; i < model.capacity; i++) {
      const j = i * 3,
        state = model.states[i];
      this.heads.set(model.positions.subarray(j, j + 3), j);
      const radius = Math.hypot(
        model.positions[j],
        model.positions[j + 1],
        model.positions[j + 2],
      );
      const heat = Math.max(0, 1 - (radius - 1) / 2.4);
      const fade =
        state === 1 ? 1 : Math.max(0, 1 - (t - model.endedAt[i]) / 2.5);
      const rgb = [0.38 + heat * 0.6, 0.75 - heat * 0.2, 0.82 - heat * 0.5];
      this.radiance.set(state === 1 ? rgb : [0, 0, 0], j);
      if (!state) continue;
      if (this.generations[i] !== model.generations[i]) {
        this.generations[i] = model.generations[i];
        this.lengths[i] = 0;
        this.cursors[i] = 0;
      }
      if ((sample && state === 1) || this.lengths[i] === 0) {
        const index = (i * this.historySize + this.cursors[i]) * 3;
        this.history.set(model.positions.subarray(j, j + 3), index);
        this.cursors[i] = (this.cursors[i] + 1) % this.historySize;
        this.lengths[i] = Math.min(this.historySize, this.lengths[i] + 1);
      }
      for (let n = 1; n < this.lengths[i]; n++) {
        const a =
          (i * this.historySize +
            ((this.cursors[i] - n + this.historySize) % this.historySize)) *
          3;
        const b =
          (i * this.historySize +
            ((this.cursors[i] - n - 1 + this.historySize) % this.historySize)) *
          3;
        const strength = Math.pow(1 - n / this.historySize, 1.5) * fade;
        for (let k = 0; k < 3; k++) {
          this.trailPositions[vertex + k] = this.history[a + k];
          this.trailPositions[vertex + k + 3] = this.history[b + k];
          this.trailColors[vertex + k] = rgb[k] * strength;
          this.trailColors[vertex + k + 3] = rgb[k] * strength;
        }
        vertex += 6;
      }
    }
    this.trailGeometry.setDrawRange(0, vertex / 3);
    this.trailGeometry.attributes.position.needsUpdate = true;
    this.trailGeometry.attributes.color.needsUpdate = true;
    this.headGeometry.attributes.aTracer.needsUpdate = true;
    this.headGeometry.attributes.aRadiance.needsUpdate = true;
  }
  clear() {
    this.model.clear();
    this.lengths.fill(0);
    this.generations.fill(0);
    this.radiance.fill(0);
    this.group.visible = false;
  }
}
