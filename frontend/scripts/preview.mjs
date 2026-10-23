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
  ["settings", "/settings"],
]) {
  await page.goto(`http://127.0.0.1:5173${path}`);
  await page.locator("main .page-heading h1").waitFor();
  if (name === "library") await page.locator(".library-row").first().waitFor();
  if (name === "insights") await page.locator(".rating-chart").waitFor();
  await page.screenshot({
    path: `../docs/screenshots/${name}.png`,
    fullPage: true,
  });
}
await page.setViewportSize({ width: 390, height: 844 });
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
