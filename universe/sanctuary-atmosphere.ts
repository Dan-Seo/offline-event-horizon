import * as T from "three/webgpu";
import {
  Fn,
  float,
  length,
  max,
  min,
  mix,
  positionLocal,
  positionGeometry,
  positionWorld,
  pow,
  sin,
  smoothstep,
  texture3D,
  uniform,
  vec3,
  vec2,
  vec4,
  frontFacing,
  cameraPosition,
  modelWorldMatrixInverse,
  modelViewMatrix,
  cameraNear,
  cameraFar,
  screenUV,
  viewportTexture,
  logarithmicDepthToViewZ,
  varying,
  Loop,
} from "three/tsl";
import { type Quality } from "./config";

export class SanctuaryAtmosphere {
  time = uniform(0);
  presence = uniform(1);
  stillness = uniform(0);
  veilOpen = uniform(0);
  forestPulse = uniform(0);
  moonbow = uniform(0);
  creature = uniform(0);
  observer = uniform(new T.Vector3());
  steps = uniform(28);
  depthReady = false;
  // Runtime accepts Texture; r183's declaration narrows this argument to
  // FramebufferTexture. Per-target copies keep the mirror and main view apart.
  private opaqueDepth = viewportTexture(
    screenUV,
    null,
    new T.DepthTexture(1, 1) as unknown as T.FramebufferTexture,
  );
  private depthCopies = new Set<T.Texture>([this.opaqueDepth.value]);
  sky: T.Mesh;
  constructor(
    public density: T.Data3DTexture,
    scene: T.Scene,
  ) {
    const copyDepth = this.opaqueDepth.updateBefore.bind(this.opaqueDepth);
    this.opaqueDepth.updateBefore = (frame) => {
      // compileAsync also visits updateBefore, before a valid framebuffer exists.
      if (!this.depthReady || !frame.renderer) return;
      this.depthCopies.add(
        this.opaqueDepth.getTextureForReference(
          frame.renderer.getRenderTarget(),
        ),
      );
      return copyDepth(frame);
    };
    const material = new T.MeshBasicNodeMaterial({
      side: T.BackSide,
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    material.colorNode = this.radiance(positionLocal.normalize());
    material.opacityNode = this.presence.mul(0.97);
    this.sky = new T.Mesh(new T.SphereGeometry(1600000, 32, 20), material);
    this.sky.renderOrder = -100;
    this.sky.frustumCulled = false;
    scene.add(this.sky);
  }
  radiance(d: T.Node<"vec3">) {
    // Directional high clouds share the same radiance field with the water reflection.
    // The enterable low clouds below are actual spatial volumes, not a sky texture.
    const horizon = pow(max(0, float(1).sub(d.y.abs())), 9);
    const zenith = mix(
      vec3(0.005, 0.012, 0.026),
      vec3(0.038, 0.069, 0.087),
      horizon,
    );
    const p = d.mul(vec3(1.6, 4, 1.6)).add(vec3(this.time.mul(0.00014), 0, 0));
    const n = texture3D(this.density, p.mul(0.6).add(0.4)).r;
    const fine = texture3D(this.density, p.mul(3.4).add(n.mul(0.35))).r;
    const filament = sin(d.x.mul(8).add(d.z.mul(6)).add(n.mul(6))).mul(0.08);
    const band = float(1).sub(
      smoothstep(0.012, 0.17, d.y.sub(0.24).sub(filament).abs()),
    );
    const lace = smoothstep(0.38, 0.69, fine)
      .mul(band)
      .mul(smoothstep(0.02, 0.15, d.y));
    const distantGlow = pow(
      max(0, d.dot(vec3(-0.5, 0.14, -0.85).normalize())),
      20,
    );
    return zenith
      .add(vec3(0.16, 0.25, 0.27).mul(lace).mul(0.21))
      .add(vec3(0.035, 0.034, 0.024).mul(distantGlow));
  }
  haze(c: T.Node<"vec3">, density = 0.00026) {
    const distance = length(positionWorld);
    const air = float(1).sub(distance.mul(-density).exp()).mul(this.presence);
    return mix(c, vec3(0.034, 0.066, 0.075), air.mul(0.85));
  }
  volume(size: T.Vector3, tint: T.Vector3, opacity = 1, opening = false) {
    // Copy already-rendered opaque depth; no extra geometry pass. Stop the
    // integral at each surface instead of clipping the entire volume box.
    const material = new T.MeshBasicNodeMaterial({
      transparent: true,
      side: T.DoubleSide,
      depthWrite: false,
      depthTest: false,
    });
    material.colorNode = Fn(() => {
      const origin = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz;
      const inside = max(
        origin.x.abs(),
        max(origin.y.abs(), origin.z.abs()),
      ).lessThan(0.5);
      inside.xor(frontFacing).not().discard();
      const sceneZ = logarithmicDepthToViewZ(
        this.opaqueDepth.r,
        cameraNear,
        cameraFar,
      ).toVar();
      const rayOrigin = varying(origin);
      const rayDirection = varying(positionGeometry.sub(origin))
        .normalize()
        .toVar();
      const entry = vec3(-0.5).sub(rayOrigin).div(rayDirection);
      const exit = vec3(0.5).sub(rayOrigin).div(rayDirection);
      const lo = min(entry, exit),
        hi = max(entry, exit);
      const viewStep = modelViewMatrix.mul(vec4(rayDirection, 0)).z;
      const bounds = vec2(
        max(0, max(lo.x, max(lo.y, lo.z))),
        min(sceneZ.div(viewStep), min(hi.x, min(hi.y, hi.z))),
      ).toVar();
      bounds.y.lessThanEqual(bounds.x).discard();
      // Integrate the visible interval, including the fractional final step.
      // Breaking a fixed object-space grid at depth leaves bands on near surfaces.
      const step = bounds.y.sub(bounds.x).div(this.steps).toVar();
      const p = rayOrigin
        .add(rayDirection.mul(bounds.x.add(step.mul(0.5))))
        .toVar();
      const result = vec4(0).toVar();
      Loop({ type: "float", start: 0, end: this.steps, update: 1 }, () => {
        const n = texture3D(
          this.density,
          p
            .mul(vec3(1.45, 1.1, 1.45))
            .add(vec3(this.time.mul(0.0014), 0.31, 0.15)),
        ).r;
        const detail = texture3D(this.density, p.mul(4.5).add(n.mul(0.4))).r;
        const edge = float(1).sub(
          smoothstep(0.2, 0.5, length(p.mul(vec3(1, 1.6, 1)))),
        );
        const hole = opening
          ? mix(
              float(1),
              smoothstep(0.045, 0.24, length(p.xz)),
              this.veilOpen.mul(0.8).add(0.2),
            )
          : float(1);
        const d = smoothstep(0.38, 0.69, n)
          .mul(detail.mul(0.8).add(0.2))
          .mul(edge)
          .mul(hole);
        const alpha = float(1).sub(
          d
            .mul(-8 * opacity)
            .mul(step)
            .exp(),
        );
        const light = n
          .mul(0.4)
          .add(0.5)
          .add(smoothstep(-0.3, 0.4, p.y).mul(0.55));
        const c = vec3(tint).mul(light);
        const remaining = float(1).sub(result.a);
        result.rgb.addAssign(c.mul(alpha).mul(remaining));
        result.a.addAssign(alpha.mul(remaining));
        p.addAssign(rayDirection.mul(step));
      });
      return vec4(
        result.rgb.div(max(result.a, 0.001)),
        result.a.mul(this.presence),
      );
    })();
    const mesh = new T.Mesh(new T.BoxGeometry(1, 1, 1), material);
    mesh.scale.copy(size);
    mesh.renderOrder = 8;
    return mesh;
  }
  setQuality(q: Quality) {
    this.steps.value = { ULTRA: 40, HIGH: 28, BALANCED: 20, BATTERY: 12 }[q];
  }
  dispose() {
    this.depthReady = false;
    this.depthCopies.forEach((texture) => texture.dispose());
    this.depthCopies.clear();
  }
}
