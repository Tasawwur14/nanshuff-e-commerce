const { chromium } = require('@playwright/test');

(async () => {
  // Launch browser
  const browser = await chromium.launch({ headless: false }); // Set to true if you don't want to see the browser UI
  const page = await browser.newPage();

  // Go to the homepage
  await page.goto('http://localhost:3000');

  console.log('Testing wishlist functionality...');

  // Find and click on the first product
  const productLinks = await page.locator('a[href^="/product/"]').count();
  if (productLinks > 0) {
    await page.locator('a[href^="/product/"]').first().click();
    
    // Wait for the product page to load
    await page.waitForURL('**/product/**');
    
    // Check if wishlist button exists
    const wishlistBtnExists = await page.locator('#wishlist-btn').count();
    console.log('Wishlist button exists:', wishlistBtnExists > 0);
    
    if (wishlistBtnExists > 0) {
      // Check if the button is disabled (which would mean user needs to log in)
      const isDisabled = await page.locator('#wishlist-btn').isDisabled();
      console.log('Wishlist button is disabled (needs login):', isDisabled);
    }
    
    // Go to wishlist page
    await page.goto('http://localhost:3000/wishlist');
    
    // Check if wishlist page loads
    await page.waitForTimeout(1000);
    const wishlistPageTitle = await page.locator('h1:text("My Wishlist")').count();
    console.log('Wishlist page loaded:', wishlistPageTitle > 0);
  }

  // Close browser after a few seconds
  await page.waitForTimeout(5000);
  await browser.close();
})();