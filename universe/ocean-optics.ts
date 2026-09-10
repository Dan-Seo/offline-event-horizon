import type * as T from "three/webgpu";
import { exp, mix, vec3, max, float, type reflector } from "three/tsl";
import { SURFACE_EXTINCTION } from "./ocean-depth";

/** r183 ReflectorBaseNode clears its last output when the camera crosses behind
 * the mirror. Unlike render(), WebGLBackend.clear() leaves that FBO bound;
 * setRenderTarget() only restores the renderer's logical target. Restore the
 * active context before the water samples its mirror, through the backend state
 * manager so its framebuffer/draw-buffer cache stays coherent. These private
 * backend members are verified against installed r183; revisit on Three upgrades. */
export function preserveReflectorFramebuffer(mirror: ReturnType<typeof reflector>) {
  const base = mirror.reflector;
  const update = base.updateBefore.bind(base);
  base.updateBefore = (frame) => {
    const hadOutput = base.hasOutput;
    const result = update(frame);
    if (hadOutput && !base.hasOutput && frame.renderer) {
      const backend = frame.renderer.backend as unknown as {
        isWebGLBackend?: boolean;
        _currentContext: unknown;
        _setFramebuffer(context: unknown): void;
      };
      if (backend.isWebGLBackend && backend._currentContext !== null)
        backend._setFramebuffer(backend._currentContext);
    }
    return result;
  };
}

/** Above-water transmission through the local water column. Scalar extinction is
 * an artistic approximation compatible with ordinary alpha blending, not refraction.
 * Normalize source colour so Fresnel reflection is applied once, not alpha-squared. */
export function waterSurfaceOptics(depth: T.Node<"float">, cosine: T.Node<"float">,
  fresnel: T.Node<"float">, reflection: T.Node<"vec3">) {
  const transmission = max(0, depth).mul(-SURFACE_EXTINCTION).div(max(0.15, cosine.abs())).exp();
  const absorbed = float(1).sub(fresnel).mul(float(1).sub(transmission));
  const opacity = fresnel.add(absorbed);
  const scatter = vec3(0.008, 0.065, 0.078);
  return { opacity, color: reflection.mul(fresnel).add(scatter.mul(absorbed)).div(max(0.001, opacity)) };
}

/** Beauty-only integration hook. Distance is linear ray length in artistic metres,
 * never raw/log depth. Call before tone mapping, only for the active underwater view.
 * Do not attach to sensor captures. A full frame water-path solver is not modeled. */
export function oceanComposite(beauty: T.Node<"vec3">, rayLength: T.Node<"float">,
  depth: T.Node<"float">, immersion: T.Node<"float">) {
  const path = max(0, rayLength).min(900);
  const transmission = vec3(path.mul(-0.045).exp(), path.mul(-0.018).exp(), path.mul(-0.011).exp());
  const light = exp(max(0, depth).mul(-0.008));
  const scatter = vec3(0.018, 0.13, 0.16).mul(light.mul(0.7).add(0.3));
  return mix(beauty, beauty.mul(transmission).add(scatter.mul(vec3(1).sub(transmission))), immersion.clamp(0, 1));
}
