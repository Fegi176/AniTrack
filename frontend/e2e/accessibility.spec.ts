import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const routes = [
  ["/", "Welcome back, Alex."],
  ["/discover", "A world of stories."],
  ["/library", "Every story, in one place."],
  ["/insights", "Your viewing, in perspective."],
  ["/settings", "Profile & data."],
] as const;
for (const width of [1440, 768, 390, 320]) {
  test(`main pages fit and pass automated WCAG AA checks at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Create an account", exact: true })
      .click();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page
      .getByRole("button", { name: "Try the demo", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Welcome back, Alex." }),
    ).toBeVisible();
    for (const [path, heading] of routes) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
      if (path === "/library")
        await expect(page.locator(".library-row")).toHaveCount(7);
      if (path === "/insights")
        await expect(page.locator(".rating-chart")).toBeVisible();
      if (path === "/discover")
        await expect(page.locator(".anime-card")).toHaveCount(12);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(results.violations, `${path} at ${width}px`).toEqual([]);
    }
  });
}

test("mobile navigation and dialogs contain keyboard focus and expose labels", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/discover");
  await expect(page.locator(".anime-card")).toHaveCount(12);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Open navigation" }).click();
  const navigation = page.getByRole("dialog", { name: "Navigation" });
  await expect(navigation).toBeVisible();
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () => !!document.activeElement?.closest("#main-sidebar"),
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(navigation).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeFocused();
  await page
    .getByRole("button", {
      name: "View Frieren: Beyond Journey's End",
      exact: true,
    })
    .click();
  const detail = page.getByRole("dialog");
  await expect(detail).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", {
      name: "Add Frieren: Beyond Journey's End to library",
      exact: true,
    })
    .click();
  const auth = page.getByRole("dialog", { name: "Sign in", exact: true });
  await expect(auth.getByLabel("Username", { exact: true })).toBeFocused();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await auth
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
});
