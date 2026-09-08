import * as T from "three/webgpu";
import {
  positionLocal,
  color,
  mix,
  mx_noise_float,
  smoothstep,
  vec3,
} from "three/tsl";
import { cityTexture } from "./textures";
import { smooth, seeded } from "./timeline";

export class ScaleJourney {
  group = new T.Group();
  city = new T.Group();
  private world: T.Mesh;
  private moon: T.Mesh;
  private sun: T.Mesh;
  private rings = new T.Group();
  constructor(scene: T.Scene) {
    scene.add(this.group);
    this.group.add(this.city, this.rings);
    const rand = seeded(54),
      temp = new T.Object3D();
    const mat = new T.MeshStandardMaterial({
      map: cityTexture(),
      color: 0x61757b,
      emissive: 0x8d8273,
      emissiveMap: cityTexture(),
      emissiveIntensity: 0.35,
      roughness: 0.9,
    });
    const buildings = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), mat, 324);
    for (let i = 0; i < 324; i++) {
      const x = ((i % 18) - 9) * 2.5,
        z = (Math.floor(i / 18) - 9) * 2.5,
        h = 0.4 + Math.pow(rand(), 2) * 6;
      temp.position.set(x, -5 + h / 2, z);
      temp.scale.set(0.7 + rand() * 0.7, h, 0.7 + rand() * 0.7);
      temp.updateMatrix();
      buildings.setMatrixAt(i, temp.matrix);
    }
    this.city.add(buildings);
    const ground = new T.Mesh(
      new T.PlaneGeometry(50, 50),
      new T.MeshBasicMaterial({ color: 0x0e1e23 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -5;
    this.city.add(ground);
    const planetMat = new T.MeshStandardNodeMaterial({ roughness: 0.83 });
    const dir = positionLocal.normalize(),
      n = mx_noise_float(dir.mul(4.5)).add(
        mx_noise_float(dir.mul(15)).mul(0.2),
      );
    planetMat.colorNode = mix(
      color(0x12303b),
      color(0x4c5d50),
      smoothstep(-0.04, 0.14, n),
    );
    this.world = new T.Mesh(new T.SphereGeometry(5.5, 80, 56), planetMat);
    this.world.position.set(0, -6, -2);
    this.group.add(this.world);
    const glow = new T.Mesh(
      new T.SphereGeometry(5.63, 64, 48),
      new T.MeshBasicMaterial({
        color: 0x709bac,
        transparent: true,
        opacity: 0.11,
        side: T.BackSide,
        blending: T.AdditiveBlending,
      }),
    );
    this.world.add(glow);
    this.moon = new T.Mesh(
      new T.SphereGeometry(0.88, 40, 28),
      new T.MeshStandardMaterial({ color: 0x8d9291, roughness: 1 }),
    );
    this.moon.position.set(-10, 1, -3);
    this.group.add(this.moon);
    this.sun = new T.Mesh(
      new T.SphereGeometry(1.7, 48, 32),
      new T.MeshBasicMaterial({ color: new T.Color(2.4, 1.65, 0.8) }),
    );
    this.sun.position.set(-20, 6, -40);
    this.group.add(this.sun);
    for (let i = 0; i < 4; i++) {
      const orbit = new T.Mesh(
        new T.TorusGeometry(7 + i * 5, 0.007, 5, 160),
        new T.MeshBasicMaterial({
          color: 0x718a8b,
          transparent: true,
          opacity: 0.12,
        }),
      );
      orbit.rotation.x = Math.PI / 2 - 0.18;
      orbit.position.y = -6;
      this.rings.add(orbit);
    }
    const light = new T.DirectionalLight(0xecd5b2, 2);
    light.position.set(-20, 15, 5);
    this.group.add(light);
    this.group.add(new T.AmbientLight(0x335866, 0.6));
  }
  update(t: number) {
    this.group.visible = t > 105 && t < 157;
    if (!this.group.visible) return;
    this.city.visible = t < 127;
    this.city.scale.setScalar(1 - smooth(108, 131, t) * 0.998);
    this.world.visible = t > 118;
    this.world.scale.setScalar(
      smooth(118, 134, t) * (1 - smooth(139, 157, t) * 0.92),
    );
    this.moon.visible = t > 130;
    this.moon.scale.setScalar(smooth(130, 136, t) * (1 - smooth(143, 157, t)));
    this.sun.visible = t > 137;
    this.sun.scale.setScalar(smooth(137, 143, t) * (1 - smooth(145, 157, t)));
    this.rings.visible = t > 137;
    this.rings.scale.setScalar(smooth(137, 144, t) * (1 - smooth(147, 157, t)));
  }
}

const keys = [
  { t: 0, p: [4.45, 3.22, 6.7], l: [-0.25, 1.86, -0.4] },
  { t: 32, p: [2.6, 2.8, 5.5], l: [-0.4, 2.0, -0.4] },
  { t: 63, p: [1, 2.65, 5.6], l: [-0.4, 2.15, -0.4] },
  { t: 95, p: [0.2, 3.3, 7.5], l: [-0.4, 2.3, -0.5] },
  { t: 108, p: [1.2, 7.3, 12], l: [0, 1, 0] },
  { t: 120, p: [2.2, 13, 23], l: [0, -2, -3] },
  { t: 137, p: [2, 12, 31], l: [0, -3, -3] },
  { t: 153, p: [0, 26, 52], l: [0, 0, 0] },
  { t: 180, p: [-3, 27, 49], l: [0, 0, 0] },
  { t: 196, p: [1, 15, 35], l: [0, 0, 0] },
  { t: 222, p: [7, 4.5, 14], l: [0, 0, 0] },
  { t: 233, p: [2, 3.6, 11], l: [0, 1, 0] },
  { t: 246, p: [0, 3.5, 12], l: [0, 1.6, -8] },
  { t: 270, p: [0, 3.6, 12], l: [0, 1.3, -18] },
  { t: 300, p: [0, 3.7, 12], l: [0, 1.5, -18] },
];
const pCurve = new T.CatmullRomCurve3(
  keys.map((k) => new T.Vector3(...(k.p as [number, number, number]))),
);
const lCurve = new T.CatmullRomCurve3(
  keys.map((k) => new T.Vector3(...(k.l as [number, number, number]))),
);
export function cameraAt(t: number, position: T.Vector3, look: T.Vector3) {
  const i = Math.min(
    keys.length - 2,
    Math.max(
      0,
      keys.findLastIndex((k) => k.t <= t),
    ),
  );
  const a = keys[i],
    b = keys[i + 1];
  const f = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)));
  const u = (i + f) / (keys.length - 1);
  pCurve.getPoint(u, position);
  lCurve.getPoint(u, look);
}
