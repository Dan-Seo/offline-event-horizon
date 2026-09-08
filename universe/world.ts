import * as T from "three/webgpu";
import type { Destination } from "./flight";
import { placeRelative } from "./coordinates";
import { SECTOR_SIZE } from "./coordinates";
import { PlanetLibrary } from "./planets";
import { NebulaLibrary } from "./nebula";
import { StarField } from "./stars";
import { GravitationalAnomaly } from "./anomaly";
import { QUALITY, seeded, sectorSeed, type Quality } from "./config";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
export type Body = Destination & {
  object: T.Group;
  color: number;
  archetype: number;
};
export class UniverseWorld {
  bodies: Body[] = [];
  sectors = 1;
  generatedSectors = 0;
  planets = new PlanetLibrary();
  nebulae = new NebulaLibrary();
  anomaly = new GravitationalAnomaly();
  stars: StarField;
  private sectorMap = new Map<
    string,
    { group: T.Group; center: T.Vector3; bodies: Body[] }
  >();
  private sectorKey = "";
  private asteroidGroup = new T.Group();
  private asteroids: T.InstancedMesh;
  private asteroidCenter = new T.Vector3(-35000, 16500, -100000);
  private cathedralHigh?: T.Group;
  private cathedralLow?: T.Group;
  private disposed = false;
  assetFallback = false;
  constructor(public scene: T.Scene) {
    this.stars = new StarField(scene);
    const specs: [string, string, string, number[], number, number, number][] =
      [
        [
          "orpheus",
          "ORPHEUS IV",
          "Ocean world",
          [5000, -48000, -16000],
          48000,
          0x1b6972,
          0,
        ],
        [
          "giant",
          "THE SILENT GIANT",
          "Ringed giant",
          [-105000, 41000, -380000],
          20000,
          0xb5a68e,
          1,
        ],
        [
          "moon",
          "SELENE",
          "Frozen moon",
          [28000, 3000, -95000],
          1900,
          0xa7b4b3,
          2,
        ],
        [
          "wound",
          "THE WOUND",
          "Gravitational anomaly",
          [160000, 70000, -380000],
          35000,
          0x020204,
          3,
        ],
        [
          "cathedral",
          "THE CATHEDRAL",
          "Ancient structure",
          [19000, 27000, -78000],
          1800,
          0xb3b29c,
          4,
        ],
        [
          "bloom",
          "THE BLOOM",
          "Nebula",
          [-45000, 36000, -160000],
          60000,
          0x785c47,
          5,
        ],
        [
          "ember",
          "EMBER",
          "Volcanic world",
          [100000, -18000, -80000],
          8300,
          0x783e24,
          6,
        ],
      ];
    for (const [id, name, kind, xyz, radius, color, archetype] of specs) {
      const object = new T.Group();
      if (archetype === 3) object.add(this.anomaly.group);
      else if (archetype === 4) {
        const ring = new T.Mesh(
          new T.TorusGeometry(1, 0.045, 6, 90, 5.6),
          new T.MeshStandardMaterial({
            color: 0x969783,
            metalness: 0.6,
            roughness: 0.5,
          }),
        );
        object.add(ring);
        object.rotation.set(0.15, -0.42, -0.25);
      } else if (archetype === 5) {
        const volume = this.nebulae.create();
        volume.scale.set(3.6, 2.1, 1.8);
        object.add(volume);
      } else object.add(this.planets.create(archetype));
      scene.add(object);
      this.bodies.push({
        id,
        name,
        kind,
        position: new T.Vector3(...xyz),
        radius,
        object,
        color,
        archetype,
        solid: ![4, 5].includes(archetype),
      });
    }
    const sun = new T.DirectionalLight(0xffe4c4, 3.2);
    sun.position.set(-0.82, 0.38, 0.43);
    scene.add(sun);
    scene.add(new T.AmbientLight(0x587b90, 0.18));
    const fill = new T.DirectionalLight(0x718895, 0.38);
    fill.position.set(0.2, 0.5, -1);
    scene.add(fill);
    this.asteroidCenter.set(-105000, 41000, -380000);
    const rock = new T.IcosahedronGeometry(1, 0);
    const positions = rock.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        y = positions.getY(i),
        z = positions.getZ(i);
      const n = 1 + Math.sin(x * 9 + y * 6 + z * 13) * 0.22;
      positions.setXYZ(i, x * n, y * n * 0.7, z * n);
    }
    rock.computeVertexNormals();
    this.asteroids = new T.InstancedMesh(
      rock,
      new T.MeshStandardMaterial({ color: 0x6c706d, roughness: 1 }),
      7000,
    );
    const random = seeded(726),
      dummy = new T.Object3D();
    for (let i = 0; i < 7000; i++) {
      const a = random() * Math.PI * 2,
        r = 58000 + random() * 24000;
      dummy.position.set(
        Math.cos(a) * r,
        (random() - 0.5) * 2400,
        Math.sin(a) * r,
      );
      dummy.rotation.set(random() * 5, random() * 5, random() * 5);
      dummy.scale.setScalar(15 + Math.pow(random(), 6) * 160);
      dummy.updateMatrix();
      this.asteroids.setMatrixAt(i, dummy.matrix);
    }
    this.asteroidGroup.add(this.asteroids);
    scene.add(this.asteroidGroup);
    this.asteroids.count = 4000;
  }
  async loadHero(prepare: (objects: T.Object3D) => Promise<void>) {
    try {
      const loader = new GLTFLoader();
      const [high, low] = await Promise.all([
        loader.loadAsync("/assets/cathedral.glb"),
        loader.loadAsync("/assets/cathedral-low.glb"),
      ]);
      if (this.disposed) return;
      // Blender's XY authoring plane becomes XZ in glTF. Restore the gate's upright silhouette.
      high.scene.rotation.x = Math.PI / 2;
      low.scene.rotation.x = Math.PI / 2;
      const staging = new T.Group();
      staging.add(high.scene, low.scene);
      staging.position.set(0, 0, -10);
      staging.traverse((o) => {
        o.frustumCulled = false;
      });
      await prepare(staging);
      if (this.disposed) return;
      this.cathedralHigh = high.scene;
      this.cathedralLow = low.scene;
      const target = this.bodies.find((b) => b.id === "cathedral")!.object;
      target.traverse((o) => {
        if (o instanceof T.Mesh) {
          o.geometry.dispose();
          (o.material as T.Material).dispose();
        }
      });
      target.clear();
      target.add(high.scene, low.scene);
      low.scene.visible = false;
    } catch {
      this.assetFallback = true;
    }
  }
  private stream(observer: T.Vector3) {
    const sx = Math.floor(observer.x / SECTOR_SIZE),
      sy = Math.floor(observer.y / SECTOR_SIZE),
      sz = Math.floor(observer.z / SECTOR_SIZE),
      key = `${sx},${sy},${sz}`;
    if (key === this.sectorKey) return;
    this.sectorKey = key;
    const needed = new Set<string>();
    for (let z = sz - 1; z <= sz + 1; z++)
      for (let y = sy - 1; y <= sy + 1; y++)
        for (let x = sx - 1; x <= sx + 1; x++) {
          const id = `${x},${y},${z}`;
          needed.add(id);
          if (this.sectorMap.has(id)) continue;
          const random = seeded(sectorSeed(x, y, z)),
            center = new T.Vector3(
              (x + 0.5) * SECTOR_SIZE,
              (y + 0.5) * SECTOR_SIZE,
              (z + 0.5) * SECTOR_SIZE,
            ),
            group = new T.Group(),
            bodies: Body[] = [];
          const stars = new Float32Array(280 * 3),
            colors = new Float32Array(280 * 3);
          for (let i = 0; i < 280; i++) {
            stars.set(
              [
                (random() - 0.5) * SECTOR_SIZE,
                (random() - 0.5) * SECTOR_SIZE,
                (random() - 0.5) * SECTOR_SIZE,
              ],
              i * 3,
            );
            const c = 0.16 + Math.pow(random(), 4) * 0.7;
            colors.set([c, c * 0.95, c * 0.88], i * 3);
          }
          const geometry = new T.BufferGeometry();
          geometry.setAttribute("position", new T.BufferAttribute(stars, 3));
          geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
          group.add(
            new T.Points(
              geometry,
              new T.PointsMaterial({
                size: 1,
                sizeAttenuation: false,
                vertexColors: true,
                transparent: true,
                depthWrite: false,
              }),
            ),
          );
          this.scene.add(group);
          if (random() > 0.3) {
            const kind = [0, 1, 2, 6][Math.floor(random() * 4)],
              radius = 3500 + random() * 15000,
              position = center
                .clone()
                .add(
                  new T.Vector3(
                    (random() - 0.5) * 250000,
                    (random() - 0.5) * 250000,
                    (random() - 0.5) * 250000,
                  ),
                );
            const object = new T.Group();
            object.add(this.planets.create(kind));
            this.scene.add(object);
            const body: Body = {
              id: `sector-${id}`,
              name: `VESPER ${sectorSeed(x, y, z).toString(16).slice(0, 4).toUpperCase()}`,
              kind:
                kind === 1
                  ? "Ringed giant"
                  : kind === 2
                    ? "Frozen moon"
                    : kind === 6
                      ? "Volcanic world"
                      : "Ocean world",
              position,
              radius,
              object,
              color: 0xaaaaaa,
              archetype: kind,
              solid: true,
            };
            bodies.push(body);
            this.bodies.push(body);
          }
          if (random() > 0.77) {
            const object = new T.Group(),
              volume = this.nebulae.create(1);
            volume.scale.set(3, 1.6, 2);
            object.add(volume);
            this.scene.add(object);
            const body: Body = {
              id: `cloud-${id}`,
              name: `THE VEIL ${sectorSeed(x, y, z).toString(16).slice(-3).toUpperCase()}`,
              kind: "Nebula",
              position: center.clone(),
              radius: 50000 + random() * 40000,
              object,
              color: 0x665544,
              archetype: 5,
              solid: false,
            };
            bodies.push(body);
            this.bodies.push(body);
          }
          this.sectorMap.set(id, { group, center, bodies });
          this.generatedSectors++;
        }
    for (const [id, sector] of this.sectorMap)
      if (!needed.has(id)) {
        this.scene.remove(sector.group);
        sector.group.traverse((o) => {
          if (o instanceof T.Points) {
            o.geometry.dispose();
            (o.material as T.Material).dispose();
          }
        });
        for (const b of sector.bodies) {
          this.scene.remove(b.object);
          this.bodies.splice(this.bodies.indexOf(b), 1);
        }
        this.sectorMap.delete(id);
      }
    this.sectors = this.sectorMap.size;
  }
  update(observer: T.Vector3, time: number, camera?: T.Camera) {
    this.stream(observer);
    this.planets.time.value = time;
    this.nebulae.time.value = time;
    for (const sector of this.sectorMap.values())
      placeRelative(sector.group, sector.center, observer);
    for (const b of this.bodies) {
      placeRelative(b.object, b.position, observer, b.radius);
      if (![3, 4, 5].includes(b.archetype)) {
        b.object.rotation.set(
          b.archetype === 0 ? 0.5 : 0,
          time * 0.003 + (b.id === "orpheus" ? 1.3 : 0),
          b.archetype === 0 ? 0.8 : 0,
        );
        this.planets.update(
          b.object.children[0] as T.Group,
          observer.distanceTo(b.position) / b.radius,
        );
      }
      if (b.id === "cathedral" && this.cathedralHigh && this.cathedralLow) {
        const close = observer.distanceTo(b.position) / b.radius < 8;
        this.cathedralHigh.visible = close;
        this.cathedralLow.visible = !close;
      }
    }
    placeRelative(this.asteroidGroup, this.asteroidCenter, observer);
    this.asteroidGroup.rotation.y = time * 0.0005;
    if (camera) this.anomaly.update(time, camera);
  }
  setQuality(quality: Quality) {
    this.nebulae.setQuality(quality);
    this.asteroids.count = QUALITY[quality].asteroids;
  }
  stressAsteroids() {
    this.asteroids.count = 7000;
  }
  dispose() {
    this.disposed = true;
    this.nebulae.dispose();
  }
}
