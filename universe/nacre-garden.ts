import * as T from "three/webgpu";
import {
  attribute,
  color,
  float,
  mix,
  mx_noise_float,
  positionLocal,
  positionWorld,
  sin,
  smoothstep,
  uniform,
  uniformArray,
  uv,
  vec3,
  vec4,
} from "three/tsl";
import { seeded, damp, QUALITY, type Quality } from "./config";
import { groundHeight, lagoonHeight, NACRE_ENTRY_Z } from "./walk-ground";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { grassInfluence, pilgrimObserver } from "./pilgrim/influence";

/** Local life and human-scale detail, attached to Nacre's existing spherical cap. */
export class NacreGarden {
  stillness = 0;
  private time = uniform(0);
  private lastTime = 0;
  private stepIndex = 0;
  private previousStep = new T.Vector3(100, 0, 100);
  private steps = Array.from(
    { length: 10 },
    () => new T.Vector4(100, 100, -100, 0),
  );
  private footsteps = uniformArray(this.steps, "vec4");
  readonly glow: T.Node<"vec3">;
  private grasses: { mesh: T.InstancedMesh; x: number; z: number }[] = [];
  private lights: T.InstancedMesh;
  private creatures = Array.from({ length: 72 }, () => ({
    p: new T.Vector3(),
    v: new T.Vector3(),
  }));
  private creatureAnchor = new T.Vector3(100, 100, 100);
  private dummy = new T.Object3D();
  private desired = new T.Vector3();
  private grassCount = 650;
  constructor(
    root: T.Group,
    private radius: number,
    material: T.MeshStandardNodeMaterial,
  ) {
    // Footprints are short-lived world-space state, not a halo glued to the camera.
    let response: T.Node<"float"> = float(0);
    for (let i = 0; i < this.steps.length; i++) {
      const step = vec4(this.footsteps.element(i)),
        age = this.time.sub(step.z).max(0);
      const distance = positionLocal.xz.sub(step.xy).length().mul(radius);
      response = response.add(
        distance.mul(-1.9).exp().mul(age.mul(-0.23).exp()).mul(step.w),
      );
    }
    const moss = mx_noise_float(positionLocal.mul(37000)).mul(0.5).add(0.5);
    this.glow = color(0x6fd7bc).mul(response.min(1).mul(moss.pow(3)).mul(0.8));
    material.emissiveNode = this.glow;

    // Three curved curtains occupy the sky volume and appear in the lagoon reflector.
    for (let layer = 0; layer < 3; layer++) {
      const geometry = new T.PlaneGeometry(1, 1, 180, 20),
        p = geometry.getAttribute("position");
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i) + 0.5,
          v = p.getY(i) + 0.5;
        const x = (u - 0.5) * (0.8 + layer * 0.1);
        const arc =
          Math.sin(u * 7 + layer * 0.9) * 0.018 + Math.sin(u * 17) * 0.004;
        p.setXYZ(
          i,
          x,
          0.11 + arc + v * (0.15 + layer * 0.012),
          -0.12 - layer * 0.11 + Math.cos(u * 5.5 + layer) * 0.06,
        );
      }
      geometry.computeVertexNormals();
      const aurora = new T.MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        side: T.DoubleSide,
        blending: T.AdditiveBlending,
      });
      const u = uv().x,
        v = uv().y.clamp(0, 1);
      const folds = sin(
        u.mul(76).add(sin(u.mul(23).add(this.time.mul(0.04))).mul(4)),
      )
        .mul(0.5)
        .add(0.5);
      const wisps = mx_noise_float(
        vec3(u.mul(47), v.mul(1.3), this.time.mul(0.018)),
      )
        .mul(0.5)
        .add(0.5);
      const edge = smoothstep(0, 0.06, v).mul(
        float(1).sub(smoothstep(0.15, 0.95, v)),
      );
      const ends = smoothstep(0, 0.15, u).mul(
        float(1).sub(smoothstep(0.78, 1, u)),
      );
      aurora.colorNode = mix(color(0x72d7b3), color(0x91afcb), v.pow(0.6)).mul(
        1.15,
      );
      const rays = sin(u.mul(580).add(wisps.mul(7)))
        .mul(0.12)
        .add(0.88);
      aurora.opacityNode = edge
        .mul(ends)
        .mul(folds.mul(0.48).add(0.25))
        .mul(wisps)
        .mul(rays)
        .mul(layer === 0 ? 0.42 : 0.19);
      aurora.positionNode = positionLocal.add(
        vec3(
          0,
          sin(u.mul(14).add(this.time.mul(0.035))).mul(0.003),
          sin(u.mul(19).add(this.time.mul(0.04)))
            .mul(v)
            .mul(0.006),
        ),
      );
      root.add(new T.Mesh(geometry, aurora));
    }

    // Small deterministic grass tiles stream underfoot; no astronomical grass overdraw.
    const blade = new T.PlaneGeometry(0.07, 1, 1, 4);
    blade.translate(0, 0.5, 0);
    const bp = blade.getAttribute("position");
    for (let i = 0; i < bp.count; i++) {
      const y = bp.getY(i);
      bp.setX(i, bp.getX(i) * (1 - y * 0.94) + y * y * 0.2);
    }
    blade.computeVertexNormals();
    const tuft = Array.from({ length: 5 }, (_, i) =>
      blade
        .clone()
        .scale(1, 0.5 + i * 0.12, 1)
        .rotateY(i * 2.39996),
    );
    const blades = mergeGeometries(tuft);
    tuft.forEach((g) => g.dispose());
    blade.dispose();
    const grass = new T.MeshBasicNodeMaterial({ side: T.DoubleSide });
    const phase = float(attribute("grassPhase", "float")),
      h = uv().y.clamp(0, 1);
    // Thin near-clipped triangles can interpolate just below zero in GLSL.
    // A fractional power then poisons the bloom chain with NaNs (even at zero gain).
    grass.colorNode = mix(color(0x183530), color(0x9ba995), h.mul(h)).mul(0.65);
    grass.positionNode = positionLocal.add(
      vec3(
        sin(this.time.mul(0.7).add(phase))
          .mul(h.pow(2))
          .mul(0.13)
          .add(
            grassInfluence(positionWorld.add(pilgrimObserver))
              .mul(h.pow(2))
              .mul(0.6),
          ),
        0,
        sin(this.time.mul(0.4).add(phase.mul(1.8)))
          .mul(h.pow(2))
          .mul(0.1),
      ),
    );
    const random = seeded(8821),
      phases = Float32Array.from({ length: 900 }, () => random() * 6.28);
    blades.setAttribute(
      "grassPhase",
      new T.InstancedBufferAttribute(phases, 1),
    );
    for (let i = 0; i < 9; i++) {
      const mesh = new T.InstancedMesh(blades, grass, 900);
      mesh.visible = false;
      mesh.frustumCulled = false;
      root.add(mesh);
      this.grasses.push({ mesh, x: Infinity, z: Infinity });
    }
    const rocks = new T.InstancedMesh(
      new T.IcosahedronGeometry(1, 2),
      new T.MeshStandardMaterial({
        color: 0x354b4c,
        roughness: 0.42,
        metalness: 0.08,
      }),
      96,
    );
    for (let i = 0; i < 96; i++) {
      const x = (random() - 0.5) * 0.016,
        z = NACRE_ENTRY_Z + (random() - 0.5) * 0.018;
      const size = (0.3 + random() ** 3 * 2) / radius;
      this.dummy.position.set(x, groundHeight(10, x, z), z);
      this.dummy.rotation.set(random(), random() * 6, random());
      this.dummy.scale.set(size * 1.5, size * 0.5, size);
      this.dummy.updateMatrix();
      rocks.setMatrixAt(i, this.dummy.matrix);
    }
    root.add(rocks);

    const living = new T.MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
    });
    living.colorNode = color(0xc3e9be).mul(1.2);
    living.opacityNode = float(1)
      .sub(uv().sub(0.5).length().mul(2))
      .max(0)
      .pow(2);
    // Soft observer-facing motes, with independent persistent positions and velocities.
    living.side = T.DoubleSide;
    this.lights = new T.InstancedMesh(new T.PlaneGeometry(2, 2), living, 72);
    this.lights.frustumCulled = false;
    this.lights.visible = false;
    root.add(this.lights);
  }
  private plant(tile: (typeof this.grasses)[number], x: number, z: number) {
    tile.x = x;
    tile.z = z;
    const random = seeded(Math.imul(x, 73856093) ^ Math.imul(z, 19349663));
    for (let i = 0; i < 900; i++) {
      const px = (x * 20 + random() * 20) / this.radius,
        pz = (z * 20 + random() * 20) / this.radius;
      const h = groundHeight(10, px, pz),
        water = lagoonHeight(px, pz);
      const size = (0.22 + random() ** 2 * 1.1) / this.radius;
      this.dummy.position.set(px, h, pz);
      this.dummy.rotation.set(0, random() * 6.28, 0);
      this.dummy.scale.setScalar(water > h + 0.25 / this.radius ? 0 : size);
      this.dummy.updateMatrix();
      tile.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    tile.mesh.instanceMatrix.needsUpdate = true;
  }
  update(viewer: T.Vector3, time: number, speed: number, near: boolean) {
    const dt = Math.min(1 / 30, Math.max(0, time - this.lastTime));
    this.lastTime = time;
    this.time.value = time;
    const height = groundHeight(10, viewer.x, viewer.z);
    const local =
      near &&
      (viewer.y - height) * this.radius < 110 &&
      Math.max(Math.abs(viewer.x), Math.abs(viewer.z)) < 0.29;
    this.stillness +=
      ((local && speed < 0.8 ? 1 : 0) - this.stillness) *
      damp(local && speed < 0.8 ? 0.12 : 0.8, dt);
    if (local) {
      const cx = Math.floor((viewer.x * this.radius) / 20),
        cz = Math.floor((viewer.z * this.radius) / 20);
      for (let i = 0; i < 9; i++) {
        const x = cx + (i % 3) - 1,
          z = cz + Math.floor(i / 3) - 1;
        if (this.grasses.some((g) => g.x === x && g.z === z)) continue;
        const tile = this.grasses.find(
          (g) => Math.abs(g.x - cx) > 1 || Math.abs(g.z - cz) > 1,
        )!;
        this.plant(tile, x, z);
        break; // Bound CPU work: at most one 20 m tile per frame.
      }
      if (
        dt > 0 &&
        speed > 0.3 &&
        viewer.distanceTo(this.previousStep) * this.radius > 1.2 &&
        (viewer.y - height) * this.radius < 4
      ) {
        this.steps[this.stepIndex].set(viewer.x, viewer.z, time, 1);
        this.stepIndex = (this.stepIndex + 1) % this.steps.length;
        this.previousStep.copy(viewer);
      }
    }
    this.grasses.forEach((g) => {
      g.mesh.visible = local && Number.isFinite(g.x);
      g.mesh.count = this.grassCount;
    });
    this.lights.visible = local;
    if (!local) return;
    if (this.creatureAnchor.distanceTo(viewer) * this.radius > 80) {
      this.creatureAnchor.copy(viewer);
      this.creatures.forEach((c, i) => {
        const a = i * 2.39996;
        c.p
          .copy(viewer)
          .add(
            new T.Vector3(
              Math.cos(a) * 18,
              4 + (i % 4),
              Math.sin(a) * 18,
            ).divideScalar(this.radius),
          );
        c.v.set(0, 0, 0);
      });
    }
    this.creatures.forEach((c, i) => {
      const angle = i * 2.39996 + time * 0.065,
        orbit =
          (4 + (i % 9) * 0.5) * this.stillness +
          (18 + (i % 12)) * (1 - this.stillness);
      this.desired
        .copy(viewer)
        .add(
          new T.Vector3(
            Math.cos(angle) * orbit,
            Math.sin(angle * 1.9 + time * 0.3) * 1.2 + 1.8,
            Math.sin(angle) * orbit,
          ).divideScalar(this.radius),
        );
      const floor = Math.max(
        groundHeight(10, c.p.x, c.p.z),
        lagoonHeight(c.p.x, c.p.z),
      );
      this.desired.y = Math.max(this.desired.y, floor + 1 / this.radius);
      c.v
        .addScaledVector(this.desired.sub(c.p), dt * 0.6)
        .multiplyScalar(Math.exp(-dt * 1.1));
      c.p.addScaledVector(c.v, dt);
      this.dummy.position.copy(c.p);
      this.dummy.lookAt(viewer);
      this.dummy.scale.setScalar(
        ((0.035 + this.stillness * 0.045) *
          (0.8 + Math.sin(time * 0.7 + i) * 0.2)) /
          this.radius,
      );
      this.dummy.updateMatrix();
      this.lights.setMatrixAt(i, this.dummy.matrix);
    });
    this.lights.instanceMatrix.needsUpdate = true;
  }
  setQuality(quality: Quality) {
    this.grassCount = QUALITY[quality].nacreGrass;
  }
  inspect() {
    return {
      stillness: this.stillness,
      blades:
        this.grasses.filter((g) => g.mesh.visible).length * this.grassCount,
      footprints: this.steps.filter(
        (s) => this.time.value - s.z < 12 && s.w > 0,
      ).length,
      lifeVisible: this.lights.visible,
      lifeCount: this.lights.count,
    };
  }
}
