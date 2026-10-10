const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('Step 1: Navigate to the homepage');
  await page.goto('http://localhost:3000');
  
  console.log('Step 2: Login with tasawwur@gmail.com/123456');
  // Navigate directly to the login page
  await page.goto('http://localhost:3000/login');
  
  await page.fill('#login-email', 'tasawwur@gmail.com');
  await page.fill('#login-password', '123456');
  await page.click('button[type="submit"]');
  
  // Wait for the page to redirect after login (usually to homepage or profile)
  await page.waitForURL('**');
  console.log('Login completed');
  
  // Wait for login to complete
  await page.waitForNavigation();
  console.log('Login completed');

  console.log('Step 3: Add a product to the cart');
  // Navigate to products page first
  await page.goto('http://localhost:3000/products');
  
  // Click on the first product (or a specific product)
  const productLink = await page.locator('a[href^="/product/"]').first();
  if (await productLink.count() > 0) {
    await productLink.click();
    
    // Add to cart using the button ID
    await page.click('#add-to-cart-btn');
    await page.waitForSelector('div:has-text("Added to cart successfully")');
    console.log('Product added to cart');
  }

  console.log('Step 4: Apply discount code "welcome"');
  await page.click('a[href="/cart"]');
  await page.fill('#discountCode', 'welcome');
  await page.click('button:has-text("Apply Discount")');
  await page.waitForSelector('div:has-text("Discount applied successfully")');
  console.log('Discount code applied');
  
  console.log('Step 5: Proceed to checkout');
  await page.click('button:has-text("Proceed to Checkout")');
  
  console.log('Step 6: Place a COD order');
  await page.click('input[value="cod"]');
  await page.click('button:has-text("Place Order")');
  
  console.log('Step 7: Check if discount is applied on confirmation page');
  // Wait for the order confirmation page
  await page.waitForURL('**/order-confirmation**');
  
  // Take a screenshot of the confirmation page to see if discount is shown
  await page.screenshot({ path: 'order-confirmation.png', fullPage: true });
  
  // Extract the order details to check if discount was applied
  const orderDetails = await page.locator('.order-details').textContent();
  console.log('Order details:', orderDetails);
  
  // Look for discount information in the confirmation page
  const discountText = await page.locator('text=Discount').textContent();
  console.log('Discount text found:', discountText || 'No discount text found');
  
  await browser.close();
})();