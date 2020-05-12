import express from 'express';
import * as path from 'path';
const fs = require('fs');
const tmp = require('tmp');
const archiver = require('archiver');
const router = express.Router();
const puppeteer = require('puppeteer');
const iPhone = puppeteer.devices['iPhone 6'];

router.post('/post', async function (
  request: express.Request,
  response: express.Response
) {
  console.log(request.query.url);

  const archive = archiver('zip', {
    zlib: { level: 9 }, // Sets the compression level.
  });

  try {
    const zippedFilename = await createTemporaryFile('screenshots', '.zip');
    const output = fs.createWriteStream(zippedFilename);
    const screenshotFullScreen = await createTemporaryFile(
      'screenshotFullScreen',
      '.png'
    );
    const screenshotPhone = await createTemporaryFile(
      'screenshotPhone',
      '.png'
    );
    await generateScreenshots(
      request.query.url,
      screenshotFullScreen,
      screenshotPhone
    );
    archive.pipe(output);
    archive.file(screenshotFullScreen, { name: 'screenshotFullScreen.png' });
    archive.file(screenshotPhone, { name: 'screenshotPhone.png' });
    archive.finalize();
    console.log('REached the end');
    output.on('close', () => {
      response.setHeader('content-type', 'application/zip');
      response.sendFile(zippedFilename);
    });
  } catch (err) {
    console.log('Error generating screenshots', err);
    response.status(500).send('Error generating screenshots: ' + err);
  }
});

async function generateScreenshots(
  url,
  pathToFullPageScreenshot,
  pathToPhoneScreenshot
) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
  });

  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(url);
  } catch (err) {
    console.log('Check URL', err);
  }
  await page.screenshot({ path: pathToFullPageScreenshot, fullPage: true });
  await page.emulate(iPhone);
  await page.screenshot({ path: pathToPhoneScreenshot, fullPage: true });

  console.log(await page.title());
  await browser.close();
}
async function createTemporaryFile(filename, extension) {
  return tmp.tmpNameSync({
    prefix: filename,
    postfix: extension,
  });
}

module.exports = router;
