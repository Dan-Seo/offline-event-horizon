import * as T from "three/webgpu";
import {
  float,
  length,
  max,
  mix,
  positionLocal,
  pow,
  reflector,
  sin,
  smoothstep,
  uniformArray,
  uniform,
  vec2,
  vec3,
  attribute,
} from "three/tsl";
import type { SanctuaryAtmosphere } from "./sanctuary-atmosphere";
import { QUALITY, type Quality } from "./config";
import { SEA_RADIUS } from "./sanctuary-layout";
import { markSurface } from "./perception/surfaces";
import { OceanLife } from "./ocean-life";
import { renderedSeaFloor, seaHeight, signedSeaDepth, submersion, oceanRadialFloor, seaMesh } from "./ocean-depth";
import { preserveReflectorFramebuffer, waterFresnel, waterSurfaceOptics } from "./ocean-optics";

export class MirrorSea {
  mesh: T.Mesh;
  private ecosystem: OceanLife;
  private oceanRoot = new T.Group();
  private submerged = uniform(0);
  private lastDepth = 0;
  private lastFloor = 0;
  private animatedTime = 0;
  private floorClearance = 0;
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
  wakeSource?: T.Vector3;
  constructor(
    scene: T.Scene,
    private air: SanctuaryAtmosphere,
  ) {
    preserveReflectorFramebuffer(this.mirror);
    scene.add(this.oceanRoot);
    this.ecosystem = new OceanLife(this.oceanRoot, air.time, renderedSeaFloor, seaHeight, 1600, 1, false);
    // A radially graded spherical cap: decimetre ripples near the observer, broad curvature at the horizon.
    const geometry = new T.BufferGeometry();
    geometry.setAttribute(
      "position",
      new T.BufferAttribute(seaMesh.water, 3),
    );
    geometry.setIndex(new T.BufferAttribute(seaMesh.indices, 1));
    const columnDepth = new Float32Array(seaMesh.water.length / 3);
    for (let i = 0; i < columnDepth.length; i++) columnDepth[i] = seaMesh.water[i * 3 + 1] - seaMesh.floor[i * 3 + 1];
    geometry.setAttribute("waterColumn", new T.BufferAttribute(columnDepth, 1));
    geometry.computeVertexNormals();
    const material = new T.MeshBasicNodeMaterial({
      side: T.DoubleSide,
      transparent: true,
      depthWrite: true,
    });
    const p = positionLocal,
      t = air.time;
    const a = p.x.mul(0.025).add(p.z.mul(0.013)).add(t.mul(0.13));
    const b = p.x.mul(-0.013).add(p.z.mul(0.041)).sub(t.mul(0.17));
    const c = p.x.mul(0.11).add(p.z.mul(0.062)).add(t.mul(0.21));
    const ripple = sin(a).mul(0.2).add(sin(b).mul(0.09)).add(sin(c).mul(0.024));
    material.positionNode = p.add(vec3(0, ripple, 0));
    const northHeight = max(1, float(SEA_RADIUS * SEA_RADIUS).sub(p.x.mul(p.x)).sub(p.z.mul(p.z))).sqrt();
    const normal = vec3(
      p.x.div(northHeight).sub(a.cos().mul(0.005).add(b.cos().mul(-0.00117)).add(c.cos().mul(0.0026))),
      1,
      p.z.div(northHeight).sub(a.cos().mul(0.0026).add(b.cos().mul(0.0037)).add(c.cos().mul(0.0015))),
    ).normalize();
    const { view, fresnel } = waterFresnel(normal);
    this.mirror.target.rotation.x = -Math.PI / 2;
    scene.add(this.mirror.target);
    this.mirror.uvNode = this.mirror.uvNode!.add(
      normal.xz.mul(0.18).add(vec2(0, ripple.mul(0.0007))),
    );
    const reflection = this.mirror.rgb.mul(vec3(0.73, 0.87, 0.93));
    const reflectedDirection = view.negate().reflect(normal);
    const ambient = air.radiance(reflectedDirection).mul(0.55);
    const optics = waterSurfaceOptics(float(attribute("waterColumn", "float")), view.dot(normal), fresnel, reflection.add(ambient.mul(0.18)));
    material.opacityNode = air.presence.mul(mix(optics.opacity, float(0.66), this.submerged));
    const albedo = optics.color;
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
    material.colorNode = mix(albedo, vec3(0.08, 0.28, 0.31).add(ambient.mul(0.4)), this.submerged).add(
      vec3(0.1, 0.65, 0.6).mul(light).mul(sparkle),
    );
    this.mesh = markSurface(new T.Mesh(geometry, material), "water");
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    // Broad curved floor closes the cap; detailed sand and life occupy a bounded local garden.
    const floorGeometry = geometry.clone();
    floorGeometry.setAttribute("position", new T.BufferAttribute(seaMesh.floor, 3));
    floorGeometry.computeVertexNormals();
    const floorMaterial = new T.MeshBasicNodeMaterial({ color: 0x315d61, side: T.DoubleSide });
    const garden = float(1).sub(smoothstep(1200, 1800, length(p.xz)));
    const sandRipple = sin(p.x.mul(2.1).add(sin(p.z.mul(0.12)).mul(3))).mul(0.035).add(0.965);
    const caustic = sin(p.x.mul(0.28).add(sin(p.z.mul(0.23).add(t.mul(0.23))).mul(2))).abs()
      .mul(sin(p.z.mul(0.31).sub(t.mul(0.19))).abs()).pow(12).mul(0.18).add(0.82);
    floorMaterial.colorNode = mix(vec3(0.03, 0.09, 0.10), vec3(0.24, 0.29, 0.22).mul(sandRipple).mul(caustic), garden);
    const floorMesh = new T.Mesh(floorGeometry, floorMaterial);
    floorMesh.name = "MirrorSea seabed";
    this.oceanRoot.add(floorMesh);
  }
  update(observer: T.Vector3, time: number, speed: number, presence: number) {
    this.mesh.position.copy(observer).negate();
    this.mesh.visible = presence > 0.001;
    this.oceanRoot.position.copy(observer).negate();
    this.oceanRoot.visible = presence > 0.001;
    this.lastDepth = signedSeaDepth(observer.x, observer.y, observer.z);
    this.lastFloor = renderedSeaFloor(observer.x, observer.z);
    const radial = new T.Vector3(observer.x, observer.y + SEA_RADIUS, observer.z);
    const distance = radial.length(); radial.normalize();
    this.floorClearance = distance - oceanRadialFloor(radial.x, radial.y, radial.z, renderedSeaFloor, SEA_RADIUS, 3);
    this.animatedTime = time;
    this.submerged.value = submersion(this.lastDepth);
    this.air.underwater.value = this.submerged.value * presence;
    this.ecosystem.update(observer, time, presence > 0.001);
    this.mirror.target.position.set(-observer.x, -observer.y, -observer.z);
    const source = this.wakeSource ?? observer;
    const localSeaY =
      Math.sqrt(Math.max(0, SEA_RADIUS ** 2 - source.x ** 2 - source.z ** 2)) -
      SEA_RADIUS;
    if (
      speed > 0.65 &&
      source.y - localSeaY < 95 &&
      time - this.lastWake > 0.45 &&
      presence > 0.8
    ) {
      this.wakes[this.wakeIndex++ % this.wakes.length].set(
        source.x,
        source.z,
        time,
        Math.min(1, speed / 22),
      );
      this.lastWake = time;
      this.wakeCount++;
    }
  }
  setQuality(q: Quality) {
    this.ecosystem.setQuality(q);
    this.mirror.reflector.resolutionScale = QUALITY[q].seaReflection;
  }
  dispose() {
    this.ecosystem.dispose();
    this.mirror.dispose();
  }
  inspect() {
    return { signedDepth: this.lastDepth, seabedHeight: this.lastFloor, floorClearance: this.floorClearance, submersion: this.submerged.value, animatedTime: this.animatedTime, ecosystem: this.ecosystem.inspect() };
  }
}
