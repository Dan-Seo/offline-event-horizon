import type { ExperienceEngine } from "./engine";
import { CHAPTERS } from "./timeline";
type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean };
  execute: (input: unknown) => unknown | Promise<unknown>;
};
type Registry = {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
export function registerExperienceTools(engine: ExperienceEngine) {
  const context = (document as Document & { modelContext?: Registry })
    .modelContext;
  const lifecycle = new AbortController();
  if (!context?.registerTool) return () => {};
  const tools: Tool[] = [
    {
      name: "read_journey",
      description:
        "Read the current chapter and playback state of Offline Event Horizon.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: () => ({
        chapter: CHAPTERS[engine.state.chapter].name,
        seconds: engine.state.time,
        running: engine.state.running,
      }),
    },
    {
      name: "navigate_journey",
      description:
        "Move the visible experience to a named chapter and pause there, or begin normal playback.",
      inputSchema: {
        type: "object",
        properties: {
          chapter: { type: "string", enum: CHAPTERS.map((c) => c.name) },
          play: { type: "boolean" },
        },
        required: ["chapter"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: async (input) => {
        if (!input || typeof input !== "object")
          throw new Error("Provide a chapter.");
        const args = input as { chapter?: unknown; play?: unknown };
        const c = CHAPTERS.find((c) => c.name === args.chapter);
        if (!c || (args.play !== undefined && typeof args.play !== "boolean"))
          throw new Error("Invalid chapter or playback state.");
        engine.start();
        engine.seek(c.start + 0.01);
        if (!args.play) engine.togglePause();
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        return { chapter: c.name, running: engine.state.running };
      },
    },
  ];
  for (const tool of tools) {
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {
      /* Optional proposal: failure never interrupts the artwork. */
    }
  }
  return () => lifecycle.abort();
}
