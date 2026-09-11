import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { act } from "react";
import * as React from "react";
import { createRoot, type Root } from "react-dom/client";
import { moduleUrl } from "./helpers/load.ts";

const { LensBoundary } = await import(
  await moduleUrl(new URL("../components/LensBoundary.tsx", import.meta.url))
);
type TestDom = {
  window: {
    document: Document;
    navigator: Navigator;
    HTMLElement: typeof HTMLElement;
    close(): void;
  };
};
const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
  JSDOM: new (html?: string, options?: { url?: string }) => TestDom;
};

function installDom() {
  const dom = new JSDOM("<!doctype html><div id=\"root\"></div>", {
    url: "http://localhost/",
  });
  const globals = [
    ["window", dom.window],
    ["document", dom.window.document],
    ["navigator", dom.window.navigator],
    ["HTMLElement", dom.window.HTMLElement],
    ["IS_REACT_ACT_ENVIRONMENT", true],
  ] as const;
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [name, value] of globals) {
    previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
  }
  return {
    dom,
    container: dom.window.document.getElementById("root")!,
    restore() {
      for (const [name] of globals) {
        const descriptor = previous.get(name);
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete (globalThis as Record<string, unknown>)[name];
      }
    },
  };
}

async function cleanup(dom: TestDom, root: Root | undefined, restore: () => void) {
  if (root) await act(async () => root.unmount());
  dom.window.close();
  restore();
}

test("LensBoundary renders children normally", async () => {
  const { dom, container, restore } = installDom();
  let root: Root | undefined;
  try {
    root = createRoot(container);
    await act(async () => {
      root!.render(
        React.createElement(
          LensBoundary,
          { message: "Lens failed" },
          React.createElement("span", { id: "child" }, "visible"),
        ),
      );
    });
    assert.equal(container.querySelector("#child")?.textContent, "visible");
  } finally {
    await cleanup(dom, root, restore);
  }
});

test("LensBoundary catches a render error and shows its alert", async () => {
  const { dom, container, restore } = installDom();
  let root: Root | undefined;
  const message = "The research lens could not render.";
  function ThrowingChild(): React.ReactNode {
    throw new Error("child render failed");
  }
  try {
    root = createRoot(container);
    const originalError = console.error;
    console.error = () => {};
    try {
      await assert.doesNotReject(async () => {
        await act(async () => {
          root!.render(
            React.createElement(
              LensBoundary,
              { message },
              React.createElement(ThrowingChild),
            ),
          );
        });
      });
    } finally {
      console.error = originalError;
    }
    const alert = container.querySelector("p.lab-error");
    assert.ok(alert);
    assert.equal(alert.getAttribute("role"), "alert");
    assert.equal(alert.textContent, message);
  } finally {
    await cleanup(dom, root, restore);
  }
});
