// Renders docs/report/project-report.html to docs/Project-Report.pdf (A4, page numbers).
// Usage (from e2e/): npm run report:pdf
import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(here, '../docs/report/project-report.html');
const output = path.join(here, '../docs/Project-Report.pdf');

const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome' });
const page = await browser.newPage();
await page.goto(`file://${source}`, { waitUntil: 'networkidle' });
await page.pdf({
  path: output,
  format: 'A4',
  preferCSSPageSize: true,
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: `<div style="width:100%;font:8px Inter,Arial,sans-serif;color:#8a8a85;padding:0 18mm;display:flex;justify-content:space-between">
      <span>Smart Wall Paint Visualizer · Project Report</span>
      <span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
});
await browser.close();
console.log(`Wrote ${path.relative(process.cwd(), output)}`);
