import { Vector3, Vector4, type Node } from "three/webgpu";
import { uniform, uniformArray, vec4, float } from "three/tsl";
export const pilgrimPosition = uniform(new Vector3(0, -100000, 0));
export const pilgrimObserver = uniform(new Vector3());
const clock = uniform(0);
const traces = Array.from(
  { length: 6 },
  () => new Vector4(0, -100000, 0, -1000),
);
const history = uniformArray(traces, "vec4");
let index = 0,
  last = -1;
export function updateInfluence(
  position: Vector3,
  time: number,
  speed: number,
) {
  pilgrimPosition.value.copy(position);
  clock.value = time;
  if (speed > 0.3 && time - last > 0.5) {
    traces[index++ % traces.length].set(
      position.x,
      position.y,
      position.z,
      time,
    );
    last = time;
  }
}
export function grassInfluence(world: Node<"vec3">) {
  let amount: Node<"float"> = float(0);
  for (let i = 0; i < 6; i++) {
    const p = vec4(history.element(i));
    amount = amount.add(
      world
        .sub(p.xyz)
        .length()
        .mul(-0.22)
        .exp()
        .mul(clock.sub(p.w).max(0).mul(-0.36).exp()),
    );
  }
  return amount.min(1);
}
