import { RGBDOdometry } from "./vo";
import { LocalMap } from "./map";
import type { WorkerRequest, WorkerReply, Analysis } from "./types";
const vo = new RGBDOdometry(),
  map = new LocalMap();
const scope = globalThis as unknown as {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage: (v: WorkerReply) => void;
};
scope.onmessage = (
  event: MessageEvent<WorkerRequest>,
) => {
  if (event.data.type === "reset") {
    vo.reset();
    map.reset();
    return;
  }
  const { frame, generation, request, id } = event.data;
  const identity = { generation, request, id };
  if (!frame) {
    scope.postMessage({
      type: "error",
      ...identity,
      message: "Perception request carried no sensor frame",
    });
    return;
  }
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
    scope.postMessage({ type: "analysis", ...identity, result });
  } catch (e) {
    scope.postMessage({
      type: "error",
      ...identity,
      message: e instanceof Error ? e.message : String(e),
    });
  }
};
