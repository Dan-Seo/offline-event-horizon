import { RGBDOdometry } from "./vo";
import { LocalMap } from "./map";
import type { SensorFrame, Analysis } from "./types";
const vo = new RGBDOdometry(),
  map = new LocalMap();
const scope = globalThis as unknown as {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage: (v: unknown) => void;
};
scope.onmessage = (
  event: MessageEvent<{ type: string; frame?: SensorFrame }>,
) => {
  if (event.data.type === "reset") {
    vo.reset();
    map.reset();
    return;
  }
  const frame = event.data.frame;
  if (!frame) return;
  try {
    const before = performance.now(),
      estimate = vo.update(frame),
      mapped = map.update(frame, estimate);
    const result: Analysis = {
      id: frame.id,
      timestamp: frame.timestamp,
      vo: estimate,
      ...mapped,
      ms: performance.now() - before,
    };
    scope.postMessage({ type: "analysis", result });
  } catch (e) {
    scope.postMessage({
      type: "error",
      message: e instanceof Error ? e.message : String(e),
    });
  }
};
