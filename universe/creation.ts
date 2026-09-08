import * as T from "three/webgpu";
import { color, float, length, max, pow, uniform, uv } from "three/tsl";
import type { Destination } from "./flight";
import { placeRelative } from "./coordinates";
import { clamp } from "./config";
export type CreatedStar = Destination & { object: T.Group; born: number };
export class CreationSystem {
  stars: CreatedStar[] = [];
  template = new T.Group();
  private halo: T.SpriteNodeMaterial;
  constructor(private scene: T.Scene) {
    const core = new T.Mesh(
      new T.SphereGeometry(1, 32, 24),
      new T.MeshBasicMaterial({ color: new T.Color(4.5, 2.1, 0.65) }),
    );
    this.template.add(core);
    this.halo = new T.SpriteNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
    });
    this.halo.colorNode = color(0xefad61).mul(1.4);
    this.halo.opacityNode = pow(
      max(0, float(1).sub(length(uv().sub(0.5).mul(2)))),
      4,
    ).mul(0.65);
    const halo = new T.Sprite(this.halo);
    halo.scale.setScalar(12);
    this.template.add(halo);
    const ring = new T.Mesh(
      new T.TorusGeometry(3.8, 0.014, 5, 100),
      new T.MeshBasicMaterial({
        color: 0x846e4b,
        transparent: true,
        opacity: 0.4,
      }),
    );
    ring.rotation.x = 1.35;
    this.template.add(ring);
    const moon = new T.Mesh(
      new T.SphereGeometry(0.3, 24, 16),
      new T.MeshStandardMaterial({ color: 0x6c8379, roughness: 0.7 }),
    );
    moon.position.set(3.8, 0, 0);
    this.template.add(moon);
    this.template.position.set(0, 0, 1500000);
    scene.add(this.template);
    try {
      const saved = JSON.parse(
        localStorage.getItem("vastness-stars-v1") || "[]",
      );
      if (Array.isArray(saved))
        for (const s of saved.slice(-24)) {
          if (
            Array.isArray(s.p) &&
            s.p.length === 3 &&
            s.p.every(
              (v: unknown) => typeof v === "number" && Number.isFinite(v),
            ) &&
            Number.isFinite(s.r) &&
            s.r > 0 &&
            s.r < 100000
          )
            this.add(new T.Vector3(...s.p), s.r, -30, false);
        }
    } catch {}
  }
  add(position: T.Vector3, radius: number, time: number, save = true) {
    const object = this.template.clone(true);
    object.visible = true;
    this.scene.add(object);
    const star: CreatedStar = {
      id: `star-${Date.now()}-${this.stars.length}`,
      name: `A SMALL BEGINNING ${this.stars.length + 1}`,
      kind: "Young star",
      position: position.clone(),
      radius,
      object,
      born: time,
      solid: radius >= 1,
    };
    this.stars.push(star);
    if (this.stars.length > 24) {
      const old = this.stars.shift()!;
      this.scene.remove(old.object);
    }
    if (save)
      try {
        localStorage.setItem(
          "vastness-stars-v1",
          JSON.stringify(
            this.stars.map((s) => ({ p: s.position.toArray(), r: s.radius })),
          ),
        );
      } catch {}
    return star;
  }
  update(observer: T.Vector3, time: number) {
    this.template.visible = false;
    for (const s of this.stars) {
      const age = Math.max(0, time - s.born),
        growth = 0.05 + 0.95 * (1 - Math.exp(-age * 0.22));
      placeRelative(s.object, s.position, observer, s.radius * growth);
      s.object.children[3].position.set(
        Math.cos(age * 0.12) * 3.8,
        Math.sin(age * 0.12) * 0.6,
        Math.sin(age * 0.12) * 3.8,
      );
      s.object.children[3].scale.setScalar(clamp((age - 5) / 14));
    }
  }
  nearest(observer: T.Vector3) {
    let d = Infinity,
      target;
    for (const s of this.stars) {
      const distance = observer.distanceToSquared(s.position);
      if (distance < d) {
        d = distance;
        target = s.position;
      }
    }
    return target;
  }
}
