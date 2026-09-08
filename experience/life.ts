import * as T from "three/webgpu";
import {
  uniform,
  positionLocal,
  positionWorld,
  normalWorld,
  cameraPosition,
  bumpMap,
  uv,
  vec3,
  vec4,
  float,
  mix,
  color,
  sin,
  cos,
  max,
  pow,
  smoothstep,
  mx_noise_float,
  attribute,
} from "three/tsl";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { QUALITY, Quality, seeded, smooth } from "./timeline";

// A spherical cap unfolds into this local terrain. Its final height field is an artistic scale transition.
export function terrainHeight(x: number, z: number) {
  const lake = Math.exp(
    -((x + Math.sin(z * 0.12) * 4) ** 2 / 130 + (z + 7) ** 2 / 850),
  );
  const ridge =
    Math.sin(x * 0.065 + z * 0.039) * 2.2 +
    Math.sin(x * 0.12 - z * 0.083) * 1.1 +
    Math.cos(z * 0.18 + x * 0.05) * 0.45;
  const mountains =
    Math.max(0, -z - 28) *
    0.32 *
    (0.7 + Math.sin(x * 0.1) * 0.25 + Math.cos(x * 0.22) * 0.19);
  return ridge * (1 - lake * 0.8) + mountains - 2.2 * lake + 0.7;
}
export class LivingWorld {
  group = new T.Group();
  private time = uniform(0);
  private growth = uniform(0);
  private atmosphere = uniform(0);
  private landing = uniform(0);
  private grass: T.InstancedMesh;
  private flowers: T.InstancedMesh;
  private sky: T.Mesh;
  private light: T.DirectionalLight;
  private ambient: T.HemisphereLight;
  private fireflies: T.Mesh;
  private water: T.Mesh;
  private moon: T.Mesh;
  private trees = new T.Group();
  private grassCount = 8000;
  private treeInstances: T.InstancedMesh[] = [];
  constructor(scene: T.Scene) {
    scene.add(this.group);
    const rand = seeded(714);
    const geo = new T.PlaneGeometry(170, 170, 180, 180);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    const cols = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        z = p.getZ(i),
        h = terrainHeight(x, z);
      p.setY(i, h);
      const c = new T.Color().setHSL(
        0.15 + Math.min(0.13, Math.max(0, h) * 0.008),
        0.1 + 0.15 * rand(),
        0.16 + rand() * 0.025 + Math.min(0.2, Math.max(0, h) * 0.017),
      );
      c.toArray(cols, i * 3);
    }
    geo.setAttribute("color", new T.BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    const ground = new T.MeshStandardNodeMaterial({
      vertexColors: true,
      roughness: 1,
    });
    // Start attached to the globe's near hemisphere, then unfold the same vertices into a landscape.
    const capDirection = vec3(
      sin(positionLocal.x.mul(0.012)).mul(cos(positionLocal.z.mul(0.012))),
      sin(positionLocal.z.mul(-0.012)),
      cos(positionLocal.x.mul(0.012)).mul(cos(positionLocal.z.mul(0.012))),
    );
    const cap = capDirection.mul(4.18);
    ground.positionNode = mix(cap, positionLocal, this.landing);
    const continent = mx_noise_float(capDirection.mul(3.8))
      .add(mx_noise_float(capDirection.mul(10)).mul(0.28))
      .add(mx_noise_float(capDirection.mul(32)).mul(0.09));
    const globeColor = mix(
      color(0x133e48),
      mix(color(0x344c37), color(0x7a8260), continent),
      smoothstep(-0.04, 0.11, continent),
    );
    const n = mx_noise_float(positionLocal.mul(2.7)).mul(0.2).add(0.8);
    ground.colorNode = mix(
      globeColor,
      attribute<"vec3">("color", "vec3")
        .mul(n)
        .mul(mix(vec3(1, 0.76, 0.57), vec3(1), this.growth)),
      this.landing,
    );
    const terrain = new T.Mesh(geo, ground);
    terrain.frustumCulled = false;
    this.group.add(terrain);
    const waterMat = new T.MeshStandardNodeMaterial({
      transparent: true,
      roughness: 0.38,
      metalness: 0.28,
    });
    const waterNoise = mx_noise_float(
      vec3(
        positionLocal.x.mul(0.8),
        positionLocal.z.mul(0.8),
        this.time.mul(0.05),
      ),
    );
    const ripples = sin(
      positionLocal.x
        .mul(0.7)
        .add(positionLocal.z.mul(0.3))
        .add(this.time.mul(0.22)),
    )
      .add(
        sin(
          positionLocal.x
            .mul(-0.23)
            .add(positionLocal.z.mul(1.1))
            .sub(this.time.mul(0.17)),
        ),
      )
      .mul(0.012)
      .add(waterNoise.mul(0.009));
    waterMat.positionNode = mix(
      cap,
      positionLocal.add(vec3(0, ripples, 0)),
      this.landing,
    );
    const view = cameraPosition.sub(positionWorld).normalize();
    const fresnel = pow(float(1).sub(max(view.dot(normalWorld), 0)), 3);
    waterMat.colorNode = mix(
      color(0x0d292e),
      color(0x4c7879),
      fresnel.mul(0.75),
    );
    waterMat.opacityNode = this.atmosphere.mul(0.94);
    waterMat.normalNode = bumpMap(ripples, float(0.3));
    const reflectedBand = sin(
      positionLocal.x.mul(0.06).add(this.time.mul(0.009)),
    )
      .mul(0.2)
      .add(0.2);
    const reflectedLight = pow(
      max(
        float(0),
        float(1).sub(positionLocal.z.mul(0.012).add(reflectedBand).abs()),
      ),
      5,
    );
    waterMat.emissiveNode = vec3(0.015, 0.045, 0.044)
      .mul(reflectedLight)
      .mul(fresnel)
      .mul(
        mx_noise_float(
          vec3(
            positionLocal.x.mul(0.6),
            positionLocal.z.mul(3.5),
            this.time.mul(0.06),
          ),
        )
          .mul(0.3)
          .add(0.7),
      );
    const wg = new T.PlaneGeometry(166, 166, 100, 100);
    wg.rotateX(-Math.PI / 2);
    this.water = new T.Mesh(wg, waterMat);
    this.water.position.y = -0.1;
    this.group.add(this.water);
    const skyMat = new T.MeshBasicNodeMaterial({
      side: T.BackSide,
      depthWrite: false,
      fog: false,
      transparent: true,
    });
    skyMat.opacityNode = this.atmosphere;
    const dir = positionLocal.normalize();
    const elevation = smoothstep(-0.025, 0.4, dir.y);
    const horizon = pow(max(float(0), float(1).sub(dir.y.abs().mul(4))), 3);
    const clouds = mx_noise_float(
      dir.mul(8).add(vec3(this.time.mul(0.002), 0, 0)),
    )
      .mul(mx_noise_float(dir.mul(24)))
      .mul(0.05);
    skyMat.colorNode = mix(color(0x426568), color(0x041321), elevation)
      .add(vec3(0.065, 0.033, 0.011).mul(horizon))
      .add(vec3(clouds.mul(0.35)));
    this.sky = new T.Mesh(new T.SphereGeometry(250, 48, 32), skyMat);
    this.sky.renderOrder = -9;
    this.group.add(this.sky);
    this.light = new T.DirectionalLight(0xffd9a1, 0.85);
    this.light.position.set(-45, 15, -40);
    this.group.add(this.light);
    this.ambient = new T.HemisphereLight(0x9cbcbf, 0x293b37, 0.7);
    this.group.add(this.ambient);
    // One blade source, 14k instances. Wind is evaluated in the vertex shader.
    const blade = new T.BufferGeometry();
    blade.setAttribute(
      "position",
      new T.Float32BufferAttribute(
        [
          -0.026, 0, 0, 0.026, 0, 0, -0.017, 0.26, 0, 0.017, 0.26, 0, 0, 0.57,
          0.016,
        ],
        3,
      ),
    );
    blade.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
    blade.computeVertexNormals();
    const grassMat = new T.MeshStandardNodeMaterial({
      color: 0x5b7753,
      roughness: 0.9,
      side: T.DoubleSide,
    });
    const bend = sin(
      this.time
        .mul(0.65)
        .add(positionWorld.x.mul(0.42))
        .add(positionWorld.z.mul(0.3)),
    )
      .mul(positionLocal.y.pow(2))
      .mul(0.3);
    grassMat.positionNode = positionLocal
      .mul(vec3(1, this.growth, 1))
      .add(vec3(bend, 0, bend.mul(0.3)));
    grassMat.colorNode = mix(
      color(0x18332e),
      color(0x526a48),
      positionLocal.y.mul(1.5),
    );
    this.grass = new T.InstancedMesh(blade, grassMat, 14000);
    this.grass.frustumCulled = false;
    const temp = new T.Object3D();
    for (let i = 0; i < 14000; i++) {
      let x = 0,
        z = 0,
        h = -3;
      for (let j = 0; j < 30 && h < 0.08; j++) {
        x = (rand() - 0.5) * 83;
        z = (rand() - 0.5) * 81 - 12;
        h = terrainHeight(x, z);
      }
      temp.position.set(x, h, z);
      temp.rotation.set(0, rand() * Math.PI * 2, 0);
      temp.scale.setScalar(0.6 + rand() * 1.1);
      temp.updateMatrix();
      this.grass.setMatrixAt(i, temp.matrix);
    }
    this.group.add(this.grass);
    const flowerMat = new T.MeshBasicMaterial({
      color: new T.Color(0.8, 1.6, 1.35),
    });
    this.flowers = new T.InstancedMesh(
      new T.IcosahedronGeometry(0.035, 0),
      flowerMat,
      440,
    );
    for (let i = 0; i < 440; i++) {
      const x = (rand() - 0.5) * 45,
        z = (rand() - 0.5) * 45 - 4,
        h = terrainHeight(x, z);
      temp.position.set(x, h + 0.22, z);
      temp.scale.setScalar(h > 0 ? 0.4 + rand() : 0);
      temp.updateMatrix();
      this.flowers.setMatrixAt(i, temp.matrix);
    }
    this.group.add(this.flowers);
    // Branch silhouettes are shared geometries, instanced by tier and trunk.
    const bark = new T.MeshStandardMaterial({ color: 0x27342e, roughness: 1 });
    const foliage = new T.MeshStandardNodeMaterial({
      color: 0x1c3930,
      roughness: 1,
    });
    foliage.positionNode = positionLocal.add(
      vec3(
        sin(this.time.mul(0.2).add(positionWorld.z.mul(0.2)))
          .mul(positionLocal.y.pow(2))
          .mul(0.005),
        0,
        0,
      ),
    );
    const trunks = new T.InstancedMesh(
      new T.CylinderGeometry(0.08, 0.16, 2.2, 7),
      bark,
      145,
    );
    const tufts: T.BufferGeometry[] = [];
    for (let level = 0; level < 10; level++) {
      const y = 0.6 + level * 0.35,
        r = (1 - level / 11) * 1.15;
      for (let b = 0; b < 9; b++) {
        if (rand() < 0.17 && level < 8) continue;
        const angle = (b / 9) * Math.PI * 2 + level * 0.72 + rand() * 0.35;
        const tuft = new T.IcosahedronGeometry(1, 0);
        tuft.scale(
          0.11 + rand() * 0.17,
          0.13 + rand() * 0.19,
          r * (0.45 + rand() * 0.37),
        );
        tuft.rotateX(-0.18 - rand() * 0.24);
        tuft.translate(
          0,
          y + (rand() - 0.5) * 0.22,
          r * (0.32 + rand() * 0.18),
        );
        tuft.rotateY(angle);
        tufts.push(tuft);
      }
    }
    const crownGeometry = mergeGeometries(tufts);
    tufts.forEach((g) => g.dispose());
    const crowns = [new T.InstancedMesh(crownGeometry, foliage, 145)];
    for (let i = 0; i < 145; i++) {
      let x = 0,
        z = 0,
        h = -5;
      for (let j = 0; j < 40 && h < 0.65; j++) {
        x = (rand() - 0.5) * 115;
        z = -12 - rand() * 65;
        h = terrainHeight(x, z);
      }
      const s = 0.7 + rand() * 1.2;
      temp.position.set(x, h + 1.1 * s, z);
      temp.scale.setScalar(s);
      temp.rotation.set(0, rand() * 6.28, 0);
      temp.updateMatrix();
      trunks.setMatrixAt(i, temp.matrix);
      crowns.forEach((mesh) => {
        temp.position.y = h;
        temp.updateMatrix();
        mesh.setMatrixAt(i, temp.matrix);
      });
    }
    this.trees.add(trunks, ...crowns);
    this.treeInstances = [trunks, ...crowns];
    this.group.add(this.trees);
    const fireGeo = new T.InstancedBufferGeometry(),
      quad = new T.PlaneGeometry(1, 1);
    fireGeo.index = quad.index;
    fireGeo.attributes = { ...quad.attributes };
    const homes = new Float32Array(260 * 3);
    for (let i = 0; i < 260; i++) {
      const x = (rand() - 0.5) * 45,
        z = (rand() - 0.5) * 50;
      homes.set(
        [x, Math.max(0.5, terrainHeight(x, z)) + rand() * 2.5, z],
        i * 3,
      );
    }
    fireGeo.setAttribute("aHome", new T.InstancedBufferAttribute(homes, 3));
    fireGeo.instanceCount = 260;
    const fm = new T.MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
    });
    const fh = attribute<"vec3">("aHome", "vec3");
    fm.positionNode = fh
      .add(
        vec3(
          sin(this.time.mul(0.2).add(fh.x)),
          cos(this.time.mul(0.35).add(fh.z)).mul(0.35),
          cos(this.time.mul(0.14).add(fh.y)),
        ),
      )
      .add(positionLocal.mul(0.06));
    fm.colorNode = vec3(1.7, 2.5, 1.1);
    fm.opacityNode = pow(
      max(float(0), float(1).sub(uv().sub(0.5).length().mul(2))),
      2,
    )
      .mul(sin(this.time.add(fh.x)).mul(0.3).add(0.6))
      .mul(this.growth);
    this.fireflies = new T.Mesh(fireGeo, fm);
    this.fireflies.frustumCulled = false;
    this.group.add(this.fireflies);
    // Broad, low-luminance aurora curtains replace an expensive volumetric march.
    const auroraMat = new T.MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      side: T.DoubleSide,
      fog: false,
    });
    const au = uv();
    const curtain = sin(au.x.mul(12).add(this.time.mul(0.025)))
      .mul(0.13)
      .add(0.5);
    const beam = pow(
      max(float(0), float(1).sub(au.y.sub(curtain).abs().mul(3.8))),
      4,
    ).mul(
      sin(au.x.mul(130).add(this.time.mul(0.1)))
        .mul(0.22)
        .add(0.6),
    );
    auroraMat.colorNode = mix(color(0x527d6b), color(0x97bba0), au.y);
    auroraMat.opacityNode = beam.mul(0.35).mul(this.growth);
    const curtainMesh = new T.Mesh(
      new T.PlaneGeometry(170, 52, 80, 1),
      auroraMat,
    );
    curtainMesh.position.set(0, 30, -100);
    curtainMesh.rotation.z = 0.12;
    this.group.add(curtainMesh);
    const moonMat = new T.MeshStandardNodeMaterial({
      color: 0xc6caba,
      roughness: 1,
      fog: false,
    });
    moonMat.normalNode = bumpMap(
      mx_noise_float(positionLocal.mul(2)).mul(0.09),
      float(0.8),
    );
    const moon = new T.Mesh(new T.SphereGeometry(5.8, 48, 32), moonMat);
    this.moon = moon;
    moon.position.set(36, 27, -125);
    this.group.add(moon);
  }
  setQuality(q: Quality) {
    this.grassCount = QUALITY[q].grass;
    this.grass.count = this.grassCount;
    this.treeInstances.forEach((mesh) => {
      mesh.count = q === "BATTERY" ? 65 : q === "BALANCED" ? 110 : 145;
    });
  }
  update(t: number, elapsed: number, reduced: boolean) {
    this.group.visible = t > 229;
    if (!this.group.visible) return;
    const landing = smooth(229, 246, t);
    this.landing.value = landing;
    this.time.value = reduced ? 0 : elapsed;
    this.growth.value = smooth(237, 266, t);
    this.grass.visible = t > 237;
    this.trees.visible = t > 243;
    this.moon.scale.setScalar(smooth(239, 250, t));
    this.atmosphere.value = smooth(238, 249, t);
    this.sky.visible = t > 230;
    this.light.intensity = landing * 0.85;
    this.ambient.intensity = landing * 0.7;
    this.trees.scale.y = Math.max(0.001, smooth(243, 264, t));
    this.flowers.visible = t > 250;
  }
}
