import test from "node:test";
import assert from "node:assert/strict";
import { moduleUrl } from "./helpers/load.ts";

// Transpile in memory: input.ts uses constructor parameter properties, which the
// strip-only loader behind `npm test` cannot run. No DOM or GPU is involved.
const owned = (name: string) =>
  moduleUrl(new URL(`../universe/${name}.ts`, import.meta.url)).then((u) => import(u));

class StubTarget {
  listeners = new Map<string, ((e: never) => void)[]>();
  addEventListener(type: string, fn: (e: never) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  removeEventListener() {}
  send(type: string, event: unknown) {
    for (const fn of [...(this.listeners.get(type) ?? [])]) fn(event as never);
  }
}
class StubCanvas extends StubTarget {
  tabIndex = -1;
  clientWidth = 800;
  clientHeight = 600;
  focus() {}
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 800, height: 600 };
  }
  setPointerCapture() {}
  hasPointerCapture() {
    return false;
  }
  releasePointerCapture() {}
}
// Only `closest` is exercised: the manager asks whether the event target is a control.
class StubElement {
  tag: string;
  constructor(tag: string) {
    this.tag = tag;
  }
  closest(selector: string) {
    return selector.split(", ").includes(this.tag) ? this : null;
  }
}
async function harness() {
  const { InputManager } = await owned("input");
  const globals = globalThis as unknown as Record<string, unknown>;
  globals.HTMLElement = StubElement;
  const win = new StubTarget(),
    canvas = new StubCanvas();
  globals.window = win;
  globals.document = new StubTarget();
  const actions: string[] = [],
    picks: boolean[] = [];
  const input = new InputManager(
    canvas,
    (a: string) => actions.push(a),
    (_p: unknown, travel: boolean) => picks.push(travel),
  );
  return { input, canvas, win, actions, picks };
}
const key = (code: string, target: unknown = null) => ({
  code,
  target,
  repeat: false,
  preventDefault() {},
});
const point = (over: Record<string, unknown> = {}) => ({
  pointerId: 1,
  pointerType: "mouse",
  button: 0,
  clientX: 400,
  clientY: 300,
  ...over,
});

test("Escape still cancels while focus sits inside a panel control", async () => {
  const { win, actions } = await harness();
  win.send("keydown", key("Escape", new StubElement("select")));
  win.send("keydown", key("Escape", new StubElement("input")));
  assert.deepEqual(actions, ["cancel", "cancel"]);
});

test("keys other than Escape stay out of an editable control", async () => {
  const { win, actions } = await harness();
  win.send("keydown", key("KeyM", new StubElement("select")));
  win.send("keydown", key("KeyW", new StubElement("input")));
  assert.deepEqual(actions, []);
  win.send("keydown", key("KeyM"));
  assert.deepEqual(actions, ["places"]);
});

test("a bare tap selects without taking control from automation", async () => {
  const { input, canvas, actions, picks } = await harness();
  canvas.send("pointerdown", point({ pointerType: "touch", clientX: 600 }));
  assert.equal(input.manual, false);
  assert.deepEqual(actions, []);
  canvas.send("pointerup", point({ pointerType: "touch", clientX: 600 }));
  assert.equal(picks.length, 1);
  assert.deepEqual(actions, []);
});

test("a touch drag past the threshold still takes control in its own event", async () => {
  const { input, canvas, actions } = await harness();
  canvas.send("pointerdown", point({ pointerType: "touch", clientX: 600 }));
  canvas.send("pointermove", point({ pointerType: "touch", clientX: 602, clientY: 301 }));
  assert.equal(input.manual, false);
  assert.deepEqual(actions, []);
  canvas.send("pointermove", point({ pointerType: "touch", clientX: 610, clientY: 305 }));
  assert.equal(input.manual, true);
  assert.deepEqual(actions, ["manual"]);
});

test("a bare mouse click selects without taking control from automation", async () => {
  const { input, canvas, actions, picks } = await harness();
  canvas.send("pointerdown", point());
  assert.equal(input.manual, false);
  assert.deepEqual(actions, []);
  canvas.send("pointerup", point());
  assert.deepEqual(picks, [false]);
  assert.deepEqual(actions, [], "a click selects and leaves automation running");
});

test("a mouse click that jitters below the threshold keeps automation", async () => {
  const { input, canvas, actions, picks } = await harness();
  canvas.send("pointerdown", point());
  // 2 px of travel, then 3: under the 4 px the mouse drag needs to take control.
  canvas.send("pointermove", point({ clientX: 401, clientY: 301 }));
  assert.equal(input.manual, false);
  canvas.send("pointermove", point({ clientX: 402, clientY: 301 }));
  assert.equal(input.manual, false);
  assert.deepEqual(actions, []);
  canvas.send("pointerup", point({ clientX: 402, clientY: 301 }));
  assert.deepEqual(picks, [false], "and it still selects, having moved 3 px");
});

test("the drag and click thresholds meet without overlapping", async () => {
  // 5 px used to sit in both: past the 4 px that takes control, under the 6 px that selected.
  for (const [moved, x, y] of [
    [5, 403, 302],
    [3, 402, 301],
  ] as const) {
    const { input, canvas, actions, picks } = await harness();
    canvas.send("pointerdown", point());
    canvas.send("pointermove", point({ clientX: x, clientY: y }));
    canvas.send("pointerup", point({ clientX: x, clientY: y }));
    const drag = moved > 4;
    assert.equal(input.manual, drag, `${moved} px takes control: ${drag}`);
    assert.deepEqual(actions, drag ? ["manual"] : []);
    assert.deepEqual(picks, drag ? [] : [false], `${moved} px selects: ${!drag}`);
  }
});

test("a mouse drag takes control in the event that passes the threshold", async () => {
  const { input, canvas, actions } = await harness();
  canvas.send("pointerdown", point());
  assert.equal(input.manual, false);
  // 30 px of travel, well past the 4 px threshold.
  canvas.send("pointermove", point({ clientX: 430 }));
  assert.equal(input.manual, true);
  assert.deepEqual(actions, ["manual"]);
});
