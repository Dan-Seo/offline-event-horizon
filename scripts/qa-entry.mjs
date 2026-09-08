// Regression suites explicitly enter through the real welcome UI. The separate
// onboarding suite verifies language detection and every hands-on guide step.
export async function enterEnglishExperience(page) {
  await page.waitForTimeout(150);
  const welcome = page.locator('[data-step="welcome"]');
  if (await welcome.isVisible()) {
    await welcome.getByRole("button", { name: "English", exact: true }).click();
    await welcome.getByRole("button", { name: "Skip the guide", exact: true }).click();
  }
}
