// QA_BROWSER names an installed Chromium channel ("chrome" by default, or
// "msedge"); the value "chromium" asks for Playwright's own bundled build.
// The bundled build runs as new headless Chromium with SwiftShader allowed as
// a WebGPU adapter, which is what a GPU-less CI runner falls back to;
// QA_SOFTWARE_GPU=1 forces that adapter on a machine that has a GPU.
export const qaChannel = process.env.QA_BROWSER || "chrome";
export const qaLaunch = () =>
  qaChannel === "chromium"
    ? {
        channel: "chromium",
        headless: true,
        args: [
          "--enable-unsafe-webgpu",
          "--enable-unsafe-swiftshader",
          "--ignore-gpu-blocklist",
          ...(process.env.QA_SOFTWARE_GPU ? ["--use-webgpu-adapter=swiftshader"] : []),
        ],
      }
    : { channel: qaChannel, headless: true };
