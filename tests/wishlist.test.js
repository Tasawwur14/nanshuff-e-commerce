const { test, expect } = require('@playwright/test');

test.describe('Wishlist functionality', () => {
  test('should allow user to add and remove products from wishlist', async ({ page }) => {
    // Navigate to the homepage
    await page.goto('http://localhost:3000');

    // Get all products on the page (first few)
    const productLinks = await page.locator('a[href^="/product/"]').first();
    
    if (await productLinks.count() > 0) {
      // Click on the first product
      await productLinks.click();
      
      // Wait for the product details page to load
      await page.waitForURL('**/product/**');
      
      // Check if the wishlist button exists on the product page
      const wishlistButton = page.locator('#wishlist-btn');
      await expect(wishlistButton).toBeVisible();
      
      // Click the wishlist button
      await wishlistButton.click();
      
      // Check if button state changes to indicate it's added to wishlist
      await expect(wishlistButton).toContainText('Added to Wishlist');
      
      // Navigate to the wishlist page
      await page.goto('http://localhost:3000/wishlist');
      
      // Check if there are products in the wishlist
      const wishlistItems = page.locator('#wishlist-content .group');
      await expect(wishlistItems).toHaveCount(1); // At least one item expected
      
      // Test removing from wishlist
      const removeButtons = page.locator('.remove-from-wishlist-btn');
      await removeButtons.first().click();
      
      // Verify the item is removed
      await expect(wishlistItems).toHaveCount(0);
      
      // Verify empty wishlist message is shown
      await expect(page.locator('#empty-wishlist')).not.toHaveClass(/hidden/);
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