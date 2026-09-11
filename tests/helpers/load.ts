import { readFile } from "node:fs/promises";
import ts from "typescript";

// One in-memory transpile for every test that needs one: no DOM, GPU, build output or files.
// `npm test` globs tests/*.test.ts, so this helper is not collected as a test itself.
const modules = new Map<string, string>();
/** Transpiles a module and, recursively, its relative imports, into an importable data: URL.
 *  `rewrite` sees each transpiled source before its imports are redirected at the cache. */
export async function moduleUrl(
  url: URL,
  rewrite?: (source: string, url: URL) => string,
): Promise<string> {
  if (modules.has(url.href)) return modules.get(url.href)!;
  let source = ts.transpileModule(await readFile(url, "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  if (rewrite) source = rewrite(source, url);
  for (const match of [...source.matchAll(/from "([^"]+)"/g)]) {
    const specifier = match[1];
    const resolved = specifier.startsWith(".")
      ? await moduleUrl(
          new URL(
            specifier.endsWith(".ts") || specifier.endsWith(".tsx")
              ? specifier
              : specifier + ".ts",
            url,
          ),
          rewrite,
        )
      : import.meta.resolve(specifier);
    source = source.replace(match[0], `from ${JSON.stringify(resolved)}`);
  }
  const result = "data:text/javascript;base64," + Buffer.from(source).toString("base64");
  modules.set(url.href, result);
  return result;
}
