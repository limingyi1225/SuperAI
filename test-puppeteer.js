const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('response', async (response) => {
    if (response.url().includes('/api/upload')) {
      console.log('Upload response status:', response.status());
      try {
        console.log('Upload response body:', await response.text());
      } catch (e) {
        console.log('Could not read upload response body');
      }
    }
  });

  await page.goto('http://localhost:3000');
  
  // Wait for React to mount
  await page.waitForSelector('input[type="file"]');
  
  // Create a dummy file and upload it
  const elementHandle = await page.$('input[type="file"]');
  const fs = require('fs');
  fs.writeFileSync('dummy.jpg', 'dummy content');
  await elementHandle.uploadFile('dummy.jpg');

  // Trigger change event if needed, but playwright/puppeteer does it automatically
  await page.waitForTimeout(2000);
  
  await browser.close();
  fs.unlinkSync('dummy.jpg');
})();
