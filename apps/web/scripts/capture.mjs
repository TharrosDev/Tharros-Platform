// Capture surfaces at desktop and phone widths into .impeccable/review/.
//
// Usage: pnpm dev, then `node scripts/capture.mjs [outDir]` from apps/web.
// Reports horizontal overflow per route so a responsive regression fails loudly
// instead of hiding in a screenshot.
// Entrance motion is disabled before capture so an element hidden by animation
// timing never reads as a missing element.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT = process.argv[2] ?? ".impeccable/review";
const BASE = "http://localhost:3000";

const ROUTES = [
  ["home", "/"],
  ["pricing", "/pricing"],
  ["login", "/login"],
  ["security", "/security"],
  ["signup", "/signup"],
];

const VIEWPORTS = [
  ["desktop", 1440, 900],
  ["mobile", 390, 844],
];

const KILL_MOTION = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
  }
`;

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const report = [];

for (const [vpName, width, height] of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.addStyleTag({ content: KILL_MOTION }).catch(() => {});

  for (const [name, path] of ROUTES) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: KILL_MOTION });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(350);

    const overflow = await page.evaluate(() => {
      const de = document.documentElement;
      const wide = [...document.querySelectorAll("body *")]
        .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
        .slice(0, 5)
        .map((el) => el.tagName.toLowerCase() + "." + String(el.className).slice(0, 60));
      return { docW: de.scrollWidth, vw: window.innerWidth, wide };
    });

    const file = `${OUT}/${name}-${vpName}.png`;
    await page.screenshot({ path: file, fullPage: true });
    report.push({ route: path, vp: vpName, ...overflow, file });
  }
  await context.close();
}

await browser.close();

for (const r of report) {
  const bad = r.docW > r.vw + 1;
  console.log(
    `${bad ? "OVERFLOW" : "ok      "} ${r.vp.padEnd(7)} ${r.route.padEnd(10)} doc=${r.docW} vw=${r.vw}` +
      (r.wide.length ? `  wide: ${r.wide.join(" | ")}` : ""),
  );
}
