import * as T from "three/webgpu";
import {
  Fn,
  If,
  instancedArray,
  instanceIndex,
  uniform,
  attribute,
  positionLocal,
  positionWorld,
  normalWorld,
  cameraPosition,
  bumpMap,
  uv,
  vec2,
  vec3,
  vec4,
  float,
  sin,
  cos,
  mix,
  smoothstep,
  length,
  max,
  pow,
  color,
  mx_noise_float,
} from "three/tsl";
import { canvasTexture } from "./textures";
import { QUALITY, Quality, seeded, smooth } from "./timeline";

const MAX_PARTICLES = 180000;
export class Cosmos {
  group = new T.Group();
  singularity = new T.Group();
  planet = new T.Group();
  private time = uniform(0);
  private morph = uniform(0);
  private expansion = uniform(0);
  private amount = uniform(0);
  private growth = uniform(0);
  private life = uniform(0);
  private field = uniform(new T.Vector3());
  private fieldB = uniform(new T.Vector3());
  private fieldC = uniform(new T.Vector3());
  private multiple = uniform(0);
  private strength = uniform(1);
  private delta = uniform(1 / 60);
  private seedForce = uniform(0);
  private geometry: T.InstancedBufferGeometry;
  private computeNode?: T.ComputeNode;
  private particleMesh: T.Mesh;
  private stars: T.Points;
  private nebula: T.Mesh;
  private horizonGlow: T.Mesh;
  private planetLight: T.DirectionalLight;
  private particleCount = 90000;
  private seedAt = -100;
  private black: T.Mesh;
  private seedRings: T.Mesh[] = [];
  private core: T.Sprite;
  computeMs = 0;
  constructor(
    scene: T.Scene,
    private gpu: boolean,
  ) {
    scene.add(this.group);
    scene.add(this.singularity);
    scene.add(this.planet);
    this.singularity.position.set(-0.47, 2.32, -0.49);
    this.black = new T.Mesh(
      new T.SphereGeometry(0.29, 48, 32),
      new T.MeshBasicMaterial({ color: 0x000102 }),
    );
    this.singularity.add(this.black);
    const ringMat = new T.MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      side: T.DoubleSide,
    });
    const u = uv().sub(0.5).mul(2);
    const a = u.y.atan(u.x);
    const turbulence = mx_noise_float(
      vec3(u.x.mul(6), u.y.mul(15), this.time.mul(0.07)),
    ).mul(0.018);
    const r = length(vec2(u.x, u.y.mul(3.2))).add(turbulence);
    const waves = sin(
      r
        .mul(230)
        .sub(this.time.mul(5))
        .add(sin(a.mul(7)).mul(3)),
    )
      .mul(0.5)
      .add(0.5);
    const envelope = smoothstep(0.24, 0.31, r).mul(
      float(1).sub(smoothstep(0.34, 0.79, r)),
    );
    const brightness = pow(envelope, 2)
      .mul(waves.mul(0.23).add(0.25))
      .mul(float(1).add(u.x.mul(0.5)));
    ringMat.colorNode = mix(
      color(0x8e421b),
      color(0xffeac1),
      pow(envelope, 8),
    ).mul(2.9);
    ringMat.opacityNode = brightness;
    const disk = new T.Mesh(new T.PlaneGeometry(3.6, 3.6), ringMat);
    disk.position.z = 0.035;
    disk.rotation.z = -0.16;
    this.singularity.add(disk);
    const photon = new T.Mesh(
      new T.TorusGeometry(0.311, 0.008, 8, 100),
      new T.MeshBasicMaterial({ color: new T.Color(3.2, 2.2, 1.3) }),
    );
    photon.position.z = 0.01;
    this.singularity.add(photon);
    const lensMat = new T.MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
    });
    const d = length(u);
    const lens = pow(max(float(0), float(1).sub(d.sub(0.43).abs().mul(28))), 3);
    lensMat.colorNode = color(0xe5c69c).mul(2.2);
    lensMat.opacityNode = lens.mul(0.52);
    this.horizonGlow = new T.Mesh(new T.PlaneGeometry(1.5, 1.5), lensMat);
    this.horizonGlow.position.z = -0.03;
    this.singularity.add(this.horizonGlow);
    const holeLight = new T.PointLight(0xe4b27b, 7, 12);
    this.singularity.add(holeLight);

    const rand = seeded(817);
    const homes = new Float32Array(MAX_PARTICLES * 3),
      galaxy = new Float32Array(MAX_PARTICLES * 3),
      orbit = new Float32Array(MAX_PARTICLES * 3),
      colors = new Float32Array(MAX_PARTICLES * 3),
      sizes = new Float32Array(MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const h = i % 5;
      if (h < 2)
        homes.set(
          [-0.47 + (rand() - 0.5) * 2.32, 2.32 + (rand() - 0.5) * 1.3, -0.57],
          i * 3,
        );
      else if (h === 2)
        homes.set([(rand() - 0.5) * 5.8, 1.22, (rand() - 0.5) * 2.65], i * 3);
      else
        homes.set([(rand() - 0.5) * 14, rand() * 7, -4.3 + rand() * 7], i * 3);
      const rr = 0.45 + Math.pow(rand(), 0.72) * 2.4,
        aa = rand() * Math.PI * 2;
      orbit.set(
        [
          -0.47 + Math.cos(aa) * rr,
          2.32 + Math.sin(aa) * rr * 0.28,
          -0.5 + Math.sin(aa) * rr * 0.45,
        ],
        i * 3,
      );
      const radius = Math.pow(rand(), 0.85) * 34,
        arm = i % 4,
        theta = radius * 0.19 + arm * Math.PI * 0.5 + (rand() - 0.5) * 0.9;
      const scatter = rand() < 0.25 ? 5 : 0.8;
      galaxy.set(
        [
          Math.cos(theta) * radius + (rand() - 0.5) * scatter,
          (rand() - 0.5) * scatter * (1 - radius / 45),
          Math.sin(theta) * radius * 0.8,
        ],
        i * 3,
      );
      const c = new T.Color();
      if (rand() < 0.06) c.set(0x81bbca);
      else
        c.setHSL(
          0.08 + rand() * 0.055,
          0.08 + rand() * 0.3,
          0.56 + rand() * 0.4,
        );
      c.toArray(colors, i * 3);
      sizes[i] = 0.45 + Math.pow(rand(), 5) * 2.5;
    }
    this.geometry = new T.InstancedBufferGeometry();
    const quad = new T.PlaneGeometry(1, 1);
    this.geometry.index = quad.index;
    this.geometry.attributes = { ...quad.attributes };
    this.geometry.setAttribute(
      "aHome",
      new T.InstancedBufferAttribute(homes, 3),
    );
    this.geometry.setAttribute(
      "aOrbit",
      new T.InstancedBufferAttribute(orbit, 3),
    );
    this.geometry.setAttribute(
      "aGalaxy",
      new T.InstancedBufferAttribute(galaxy, 3),
    );
    this.geometry.setAttribute(
      "aColor",
      new T.InstancedBufferAttribute(colors, 3),
    );
    this.geometry.setAttribute(
      "aSize",
      new T.InstancedBufferAttribute(sizes, 1),
    );
    this.geometry.instanceCount = this.particleCount;
    const home = attribute<"vec3">("aHome", "vec3"),
      orb = attribute<"vec3">("aOrbit", "vec3"),
      rest = attribute<"vec3">("aGalaxy", "vec3");
    let destination: T.Node<"vec3"> = rest;
    if (gpu) {
      const positions = instancedArray(galaxy.slice(), "vec3"),
        velocities = instancedArray(MAX_PARTICLES, "vec3"),
        origins = instancedArray(galaxy.slice(), "vec3");
      const step = Fn(() => {
        const p = positions.element(instanceIndex),
          v = velocities.element(instanceIndex),
          origin = origins.element(instanceIndex);
        const toField = this.field.sub(p),
          r2 = toField.dot(toField).add(6);
        const spring = origin.sub(p).mul(0.055);
        const b = this.fieldB.sub(p),
          c = this.fieldC.sub(p);
        const secondary = b
          .div(b.dot(b).add(8))
          .add(c.div(c.dot(c).add(8)))
          .mul(this.multiple)
          .mul(18);
        const gravity = toField
          .mul(this.strength.mul(5).add(this.seedForce.mul(45)))
          .div(r2)
          .add(secondary);
        const swirl = vec3(p.z.negate(), sin(p.x.mul(0.1)).mul(0.2), p.x).mul(
          0.003,
        );
        v.addAssign(spring.add(gravity).add(swirl).mul(this.delta));
        v.mulAssign(pow(0.982, this.delta.mul(60)));
        p.addAssign(v.mul(this.delta));
        If(length(p).greaterThan(100), () => {
          p.assign(origin);
          v.assign(vec3(0));
        });
      })().compute(this.particleCount);
      this.computeNode = step;
      destination = positions.toAttribute();
    } else {
      destination = rest.add(
        vec3(
          sin(this.time.mul(0.07).add(rest.z)).mul(0.22),
          cos(this.time.mul(0.09).add(rest.x)).mul(0.1),
          0,
        ),
      );
    }
    const mat = new T.MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
    });
    const rotate = this.time.mul(0.018),
      gx = destination.x.mul(cos(rotate)).sub(destination.z.mul(sin(rotate))),
      gz = destination.x.mul(sin(rotate)).add(destination.z.mul(cos(rotate)));
    const target = vec3(gx, destination.y, gz).mul(
      float(1).sub(this.growth.mul(0.78)),
    );
    const base = mix(mix(home, orb, this.morph), target, this.expansion);
    const size = attribute<"float">("aSize", "float").mul(
      mix(0.007, 0.032, this.expansion),
    );
    mat.positionNode = base.add(positionLocal.mul(size));
    mat.colorNode = attribute<"vec3">("aColor", "vec3").mul(
      mix(0.7, 2.4, this.expansion),
    );
    const circle = pow(
      max(float(0), float(1).sub(length(uv().sub(0.5).mul(2)))),
      2,
    );
    mat.opacityNode = circle
      .mul(this.amount)
      .mul(float(1).sub(this.growth.mul(0.82)));
    this.particleMesh = new T.Mesh(this.geometry, mat);
    this.particleMesh.frustumCulled = false;
    this.group.add(this.particleMesh);
    const glowTexture = canvasTexture(128, 128, (c) => {
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, "rgba(255,236,201,1)");
      g.addColorStop(0.08, "rgba(255,219,165,.6)");
      g.addColorStop(0.28, "rgba(191,157,116,.15)");
      g.addColorStop(1, "rgba(106,124,130,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
    });
    this.core = new T.Sprite(
      new T.SpriteMaterial({
        map: glowTexture,
        transparent: true,
        blending: T.AdditiveBlending,
        depthWrite: false,
        opacity: 0,
      }),
    );
    this.core.scale.set(16, 13, 1);
    this.group.add(this.core);

    const stars = new Float32Array(4200 * 3),
      starColors = new Float32Array(4200 * 3);
    for (let i = 0; i < 4200; i++) {
      const p = new T.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5)
        .normalize()
        .multiplyScalar(130 + rand() * 80);
      p.toArray(stars, i * 3);
      const c = new T.Color().setHSL(
        0.09 + rand() * 0.07,
        0.05 + rand() * 0.15,
        0.35 + rand() * 0.55,
      );
      c.toArray(starColors, i * 3);
    }
    const sg = new T.BufferGeometry();
    sg.setAttribute("position", new T.BufferAttribute(stars, 3));
    sg.setAttribute("color", new T.BufferAttribute(starColors, 3));
    this.stars = new T.Points(
      sg,
      new T.PointsMaterial({
        size: 0.1,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0,
        vertexColors: true,
        depthWrite: false,
      }),
    );
    this.group.add(this.stars);
    const nebulaMat = new T.MeshBasicNodeMaterial({
      side: T.BackSide,
      transparent: true,
      depthWrite: false,
    });
    const dir = positionLocal.normalize();
    const n = mx_noise_float(dir.mul(4.8)).mul(0.5).add(0.5),
      n2 = mx_noise_float(dir.mul(13)).mul(0.5).add(0.5);
    const cloud = pow(n, 4)
      .mul(n2)
      .mul(smoothstep(0.5, 0, dir.y.add(dir.x.mul(0.2)).abs()));
    nebulaMat.colorNode = vec3(color(0x03090f)).add(
      mix(color(0x254e52), color(0x785242), n2).mul(cloud.mul(1.8)),
    );
    nebulaMat.opacityNode = this.expansion;
    this.nebula = new T.Mesh(new T.SphereGeometry(270, 40, 28), nebulaMat);
    this.nebula.renderOrder = -10;
    this.group.add(this.nebula);

    const planetMaterial = new T.MeshStandardNodeMaterial({
      roughness: 0.84,
      metalness: 0.02,
    });
    const surface = positionLocal.normalize();
    const continents = mx_noise_float(surface.mul(3.8))
      .add(mx_noise_float(surface.mul(10)).mul(0.28))
      .add(mx_noise_float(surface.mul(32)).mul(0.09));
    const land = smoothstep(-0.04, 0.11, continents);
    const ice = smoothstep(0.72, 0.95, surface.y.abs());
    const dry = mix(
      color(0x302720),
      color(0x948572),
      continents.mul(0.7).add(0.5),
    );
    const wet = mix(
      color(0x133e48),
      mix(color(0x344c37), color(0x7a8260), continents),
      land,
    );
    planetMaterial.colorNode = mix(
      dry,
      mix(wet, color(0xd0d9c9), ice),
      this.life,
    );
    planetMaterial.roughnessNode = mix(0.85, mix(0.24, 0.85, land), this.life);
    planetMaterial.normalNode = bumpMap(
      mx_noise_float(surface.mul(47)).mul(0.035),
      float(0.3),
    );
    planetMaterial.positionNode = positionLocal.add(
      surface.mul(max(continents, 0).mul(0.07)),
    );
    const globe = new T.Mesh(
      new T.SphereGeometry(4.15, 96, 64),
      planetMaterial,
    );
    this.planet.add(globe);
    const atmoMaterial = new T.MeshBasicNodeMaterial({
      transparent: true,
      side: T.BackSide,
      depthWrite: false,
      blending: T.AdditiveBlending,
    });
    // Layered shells provide the atmosphere's grazing-angle rim without a ray march.
    atmoMaterial.colorNode = color(0x5cbbc1);
    atmoMaterial.opacityNode = pow(
      float(1).sub(
        normalWorld.dot(cameraPosition.sub(positionWorld).normalize()).abs(),
      ),
      3,
    )
      .mul(this.life)
      .mul(0.32);
    for (let i = 0; i < 3; i++) {
      const shell = new T.Mesh(
        new T.SphereGeometry(4.22 + i * 0.045, 64, 40),
        atmoMaterial,
      );
      this.planet.add(shell);
    }
    const clouds = new T.MeshStandardNodeMaterial({
      transparent: true,
      depthWrite: false,
      roughness: 1,
    });
    const cloudNoise = mx_noise_float(
      surface.mul(7).add(vec3(this.time.mul(0.009), 0, 0)),
    ).add(mx_noise_float(surface.mul(21)).mul(0.35));
    clouds.colorNode = color(0xbacac7);
    clouds.opacityNode = smoothstep(0.08, 0.49, cloudNoise)
      .mul(this.life)
      .mul(0.52);
    this.planet.add(new T.Mesh(new T.SphereGeometry(4.23, 72, 48), clouds));
    this.planetLight = new T.DirectionalLight(0xffdfaa, 4);
    this.planetLight.position.set(-12, 8, 9);
    scene.add(this.planetLight);
    const ambient = new T.HemisphereLight(0x92c9d7, 0x06111b, 0.4);
    this.planet.add(ambient);
    for (let i = 0; i < 3; i++) {
      const ring = new T.Mesh(
        new T.TorusGeometry(4.8 + i * 0.45, 0.008, 6, 180),
        new T.MeshBasicMaterial({
          color: 0xb9a485,
          transparent: true,
          opacity: 0.28,
        }),
      );
      ring.rotation.x = 1.22;
      ring.rotation.y = 0.24;
      this.planet.add(ring);
      this.seedRings.push(ring);
    }
  }
  setCount(quality: Quality) {
    this.particleCount = QUALITY[quality].particles;
    this.geometry.instanceCount = this.particleCount;
    this.computeNode?.setCount(this.particleCount);
  }
  get count() {
    return this.particleMesh.visible ? this.particleCount : 0;
  }
  seed(t: number, pointer: T.Vector2) {
    this.seedAt = t;
    this.field.value.set(pointer.x * 14, pointer.y * 8, 0);
  }
  update(
    t: number,
    elapsed: number,
    dt: number,
    pointer: T.Vector2,
    renderer: T.WebGPURenderer,
    gravity: number,
    reduced: boolean,
    multiple = false,
  ) {
    this.time.value = reduced ? 0 : elapsed;
    this.morph.value = smooth(45, 108, t);
    this.expansion.value = smooth(91, 145, t);
    this.amount.value = smooth(23, 73, t) * (1 - smooth(226, 238, t)) * 0.68;
    this.growth.value = smooth(192, 223, t);
    this.life.value = smooth(212, 245, t);
    this.group.visible = t > 18;
    this.particleMesh.visible = t > 18 && t < 249;
    (this.stars.material as T.PointsMaterial).opacity =
      smooth(75, 140, t) * (1 - smooth(243, 265, t) * 0.6);
    const anomaly = smooth(20, 76, t) * (1 - smooth(111, 146, t));
    this.singularity.visible = anomaly > 0.001;
    this.singularity.scale.setScalar(0.03 + anomaly * 1.85);
    this.singularity.rotation.z = Math.sin(elapsed * 0.08) * 0.07;
    this.core.material.opacity =
      smooth(119, 155, t) * (1 - smooth(191, 219, t)) * 0.45;
    this.planet.visible = t >= 192 && t < 233;
    this.planet.scale.setScalar(
      Math.max(0.001, smooth(192, 225, t)) * (1 - smooth(229, 233, t)),
    );
    this.planet.rotation.y = elapsed * 0.014;
    this.planetLight.intensity =
      smooth(186, 223, t) * (1 - smooth(230, 246, t)) * 3.2;
    this.seedRings.forEach((r, i) => {
      (r.material as T.MeshBasicMaterial).opacity =
        (1 - smooth(218, 237, t)) * 0.25;
      r.rotation.z = elapsed * 0.025 * (i % 2 ? 1 : -1);
    });
    this.strength.value = gravity;
    this.delta.value = Math.min(dt, 1 / 30);
    this.seedForce.value = Math.max(0, 1 - (t - this.seedAt) / 9);
    this.multiple.value = multiple ? 1 : 0;
    this.fieldB.value.set(
      Math.cos(elapsed * 0.13) * 12,
      2,
      Math.sin(elapsed * 0.13) * 12,
    );
    this.fieldC.value.set(
      Math.sin(elapsed * 0.17) * 18,
      -2,
      Math.cos(elapsed * 0.17) * 9,
    );
    if (this.seedForce.value === 0)
      this.field.value.set(pointer.x * 18, pointer.y * 9, 0);
    if (this.computeNode && this.particleMesh.visible && t > 98 && !reduced) {
      const start = performance.now();
      renderer.compute(this.computeNode as T.ComputeNode);
      this.computeMs = performance.now() - start;
    }
  }
  dispose() {
    this.computeNode?.dispose();
  }
}
