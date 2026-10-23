import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

async function demo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back, Alex." }),
  ).toBeVisible();
}
const title = "Frieren: Beyond Journey's End";

test("sign out succeeds locally when the server session has already expired", async ({
  page,
  context,
}) => {
  await demo(page);
  await context.clearCookies();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back.", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".user-card")).toHaveCount(0);
});

test("profile validation and long display names remain usable on a narrow screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await demo(page);
  await page.goto("/settings");
  await page.getByLabel("Display name", { exact: true }).fill("   ");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Display name is required",
  );
  const longName = "W".repeat(50);
  await page.getByLabel("Display name", { exact: true }).fill(longName);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(
    page.getByText("Your profile has been updated.", { exact: true }),
  ).toBeVisible();
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: `Welcome back, ${longName}.`,
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("a stalled request times out and leaves the sign-in dialog usable", async ({
  page,
}) => {
  await page.route("**/api/auth/demo", () => {});
  await page.goto("/discover");
  await page.getByRole("button", { name: "Sign in to your space" }).click();
  await page.getByRole("button", { name: "Try the demo", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "The request timed out.",
    { timeout: 20000 },
  );
  await expect(
    page.getByRole("button", { name: "Close dialog" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("large catalog, alternate names, page size, last page, and invalid page URLs", async ({
  page,
}) => {
  await page.goto("/discover");
  await expect(page.locator(".result-count strong")).toHaveText(
    "28,302 titles",
  );
  await page.getByRole("button", { name: "Page 2,359", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Next", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".anime-card")).toHaveCount(6);
  await page.getByRole("button", { name: "Page 1", exact: true }).click();
  await page.getByLabel("Titles per page").selectOption("24");
  await expect(page.locator(".anime-card")).toHaveCount(24);
  await expect(
    page.getByText("Page 1 of 1,180", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search titles").fill("notatnik śmierci");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.locator(".result-count strong")).toHaveText("1 title");
  await expect(
    page.getByRole("button", { name: "View Death Note", exact: true }),
  ).toBeVisible();
  await page.goto("/discover?page=1.5");
  await expect(
    page.getByText("Page 1 of 2,359", { exact: true }),
  ).toBeVisible();
  await page.goto("/discover?page=2147483647");
  await expect(
    page.getByText("Page 2,359 of 2,359", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("stale edits can reload the latest version without losing another tab’s saved notes", async ({
  page,
  context,
}) => {
  await demo(page);
  await page.goto("/library");
  await page
    .getByRole("button", { name: `Edit ${title}`, exact: true })
    .click();
  const second = await context.newPage();
  await second.goto("/library");
  await second
    .getByRole("button", { name: `Edit ${title}`, exact: true })
    .click();
  await page.getByLabel("Private notes").fill("Saved in the first tab.");
  await page.getByRole("button", { name: "Save to my library" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await second
    .getByRole("combobox", { name: "Your rating", exact: true })
    .selectOption("10");
  await second.getByRole("button", { name: "Save to my library" }).click();
  await expect(second.getByRole("alert")).toContainText(
    "changed in another tab",
  );
  await second.getByRole("button", { name: "Reload latest version" }).click();
  await expect(second.getByLabel("Private notes")).toHaveValue(
    "Saved in the first tab.",
  );
  await second
    .getByRole("combobox", { name: "Your rating", exact: true })
    .selectOption("10");
  await second.getByRole("button", { name: "Save to my library" }).click();
  await expect(second.getByRole("dialog")).toHaveCount(0);
  await second
    .getByRole("button", { name: `Edit ${title}`, exact: true })
    .click();
  await expect(second.getByLabel("Private notes")).toHaveValue(
    "Saved in the first tab.",
  );
  await expect(
    second.getByRole("combobox", { name: "Your rating", exact: true }),
  ).toHaveValue("10");
  await second.getByRole("button", { name: "Remove from library" }).click();
  await second.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(second.getByRole("dialog")).toBeVisible();
  await second.getByRole("button", { name: "Remove from library" }).click();
  await second
    .getByRole("button", { name: "Yes, remove", exact: true })
    .click();
  await expect(second.getByRole("dialog")).toHaveCount(0);
  await expect(
    second.getByRole("button", { name: `Edit ${title}`, exact: true }),
  ).toHaveCount(0);
  await second.close();
});

test("signing out clears private views and open editors in other tabs", async ({
  page,
  context,
}) => {
  await demo(page);
  const second = await context.newPage();
  await second.goto("/library");
  await second
    .getByRole("button", { name: `Edit ${title}`, exact: true })
    .click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(second.getByRole("dialog")).toHaveCount(0);
  await expect(
    second.getByRole("heading", { name: "Make room for your favorites." }),
  ).toBeVisible();
  await expect(second.locator(".library-row")).toHaveCount(0);
  await expect(second.locator(".user-card")).toHaveCount(0);
  await second.close();
});

test("catalog errors retry cleanly and broken poster images show a fallback", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/api/catalog?*", (route) =>
    fail
      ? route.fulfill({
          status: 503,
          contentType: "application/problem+json",
          body: JSON.stringify({ detail: "Catalog temporarily unavailable." }),
        })
      : route.continue(),
  );
  await page.goto("/discover");
  await expect(page.getByRole("alert")).toContainText(
    "Catalog temporarily unavailable.",
  );
  await expect(page.locator(".anime-card")).toHaveCount(0);
  fail = false;
  await page.route("https://cdn.myanimelist.net/**", (route) => route.abort());
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator(".anime-card")).toHaveCount(12);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".poster-fallback").first()).toBeVisible();
  await page
    .getByRole("button", { name: `View ${title}`, exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Madhouse");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: `View ${title}`, exact: true }),
  ).toBeFocused();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
});

test("missing metadata stays honest and unknown episode counts remain editable", async ({
  page,
}) => {
  await demo(page);
  const entry = {
    id: 900000,
    title: "Unknown metadata example",
    originalTitle: "Unknown metadata example",
    synopsis: "",
    posterUrl: "",
    genres: [],
    studio: "",
    format: "ONA",
    year: 0,
    episodes: 0,
    episodeMinutes: 0,
    communityScore: 0,
    airing: false,
    sourceUrl: "https://myanimelist.net/anime/1",
  };
  await page.route("**/api/catalog?*", (route) =>
    route.fulfill({
      json: { items: [entry], total: 1, page: 1, pageSize: 12, totalPages: 1 },
    }),
  );
  await page.goto("/discover");
  await page
    .getByRole("button", { name: "View Unknown metadata example", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Year unknown");
  await expect(dialog).toContainText("A synopsis is not available");
  await expect(dialog).toContainText("Not announced");
  await expect(dialog.getByText("Not listed", { exact: true })).toHaveCount(2);
  await expect(dialog).not.toContainText("0.00");
  await dialog.getByRole("button", { name: "Add to my library" }).click();
  await dialog
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("Completed");
  await expect(dialog.getByLabel("Episodes watched")).toBeEnabled();
  await dialog.getByLabel("Episodes watched").fill("5");
  await expect(dialog.getByLabel("Episodes watched")).toHaveValue("5");
  await page.keyboard.press("Escape");
});
