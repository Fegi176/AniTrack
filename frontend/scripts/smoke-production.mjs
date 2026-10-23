import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const baseUrl = process.env.SMOKE_URL ?? "http://localhost:5001";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(baseUrl);
  await page
    .getByRole("heading", { name: "Welcome back.", exact: true })
    .waitFor();
  assert.equal(new URL(page.url()).pathname, "/login");
  const response = await page.goto(`${baseUrl}/library`);
  assert.equal(
    response.status(),
    200,
    "The published app must serve SPA routes",
  );
  await page
    .getByRole("heading", { name: "Make room for your favorites." })
    .waitFor();
  const configuration = await (
    await page.request.get(`${baseUrl}/api/config`)
  ).json();
  assert.equal(
    configuration.demoEnabled,
    false,
    "Production demo access must be disabled",
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Try the demo", exact: true })
      .count(),
    0,
  );
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Display name", { exact: true })
    .fill("Release viewer");
  await dialog
    .getByLabel("Username", { exact: true })
    .fill(`release-${Date.now()}`);
  await dialog.getByLabel("Password", { exact: true }).fill("Portfolio123");
  await dialog
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Every story, in one place." })
    .waitFor();
  await page.reload();
  await page
    .getByRole("heading", { name: "Every story, in one place." })
    .waitFor();
  await page.goto(`${baseUrl}/settings`);
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 40;
    canvas.height = 20;
    const context = canvas.getContext("2d");
    context.fillStyle = "#a9c7a3";
    context.fillRect(0, 0, 40, 20);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page
    .getByLabel("Choose profile picture", { exact: true })
    .setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await page
    .getByText("Your profile picture has been updated.", { exact: true })
    .waitFor();
  const avatarUrl = await page.locator(".user-card img").getAttribute("src");
  const avatar = await page.request.get(`${baseUrl}${avatarUrl}`);
  assert.equal(avatar.status(), 200);
  assert.equal(avatar.headers()["content-type"], "image/png");
  await page.reload();
  await page.locator(`.user-card img[src="${avatarUrl}"]`).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "Published app passed: login entry, SPA routing, production config, account creation, persistent sessions and pictures, and no browser errors.",
  );
} finally {
  await browser.close();
}
