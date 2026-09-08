import * as T from "three/webgpu";
import {
  mergeGeometries,
  mergeVertices,
} from "three/addons/utils/BufferGeometryUtils.js";
import {
  attribute,
  float,
  length,
  max,
  mix,
  normalWorld,
  positionLocal,
  positionWorld,
  pow,
  sin,
  smoothstep,
  texture3D,
  uv,
  vec3,
} from "three/tsl";
import { seeded, type Quality } from "./config";
import type { SanctuaryAtmosphere } from "./sanctuary-atmosphere";

type Places = { id: string; object: T.Group; position: T.Vector3 }[];
function rockGeometry() {
  const source = new T.IcosahedronGeometry(1, 12);
  source.deleteAttribute("normal");
  source.deleteAttribute("uv");
  const g = mergeVertices(source),
    p = g.attributes.position;
  source.dispose();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    const d =
      1 +
      Math.sin(x * 3.9 + y * 1.8 + z * 2.2) * 0.12 +
      Math.sin(z * 9 - x * 3 + y * 7) * 0.048 +
      Math.sin(y * 26 + x * 8 + z * 11) * 0.016;
    p.setXYZ(i, x * d, y * d, z * d);
  }
  g.computeVertexNormals();
  return g;
}
function islandGeometry(
  rx: number,
  rz: number,
  height: number,
  depth: number,
  seed: number,
) {
  const p: number[] = [],
    ids: number[] = [];
  const slices = 96,
    rows = 32;
  for (let j = 0; j <= rows; j++) {
    const t = j / rows,
      r = Math.sin(t * Math.PI);
    for (let i = 0; i <= slices; i++) {
      const a = (i / slices) * Math.PI * 2,
        edge =
          1 + Math.sin(a * 5 + seed) * 0.08 + Math.sin(a * 9 - seed) * 0.035;
      const y =
        t < 0.5
          ? height * Math.pow(Math.max(0, Math.cos(t * Math.PI)), 0.4)
          : -depth * Math.pow(Math.max(0, -Math.cos(t * Math.PI)), 1.3);
      p.push(
        Math.cos(a) * r * rx * edge,
        y + Math.sin(a * 7 + t * 17 + seed) * r * 8,
        Math.sin(a) * r * rz * edge,
      );
    }
  }
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < slices; i++) {
      const a = j * (slices + 1) + i,
        b = a + slices + 1;
      ids.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
  g.setIndex(ids);
  g.computeVertexNormals();
  return g;
}
function treeGeometry(seed: number) {
  const random = seeded(seed),
    parts: T.BufferGeometry[] = [],
    tips: T.Vector3[] = [];
  function branch(
    start: T.Vector3,
    direction: T.Vector3,
    size: number,
    width: number,
    depth: number,
  ) {
    const end = start.clone().addScaledVector(direction, size);
    const curve = new T.CatmullRomCurve3([
      start,
      start
        .clone()
        .lerp(end, 0.32)
        .add(new T.Vector3(size * 0.035, 0, size * 0.025)),
      start
        .clone()
        .lerp(end, 0.72)
        .add(new T.Vector3(-size * 0.045, 0, 0)),
      end,
    ]);
    const segments = depth === 0 ? 10 : 6,
      radial = 12;
    const g = new T.TubeGeometry(curve, segments, width, radial, false),
      p = g.attributes.position;
    for (let j = 0; j <= segments; j++) {
      const center = curve.getPointAt(j / segments),
        taper = 1 - (j / segments) * 0.78;
      for (let i = 0; i <= radial; i++) {
        const k = j * (radial + 1) + i;
        p.setXYZ(
          k,
          center.x + (p.getX(k) - center.x) * taper,
          center.y + (p.getY(k) - center.y) * taper,
          center.z + (p.getZ(k) - center.z) * taper,
        );
      }
    }
    g.computeVertexNormals();
    parts.push(g);
    if (depth < 3)
      for (let i = 0; i < 3; i++) {
        const a = random() * Math.PI * 2,
          tilt = depth === 0 ? 0.8 : 0.92;
        const d = new T.Vector3(
          Math.cos(a) * tilt,
          0.4 + random() * 0.45,
          Math.sin(a) * tilt,
        ).normalize();
        branch(
          curve.getPoint(0.55 + i * 0.19),
          d,
          size * (0.43 + random() * 0.15),
          width * 0.44,
          depth + 1,
        );
      }
    else tips.push(end);
  }
  branch(
    new T.Vector3(),
    new T.Vector3(0.03, 1, 0.025).normalize(),
    1,
    0.031,
    0,
  );
  const merged = mergeGeometries(parts)!;
  parts.forEach((g) => g.dispose());
  return { geometry: merged, tips };
}

export class SanctuaryNature {
  private leaves: T.InstancedMesh[] = [];
  private foliageCounts: number[] = [];
  private trees: T.InstancedMesh[] = [];
  private treeCounts: number[] = [];
  private grass: T.InstancedMesh[] = [];
  constructor(
    places: Places,
    private air: SanctuaryAtmosphere,
  ) {
    const get = (id: string) => places.find((p) => p.id === id)!.object;
    const rock = rockGeometry();
    const stone = new T.MeshBasicNodeMaterial();
    const world = positionWorld.add(air.observer);
    const n = texture3D(air.density, world.mul(0.005)).r;
    const moss = smoothstep(0.22, 0.8, normalWorld.y).mul(
      smoothstep(0.36, 0.64, n),
    );
    const strata = sin(world.y.mul(0.045).add(n.mul(5)))
      .mul(0.1)
      .add(0.9);
    const detail = texture3D(air.density, world.mul(0.032)).r;
    const lighting = normalWorld
      .dot(vec3(-0.5, 0.7, 0.25).normalize())
      .mul(0.26)
      .add(0.51);
    stone.colorNode = air.haze(
      mix(vec3(0.023, 0.041, 0.046), vec3(0.055, 0.11, 0.078), moss)
        .mul(n.mul(0.7).add(0.5))
        .mul(lighting)
        .mul(strata)
        .mul(detail.mul(0.45).add(0.78)),
      0.00036,
    );
    const rockGroup = (root: T.Group, specs: number[][]) => {
      const mesh = new T.InstancedMesh(rock, stone, specs.length),
        d = new T.Object3D();
      specs.forEach(([x, y, z, sx, sy, sz, rot], i) => {
        d.position.set(x, y, z);
        d.scale.set(sx, sy, sz);
        d.rotation.set(0.07, rot || 0, 0.05);
        d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix);
      });
      mesh.computeBoundingSphere();
      root.add(mesh);
      return mesh;
    };
    // Near silhouettes provide a familiar scale against the very distant sky.
    rockGroup(get("last-light"), [
      [-380, 22, -510, 65, 64, 68, 0.2],
      [-430, 12, -560, 80, 38, 66, 2],
      [-320, 4, -480, 55, 25, 31, 1],
      [640, 0, -1500, 92, 80, 86, 0.5],
      [735, -8, -1640, 130, 104, 130, 2],
      [-1320, -3, -1990, 220, 140, 135, 3],
    ]);
    const falls = get("moonfall");
    const random = seeded(3248),
      cliffs: number[][] = [];
    for (let i = 0; i < 29; i++) {
      const x = (i - 14) * 54;
      const gap = Math.abs(x) < 200;
      cliffs.push([
        x,
        gap ? 535 : 135 + random() * 120,
        -490 - random() * 160,
        80 + random() * 50,
        gap ? 115 : 360 + random() * 160,
        150 + random() * 80,
        random() * 5,
      ]);
    }
    rockGroup(falls, cliffs);
    const crown = new T.Mesh(islandGeometry(1000, 490, 510, 170, 23), stone);
    crown.position.set(-100, 20, -710);
    falls.add(crown);
    rockGroup(falls, [
      [-470, 345, -320, 265, 270, 260, 1],
      [450, 365, -340, 270, 260, 230, 2],
      [-40, 585, -460, 215, 62, 150, 0.7],
    ]);
    this.waterfall(falls, 0, 620, -100, 320);
    this.waterfall(falls, -370, 390, -20, 75);
    this.waterfall(falls, 490, 450, -100, 60);
    const mist = air.volume(
      new T.Vector3(1700, 400, 1250),
      new T.Vector3(0.1, 0.16, 0.17),
      1.45,
    );
    mist.position.set(0, -35, 120);
    falls.add(mist);
    const topMist = air.volume(
      new T.Vector3(1800, 180, 570),
      new T.Vector3(0.08, 0.14, 0.16),
      0.7,
    );
    topMist.position.set(0, 620, -350);
    falls.add(topMist);
    const bowMat = new T.MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      side: T.DoubleSide,
      blending: T.AdditiveBlending,
    });
    const r = length(positionLocal.xy);
    bowMat.colorNode = mix(
      vec3(0.21, 0.39, 0.42),
      vec3(0.42, 0.3, 0.2),
      smoothstep(410, 426, r),
    );
    bowMat.opacityNode = sin(r.sub(407).div(24).mul(Math.PI))
      .max(0)
      .mul(air.moonbow)
      .mul(0.24);
    const bow = new T.Mesh(
      new T.RingGeometry(407, 431, 128, 1, 0, Math.PI),
      bowMat,
    );
    bow.position.set(0, 5, 130);
    falls.add(bow);
    const forest = get("forest");
    const ground = new T.Mesh(islandGeometry(760, 1060, 40, 180, 41), stone);
    ground.position.y = -10;
    forest.add(ground);
    this.forest(forest, 62, 720, 950, 30, seeded(6984));
    const veil = get("veil");
    const floating = new T.Mesh(islandGeometry(490, 590, 40, 460, 92), stone);
    floating.position.y = 70;
    veil.add(floating);
    this.forest(veil, 16, 430, 430, 104, seeded(456), 0.65);
    // Small reflective pools use the same world ocean below. Hanging roots silhouette the garden.
    rockGroup(veil, [
      [-510, -40, -200, 110, 130, 150, 1],
      [580, -100, -450, 120, 210, 130, 2],
      [-780, -230, -830, 210, 300, 220, 1],
    ]);
    const cloud = air.volume(
      new T.Vector3(2600, 1250, 2100),
      new T.Vector3(0.15, 0.19, 0.19),
      1.1,
      true,
    );
    cloud.position.set(0, 60, 160);
    veil.add(cloud);
    const low = air.volume(
      new T.Vector3(3200, 510, 2100),
      new T.Vector3(0.07, 0.13, 0.145),
      0.85,
    );
    low.position.set(0, -280, 0);
    veil.add(low);
    const forestMist = air.volume(
      new T.Vector3(1800, 210, 2350),
      new T.Vector3(0.058, 0.11, 0.11),
      0.65,
    );
    forestMist.position.y = 55;
    forest.add(forestMist);
    const sky = get("living-sky");
    const skyMist = air.volume(
      new T.Vector3(3700, 620, 3400),
      new T.Vector3(0.046, 0.079, 0.092),
      0.35,
    );
    skyMist.position.set(0, -600, 0);
    sky.add(skyMist);
  }
  private waterfall(
    root: T.Group,
    x: number,
    height: number,
    z: number,
    width: number,
  ) {
    const material = new T.MeshBasicNodeMaterial({
      transparent: true,
      side: T.DoubleSide,
      depthWrite: false,
    });
    const p = uv(),
      t = this.air.time;
    const flow = texture3D(
      this.air.density,
      vec3(p.x.mul(7), p.y.mul(0.75).add(t.mul(0.033)), 0.15),
    ).r;
    const filaments = texture3D(
      this.air.density,
      vec3(p.x.mul(31), p.y.mul(1.6).add(t.mul(0.076)), 0.4),
    ).r;
    const strands = smoothstep(0.28, 0.72, flow).mul(
      filaments.mul(0.7).add(0.4),
    );
    material.positionNode = positionLocal.add(
      vec3(
        sin(p.y.mul(8).add(t.mul(0.12)))
          .mul(p.y.oneMinus())
          .mul(width * 0.012),
        0,
        sin(p.y.mul(17).add(p.x.mul(7)).add(t.mul(0.3))).mul(2),
      ),
    );
    material.colorNode = this.air.haze(
      mix(vec3(0.08, 0.19, 0.22), vec3(0.6, 0.76, 0.75), strands),
      0.00016,
    );
    material.opacityNode = smoothstep(0, 0.06, p.x)
      .mul(p.x.oneMinus().smoothstep(0, 0.06))
      .mul(smoothstep(0, 0.08, p.y))
      .mul(strands.mul(0.72).add(0.09));
    const sheet = new T.Mesh(
      new T.PlaneGeometry(width, height + 140, 24, 64),
      material,
    );
    sheet.position.set(x, (height - 140) * 0.5, z);
    root.add(sheet);
  }
  private forest(
    root: T.Group,
    count: number,
    rx: number,
    rz: number,
    ground: number,
    random: () => number,
    scale = 1,
  ) {
    const bark = new T.MeshStandardNodeMaterial({ roughness: 0.82 });
    const wp = positionWorld.add(this.air.observer);
    const grain = texture3D(
      this.air.density,
      wp.mul(vec3(0.06, 0.008, 0.06)),
    ).r;
    bark.colorNode = this.air.haze(
      mix(vec3(0.025, 0.044, 0.049), vec3(0.079, 0.1, 0.087), grain),
    );
    const wave = sin(
      wp.x.mul(0.008).add(wp.z.mul(0.006)).sub(this.air.time.mul(0.22)),
    )
      .mul(0.5)
      .add(0.5);
    bark.emissiveNode = vec3(0.022, 0.095, 0.068)
      .mul(wave.pow(6))
      .mul(this.air.forestPulse)
      .mul(smoothstep(0.57, 0.8, grain));
    const tips: T.Vector3[] = [],
      dummy = new T.Object3D();
    for (let variant = 0; variant < 3; variant++) {
      const source = treeGeometry(9743 + variant * 587),
        n = Math.ceil(count / 3);
      const trees = new T.InstancedMesh(source.geometry, bark, n);
      for (let i = 0; i < n; i++) {
        const a = random() * Math.PI * 2,
          r = 0.16 + Math.sqrt(random()) * 0.78;
        const height = (155 + Math.pow(random(), 2) * 210) * scale;
        dummy.position.set(
          Math.cos(a) * r * rx,
          ground - Math.pow(r, 3) * 19,
          Math.sin(a) * r * rz,
        );
        dummy.scale.set(
          height * (0.85 + random() * 0.3),
          height,
          height * (0.85 + random() * 0.3),
        );
        dummy.rotation.y = random() * Math.PI * 2;
        dummy.updateMatrix();
        trees.setMatrixAt(i, dummy.matrix);
        for (const tip of source.tips)
          tips.push(tip.clone().applyMatrix4(dummy.matrix));
      }
      trees.computeBoundingSphere();
      root.add(trees);
      this.trees.push(trees);
      this.treeCounts.push(n);
    }
    const leafGeometry = new T.PlaneGeometry(1, 1, 1, 2);
    const leafMaterial = new T.MeshBasicNodeMaterial({
      side: T.DoubleSide,
      transparent: true,
      depthWrite: false,
    });
    const global = positionWorld.add(this.air.observer),
      u = uv();
    const sway = sin(
      global.x.mul(0.013).add(global.z.mul(0.017)).add(this.air.time.mul(0.17)),
    );
    leafMaterial.positionNode = positionLocal.add(
      vec3(
        sin(positionLocal.y.mul(3)).mul(0.2),
        0,
        positionLocal.y
          .mul(0.25)
          .add(sway.mul(positionLocal.y.add(0.5)).mul(0.14)),
      ),
    );
    const lit = sin(
      global.y.mul(0.07).add(global.x.mul(0.008)).sub(this.air.time.mul(0.2)),
    )
      .mul(0.5)
      .add(0.5);
    leafMaterial.colorNode = this.air.haze(
      mix(vec3(0.05, 0.16, 0.14), vec3(0.33, 0.63, 0.42), lit)
        .mul(this.air.forestPulse.mul(0.85).add(0.35))
        .add(vec3(0.1, 0.16, 0.1).mul(sway.mul(0.1).add(0.1))),
      0.00023,
    );
    const silhouette = float(1).sub(
      smoothstep(
        0.1,
        0.5,
        u.x
          .sub(0.5)
          .abs()
          .div(max(0.1, sin(u.y.mul(Math.PI)))),
      ),
    );
    leafMaterial.opacityNode = silhouette.mul(0.85);
    const leavesPerTip = 24,
      leafCount = tips.length * leavesPerTip,
      leaves = new T.InstancedMesh(leafGeometry, leafMaterial, leafCount);
    for (let i = 0; i < leafCount; i++) {
      const tip = tips[i % tips.length];
      dummy.position
        .copy(tip)
        .add(
          new T.Vector3(
            (random() - 0.5) * 47,
            (random() - 0.5) * 24,
            (random() - 0.5) * 47,
          ).multiplyScalar(scale),
        );
      const size = (4 + random() * 7) * scale;
      dummy.scale.set(size, size * (1.6 + random()), size);
      dummy.rotation.set(
        random() * 1.3 - 0.65,
        random() * 6.3,
        random() * 0.7 - 0.35,
      );
      dummy.updateMatrix();
      leaves.setMatrixAt(i, dummy.matrix);
    }
    leaves.computeBoundingSphere();
    root.add(leaves);
    this.leaves.push(leaves);
    this.foliageCounts.push(leafCount);
    const blade = new T.BufferGeometry();
    blade.setAttribute(
      "position",
      new T.Float32BufferAttribute([-0.25, 0, 0, 0.25, 0, 0, 0.08, 1, 0], 3),
    );
    blade.computeVertexNormals();
    blade.setAttribute("aBladeTip", new T.Float32BufferAttribute([0, 0, 1], 1));
    const grassMat = new T.MeshBasicNodeMaterial({ side: T.DoubleSide });
    grassMat.positionNode = positionLocal.add(
      vec3(
        sin(this.air.time.mul(0.4).add(positionWorld.x.mul(0.2)))
          .mul(positionLocal.y.pow(2))
          .mul(0.3),
        0,
        0,
      ),
    );
    grassMat.colorNode = this.air.haze(
      mix(
        vec3(0.008, 0.023, 0.018),
        vec3(0.038, 0.12, 0.063),
        attribute<"float">("aBladeTip", "float"),
      ).mul(this.air.forestPulse.mul(0.5).add(0.55)),
    );
    const grass = new T.InstancedMesh(blade, grassMat, 4000);
    for (let i = 0; i < 4000; i++) {
      const a = random() * Math.PI * 2,
        r = Math.sqrt(random()) * 0.82;
      dummy.position.set(
        Math.cos(a) * r * rx,
        ground - Math.pow(r, 3) * 19,
        Math.sin(a) * r * rz,
      );
      dummy.rotation.set(0, random() * 6.28, 0);
      dummy.scale.setScalar(1.4 + random() * 3);
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
    }
    grass.computeBoundingSphere();
    root.add(grass);
    this.grass.push(grass);
  }
  setQuality(q: Quality) {
    const fraction = { ULTRA: 1, HIGH: 1, BALANCED: 0.68, BATTERY: 0.36 }[q];
    this.leaves.forEach(
      (m, i) => (m.count = Math.floor(this.foliageCounts[i] * fraction)),
    );
    this.grass.forEach((m) => (m.count = Math.floor(4000 * fraction)));
  }
}
