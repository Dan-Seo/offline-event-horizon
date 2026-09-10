import * as T from "three/webgpu";
import { positionLocal, normalLocal, sin, vec3, color, uniform, attribute } from "three/tsl";
import { seeded, type Quality } from "./config";
import { NACRE_ENTRY_Z } from "./walk-ground";

/** Bounded authored ecosystem. Coordinates are local, unit is one artistic metre. */
export class OceanLife {
  root = new T.Group();
  private depth = uniform(0);
  private meshes: T.InstancedMesh[] = [];
  private fish: T.InstancedMesh;
  private dummy = new T.Object3D();
  private lastTime = -1;
  private reefs: { x: number; z: number }[] = [];
  constructor(parent: T.Object3D, time: T.Node<"float">,
    private floor: (x: number, z: number) => number,
    private surface: (x: number, z: number) => number,
    private extent: number, private unit = 1, makeFloor = true) {
    parent.add(this.root);
    const optical = (base: T.Node<"vec3">) => {
      // Whole-view absorption is applied exactly once by the beauty compositor.
      return base;
    };
    const material = (tint: number, grass = false) => {
      const m = new T.MeshBasicNodeMaterial({ side: T.DoubleSide });
      const p = positionLocal.div(unit);
      const caustic = sin(p.x.mul(0.28).add(sin(p.z.mul(0.23).add(time.mul(0.23))).mul(2))).abs()
        .mul(sin(p.z.mul(0.31).sub(time.mul(0.19))).abs()).pow(12);
      const shapeLight = normalLocal.dot(vec3(0.4, 0.8, 0.3).normalize()).abs().mul(0.42).add(0.58);
      m.colorNode = optical(color(tint).mul(caustic.mul(0.24).add(0.82)).mul(shapeLight));
      if (grass) m.positionNode = positionLocal.add(vec3(sin(time.mul(0.55).add(positionLocal.y.mul(2))).mul(positionLocal.y.max(0).pow(2)).mul(0.12), 0, 0));
      return m;
    };
    if (makeFloor) {
      const g = new T.PlaneGeometry(extent * 2, extent * 2, 128, 128);
      const p = g.getAttribute("position");
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = -p.getY(i); p.setXYZ(i, x, floor(x, z), z); }
      g.computeVertexNormals();
      const m = material(0xa8b79b);
      const ripple = sin(positionLocal.x.div(unit).mul(2.1).add(sin(positionLocal.z.div(unit).mul(0.12)).mul(3))).mul(0.09).add(0.91);
      m.colorNode = m.colorNode!.mul(ripple);
      this.root.add(new T.Mesh(g, m));
    }
    const random = seeded(8721);
    // Persistent authored sites in the world/local regional frame. Never camera-relative.
    // HOME's first descent is near (0,460), looking toward -Z. The regional
    // Nacre's arrival is dry shore: place the matching composition 130 metres
    // farther inward, before applying reef offsets, inside its existing lagoon.
    const entryZ = unit === 1 ? 460 : NACRE_ENTRY_Z - 130 * unit;
    this.reefs = [[-9, -30], [18, -50], [-22, -75]].map(([x, z]) => ({ x: x * unit, z: entryZ + z * unit }));
    const clusters = Array.from({ length: 40 }, () => {
      const i = Math.floor(random() * 3), reef = this.reefs[i];
      const a = random() * Math.PI * 2, r = (6 + random() * 12) * unit;
      return { x: reef.x + Math.cos(a) * r, z: reef.z + Math.sin(a) * r };
    });
    // Layered foreground tufts flank a clear descent corridor.
    for (let i = 0; i < 12; i++) clusters[i] = {
      x: (i % 2 ? 1 : -1) * (5 + (i % 3) * 2.8) * unit,
      z: entryZ - (9 + Math.floor(i / 2) * 3) * unit,
    };
    const populate = (geometry: T.BufferGeometry, m: T.Material, count: number, kind: number) => {
      const mesh = new T.InstancedMesh(geometry, m, count);
      for (let i = 0; i < count; i++) {
        const a = random() * Math.PI * 2, reef = this.reefs[i % 3];
        const cluster = clusters[i % clusters.length];
        const spread = Math.sqrt(random()) * (kind === 1 ? 1.8 : 13) * unit;
        let x = (kind === 1 ? cluster.x : reef.x) + Math.cos(a) * spread;
        let z = (kind === 1 ? cluster.z : reef.z) + Math.sin(a) * spread;
        const piece = Math.floor(i / 3);
        if (kind === 0 && piece < 3) { x = reef.x + (piece - 1) * 4 * unit; z = reef.z; }
        const y = floor(x, z);
        const wet = surface(x, z) - y;
        const h = Math.min(wet * 0.18, (kind === 0 ? 1.1 + random() * 2.1 : 1.1 + random() * 2.6) * unit);
        this.dummy.position.set(x, y + (kind === 0 ? h * 0.58 : 0), z);
        this.dummy.rotation.set((random() - 0.5) * 0.16, random() * Math.PI * 2, (random() - 0.5) * 0.12);
        this.dummy.scale.set(h * (kind === 0 ? 1.2 + random() * 0.8 : 0.20 + random() * 0.17), h, h * (kind === 0 ? 0.85 : 0.7));
        // Three large interlocking stones form each low arch; retain them at Battery.
        if (kind === 0 && piece < 3) {
          const size = Math.min(unit, wet / 12);
          this.dummy.rotation.set(0, 0.12 * (piece - 1), 0);
          this.dummy.position.y = y + (piece === 1 ? 5.0 : 2.2) * size;
          this.dummy.scale.set((piece === 1 ? 5.6 : 2.3) * size, (piece === 1 ? 1.25 : 2.8) * size, 2.2 * size);
        }
        // Broader, low fan-like leaves among fine grass, within the same draw/budget.
        if (kind === 1 && i % 7 === 0) this.dummy.scale.set(h * 0.9, h * 0.72, h * 0.8);
        if (wet < unit * 2) this.dummy.scale.setScalar(0);
        this.dummy.updateMatrix(); mesh.setMatrixAt(i, this.dummy.matrix);
        const tint = new T.Color().setHSL(kind === 0 ? 0.09 + random() * 0.13 : i % 7 === 0 ? 0.04 + random() * 0.05 : 0.28 + random() * 0.13,
          kind === 0 ? 0.16 : 0.34, 0.48 + random() * 0.25);
        mesh.setColorAt(i, tint);
      }
      this.root.add(mesh); this.meshes.push(mesh); return mesh;
    };
    const rock = new T.IcosahedronGeometry(1, 2), rp = rock.getAttribute("position");
    for (let i = 0; i < rp.count; i++) {
      const x = rp.getX(i), y = rp.getY(i), z = rp.getZ(i);
      const relief = 1 + 0.13 * Math.sin(x * 8 + z * 3) * Math.cos(y * 7 - z * 4);
      rp.setXYZ(i, x * relief, y * relief * (0.94 + 0.06 * Math.cos(x * 6)), z * relief);
    }
    rock.computeVertexNormals();
    populate(rock, material(0xc0c6ad), 120, 0);
    const blade = new T.PlaneGeometry(1, 1, 2, 8); blade.translate(0, 0.5, 0);
    const bp = blade.getAttribute("position");
    for (let i = 0; i < bp.count; i++) {
      const t = bp.getY(i), x = bp.getX(i);
      bp.setXYZ(i, x * Math.pow(1 - t, 0.8) + 0.25 * t * t, t,
        0.48 * t * t + 0.10 * Math.sin(Math.PI * t) * (1 - Math.abs(x) * 2));
    }
    blade.computeVertexNormals();
    blade.name = "Curved tapered ocean blade";
    populate(blade, material(0xa1c99a, true), 700, 1);
    const body = new T.SphereGeometry(1, 12, 8).scale(1, 0.36, 0.22).toNonIndexed();
    const fishGeometry = new T.BufferGeometry();
    fishGeometry.setAttribute("position", new T.Float32BufferAttribute([
      ...body.attributes.position.array,
      -0.8, 0, 0, -1.65, 0.6, 0, -1.65, -0.6, 0,
      0.3, 0.25, 0, -0.6, 0.3, 0, -0.35, 0.72, 0,
      0.2, 0, 0, -0.4, -0.12, 0.6, -0.5, 0, 0,
      0.2, 0, 0, -0.5, 0, 0, -0.4, -0.12, -0.6,
    ], 3));
    body.dispose(); fishGeometry.computeVertexNormals();
    const fishMaterial = material(0xd6d7ae);
    fishMaterial.positionNode = positionLocal.add(vec3(0, 0,
      sin(time.mul(2.1).add(positionLocal.x.mul(4))).mul(positionLocal.x.negate().max(0)).mul(0.08)));
    this.fish = new T.InstancedMesh(fishGeometry, fishMaterial, 72);
    this.fish.frustumCulled = false;
    for (let i = 0; i < 72; i++) this.fish.setColorAt(i, new T.Color().setHSL(0.12 + random() * 0.10, 0.28, 0.63 + random() * 0.2));
    this.root.add(this.fish); this.meshes.push(this.fish);
    const motes = new T.IcosahedronGeometry(unit * 0.065, 0);
    const seeds = new Float32Array(160 * 3);
    for (let i = 0; i < 160; i++) {
      const x = (random() - 0.5) * extent, z = (random() - 0.5) * extent;
      seeds.set([x, floor(x, z) + (surface(x, z) - floor(x, z)) * (0.15 + random() * 0.7), z], i * 3);
    }
    motes.setAttribute("oceanSeed", new T.InstancedBufferAttribute(seeds, 3));
    const moteMaterial = new T.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
    const seed = vec3(attribute("oceanSeed", "vec3"));
    moteMaterial.positionNode = positionLocal.add(seed).add(vec3(sin(time.mul(0.12).add(seed.z)).mul(unit * 1.2), sin(time.mul(0.08).add(seed.x)).mul(unit * 0.4), 0));
    moteMaterial.colorNode = color(0x8bbeb6);
    moteMaterial.opacityNode = this.depth.mul(0.28);
    const particles = new T.InstancedMesh(motes, moteMaterial, 160);
    const identity = new T.Matrix4();
    for (let i = 0; i < 160; i++) particles.setMatrixAt(i, identity);
    particles.frustumCulled = false;
    this.root.add(particles); this.meshes.push(particles);
  }
  update(local: T.Vector3, time: number, active: boolean) {
    this.root.visible = active && Math.hypot(local.x, local.z) < this.extent * 2;
    if (!this.root.visible) return;
    this.depth.value = T.MathUtils.smoothstep((this.surface(local.x, local.z) - local.y) / this.unit, 0, 1.5);
    if (time === this.lastTime) return;
    this.lastTime = time;
    for (let i = 0; i < this.fish.instanceMatrix.count; i++) {
      const school = i < 48 ? 0 : 1 + Math.floor((i - 48) / 12), phase = time * 0.07 + school * 2.1;
      const reef = this.reefs[school];
      const x = reef.x + (Math.cos(phase) * 4 + Math.sin(i * 17) * 3.4) * this.unit;
      const z = reef.z + (Math.sin(phase) * 3 + Math.cos(i * 13) * 2.4) * this.unit;
      const floor = this.floor(x, z), top = this.surface(x, z);
      this.dummy.position.set(x, floor + Math.min((top - floor) * 0.5, (7.5 + Math.sin(i * 7) * 1.2 + Math.sin(phase) * 0.4) * this.unit), z);
      this.dummy.rotation.set(0, Math.atan2(-3 * Math.cos(phase), -4 * Math.sin(phase)), Math.sin(time * 0.7 + i) * 0.045);
      const size = (0.68 + (Math.sin(i * 23) + 1) * 0.18) * this.unit;
      this.dummy.scale.setScalar(size);
      if (top - floor < this.unit * 2) this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix(); this.fish.setMatrixAt(i, this.dummy.matrix);
    }
    this.fish.instanceMatrix.needsUpdate = true;
  }
  setQuality(q: Quality) {
    const fraction = { ULTRA: 1, HIGH: 0.8, BALANCED: 0.55, BATTERY: 0.3 }[q];
    this.meshes.forEach(m => { m.count = Math.floor(m.instanceMatrix.count * fraction); });
  }
  inspect() { return { visible: this.root.visible, rocks: this.meshes[0].count, grass: this.meshes[1].count, fish: this.fish.count, particles: this.meshes[3].count, animatedTime: this.lastTime,
    reefs: this.reefs.map(r => [r.x, this.floor(r.x, r.z), r.z]),
    primarySchoolCenter: [this.reefs[0].x + Math.cos(Math.max(0, this.lastTime) * 0.07) * 4 * this.unit,
      this.floor(this.reefs[0].x, this.reefs[0].z) + 7.5 * this.unit,
      this.reefs[0].z + Math.sin(Math.max(0, this.lastTime) * 0.07) * 3 * this.unit],
  }; }
  dispose() {
    this.root.traverse(o => { if (o instanceof T.Mesh) { o.geometry.dispose(); (o.material as T.Material).dispose(); } });
    this.root.removeFromParent();
  }
}
