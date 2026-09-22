import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function executionSource(cwd = fileURLToPath(new URL("..", import.meta.url))) {
  const dirtyScope = "tracked and untracked files; ignored files excluded";
  const unknown = { revision: "unknown", dirty: null, dirtyScope };
  try {
    const git = (args: string[]) => execFileSync("git", args, {
      cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000,
    }).trim();
    if (realpathSync(git(["rev-parse", "--show-toplevel"])) !== realpathSync(cwd)) return unknown;
    return { revision: git(["rev-parse", "HEAD"]),
      dirty: git(["status", "--porcelain", "--untracked-files=normal"]) !== "", dirtyScope };
  } catch {
    return unknown;
  }
}

// These are repeated observations of held values, not identifiable GPU queries.
export function heldGpuReads(values: unknown[]) {
  const finite = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const distinctValueCount = new Set(finite).size;
  return {
    samplingMethod: "raf-held-latest", uniqueQueryCount: null,
    freshness: "unknown", liveness: "undetermined",
    readCount: values.length, finiteReadCount: finite.length,
    unavailableReadCount: values.length - finite.length,
    unavailabilityReason: !finite.length || finite.length < values.length ? "unknown" : null,
    distinctValueCount, first: finite[0] ?? null, last: finite.at(-1) ?? null,
    heldSingleValue: finite.length > 0 && distinctValueCount === 1,
  };
}
