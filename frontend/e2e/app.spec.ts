import { test, expect } from "@playwright/test";

test("catalog search, filters, pagination, and detail dialog", async ({
  page,
}) => {
  await page.goto("/discover");
  await expect(page.getByText("28,302 titles", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByText("Page 2 of 2,359", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search titles").fill("Frieren");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "View Frieren: Beyond Journey's End",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "View Frieren: Beyond Journey's End",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Madhouse");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Drama", exact: true }).click();
  await page.getByLabel("Format", { exact: true }).selectOption("Movie");
  await page.getByLabel("Search titles").fill("zzzz-unmatched-title-zzzz");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByText("No anime found.", { exact: true }),
  ).toBeVisible();
});

test("register, track, complete, reload, export, import, profile, and sign out", async ({
  page,
}) => {
  const username = `viewer-${Date.now()}`;
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const registration = page.getByRole("region", {
    name: "Create your account",
    exact: true,
  });
  await registration
    .getByLabel("Display name", { exact: true })
    .fill("Portfolio viewer");
  await registration.getByLabel("Username", { exact: true }).fill(username);
  await registration
    .getByLabel("Password", { exact: true })
    .fill("Portfolio123");
  await registration
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Welcome back, Portfolio viewer." }),
  ).toBeVisible();
  await page.goto("/discover?q=Frieren");
  await page
    .getByRole("button", {
      name: "Add Frieren: Beyond Journey's End to library",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Edit Frieren: Beyond Journey's End",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Edit Frieren: Beyond Journey's End",
      exact: true,
    })
    .click();
  await dialog
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("Watching");
  await dialog.getByLabel("Episodes watched", { exact: true }).fill("27");
  await dialog
    .getByRole("combobox", { name: "Your rating", exact: true })
    .selectOption("9");
  await dialog
    .getByLabel("Private notes", { exact: true })
    .fill("A new favorite.");
  await dialog.getByRole("button", { name: "Save to my library" }).click();
  await expect(dialog).not.toBeVisible();
  await page.goto("/");
  await page
    .getByRole("button", {
      name: "Mark next episode of Frieren: Beyond Journey's End watched",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Marked Frieren: Beyond Journey's End as completed.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/library?status=Completed");
  await expect(page.locator(".library-progress")).toContainText(
    "28 / 28 episodes",
  );
  await page.reload();
  await expect(page.locator(".library-progress")).toContainText(
    "28 / 28 episodes",
  );
  await page.goto("/insights");
  await expect(page.getByText("11.2h", { exact: true })).toBeVisible();
  await page.goto("/settings");
  await page.getByLabel("Display name", { exact: true }).fill("Anime explorer");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.locator(".user-card")).toContainText("Anime explorer");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export XML", exact: true }).click();
  const download = await downloadPromise;
  await expect(download.suggestedFilename()).toBe("animetrack-library.xml");
  const filePath = await download.path();
  await page
    .getByLabel("Import MyAnimeList XML", { exact: true })
    .setInputFiles(filePath!);
  await expect(
    page.getByText("Imported 1 title:", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back.", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("Portfolio123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Welcome back, Anime explorer.",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".user-card")).toContainText("Anime explorer");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/library");
  await expect(
    page.getByRole("heading", { name: "Make room for your favorites." }),
  ).toBeVisible();
});

test("demo sessions have private libraries and mobile layout fits the viewport", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back, Alex." }),
  ).toBeVisible();
  await page
    .getByRole("main")
    .getByRole("link", { name: "My library", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Every story, in one place." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await context.close();
});
