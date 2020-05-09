import express from "express";


const router = express.Router();
const puppeteer = require('puppeteer');
const iPhone = puppeteer.devices['iPhone 6'];

router.post('/post', async function(request: express.Request, response: express.Response){ 
    console.log((request.query.url));
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox']
    });

    const page = await browser.newPage();
   
    try {
        await page.setViewport({ width: 1280, height: 800 });
    } catch(err) {
        console.log(err);
    }
    try {
        await page.goto(request.query.url);
    } catch(err) {
        console.log('Check URL',err);
    }
    await page.screenshot({ path: 'screenshot.png', fullPage: true });
    await page.emulate(iPhone);
    await page.screenshot({
      path: 'screenshotphone.png',
      fullPage: true
    })
    console.log(await page.title())
    await browser.close();
    response.send('Succesfully downloaded!');
  })



  module.exports = router;