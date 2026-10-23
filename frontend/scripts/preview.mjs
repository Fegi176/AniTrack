import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
await mkdir("../docs/screenshots", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 1080 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.goto("http://127.0.0.1:5173/");
await page
  .getByRole("heading", { name: "Welcome back.", exact: true })
  .waitFor();
await page.evaluate(async () => {
  await Promise.race([
    Promise.all(
      [...document.images].map((image) => {
        image.loading = "eager";
        return image.decode().catch(() => {});
      }),
    ),
    new Promise((resolve) => setTimeout(resolve, 10000)),
  ]);
});
await page.screenshot({
  path: "../docs/screenshots/landing.png",
  fullPage: true,
});
await page.screenshot({ path: "../docs/screenshots/sign-in.png" });
await page
  .getByRole("button", { name: "Create an account", exact: true })
  .click();
await page.screenshot({ path: "../docs/screenshots/register.png" });
await page.getByRole("button", { name: "Try the demo", exact: true }).click();
await page.getByRole("heading", { name: "Welcome back, Alex." }).waitFor();
// Make real, isolated demo changes so the history preview shows the complete journey.
const origin = "http://127.0.0.1:5173";
const demoEntries = await (
  await page.request.get(`${origin}/api/library`)
).json();
const csrf = await (await page.request.get(`${origin}/api/auth/csrf`)).json();
async function updateEntry(entry, changes) {
  const response = await page.request.put(
    `${origin}/api/library/${entry.animeId}`,
    {
      headers: { "X-CSRF-TOKEN": csrf.token },
      data: {
        status: entry.status,
        episodesWatched: entry.episodesWatched,
        score: entry.score,
        notes: entry.notes,
        revision: entry.revision,
        ...changes,
      },
    },
  );
  if (!response.ok())
    throw new Error("Could not prepare the demo history preview.");
  return response.json();
}
let frieren = demoEntries.find((entry) => entry.animeId === 52991);
frieren = await updateEntry(frieren, {
  episodesWatched: frieren.episodesWatched + 1,
});
await updateEntry(frieren, { score: 9 });
await updateEntry(
  demoEntries.find((entry) => entry.animeId === 199),
  { status: "Completed", episodesWatched: 1, score: 9 },
);
await page.reload();
await page.locator(".continue-card").first().waitFor();
await page.evaluate(async () => {
  await Promise.race([
    Promise.all(
      [...document.images].map((image) => {
        image.loading = "eager";
        return image.decode().catch(() => {});
      }),
    ),
    new Promise((resolve) => setTimeout(resolve, 10000)),
  ]);
});
await page.screenshot({
  path: "../docs/screenshots/overview.png",
  fullPage: true,
});
await page.goto("http://127.0.0.1:5173/discover");
await page.locator(".result-count strong").waitFor();
await page.evaluate(async () => {
  await Promise.race([
    Promise.all(
      [...document.images].map((image) => {
        image.loading = "eager";
        return image.decode().catch(() => {});
      }),
    ),
    new Promise((resolve) => setTimeout(resolve, 10000)),
  ]);
});
await page.screenshot({
  path: "../docs/screenshots/discover.png",
  fullPage: true,
});
await page.setViewportSize({ width: 390, height: 844 });
await page.goto("http://127.0.0.1:5173/");
await page.getByRole("heading", { name: "Welcome back, Alex." }).waitFor();
await page.screenshot({
  path: "../docs/screenshots/mobile.png",
  fullPage: true,
});
await page.setViewportSize({ width: 1440, height: 1080 });
for (const [name, path] of [
  ["library", "/library"],
  ["insights", "/insights"],
  ["history", "/insights/history"],
  ["achievements", "/insights/achievements"],
  ["settings", "/settings"],
]) {
  await page.goto(`http://127.0.0.1:5173${path}`);
  await page.locator("main .page-heading h1").waitFor();
  if (name === "library") await page.locator(".library-row").first().waitFor();
  if (name === "insights") await page.locator(".rating-chart").waitFor();
  if (name === "history") await page.locator(".activity-row").first().waitFor();
  if (name === "achievements")
    await page.locator(".achievement-card").first().waitFor();
  await page.screenshot({
    path: `../docs/screenshots/${name}.png`,
    fullPage: true,
  });
}
await page.setViewportSize({ width: 390, height: 844 });
for (const name of ["history", "achievements"]) {
  await page.goto(`http://127.0.0.1:5173/insights/${name}`);
  await page
    .locator(name === "history" ? ".activity-row" : ".achievement-card")
    .first()
    .waitFor();
  await page.screenshot({
    path: `../docs/screenshots/${name}-mobile.png`,
    fullPage: true,
  });
}
await page.goto("http://127.0.0.1:5173/discover");
await page
  .getByRole("button", {
    name: "View Frieren: Beyond Journey's End",
    exact: true,
  })
  .click();
await page.screenshot({ path: "../docs/screenshots/detail-mobile.png" });
await page
  .getByRole("button", { name: "Update your progress", exact: true })
  .click();
await page.screenshot({ path: "../docs/screenshots/editor-mobile.png" });
console.log(
  JSON.stringify({
    errors,
    overflow: await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  }),
);
await browser.close();
