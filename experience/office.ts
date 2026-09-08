import * as T from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { color, uniform, positionLocal, sin, vec3 } from "three/tsl";
import {
  canvasTexture,
  screenTexture,
  woodTexture,
  cityTexture,
  notificationTexture,
} from "./textures";
import { smooth, seeded } from "./timeline";

type Piece = {
  mesh: T.Object3D;
  home: T.Vector3;
  rotation: T.Euler;
  scale: T.Vector3;
  drift: T.Vector3;
  delay: number;
};
export type Thought = {
  mesh: T.Mesh<T.PlaneGeometry, T.MeshBasicMaterial>;
  home: T.Vector3;
  name: string;
  released: number;
  escaped: boolean;
};
export class Office {
  group = new T.Group();
  thoughts: Thought[] = [];
  anomaly = new T.Vector3(-0.47, 2.32, -0.53);
  private pieces: Piece[] = [];
  private keys!: T.InstancedMesh;
  private keyHomes: T.Vector3[] = [];
  private rain!: T.LineSegments;
  private rainPositions!: Float32Array;
  private screenMaterials: T.MeshBasicMaterial[] = [];
  private lamp: T.SpotLight;
  private monitorLight: T.PointLight;
  private officeLight: T.HemisphereLight;
  private clock = uniform(0);
  private coffee: T.Mesh;
  private city = new T.Group();
  private rand = seeded(42);
  private temp = new T.Object3D();
  constructor(scene: T.Scene) {
    scene.add(this.group);
    this.officeLight = new T.HemisphereLight(0x7496a5, 0x262321, 1.3);
    this.group.add(this.officeLight);
    this.lamp = new T.SpotLight(0xffce8b, 32, 10, 0.65, 0.85, 1.8);
    this.lamp.position.set(1.65, 2.76, -0.72);
    this.lamp.target.position.set(1, 1.1, 0.5);
    this.lamp.castShadow = true;
    this.lamp.shadow.mapSize.set(
      innerWidth < 760 ? 512 : 1024,
      innerWidth < 760 ? 512 : 1024,
    );
    this.lamp.shadow.bias = -0.0002;
    this.lamp.shadow.normalBias = 0.008;
    this.lamp.shadow.camera.near = 0.1;
    this.group.add(this.lamp, this.lamp.target);
    this.monitorLight = new T.PointLight(0x99c6d8, 8, 5, 2);
    this.monitorLight.position.set(-0.6, 2.1, 0.1);
    this.group.add(this.monitorLight);
    const fill = new T.PointLight(0x557d95, 22, 18, 2);
    fill.position.set(-3.5, 4.2, -3.5);
    this.group.add(fill);
    const wall = new T.MeshStandardMaterial({
      color: 0x202a2e,
      roughness: 0.83,
    });
    const trim = new T.MeshStandardMaterial({
      color: 0x101719,
      roughness: 0.36,
      metalness: 0.5,
    });
    const box = (size: number[], pos: number[], mat: T.Material) => {
      const m = new T.Mesh(
        new T.BoxGeometry(...(size as [number, number, number])),
        mat,
      );
      m.position.set(...(pos as [number, number, number]));
      m.receiveShadow = true;
      this.group.add(m);
      return m;
    };
    box(
      [15, 0.12, 14],
      [0, -0.08, -1],
      new T.MeshStandardMaterial({
        color: 0x151e24,
        roughness: 0.3,
        metalness: 0.25,
      }),
    );
    box([0.18, 7, 12], [-7, 3.5, -1], wall);
    box([0.18, 7, 12], [7, 3.5, -1], wall);
    box([14, 0.22, 0.2], [0, 5.9, -4.3], trim);
    box([14, 0.15, 0.2], [0, 1.0, -4.3], trim);
    for (let x = -7; x <= 7; x += 3.5) box([0.09, 6, 0.16], [x, 3, -4.3], trim);
    for (let x = -6; x < 7; x += 2)
      for (let z = -4; z < 4; z += 2) {
        const tile = box([1.96, 0.05, 1.96], [x, 6, z], wall);
        this.register(tile);
      }
    const sill = box([14, 0.18, 0.58], [0, 0.8, -4.4], wall);
    this.register(sill);
    const cityMap = cityTexture();
    for (let i = 0; i < 52; i++) {
      const h = 2 + this.rand() * 10,
        w = 0.45 + this.rand() * 1.6;
      const m = new T.Mesh(
        new T.BoxGeometry(w, h, 0.6 + this.rand()),
        new T.MeshStandardMaterial({
          map: cityMap,
          color: 0x607786,
          emissive: 0x80909d,
          emissiveMap: cityMap,
          emissiveIntensity: 0.4,
          roughness: 0.9,
        }),
      );
      m.position.set(
        (this.rand() - 0.5) * 48,
        h / 2 - 3,
        -9 - this.rand() * 24,
      );
      this.city.add(m);
    }
    this.group.add(this.city);
    const rainArray = new Float32Array(1900 * 6);
    for (let i = 0; i < 1900; i++) {
      const x = (this.rand() - 0.5) * 18,
        y = this.rand() * 11,
        z = -4.35 - this.rand() * 5;
      rainArray.set(
        [x, y, z, x - 0.027, y - 0.18 - this.rand() * 0.22, z],
        i * 6,
      );
    }
    this.rainPositions = rainArray;
    const rg = new T.BufferGeometry();
    rg.setAttribute("position", new T.BufferAttribute(rainArray, 3));
    this.rain = new T.LineSegments(
      rg,
      new T.LineBasicMaterial({
        color: 0x8da8b6,
        transparent: true,
        opacity: 0.075,
      }),
    );
    this.group.add(this.rain);
    this.addScreen("main", [-0.47, 2.32, -0.577], [2.32, 1.3]);
    this.addScreen("side", [-2.18, 2.24, -0.477], [0.76, 1.46]);
    this.addScreen("laptop", [1.56, 1.65, -0.633], [1.17, 0.66]);
    const keyboardMaterial = new T.MeshStandardMaterial({
      color: 0x333f43,
      roughness: 0.36,
      metalness: 0.3,
    });
    this.keys = new T.InstancedMesh(
      new RoundedBoxGeometry(0.112, 0.035, 0.106, 2, 0.012),
      keyboardMaterial,
      75,
    );
    for (let row = 0; row < 5; row++)
      for (let col = 0; col < 15; col++) {
        const p = new T.Vector3(
          -1.25 + col * 0.122,
          1.316,
          0.407 + row * 0.115,
        );
        this.keyHomes.push(p);
        this.temp.position.copy(p);
        this.temp.updateMatrix();
        this.keys.setMatrixAt(row * 15 + col, this.temp.matrix);
      }
    this.group.add(this.keys);
    // A single reusable curve supplies real cable geometry, and later becomes an orbit.
    const cable = new T.CatmullRomCurve3([
      new T.Vector3(-0.4, 1.24, 0.34),
      new T.Vector3(-0.7, 1.24, -0.1),
      new T.Vector3(-0.15, 1.24, -0.4),
      new T.Vector3(-0.47, 1.24, -0.85),
    ]);
    const cm = new T.Mesh(
      new T.TubeGeometry(cable, 40, 0.013, 7, false),
      new T.MeshStandardMaterial({ color: 0x141819 }),
    );
    this.group.add(cm);
    this.register(cm);
    const coffeeMaterial = new T.MeshStandardNodeMaterial({
      roughness: 0.15,
      metalness: 0.15,
    });
    coffeeMaterial.colorNode = color(0x1e0f08);
    coffeeMaterial.positionNode = positionLocal.add(
      vec3(
        0,
        sin(positionLocal.x.mul(45).add(this.clock.mul(1.4))).mul(0.002),
        0,
      ),
    );
    this.coffee = new T.Mesh(new T.CircleGeometry(0.147, 48), coffeeMaterial);
    this.coffee.rotation.x = -Math.PI / 2;
    this.coffee.position.set(1.57, 1.517, 0.55);
    this.group.add(this.coffee);
    this.register(this.coffee);
    const light = new T.Mesh(
      new T.CircleGeometry(0.23, 32),
      new T.MeshBasicMaterial({ color: 0xffdd98 }),
    );
    light.position.set(1.65, 2.752, -0.72);
    light.rotation.x = Math.PI / 2;
    this.group.add(light);
    this.register(light);
    [
      "URGENT",
      "BUILD FAILED",
      "MEETING",
      "TODO 37",
      "LEGACY CODE",
      "EOD",
    ].forEach((text, i) => {
      const m = new T.Mesh(
        new T.PlaneGeometry(1.14, 0.261),
        new T.MeshBasicMaterial({
          map: notificationTexture(text),
          transparent: true,
          opacity: 0,
          side: T.DoubleSide,
        }),
      );
      const home = new T.Vector3(
        -0.47 + Math.cos(i * 1.3) * (1.5 + i * 0.08),
        2.4 + Math.sin(i * 1.3) * 0.9,
        -0.15 + (i % 2) * 0.3,
      );
      m.position.copy(home);
      m.visible = false;
      this.group.add(m);
      this.thoughts.push({
        mesh: m,
        name: text,
        home,
        released: -1,
        escaped: false,
      });
    });
    const clockTexture = canvasTexture(512, 128, (c) => {
      c.fillStyle = "#98a5a5";
      c.font = "75px monospace";
      c.fillText("23:48", 15, 92);
    });
    const clock = new T.Mesh(
      new T.PlaneGeometry(0.62, 0.155),
      new T.MeshBasicMaterial({ map: clockTexture, transparent: true }),
    );
    clock.position.set(-4.95, 3.35, -4.15);
    this.group.add(clock);
  }
  private addScreen(
    kind: "main" | "side" | "laptop",
    pos: number[],
    size: number[],
  ) {
    const mat = new T.MeshBasicMaterial({
      map: screenTexture(kind),
      color: 0xb3c5c6,
    });
    this.screenMaterials.push(mat);
    const m = new T.Mesh(new T.PlaneGeometry(size[0], size[1]), mat);
    m.position.set(...(pos as [number, number, number]));
    this.group.add(m);
    this.register(m);
  }
  async load() {
    try {
      const gltf = await new GLTFLoader().loadAsync("/assets/office.glb");
      const wood = woodTexture();
      gltf.scene.traverse((o) => {
        if (o instanceof T.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          if (o.name === "source_rock") {
            o.visible = false;
            return;
          }
          if (o.name === "desk_walnut") {
            o.material = new T.MeshStandardMaterial({
              map: wood,
              color: 0x8b735d,
              roughness: 0.36,
              metalness: 0.07,
            });
          }
          this.register(o);
        }
      });
      this.group.add(gltf.scene);
      return true;
    } catch {
      // Complete lightweight core remains usable if the optional GLB is unavailable.
      const fallback = new T.Mesh(
        new T.BoxGeometry(5.85, 0.16, 2.65),
        new T.MeshStandardMaterial({ map: woodTexture(), roughness: 0.5 }),
      );
      fallback.position.y = 1.12;
      this.group.add(fallback);
      this.register(fallback);
      return false;
    }
  }
  private register(mesh: T.Object3D) {
    this.pieces.push({
      mesh,
      home: mesh.position.clone(),
      rotation: mesh.rotation.clone(),
      scale: mesh.scale.clone(),
      drift: new T.Vector3(
        (this.rand() - 0.5) * 8,
        1 + this.rand() * 7,
        (this.rand() - 0.5) * 5,
      ),
      delay: this.rand() * 0.22,
    });
  }
  update(
    t: number,
    elapsed: number,
    dt: number,
    pointer: T.Vector2,
    reduced: boolean,
  ) {
    this.clock.value = elapsed;
    const distortion = smooth(25, 68, t),
      fracture = smooth(69, 111, t);
    this.group.visible = t < 144;
    if (!this.group.visible) return;
    this.lamp.intensity = 32 * (1 - fracture);
    this.monitorLight.intensity = (8 + distortion * 8) * (1 - fracture);
    this.officeLight.intensity = 1.3 * (1 - fracture * 0.7);
    this.city.scale.setScalar(1 - smooth(108, 144, t));
    for (const p of this.pieces) {
      const f = smooth(p.delay, 1, fracture),
        w = reduced ? 0.2 : 1;
      p.mesh.position.copy(p.home).addScaledVector(p.drift, f * w);
      p.mesh.rotation.copy(p.rotation);
      p.mesh.rotation.x += f * 0.7 * w;
      p.mesh.rotation.z += f * (p.drift.x * 0.3) * w;
      p.mesh.scale.copy(p.scale).multiplyScalar(1 - smooth(0.48, 1, f));
    }
    for (let i = 0; i < 75; i++) {
      const p = this.keyHomes[i];
      this.temp.position.copy(p);
      this.temp.position.y +=
        distortion * (0.015 + Math.sin(elapsed * 0.7 + i) * 0.008) +
        fracture * (0.7 + (i % 7) * 0.4);
      this.temp.position.x += fracture * Math.sin(i) * 2;
      this.temp.rotation.set(
        fracture * 0.8,
        fracture * i * 0.03,
        fracture * 0.5,
      );
      this.temp.scale.setScalar(1 - fracture);
      this.temp.updateMatrix();
      this.keys.setMatrixAt(i, this.temp.matrix);
    }
    this.keys.instanceMatrix.needsUpdate = true;
    const ra = this.rainPositions;
    if (!reduced)
      for (let i = 0; i < ra.length; i += 6) {
        const drop = dt * (2.8 + distortion * 3);
        ra[i + 1] -= drop;
        ra[i + 4] -= drop;
        ra[i] += dt * distortion * 0.2;
        ra[i + 3] += dt * distortion * 0.2;
        if (ra[i + 1] < -1) {
          ra[i + 1] += 12;
          ra[i + 4] += 12;
        }
      }
    this.rain.geometry.attributes.position.needsUpdate = true;
    this.thoughts.forEach((thought, i) => {
      const m = thought.mesh,
        appear = smooth(37 + i * 2.8, 47 + i * 2.8, t),
        fade = 1 - smooth(94, 107, t);
      m.visible = appear > 0 && fade > 0;
      m.material.opacity = appear * fade;
      if (thought.released >= 0) {
        let age = t - thought.released;
        if (
          thought.name === "LEGACY CODE" &&
          !thought.escaped &&
          age > 1.3 &&
          age < 3.2
        ) {
          age = 0.35 + Math.sin(age * 2) * 0.2;
        }
        const s = smooth(0, 2, age);
        m.position.lerpVectors(thought.home, this.anomaly, s);
        m.scale.set(1 - s * 0.96, (1 - s) * (1 - s), 1);
        m.rotation.z = s * 4;
        if (age > 2) m.visible = false;
      } else if (!m.userData.dragged) {
        m.position.copy(thought.home);
        m.position.x +=
          Math.sin(elapsed * 0.22 + i) * 0.1 + pointer.x * distortion * 0.15;
        m.position.y += Math.cos(elapsed * 0.4 + i) * 0.09;
        m.rotation.set(
          0,
          Math.sin(elapsed * 0.16 + i) * 0.16,
          Math.sin(elapsed * 0.2 + i) * 0.035,
        );
        m.scale.setScalar(appear);
      }
    });
  }
  release(index: number, t: number) {
    const thought = this.thoughts[index];
    if (!thought || thought.released >= 0) return;
    thought.home.copy(thought.mesh.position);
    thought.released = t;
    thought.mesh.userData.dragged = false;
  }
  reset() {
    for (const thought of this.thoughts) {
      thought.released = -1;
      thought.escaped = false;
      thought.mesh.scale.setScalar(1);
    }
  }
}
