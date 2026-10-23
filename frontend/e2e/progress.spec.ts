import { test, expect } from "@playwright/test";

async function demo(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back, Alex.", exact: true }),
  ).toBeVisible();
}

test("history and milestones follow real updates, survive reload and removal, and clear on logout", async ({
  page,
}) => {
  await demo(page);
  await page.goto("/insights");
  await page.getByRole("link", { name: "History", exact: true }).click();
  await expect(page.locator(".activity-row")).toHaveCount(7);
  await page.getByRole("link", { name: "Achievements", exact: true }).click();
  await expect(page.locator(".achievement-card")).toHaveCount(9);
  const movieNight = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Movie night", exact: true }),
  });
  await expect(movieNight).toContainText("In progress");
  await page.goto("/discover?q=Spirited%20Away");
  await page
    .getByRole("button", { name: "Edit Spirited Away", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("Completed");
  await page
    .getByRole("button", { name: "Save to my library", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/insights/history");
  await expect(page.locator(".activity-row").first()).toContainText(
    "Completed an anime",
  );
  await expect(page.locator(".activity-row").first()).toContainText(
    "Spirited Away",
  );
  await page.reload();
  await expect(page.locator(".activity-row").first()).toContainText(
    "Spirited Away",
  );
  await page.getByRole("link", { name: "Achievements", exact: true }).click();
  await expect(movieNight).toContainText("Unlocked");
  await page.goto("/library?status=Completed");
  await page
    .getByRole("button", { name: "Edit Spirited Away", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove from library", exact: true })
    .click();
  await page.getByRole("button", { name: "Yes, remove", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/insights/history");
  await expect(page.locator(".activity-row").first()).toContainText(
    "Removed from your library",
  );
  await page.getByRole("link", { name: "Achievements", exact: true }).click();
  await expect(movieNight).toContainText("Unlocked");
  await page.reload();
  await expect(movieNight).toContainText("Unlocked");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/insights/history");
  await expect(page.locator(".activity-row")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Keep your story going." }),
  ).toBeVisible();
  await page.goto("/insights/achievements");
  await expect(page.locator(".achievement-card")).toHaveCount(0);
});

test("import history is explicit and the timeline and badges fit a phone", async ({
  page,
}) => {
  await demo(page);
  await page.goto("/settings");
  await page
    .getByLabel("Import MyAnimeList XML", { exact: true })
    .setInputFiles({
      name: "history.xml",
      mimeType: "application/xml",
      buffer: Buffer.from(
        "<myanimelist><anime><series_animedb_id>199</series_animedb_id><my_status>Completed</my_status><my_watched_episodes>1</my_watched_episodes></anime></myanimelist>",
      ),
    });
  await expect(
    page.getByText("Imported 1 title:", { exact: false }),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/insights/history");
  await expect(page.locator(".activity-row").first()).toContainText(
    "Imported your anime list",
  );
  await expect(page.locator(".activity-row").first()).toContainText(
    "1 title imported",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Achievements", exact: true }).click();
  await expect(page.locator(".achievement-card")).toHaveCount(9);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/insights/history");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Try the demo", exact: true }).click();
  await expect(page.locator(".activity-row")).toHaveCount(7);
  await expect(
    page.getByText("Imported your anime list", { exact: true }),
  ).toHaveCount(0);
});

test("history and achievements recover from unavailable endpoints", async ({
  page,
}) => {
  await demo(page);
  for (const [endpoint, path] of [
    ["history", "/insights/history"],
    ["achievements", "/insights/achievements"],
  ]) {
    let fail = true;
    await page.route(`**/api/${endpoint}*`, (route) =>
      fail
        ? route.fulfill({
            status: 503,
            contentType: "application/problem+json",
            body: JSON.stringify({
              detail: "Progress is temporarily unavailable.",
            }),
          })
        : route.continue(),
    );
    await page.goto(path);
    await expect(page.getByRole("alert")).toContainText(
      "Progress is temporarily unavailable.",
    );
    fail = false;
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(
      page.locator(
        endpoint === "history" ? ".activity-row" : ".achievement-card",
      ),
    ).toHaveCount(endpoint === "history" ? 7 : 9);
  }
});
