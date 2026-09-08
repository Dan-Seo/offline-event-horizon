import * as T from "three/webgpu";
import {
  uniform,
  attribute,
  positionLocal,
  uv,
  vec3,
  float,
  mix,
  smoothstep,
  sin,
  cos,
  max,
  pow,
} from "three/tsl";

/** Glyph samples are uploaded only when released. Their flight is evaluated on the GPU. */
export class ThoughtDebris {
  mesh: T.Mesh;
  private clock = uniform(0);
  private homes = new Float32Array(12000 * 3);
  private releases = new Float32Array(12000).fill(-1000);
  private random = new Float32Array(12000);
  private cursor = 0;
  constructor(scene: T.Scene) {
    const g = new T.InstancedBufferGeometry(),
      quad = new T.PlaneGeometry(1, 1);
    g.index = quad.index;
    g.attributes = { ...quad.attributes };
    g.instanceCount = 12000;
    g.setAttribute("aHome", new T.InstancedBufferAttribute(this.homes, 3));
    g.setAttribute(
      "aRelease",
      new T.InstancedBufferAttribute(this.releases, 1),
    );
    for (let i = 0; i < 12000; i++) this.random[i] = Math.random();
    g.setAttribute("aSeed", new T.InstancedBufferAttribute(this.random, 1));
    const home = attribute<"vec3">("aHome", "vec3"),
      release = attribute<"float">("aRelease", "float"),
      seed = attribute<"float">("aSeed", "float");
    const age = max(0, this.clock.sub(release));
    const a = age.mul(4).add(seed.mul(6.28));
    const f = smoothstep(0, 3.5, age),
      radius = float(1).sub(f).mul(0.2).mul(age);
    const orbit = vec3(cos(a).mul(radius), sin(a).mul(radius).mul(0.35), 0);
    const mat = new T.MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
    });
    mat.positionNode = mix(home, vec3(-0.47, 2.32, -0.35), f)
      .add(orbit)
      .add(positionLocal.mul(0.014).mul(float(1).sub(f)));
    mat.colorNode = vec3(2.8, 2.1, 1.4);
    mat.opacityNode = pow(
      max(float(0), float(1).sub(uv().sub(0.5).length().mul(2))),
      2,
    )
      .mul(float(1).sub(smoothstep(2.5, 3.5, age)))
      .mul(smoothstep(-0.01, 0, this.clock.sub(release)));
    this.mesh = new T.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
  emit(source: T.Mesh<T.PlaneGeometry, T.MeshBasicMaterial>, t: number) {
    const canvas = source.material.map?.image as HTMLCanvasElement | undefined;
    if (!canvas?.getContext) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    source.updateWorldMatrix(true, false);
    const pixels: number[] = [];
    for (let y = 48; y < 126; y += 2)
      for (let x = 48; x < 710; x += 2) {
        const i = (y * canvas.width + x) * 4;
        if (data[i] > 170 && data[i + 1] > 150) pixels.push(x, y);
      }
    const count = Math.min(2000, pixels.length / 2),
      v = new T.Vector3();
    for (let n = 0; n < count; n++) {
      const i = Math.floor((n * pixels.length) / 2 / count) * 2;
      v.set(
        (pixels[i] / canvas.width - 0.5) * 1.14,
        (0.5 - pixels[i + 1] / canvas.height) * 0.261,
        0.005,
      ).applyMatrix4(source.matrixWorld);
      const at = this.cursor++ % 12000;
      v.toArray(this.homes, at * 3);
      this.releases[at] = t;
    }
    this.mesh.geometry.attributes.aHome.needsUpdate = true;
    this.mesh.geometry.attributes.aRelease.needsUpdate = true;
  }
  update(t: number) {
    this.clock.value = t;
    this.mesh.visible = t > 35 && t < 112;
  }
}
