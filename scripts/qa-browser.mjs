// QA_BROWSER names an installed Chromium channel ("chrome" by default, or
// "msedge"); the value "chromium" asks for Playwright's own bundled build,
// which is launched without a channel.
export const qaChannel = process.env.QA_BROWSER || "chrome";
export const qaLaunch = () =>
  qaChannel === "chromium"
    ? { headless: true }
    : { channel: qaChannel, headless: true };
