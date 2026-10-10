// Test script to verify the customer history API calls work with proper authentication
const { chromium } = require('playwright');

async function testCustomerHistory() {
  console.log('Testing customer history functionality...');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    // Navigate to the admin dashboard
    await page.goto('http://localhost:3000/admindashboard');
    
    // Check if we need to log in first
    if (page.url().includes('/adminlogin')) {
      console.log('Need to log in first');
      await page.fill('input#username', 'admin'); // Default admin username
      await page.fill('input#password', 'adminpassword'); // Default admin password
      await page.click('button[type="submit"]');
      await page.waitForNavigation();
    }
    
    // Navigate to the customers page
    await page.click('a[data-page="customers"]');
    
    // Wait for customers to load
    await page.waitForTimeout(2000);
    
    // Click the first "View History" button
    const viewHistoryBtn = await page.$('.view-customer-btn');
    if (viewHistoryBtn) {
      console.log('Clicking "View History" button...');
      await viewHistoryBtn.click();
      
      // Wait for modal to appear and API requests to complete
      await page.waitForSelector('#customer-modal', { state: 'visible' });
      await page.waitForTimeout(2000);
      
      // Check if there are any API error messages
      const errorElement = await page.$('.text-red-500');
      if (errorElement) {
        const errorText = await errorElement.textContent();
        if (errorText.includes('Error loading customer history')) {
          console.log('❌ Error still exists:', errorText);
        } else {
          console.log('✅ No customer history error found');
        }
      } else {
        console.log('✅ No error messages found in modal');
      }
      
      // Get modal content to see if customer history is displayed
      const modalContent = await page.$eval('#customer-modal-body', el => el.textContent);
      console.log('Modal content preview:', modalContent.substring(0, 200) + '...');
    } else {
      console.log('No "View History" buttons found');
    }
    
    console.log('Test completed. Please check the browser for results.');
  } catch (error) {
    console.error('Test failed:', error);
  }
  
  // Keep browser open for a while so we can see the results
  await page.waitForTimeout(10000);
  
  await browser.close();
}

testCustomerHistory().catch(console.error);