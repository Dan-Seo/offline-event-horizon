import * as T from "three/webgpu";
import {
  cameraPosition,
  float,
  length,
  max,
  mix,
  positionLocal,
  positionWorld,
  pow,
  reflector,
  sin,
  smoothstep,
  uniformArray,
  vec2,
  vec3,
} from "three/tsl";
import type { SanctuaryAtmosphere } from "./sanctuary-atmosphere";
import type { Quality } from "./config";
import { SEA_RADIUS } from "./sanctuary-layout";

export class MirrorSea {
  mesh: T.Mesh;
  private mirror = reflector({
    resolutionScale: 0.65,
    bounces: false,
    samples: 0,
  });
  private wakes = Array.from(
    { length: 12 },
    () => new T.Vector4(0, 0, -1000, 0),
  );
  private wakeIndex = 0;
  private lastWake = -1;
  wakeCount = 0;
  constructor(
    scene: T.Scene,
    private air: SanctuaryAtmosphere,
  ) {
    // A radially graded spherical cap: decimetre ripples near the observer, broad curvature at the horizon.
    const rings = 128,
      slices = 192,
      positions: number[] = [],
      indices: number[] = [];
    for (let j = 0; j <= rings; j++) {
      const r = 46000 * Math.pow(j / rings, 2.5);
      for (let i = 0; i <= slices; i++) {
        const a = (i / slices) * Math.PI * 2;
        positions.push(
          Math.cos(a) * r,
          Math.sqrt(SEA_RADIUS ** 2 - r ** 2) - SEA_RADIUS + 0.3,
          Math.sin(a) * r,
        );
      }
    }
    for (let j = 0; j < rings; j++)
      for (let i = 0; i < slices; i++) {
        const a = j * (slices + 1) + i,
          b = a + slices + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute(
      "position",
      new T.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const material = new T.MeshBasicNodeMaterial({
      side: T.DoubleSide,
      transparent: true,
      depthWrite: false,
    });
    material.opacityNode = air.presence;
    const p = positionLocal,
      t = air.time;
    const a = p.x.mul(0.025).add(p.z.mul(0.013)).add(t.mul(0.13));
    const b = p.x.mul(-0.013).add(p.z.mul(0.041)).sub(t.mul(0.17));
    const c = p.x.mul(0.11).add(p.z.mul(0.062)).add(t.mul(0.21));
    const ripple = sin(a).mul(0.2).add(sin(b).mul(0.09)).add(sin(c).mul(0.024));
    material.positionNode = p.add(vec3(0, ripple, 0));
    const normal = vec3(
      a.cos().mul(0.005).add(b.cos().mul(-0.00117)).add(c.cos().mul(0.0026)),
      1,
      a.cos().mul(0.0026).add(b.cos().mul(0.0037)).add(c.cos().mul(0.0015)),
    ).normalize();
    const view = cameraPosition.sub(positionWorld).normalize();
    const fresnel = pow(float(1).sub(max(0, view.dot(normal))), 5)
      .mul(0.65)
      .add(0.3);
    this.mirror.target.rotation.x = -Math.PI / 2;
    scene.add(this.mirror.target);
    this.mirror.uvNode = this.mirror.uvNode!.add(
      normal.xz.mul(0.18).add(vec2(0, ripple.mul(0.0007))),
    );
    const reflection = this.mirror.rgb.mul(vec3(0.73, 0.87, 0.93));
    const reflectedDirection = view.negate().reflect(normal);
    const ambient = air.radiance(reflectedDirection).mul(0.55);
    const albedo = mix(
      vec3(0.0015, 0.009, 0.012),
      reflection.add(ambient.mul(0.18)),
      fresnel,
    );
    const data = uniformArray<"vec4">(this.wakes, "vec4");
    let light: T.Node<"float"> = float(0);
    for (let i = 0; i < this.wakes.length; i++) {
      const wake = data.element(i),
        age = t.sub(wake.z);
      const r = length(p.xz.sub(wake.xy));
      const envelope = age
        .mul(-0.26)
        .exp()
        .mul(smoothstep(0, 0.7, age))
        .mul(wake.w);
      const ring = pow(
        max(0, float(1).sub(r.sub(age.mul(5)).abs().mul(0.2))),
        2,
      );
      const trail = r
        .mul(-0.035)
        .exp()
        .mul(
          sin(r.mul(0.45).sub(age.mul(0.6)))
            .abs()
            .pow(2),
        );
      light = light.add(ring.mul(0.14).add(trail.mul(0.36)).mul(envelope));
    }
    const sparkle = sin(p.x.mul(1.1).add(sin(p.z.mul(0.19)).mul(3)))
      .mul(sin(p.z.mul(0.92)))
      .abs()
      .pow(4)
      .mul(0.65)
      .add(0.35);
    material.colorNode = albedo.add(
      vec3(0.1, 0.65, 0.6).mul(light).mul(sparkle),
    );
    this.mesh = new T.Mesh(geometry, material);
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
  update(observer: T.Vector3, time: number, speed: number, presence: number) {
    this.mesh.position.copy(observer).negate();
    this.mesh.visible = presence > 0.001;
    this.mirror.target.position.set(-observer.x, -observer.y, -observer.z);
    const localSeaY =
      Math.sqrt(
        Math.max(0, SEA_RADIUS ** 2 - observer.x ** 2 - observer.z ** 2),
      ) - SEA_RADIUS;
    if (
      speed > 0.65 &&
      observer.y - localSeaY < 95 &&
      time - this.lastWake > 0.45 &&
      presence > 0.8
    ) {
      this.wakes[this.wakeIndex++ % this.wakes.length].set(
        observer.x,
        observer.z,
        time,
        Math.min(1, speed / 22),
      );
      this.lastWake = time;
      this.wakeCount++;
    }
  }
  setQuality(q: Quality) {
    this.mirror.reflector.resolutionScale = {
      ULTRA: 0.85,
      HIGH: 0.65,
      BALANCED: 0.45,
      BATTERY: 0.3,
    }[q];
  }
  dispose() {
    this.mirror.dispose();
  }
}
