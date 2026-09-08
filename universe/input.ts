import { Vector2 } from "three/webgpu";
export type InputAction =
  | "focus"
  | "reset"
  | "pause"
  | "help"
  | "quiet"
  | "wander"
  | "seed"
  | "hud"
  | "places"
  | "experiment"
  | "orbit"
  | "manual"
  | "cancel";
type Touch = {
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  started: number;
  move: boolean;
  travelled: number;
};
const movementKeys = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyQ",
  "KeyE",
  "Space",
  "KeyX",
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
]);
const actions: Record<string, InputAction> = {
  KeyF: "focus",
  KeyR: "reset",
  KeyP: "pause",
  KeyH: "help",
  KeyK: "quiet",
  KeyB: "wander",
  KeyN: "seed",
  KeyM: "places",
  KeyT: "experiment",
  KeyO: "orbit",
  Backquote: "hud",
  Escape: "cancel",
};
export class InputManager {
  keys = new Set<string>();
  look = new Vector2();
  orbit = new Vector2();
  touchMove = new Vector2();
  pointer = new Vector2();
  buttons = new Set<number>();
  wheel = 0;
  manual = false;
  selected = false;
  active = false;
  learning = { look: 0, move: 0, speed: 0 };
  private touches = new Map<number, Touch>();
  private captures = new Set<number>();
  private lastPinch = 0;
  private down = { x: 0, y: 0, moved: 0 };
  private mouseLast = new Vector2();
  private lastTap = 0;
  private controller = new AbortController();
  constructor(
    public canvas: HTMLCanvasElement,
    private action: (a: InputAction) => void,
    private pick: (p: Vector2, travel: boolean) => void,
  ) {
    const o = { signal: this.controller.signal };
    window.addEventListener("keydown", this.keyDown, o);
    window.addEventListener("keyup", this.keyUp, o);
    window.addEventListener("blur", this.clear, o);
    document.addEventListener("visibilitychange", this.clear, o);
    canvas.addEventListener("pointerdown", this.pointerDown, o);
    canvas.addEventListener("pointermove", this.pointerMove, o);
    canvas.addEventListener("pointerup", this.pointerUp, o);
    canvas.addEventListener("pointercancel", this.pointerCancel, o);
    canvas.addEventListener("lostpointercapture", this.pointerCancel, o);
    canvas.addEventListener(
      "dblclick",
      (e) => {
        this.manual = false;
        this.updatePointer(e);
        this.pick(this.pointer, true);
      },
      o,
    );
    canvas.addEventListener("contextmenu", (e) => e.preventDefault(), o);
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.wheel += -e.deltaY * 0.002;
        this.takeControl();
      },
      { ...o, passive: false },
    );
    canvas.tabIndex = 0;
  }
  private editable(target: EventTarget | null) {
    return (
      target instanceof HTMLElement &&
      !!target.closest("input, select, textarea, [contenteditable=true]")
    );
  }
  private takeControl() {
    this.manual = true;
    // Automation yields in the input event, even when rendering is delayed.
    this.action("manual");
  }
  private keyDown = (e: KeyboardEvent) => {
    if (this.editable(e.target)) return;
    if (e.code === "Escape") {
      this.clear();
      this.action("cancel");
      return;
    }
    if (
      e.target instanceof HTMLElement &&
      e.target.closest("button") &&
      ["Space", "Enter"].includes(e.code)
    )
      return;
    if (movementKeys.has(e.code) || ["KeyG", "KeyV"].includes(e.code)) {
      e.preventDefault();
      this.keys.add(e.code);
      if (movementKeys.has(e.code)) this.takeControl();
    }
    if (!e.repeat && actions[e.code]) {
      e.preventDefault();
      this.action(actions[e.code]);
    }
  };
  private keyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private updatePointer(e: PointerEvent | MouseEvent) {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      1 - ((e.clientY - r.top) / r.height) * 2,
    );
  }
  private pointerDown = (e: PointerEvent) => {
    this.canvas.focus({ preventScroll: true });
    this.updatePointer(e);
    this.buttons.add(e.button);
    this.takeControl();
    this.down = { x: e.clientX, y: e.clientY, moved: 0 };
    this.mouseLast.set(e.clientX, e.clientY);
    // Capture only the active drag: the cursor stays visible and unrestricted.
    this.canvas.setPointerCapture(e.pointerId);
    this.captures.add(e.pointerId);
    if (e.pointerType === "touch") {
      this.touches.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        started: performance.now(),
        travelled: 0,
        move: e.clientX < this.canvas.clientWidth * 0.45,
      });
      this.lastPinch = 0;
    }
  };
  private pointerMove = (e: PointerEvent) => {
    this.updatePointer(e);
    if (e.pointerType === "touch") {
      const t = this.touches.get(e.pointerId);
      if (!t) return;
      const dx = e.clientX - t.lastX,
        dy = e.clientY - t.lastY;
      t.lastX = e.clientX;
      t.lastY = e.clientY;
      t.travelled += Math.abs(dx) + Math.abs(dy);
      if (t.move)
        this.touchMove.set(
          Math.max(-1, Math.min(1, (e.clientX - t.x) / 65)),
          Math.max(-1, Math.min(1, (t.y - e.clientY) / 65)),
        );
      else this.look.add(new Vector2(dx, dy).multiplyScalar(1.2));
      if (t.travelled > 5) this.takeControl();
      if (this.touches.size === 2) {
        const [a, b] = [...this.touches.values()];
        const d = Math.hypot(a.lastX - b.lastX, a.lastY - b.lastY);
        if (this.lastPinch) this.wheel += Math.log(d / this.lastPinch) * 1.4;
        this.lastPinch = d;
      }
      return;
    }
    if (!this.buttons.size) return;
    const dx = e.clientX - this.mouseLast.x,
      dy = e.clientY - this.mouseLast.y;
    this.mouseLast.set(e.clientX, e.clientY);
    if (this.buttons.has(0)) this.down.moved += Math.abs(dx) + Math.abs(dy);
    if (Math.abs(dx) + Math.abs(dy) > 0) {
      if (this.selected && this.buttons.has(2))
        this.orbit.add(new Vector2(dx, dy));
      else this.look.add(new Vector2(dx, dy));
      this.takeControl();
    }
  };
  private pointerUp = (e: PointerEvent) => {
    if (!this.captures.has(e.pointerId)) return;
    this.updatePointer(e);
    if (e.pointerType === "touch") {
      const t = this.touches.get(e.pointerId);
      if (t && t.travelled < 12 && performance.now() - t.started < 450) {
        const travel = performance.now() - this.lastTap < 350;
        if (travel) this.manual = false;
        this.pick(this.pointer, travel);
        this.lastTap = performance.now();
      }
      if (t?.move) this.touchMove.set(0, 0);
      this.touches.delete(e.pointerId);
      this.lastPinch = 0;
    } else if (e.button === 0 && this.down.moved < 6) {
      this.pick(this.pointer, false);
    }
    this.buttons.delete(e.button);
    if (this.canvas.hasPointerCapture(e.pointerId))
      this.canvas.releasePointerCapture(e.pointerId);
    this.captures.delete(e.pointerId);
  };
  private pointerCancel = (e: PointerEvent) => {
    const t = this.touches.get(e.pointerId);
    if (t?.move) this.touchMove.set(0, 0);
    this.touches.delete(e.pointerId);
    this.captures.delete(e.pointerId);
    this.buttons.clear();
    this.lastPinch = 0;
  };
  clear = () => {
    this.keys.clear();
    this.buttons.clear();
    this.touches.clear();
    this.touchMove.set(0, 0);
    this.look.set(0, 0);
    this.orbit.set(0, 0);
    this.wheel = 0;
    this.manual = false;
    for (const id of this.captures) {
      if (this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
    }
    this.captures.clear();
  };
  consume() {
    this.look.set(0, 0);
    this.orbit.set(0, 0);
    this.wheel = 0;
    this.manual = false;
  }
  dispose() {
    this.clear();
    this.controller.abort();
  }
}
