import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// app/, components/, universe/, scripts/ and tests/ are the linted trees; everything
// else at the root is generated, downloaded or evidence.
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // `const { rgb: _rgb, ...frame } = c.frame` is how a field is dropped from a copy.
      "@typescript-eslint/no-unused-vars": ["warn", { ignoreRestSiblings: true }],
    },
  },
  {
    files: ["components/**"],
    rules: {
      // The renderer is a mutable non-React object held in a ref; render reads it to
      // decide whether the lab panel exists at all.
      "react-hooks/refs": "off",
      // localStorage, matchMedia and navigator.languages cannot be read while a static
      // export prerenders, so the first device-local state necessarily lands in an effect.
      "react-hooks/set-state-in-effect": "off",
      // The artwork, the lab and the lighter-graphics retry are separate WebGPU roots:
      // moving between them must be a document load so the old renderer is torn down.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "next-env.d.ts",
    "artifacts/**",
    "node_modules/**",
  ]),
]);
