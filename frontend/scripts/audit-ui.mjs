import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";

const tag = (process.argv[2] ?? "current").replace(/[^a-z0-9-]/gi, "");
const output = `../.tools/ui-audit/${tag}`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.goto("http://127.0.0.1:5173/");
await page.getByRole("button", { name: "Try the demo", exact: true }).click();
await page.getByRole("heading", { name: "Welcome back, Alex." }).waitFor();
const reports = [];
for (const width of [1440, 768, 390, 320]) {
  await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
  for (const [name, path] of [
    ["overview", "/"],
    ["discover", "/discover"],
    ["library", "/library"],
    ["insights", "/insights"],
    ["settings", "/settings"],
  ]) {
    await page.goto(`http://127.0.0.1:5173${path}`);
    await page.locator("main h1").waitFor();
    if (name === "library")
      await page.locator(".library-row").first().waitFor();
    if (name === "insights") await page.locator(".status-chart").waitFor();
    if (name === "discover")
      await page.locator(".anime-card").first().waitFor();
    if (name === "overview")
      await page.locator(".continue-card").first().waitFor();
    const layout = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      title: document.title,
    }));
    const violations = (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    }));
    await page.evaluate(async () => {
      await Promise.race([
        Promise.all(
          [...document.images].map((image) => {
            image.loading = "eager";
            return image.decode().catch(() => {});
          }),
        ),
        new Promise((resolve) => setTimeout(resolve, 8000)),
      ]);
    });
    await page.screenshot({
      path: `${output}/${name}-${width}.png`,
      fullPage: true,
    });
    reports.push({ name, width, ...layout, violations });
  }
}
await writeFile(
  `${output}/report.json`,
  JSON.stringify({ errors, reports }, null, 2),
);
console.log(
  JSON.stringify({
    errors,
    reports: reports.map((r) => ({
      name: r.name,
      width: r.width,
      overflow: r.scrollWidth > r.width,
      violations: r.violations.map((v) => ({
        id: v.id,
        count: v.nodes.length,
      })),
    })),
  }),
);
await browser.close();
