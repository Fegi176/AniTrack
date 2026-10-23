import { test, expect } from "@playwright/test";

test("pictures upload, persist, replace, validate, and remove", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("button", { name: "Try the demo", exact: true }).click();
  await page
    .getByRole("link", { name: "View your profile", exact: true })
    .click();
  await expect(page).toHaveURL(/\/settings$/);
  const source = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 400;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#a9c7a3";
    context.fillRect(0, 0, 600, 400);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  const file = page.getByLabel("Choose profile picture", { exact: true });
  await file.setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: Buffer.from(source, "base64"),
  });
  await expect(
    page.getByText("Your profile picture has been updated.", { exact: true }),
  ).toBeVisible();
  const avatar = page.locator(".user-card .avatar img");
  await expect(avatar).toBeVisible();
  await expect
    .poll(() =>
      avatar.evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBe(256);
  const firstUrl = await avatar.getAttribute("src");
  await page.reload();
  await expect(avatar).toHaveAttribute("src", firstUrl!);
  await file.setInputFiles({
    name: "replacement.png",
    mimeType: "image/png",
    buffer: Buffer.from(source, "base64"),
  });
  await expect(avatar).not.toHaveAttribute("src", firstUrl!);
  await file.setInputFiles({
    name: "oversized.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
  });
  await expect(page.getByRole("alert")).toContainText("smaller than 2 MB");
  await file.setInputFiles({
    name: "invalid.png",
    mimeType: "image/png",
    buffer: Buffer.from("not a picture"),
  });
  await expect(page.getByRole("alert")).toContainText("could not be read");
  await expect(avatar).toBeVisible();
  await page.setViewportSize({ width: 320, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Remove picture", exact: true })
    .click();
  await expect(
    page.getByText("Your profile picture has been removed.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.locator(".user-card .avatar")).toHaveText("A");
  await expect(avatar).toHaveCount(0);
});
