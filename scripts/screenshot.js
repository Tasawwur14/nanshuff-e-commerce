const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const issues = { console: [], failedRequests: [] };

  page.on('console', msg => {
    issues.console.push({ type: msg.type(), text: msg.text() });
  });

  page.on('requestfailed', request => {
    issues.failedRequests.push({ url: request.url(), method: request.method(), failure: request.failure() });
  });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500); // small wait for any late requests

  const screenshotPath = 'homepage-screenshot.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('screenshot taken:', screenshotPath);

  // save issues
  fs.writeFileSync('playwright-issues.json', JSON.stringify(issues, null, 2));
  console.log('issues written to playwright-issues.json');

  await browser.close();
})();