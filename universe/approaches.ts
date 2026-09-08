import * as T from "three/webgpu";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import {
  attribute,
  color,
  float,
  mix,
  mx_noise_float,
  normalView,
  positionLocal,
  positionView,
  modelScale,
  sin,
  smoothstep,
  uniform,
  vec3,
} from "three/tsl";
import type { Body } from "./world";
import { terrainHeight, terrainClearance } from "./approach-terrain";
import { clamp, seeded, type Quality } from "./config";
import { treeGeometry } from "./sanctuary-nature";
import type { NebulaLibrary } from "./nebula";
import { reliefNormal } from "./planets";
import { RegionalLagoon } from "./approach-water";
import { groundHeight, lagoonHeight, NACRE_ENTRY_Z } from "./walk-ground";
import type { WalkSurface } from "./walk";
import { NacreGarden } from "./nacre-garden";
import { markSurface } from "./perception/surfaces";

type Region = {
  body: Body;
  root: T.Group;
  up: T.Vector3;
  frame: T.Quaternion;
  inverse: T.Quaternion;
  particles: T.InstancedMesh;
  color: T.Color;
  lagoon?: RegionalLagoon;
  garden?: NacreGarden;
};
export class PlanetApproaches {
  active = "";
  reflectiveMeshes: T.Mesh[] = [];
  private regions: Region[] = [];
  private time = uniform(0);
  private viewer = uniform(new T.Vector3(0, -100, 0));
  private motion = uniform(0);
  private background = new T.Color(0x020407);
  private black = new T.Color(0x020407);
  constructor(
    private scene: T.Scene,
    bodies: Body[],
    nebulae: NebulaLibrary,
  ) {
    scene.background = this.background;
    for (const body of bodies.filter((b) =>
      ["moon", "serein", "ember", "nacre", "giant"].includes(b.id),
    )) {
      const kind = body.archetype,
        root = new T.Group();
      const up = new T.Vector3(-0.6, 0.33, 0.73).normalize();
      const frame = new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        up,
      );
      root.position.copy(up);
      root.quaternion.copy(frame);
      body.object.add(root);
      const inverse = frame.clone().invert();
      const localPoint = (x: number, z: number, extra = 0) =>
        new T.Vector3(
          x,
          Math.sqrt(Math.max(0, 1 - x * x - z * z)) -
            1 +
            terrainHeight(kind, x, z) +
            extra,
          z,
        );
      const geometry = new T.PlaneGeometry(0.62, 0.62, 100, 100);
      const positions = geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
        const p = localPoint(positions.getX(i), positions.getY(i));
        positions.setXYZ(i, p.x, p.y, p.z);
      }
      geometry.setIndex(Array.from(geometry.index!.array).reverse());
      geometry.computeVertexNormals();
      const material = new T.MeshStandardNodeMaterial({
        roughness: kind === 2 ? 0.28 : 0.9,
        metalness: kind === 2 ? 0.18 : 0,
      });
      const palettes =
        kind === 2
          ? [0x214660, 0x82bacd]
          : kind === 9
            ? [0x5d3e25, 0xcaa779]
            : kind === 6
              ? [0x0e1216, 0x343a3e]
              : kind === 10
                ? [0x142d2b, 0x617766]
                : [0x666556, 0xd1ccaf];
      const grain = mx_noise_float(positionLocal.mul(kind === 2 ? 1200 : 2800))
        .mul(0.12)
        .add(0.88);
      const elevation = positionLocal.y.add(
        positionLocal.xz.length().pow(2).mul(0.5),
      );
      material.colorNode = mix(
        color(palettes[0]),
        color(palettes[1]),
        smoothstep(0.016, 0.047, elevation),
      ).mul(grain);
      material.normalNode = reliefNormal(
        mx_noise_float(positionLocal.mul(kind === 2 ? 320 : 1800)).mul(
          kind === 2 ? 0.0001 : 0.000012,
        ),
      );
      if (kind === 10) {
        const stone = mx_noise_float(positionLocal.mul(14500))
          .mul(0.5)
          .add(0.5);
        const moss = mx_noise_float(positionLocal.mul(5800)).mul(0.5).add(0.5);
        const detail = mx_noise_float(positionLocal.mul(110000))
          .mul(0.12)
          .add(0.88);
        material.colorNode = mix(
          color(0x18332f),
          color(0x455555),
          smoothstep(0.28, 0.75, moss),
        )
          .mul(stone.mul(0.3).add(0.7))
          .mul(detail);
        material.normalNode = reliefNormal(
          stone.mul(0.000006).add(detail.mul(0.000001)),
        );
        material.roughnessNode = mix(float(0.48), float(0.9), moss);
      }
      if (kind === 2)
        material.emissiveNode = color(0x266779).mul(
          sin(
            positionLocal.x.mul(890).add(sin(positionLocal.z.mul(170)).mul(4)),
          )
            .abs()
            .pow(18)
            .mul(0.07),
        );
      if (kind !== 1)
        root.add(
          markSurface(
            new T.Mesh(geometry, material),
            kind === 9 ? "sand" : kind === 2 ? "ice" : "terrain",
            true,
          ),
        );
      else {
        geometry.dispose();
        material.dispose();
      }
      let lagoon: RegionalLagoon | undefined;
      let garden: NacreGarden | undefined;
      if (kind === 10) {
        lagoon = new RegionalLagoon(root, this.time, this.viewer, this.motion);
        garden = new NacreGarden(root, body.radius, material);
        this.reflectiveMeshes.push(lagoon.mesh);
      }
      if (kind === 6) {
        const water = new T.MeshBasicNodeMaterial({ side: T.DoubleSide });
        const p = positionLocal;
        const cracks = mx_noise_float(
          p.mul(360).add(vec3(this.time.mul(0.0015), 0, 0)),
        )
          .add(mx_noise_float(p.mul(1200)).mul(0.22))
          .abs();
        const heat = float(1).sub(smoothstep(0.008, 0.06, cracks));
        water.colorNode = mix(
          color(0x111518),
          color(0xff5621).mul(1.25),
          heat,
        ).add(
          color(0xa42b0d)
            .mul(float(1).sub(smoothstep(0.01, 0.14, cracks)))
            .mul(0.12),
        );
        const basin = new T.RingGeometry(0.00001, 0.093, 128, 20);
        const bp = basin.getAttribute("position");
        for (let i = 0; i < bp.count; i++) {
          const x = bp.getX(i),
            z = bp.getY(i);
          bp.setXYZ(i, x, Math.sqrt(1 - x * x - z * z) - 1 + 0.024, z);
        }
        basin.computeVertexNormals();
        root.add(new T.Mesh(basin, water));
      }
      const random = seeded(kind * 731);
      if (kind === 2 || kind === 10) {
        const tree = kind === 10 ? treeGeometry(816) : undefined;
        const geometry = tree ? tree.geometry : new T.ConeGeometry(1, 1, 5, 1);
        const material = new T.MeshStandardMaterial({
          color: kind === 2 ? 0x9ccecb : 0x203e35,
          roughness: 0.44,
          emissive: kind === 2 ? 0x123039 : 0x254d37,
          emissiveIntensity: 0.3,
        });
        const formCount = kind === 2 ? 150 : 85;
        const forms = new T.InstancedMesh(geometry, material, formCount),
          dummy = new T.Object3D();
        const leafMaterial = new T.MeshStandardNodeMaterial({ roughness: 0.9 });
        leafMaterial.colorNode = color(0x416455).mul(
          mx_noise_float(positionLocal.mul(5)).mul(0.25).add(0.8),
        );
        leafMaterial.emissiveNode = color(0x63bba2).mul(
          float(1).sub(normalView.z.abs()).pow(3).mul(0.12).add(0.04),
        );
        const leafSource = new T.IcosahedronGeometry(1, 2);
        leafSource.deleteAttribute("normal");
        leafSource.deleteAttribute("uv");
        const leafGeometry = mergeVertices(leafSource);
        leafSource.dispose();
        const lp = leafGeometry.getAttribute("position");
        for (let i = 0; i < lp.count; i++) {
          const x = lp.getX(i),
            y = lp.getY(i),
            z = lp.getZ(i);
          const shape = 1 + Math.sin(Math.atan2(z, x) * 7 + y * 4) * 0.09;
          lp.setXYZ(
            i,
            x * shape,
            y + Math.sin(x * 5 + z * 3) * 0.12,
            z * shape,
          );
        }
        leafGeometry.computeVertexNormals();
        const leaves = tree
          ? new T.InstancedMesh(
              leafGeometry,
              leafMaterial,
              formCount * tree.tips.length,
            )
          : undefined;
        if (!leaves) {
          leafMaterial.dispose();
          leafGeometry.dispose();
        }
        const leaf = new T.Object3D();
        for (let i = 0; i < formCount; i++) {
          const angle = random() * Math.PI * 2,
            r = 0.15 + random() * 0.11;
          const x =
            kind === 2
              ? (i % 2 ? 1 : -1) * (0.065 + random() * 0.036)
              : Math.cos(angle) * r;
          const z = kind === 2 ? (random() - 0.65) * 0.34 : Math.sin(angle) * r;
          const h = (kind === 2 ? 0.024 : 0.045) * (0.3 + random());
          dummy.position.copy(localPoint(x, z, kind === 2 ? h * 0.48 : 0));
          if (kind === 10 && Math.hypot(x, z - NACRE_ENTRY_Z) < 0.018)
            dummy.position.copy(localPoint(x + 0.035, z));
          dummy.rotation.set(
            (random() - 0.5) * 0.45,
            random() * Math.PI,
            (random() - 0.5) * 0.3,
          );
          dummy.scale.set(
            h * (kind === 2 ? 0.19 : 1.2),
            h,
            h * (kind === 2 ? 0.15 : 1.2),
          );
          dummy.updateMatrix();
          forms.setMatrixAt(i, dummy.matrix);
          if (tree && leaves)
            tree.tips.forEach((tip, j) => {
              leaf.position.copy(tip).applyMatrix4(dummy.matrix);
              leaf.quaternion.copy(dummy.quaternion);
              leaf.scale.set(h * 0.13, h * 0.045, h * 0.16);
              leaf.updateMatrix();
              leaves.setMatrixAt(i * tree.tips.length + j, leaf.matrix);
            });
        }
        markSurface(forms, kind === 10 ? "vegetation" : "ice", true);
        root.add(forms);
        if (leaves) root.add(leaves);
      }
      if (kind === 1) {
        for (const [x, z] of [
          [-0.12, -0.13],
          [0.16, -0.08],
          [0.07, 0.2],
        ]) {
          const cloud = nebulae.create(2);
          cloud.position.set(x, 0.025, z);
          cloud.scale.set(0.46, 0.12, 0.55);
          root.add(cloud);
        }
      }
      const seeds = new Float32Array(440 * 3);
      for (let i = 0; i < seeds.length; i++) seeds[i] = random();
      const moteGeometry = new T.IcosahedronGeometry(1, 0);
      moteGeometry.setAttribute(
        "moteSeed",
        new T.InstancedBufferAttribute(seeds, 3),
      );
      const moteMaterial = new T.MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
      });
      const seed = vec3(attribute("moteSeed", "vec3")),
        phase = seed.x.add(this.time.mul(kind === 2 ? 0.035 : 0.016)).fract();
      const height =
        kind === 2 ? phase.mul(0.085).add(0.007) : phase.mul(0.018).add(0.029);
      const x =
        kind === 2
          ? seed.y
              .sub(0.5)
              .mul(0.025)
              .add(sin(phase.mul(7).add(seed.x.mul(4))).mul(0.006))
          : seed.y
              .sub(0.5)
              .mul(0.46)
              .add(this.time.mul(0.0008))
              .mod(0.46)
              .sub(0.06);
      const z = seed.z.sub(0.5).mul(kind === 2 ? 0.22 : 0.45);
      moteMaterial.positionNode = positionLocal
        .mul(kind === 2 ? 0.00009 : 0.00007)
        .add(vec3(x, height, z));
      moteMaterial.colorNode = color(
        kind === 6 ? 0xffa054 : kind === 9 ? 0xf4d5a1 : 0x8ce8d8,
      ).mul(1.6);
      moteMaterial.opacityNode = sin(phase.mul(Math.PI))
        .mul(0.45)
        .mul(smoothstep(0.003, 0.012, positionView.length().div(modelScale.x)));
      const particles = new T.InstancedMesh(moteGeometry, moteMaterial, 440);
      const identity = new T.Matrix4();
      for (let i = 0; i < 440; i++) particles.setMatrixAt(i, identity);
      particles.frustumCulled = false;
      root.add(particles);
      const colorValue =
        kind === 2
          ? 0x486974
          : kind === 9
            ? 0x72624b
            : kind === 6
              ? 0x342920
              : kind === 10
                ? 0x234e4c
                : 0x6b6b5a;
      this.regions.push({
        body,
        root,
        up,
        frame,
        inverse,
        particles,
        color: new T.Color(colorValue),
        lagoon,
        garden,
      });
      // Approach is a continuous flight into a region, not a scene swap.
      body.approachArrival = localPoint(
        0,
        kind === 10 ? NACRE_ENTRY_Z : 0.12,
        kind === 1 ? 0.018 : 0.0045,
      )
        .applyQuaternion(frame)
        .add(up)
        .multiplyScalar(body.radius)
        .add(body.position);
      body.approachGaze = localPoint(0.01, -0.16, kind === 1 ? 0.065 : 0.019)
        .applyQuaternion(frame)
        .add(up)
        .multiplyScalar(body.radius)
        .add(body.position);
      if (kind === 1) {
        const ringNormal = new T.Vector3(0, 0, 1).applyEuler(
          new T.Euler(-1.02, 0.14, -0.21),
        );
        body.approachGaze = up
          .clone()
          .addScaledVector(ringNormal, -up.dot(ringNormal))
          .normalize()
          .multiplyScalar(body.radius * 2.2)
          .add(body.position);
      }
      body.approachUp = up;
      body.clearance = (direction) => {
        const local = direction.clone().applyQuaternion(inverse);
        return (
          body.radius * terrainClearance(kind, local.x, local.y, local.z) + 2
        );
      };
    }
  }
  walkSurface(id: string): WalkSurface | undefined {
    const region = this.regions.find((r) => r.body.id === id && id === "nacre");
    if (!region) return;
    return {
      id,
      radius: region.body.radius,
      center: region.body.position,
      frame: region.frame,
      up: region.up,
      height: (x, z) => groundHeight(10, x, z),
      water: lagoonHeight,
    };
  }
  pilgrimSurface(id: string): WalkSurface | undefined {
    const region = this.regions.find(
      (r) => r.body.id === id && r.body.archetype !== 1,
    );
    if (!region) return;
    return {
      id,
      radius: region.body.radius,
      center: region.body.position,
      frame: region.frame,
      up: region.up,
      height: (x, z) => groundHeight(region.body.archetype, x, z),
      water: id === "nacre" ? lagoonHeight : () => -10,
    };
  }
  inspectGarden() {
    return this.regions.find((r) => r.garden)?.garden?.inspect();
  }
  update(observer: T.Vector3, time: number, speed: number) {
    this.time.value = time;
    this.active = "";
    let presence = 0,
      region: Region | undefined;
    for (const r of this.regions) {
      const distance = observer.distanceTo(r.body.position) / r.body.radius;
      r.root.visible = distance < 3.8;
      const local = observer
        .clone()
        .sub(r.body.position)
        .divideScalar(r.body.radius)
        .sub(r.up)
        .applyQuaternion(r.inverse);
      if (r.root.visible) r.lagoon?.update(local);
      r.garden?.update(local, time, speed, r.root.visible);
      const weight =
        clamp((1.42 - distance) / 0.32) *
        clamp((0.4 - Math.max(Math.abs(local.x), Math.abs(local.z))) / 0.1);
      if (weight > presence) {
        presence = weight;
        region = r;
        this.viewer.value.copy(local);
      }
    }
    this.background.copy(this.black);
    if (region) {
      this.background.lerp(region.color, presence * 0.09);
      this.motion.value += (Math.min(1, speed / 30) - this.motion.value) * 0.03;
      if (presence > 0.15) this.active = region.body.id;
    }
  }
  setQuality(quality: Quality) {
    const count = { ULTRA: 440, HIGH: 340, BALANCED: 220, BATTERY: 100 }[
      quality
    ];
    this.regions.forEach((r) => {
      r.particles.count = count;
      r.lagoon?.setQuality(quality);
      r.garden?.setQuality(quality);
    });
  }
  dispose() {
    this.regions.forEach((r) => r.lagoon?.dispose());
  }
}
