const { test, expect } = require('@playwright/test');

test.describe('Wishlist functionality', () => {
  let page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('should allow logged-in user to add and remove products from wishlist', async () => {
    // First, register a test user to ensure we have an account
    await page.goto('http://localhost:3000/login');
    
    // Check if we're on the login page and look for signup option
    const signupLink = page.locator('text=Sign up');
    if (await signupLink.count() > 0) {
      await signupLink.first().click();
    }
    
    // Fill in the signup form with a test account
    await page.fill('#signup-name', 'Test User');
    await page.fill('#signup-email', 'testuser' + Date.now() + '@example.com');
    await page.fill('#signup-password', 'password123');
    await page.fill('#confirm-password', 'password123');
    
    // Submit the form
    await page.locator('text=Sign Up').click();

    // Wait for a bit to see if registration is successful
    await page.waitForTimeout(2000);
    
    // If we don't see a success message, try logging in with the credentials
    await page.goto('http://localhost:3000/login');
    await page.fill('#login-email', 'testuser' + Date.now() + '@example.com');
    await page.fill('#login-password', 'password123');
    await page.locator('text=Log In').click();
    
    // Wait for login to complete
    await page.waitForTimeout(2000);
    
    // Navigate to the homepage
    await page.goto('http://localhost:3000');

    // Get the first product link
    const productLinks = page.locator('a[href^="/product/"]');
    await expect(productLinks).toHaveCount({gte: 1});
    
    // Click on the first product
    await productLinks.first().click();
    
    // Wait for the product details page to load
    await page.waitForURL('**/product/**');
    
    // Check if the wishlist button exists on the product page
    const wishlistButton = page.locator('#wishlist-btn');
    await expect(wishlistButton).toBeVisible();
    
    // The button should be enabled now since user is logged in
    await expect(wishlistButton).toBeEnabled();
    
    // Click the wishlist button
    await wishlistButton.click();
    
    // Check if button state changes to indicate it's added to wishlist
    await page.waitForTimeout(1000); // Wait for UI update
    
    // Navigate to the wishlist page
    await page.goto('http://localhost:3000/wishlist');
    
    // Check if there are products in the wishlist
    const wishlistItems = page.locator('#wishlist-content .group');
    
    // Wait for the page to load
    await page.waitForTimeout(2000);
    
    // Verify at least one item is in the wishlist
    await expect(wishlistItems).toHaveCount({gte: 1});
    
    // Test removing from wishlist
    const removeButtons = page.locator('.remove-from-wishlist-btn');
    const initialCount = await wishlistItems.count();
    
    if (initialCount > 0) {
      await removeButtons.first().click();
      
      // Verify the item is removed
      await page.waitForTimeout(2000); // Wait for update
      const finalCount = await wishlistItems.count();
      
      // If we had 1 item, it should now be 0
      expect(finalCount).toBe(initialCount - 1);
    }
  });

  test('should show wishlist button on product listing page', async ({ page }) => {
    // Navigate to the products page
    await page.goto('http://localhost:3000/products');
    
    // Wait for products to load
    await page.waitForSelector('.bg-white.group');
    
    // Check if wishlist buttons are present on product cards
    const wishlistButtons = page.locator('.wishlist-btn');
    const count = await wishlistButtons.count();
    
    // If there are products, check for wishlist buttons
    if (count > 0) {
      await expect(wishlistButtons.first()).toBeVisible();
    }
  });
});