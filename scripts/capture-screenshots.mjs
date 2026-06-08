import { chromium } from "playwright";
const BASE = process.env.SCREENSHOT_URL ?? "http://127.0.0.1:3109";
const OUT = "docs/screenshots";

async function capture(label, scrollY = 0, fullPage = false) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  if (scrollY > 0) { await page.evaluate(y => window.scrollTo(0, y), scrollY); await page.waitForTimeout(500); }
  await page.screenshot({ path: `${OUT}/${label}.png`, fullPage });
  console.log(`Captured: ${label}.png`);
  await browser.close();
}

async function main() {
  await capture("00-full-page", 0, true);
  await capture("01-dashboard-hero");
  await capture("02-hybrid-search-results", 700);
  await capture("03-parser-comparison", 1700);
  await capture("04-citations-sources", 900);
  await capture("05-ingestion-dashboard", 2000);
  await capture("06-search-history", 2400);
}
main().catch(e => { console.error(e); process.exit(1); });
