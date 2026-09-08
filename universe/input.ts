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
  locked = false;
  lockFailed = false;
  selected = false;
  active = false;
  private touches = new Map<number, Touch>();
  private lastPinch = 0;
  private down = { x: 0, y: 0, moved: 0 };
  private inside = false;
  private lastTap = 0;
  private mousePickAt = -1000;
  private mousePick = new Vector2();
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
    document.addEventListener(
      "pointerlockchange",
      () => {
        this.locked = document.pointerLockElement === canvas;
        this.look.set(0, 0);
        this.orbit.set(0, 0);
        this.buttons.clear();
        this.inside = this.locked;
        if (this.locked) this.lockFailed = false;
        else this.action("cancel");
      },
      o,
    );
    document.addEventListener(
      "pointerlockerror",
      () => {
        this.lockFailed = true;
      },
      o,
    );
    canvas.addEventListener("pointerdown", this.pointerDown, o);
    canvas.addEventListener("pointermove", this.pointerMove, o);
    canvas.addEventListener("pointerup", this.pointerUp, o);
    canvas.addEventListener("pointercancel", this.pointerCancel, o);
    canvas.addEventListener("lostpointercapture", this.pointerCancel, o);
    canvas.addEventListener(
      "pointerleave",
      () => {
        this.inside = false;
      },
      o,
    );
    canvas.addEventListener(
      "dblclick",
      (e) => {
        this.manual = false;
        // Pointer lock can recenter the second click. Retain the first ray of
        // the double-click gesture so its visible target does not change.
        this.pick(this.mousePick, true);
      },
      o,
    );
    canvas.addEventListener("contextmenu", (e) => e.preventDefault(), o);
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.wheel += -e.deltaY * 0.002;
        this.manual = true;
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
  private keyDown = (e: KeyboardEvent) => {
    if (this.editable(e.target)) return;
    if (e.code === "Escape") {
      this.clear();
      if (document.pointerLockElement) void document.exitPointerLock();
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
      if (movementKeys.has(e.code)) this.manual = true;
    }
    if (!e.repeat && actions[e.code]) {
      e.preventDefault();
      this.action(actions[e.code]);
    }
    if (e.code === "KeyL" && !e.repeat) this.lock();
  };
  private lock() {
    if (this.locked || !this.canvas.requestPointerLock) return;
    try {
      void this.canvas.requestPointerLock()?.catch(() => {
        this.lockFailed = true;
      });
    } catch {
      this.lockFailed = true;
    }
  }
  private keyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private updatePointer(e: PointerEvent | MouseEvent) {
    if (this.locked) {
      this.pointer.set(0, 0);
      return;
    }
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
    this.manual = true;
    this.down = { x: e.clientX, y: e.clientY, moved: 0 };
    if (!this.locked) this.canvas.setPointerCapture(e.pointerId);
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
      if (t.travelled > 5) this.manual = true;
      if (this.touches.size === 2) {
        const [a, b] = [...this.touches.values()];
        const d = Math.hypot(a.lastX - b.lastX, a.lastY - b.lastY);
        if (this.lastPinch) this.wheel += Math.log(d / this.lastPinch) * 1.4;
        this.lastPinch = d;
      }
      return;
    }
    if (!this.locked && !this.buttons.size) return;
    if (!this.inside && !this.locked) {
      this.inside = true;
      return;
    }
    const dx = e.movementX,
      dy = e.movementY;
    if (this.buttons.has(0)) this.down.moved += Math.abs(dx) + Math.abs(dy);
    if (Math.abs(dx) + Math.abs(dy) > 0) {
      if (this.selected && this.buttons.has(2))
        this.orbit.add(new Vector2(dx, dy));
      else this.look.add(new Vector2(dx, dy));
      this.manual = true;
    }
  };
  private pointerUp = (e: PointerEvent) => {
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
      if (performance.now() - this.mousePickAt > 350)
        this.mousePick.copy(this.pointer);
      this.mousePickAt = performance.now();
      this.pick(this.mousePick, false);
    }
    this.buttons.delete(e.button);
    if (this.canvas.hasPointerCapture(e.pointerId))
      this.canvas.releasePointerCapture(e.pointerId);
    if (e.pointerType === "mouse" && e.button === 0 && this.down.moved < 6)
      this.lock();
  };
  private pointerCancel = (e: PointerEvent) => {
    const t = this.touches.get(e.pointerId);
    if (t?.move) this.touchMove.set(0, 0);
    this.touches.delete(e.pointerId);
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
    this.inside = false;
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
    if (this.locked) void document.exitPointerLock();
  }
}
