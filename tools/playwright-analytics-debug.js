const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

  // intercept analytics API calls
  page.on('request', req => {
    if (req.url().includes('/api/analytics')) {
      console.log('REQUEST:', req.method(), req.url());
    }
  });
  page.on('response', async res => {
    if (res.url().includes('/api/analytics')) {
      let txt = '<<unreadable>>';
      try { txt = await res.text(); } catch(e) {}
      console.log('RESPONSE:', res.status(), res.url(), txt.slice(0, 1000));
    }
  });

  // Navigate to admin dashboard
  await page.goto('http://localhost:3000/admindashboard', { waitUntil: 'networkidle' });

  // Try to authenticate via cookie if provided in environment (optional)
  // Click analytics tab - we try common selectors used in admin UIs
  const analyticsSelectors = [
    'a[href="#analytics"]',
    'a[href="/api/analytics"]',
    'button#analyticsTab',
    'button[data-tab="analytics"]',
    'a:has-text("Analytics")',
    'text=Analytics'
  ];

  for (const sel of analyticsSelectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        console.log('Found analytics selector:', sel);
        await el.click();
        await page.waitForTimeout(2000);
        break;
      }
    } catch (e) {}
  }

  // Also try to directly call the analytics endpoints as admin using existing session cookie if present
  try {
    const resp = await page.request.get('/api/analytics/dashboard');
    console.log('Direct fetch /api/analytics/dashboard ->', resp.status());
    const body = await resp.text();
    console.log('BODY:', body.slice(0,1000));
  } catch (e) {
    console.log('Direct fetch failed:', e && e.message);
  }

  await browser.close();
})();
