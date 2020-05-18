import express from 'express';
import * as path from 'path';
const fs = require('fs');
const tmp = require('tmp');
const archiver = require('archiver');
const router = express.Router();
const puppeteer = require('puppeteer');
const iPhone = puppeteer.devices['iPhone 6'];
const Vibrant = require('node-vibrant');
const bodyParser = require('body-parser').json();
router.get('/getColorScheme', async function (
  request: express.Request,
  response: express.Response
) {
  const tempFilename = await createTemporaryFile('screenshot', '.png');
  await generateScreenshots(request.query.url, tempFilename, undefined);
  var palette = await getDominantColors(tempFilename);
  console.log(palette);
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(palette));
});
router.post('/post', bodyParser, async function (
  request: express.Request,
  response: express.Response
) {
  console.log(request.body.url);
  const urlArray = await getValidatedUrls(request.body.url);
  console.log(urlArray);
  const archive = archiver('zip', {
    zlib: { level: 9 }, // Sets the compression level.
  });
  //Create the zipped file
  const zippedFilename = await createTemporaryFile('screenshots', '.zip');
  //Create an output write stream
  const output = fs.createWriteStream(zippedFilename);
  archive.pipe(output);
  try {
    for (var i = 0; i < urlArray.length; i++) {
      //If no. of urls is equal to 1, no need to append number to file name
      var pageNumber = urlArray.length > 1 ? (i + 1).toString() : '';
      const screenshotFullScreen = await createTemporaryFile(
        'screenshotFullScreen' + pageNumber,
        '.png'
      );
      const screenshotPhone = await createTemporaryFile(
        'screenshotPhone' + pageNumber,
        '.png'
      );
      //Generate screenshots for URL
      await generateScreenshots(
        urlArray[i],
        screenshotFullScreen,
        screenshotPhone
      );
      //Add generated files to zipped file
      archive.file(screenshotFullScreen, {
        name: 'screenshotFullScreen' + pageNumber + '.png',
      });
      archive.file(screenshotPhone, {
        name: 'screenshotPhone' + pageNumber + '.png',
      });
    }
    output.on('close', () => {
      response.setHeader('content-type', 'application/zip');
      response.download(zippedFilename);
    });
    archive.finalize();
  } catch (err) {
    console.log('Error generating screenshots', err);
    response.status(500).send('Error generating screenshots: ' + err);
  }
});

async function getValidatedUrls(urlArray: Array<string>) {
  return urlArray.map((url) => {
    if (url) {
      if (!url.startsWith('http')) {
        url = 'https://' + url;
      }
    }
    return url;
  });
}

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
  await page.screenshot({ path: pathToFullPageScreenshot, fullPage: false });
  if (pathToPhoneScreenshot != undefined) {
    await page.emulate(iPhone);

    await page.screenshot({ path: pathToPhoneScreenshot, fullPage: false });
  }
  console.log(await page.title());
  await browser.close();
}
async function createTemporaryFile(filename, extension) {
  return tmp.tmpNameSync({
    prefix: filename,
    postfix: extension,
  });
}
async function getDominantColors(pathToFullPageScreenshot) {
  console.log(pathToFullPageScreenshot);
  var palette = await Vibrant.from(pathToFullPageScreenshot).getPalette();

  return palette;
}
module.exports = router;
