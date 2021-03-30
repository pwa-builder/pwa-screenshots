import fs from 'fs';
import express from 'express';
import puppeteer from 'puppeteer';
import archiver from 'archiver';
import Vibrant from 'node-vibrant';
import { launchBrowser } from '../utils/puppeteer';
import { createTemporaryFile, scheduleTemporaryFileDeletion } from '../utils/temp';

const sizeOf = require('image-size');
const iPhone = puppeteer.devices['iPhone 6'];
const router = express.Router();

router.get('/getColorScheme', async function (
  request: express.Request,
  response: express.Response
) {
  let tempFilename: string;
  try {
    tempFilename = await createTemporaryFile('screenshot', '.png');
    const url: string = request.query.url as string;
    await generateScreenshots(url, tempFilename, undefined);
    var palette = await getDominantColors(tempFilename);
    console.log(palette);
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(palette));
  } catch (e) {
    console.error(e);
    response.status(500).send('Error getting color scheme: ' + e);
  } finally {
    if (tempFilename) {
      await scheduleTemporaryFileDeletion(tempFilename);
    }
  }
});

router.post('/post', async function (
  request: express.Request,
  response: express.Response
) {

  let zippedFilename: string;
  try {
    console.log(request.body.url);
    const urlArray = getValidatedUrls(request.body.url);
    console.log(urlArray);
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Sets the compression level.
    });
    //Create the zipped file
    zippedFilename = await createTemporaryFile('screenshots', '.zip');

    if (!zippedFilename) {
      throw new Error("unable to create temporary file");
    }

    //Create an output write stream
    const output = fs.createWriteStream(zippedFilename);
    archive.pipe(output);

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
      response.setHeader('Content-Disposition', 'filename="screenshots.zip"');
      response.sendFile(zippedFilename);
    });
    archive.finalize();
  } catch (err) {
    console.log('Error generating screenshots', err);
    response.status(500).send('Error generating screenshots: ' + err);
  } finally {
    await scheduleTemporaryFileDeletion(zippedFilename);
  }
});

//Returns Zipped file of screenshots
router.post('/downloadScreenshotsZipFile', async function (
  request: express.Request,
  response: express.Response
) {
  let zippedFileName: string;
  try {
      const archive = archiver('zip', {
      zlib: { level: 9 }, // Sets the compression level.
    });
    //Create the zipped file
    zippedFileName = await createTemporaryFile('screenshots', '.zip');
    //Create an output write stream
    const output = fs.createWriteStream(zippedFileName);
    archive.pipe(output);
    var screenshotImages = request.body;

    console.log(screenshotImages);

    for (var i = 0; i < screenshotImages.length; i++) {
      let buffer = Buffer.from(screenshotImages[i].src);
      let file = await createTemporaryFile(
        'screenshot' + (i + 1).toString(),
        '.png'
      );
      fs.writeFileSync(file, '.png', buffer.toString('utf8'));
      archive.file(file, {
        name: 'screenshot' + (i + 1) + '.png',
      });
    }
    output.on('close', () => {
      response.setHeader('Content-Disposition', 'filename="screenshots.zip"');
      response.sendFile(zippedFileName);
    });
    archive.finalize();
  } catch (e) {
    console.error(e);
  } finally {
    await scheduleTemporaryFileDeletion(zippedFileName)
  }
});

//For standalone tool
router.post(
  '/screenshotsAsBase64StringWithOptions',
  async function (request: express.Request, response: express.Response) {

    const screenshotsCreated = [];
    try {
      const screenshotObjects = request.body;
      const resultObject = {
        images: []
      };
      console.log(screenshotObjects);
      for (var i = 0; i < screenshotObjects.length; i++) {
        const pageNumber = screenshotObjects.length > 1 ? (i + 1).toString() : '';
        const screenshotFullScreen = screenshotObjects[i].desktop
          ? await createTemporaryFile(
              'screenshotFullScreen' + pageNumber,
              '.png'
            )
          : undefined;

        screenshotsCreated.push(screenshotFullScreen);

        const screenshotPhone = screenshotObjects[i].mobile
          ? await createTemporaryFile('screenshotPhone' + pageNumber, '.png')
          : undefined;
        screenshotObjects[i].url = await validateUrl(screenshotObjects[i].url);
        console.log(screenshotFullScreen, screenshotPhone);
        await generateScreenshots(
          screenshotObjects[i].url,
          screenshotFullScreen,
          screenshotPhone
        );
        console.log('TYPE OF', typeof screenshotObjects[i].desktop);
        if (screenshotObjects[i].desktop) {
          resultObject['images'].push(
            await getScreenshotDetails(screenshotFullScreen)
          );
        }
        if (screenshotObjects[i].mobile) {
          resultObject['images'].push(
            await getScreenshotDetails(screenshotPhone)
          );
        }
      }
      response.setHeader('Content-Type', 'application/json');
      response.json(resultObject);
    } catch (err) {
      console.log('Error generating screenshots', err);
      response.status(500).send('Error generating screenshots: ' + err);
    } finally {
      const cleanups = screenshotsCreated.map(item => scheduleTemporaryFileDeletion(item))
      await Promise.all(cleanups);
    }
  }
);

//Return screenshots as an array of Base64 encoded strings for PWABuilder website
router.post('/screenshotsAsBase64Strings',
  async function (
  request: express.Request,
  response: express.Response
  ) {

  let screenshotFullScreen;
  let screenshotPhone;
  try {
    const urlArray = getValidatedUrls(request.body.url);
    console.log(urlArray);
    const resultObject = {
      images: []
    };

    for (var i = 0; i < urlArray.length; i++) {
      //If no. of urls is equal to 1, no need to append number to file name
      var pageNumber = urlArray.length > 1 ? (i + 1).toString() : '';
      screenshotFullScreen = await createTemporaryFile(
        'screenshotFullScreen' + pageNumber,
        '.png'
      );
      screenshotPhone = await createTemporaryFile(
        'screenshotPhone' + pageNumber,
        '.png'
      );
      //Generate screenshots for URL
      await generateScreenshots(
        urlArray[i],
        screenshotFullScreen,
        screenshotPhone
      );
      let screenshotFullScreenDims = await getImageDims(screenshotFullScreen);
      let screenshotPhoneDims = await getImageDims(screenshotPhone);
      let buffFullScreen = fs.readFileSync(screenshotFullScreen);
      let base64dataFullScreen = buffFullScreen.toString('base64');
      let buffPhone = fs.readFileSync(screenshotPhone);
      let base64dataPhone = buffPhone.toString('base64');
      let fullScreenObject = {
        src: base64dataFullScreen,
        sizes:
          screenshotFullScreenDims.width +
          'x' +
          screenshotFullScreenDims.height,
        type: 'image/' + screenshotFullScreenDims.type,
      };
      let phoneObject = {
        src: base64dataPhone,
        sizes: screenshotPhoneDims.width + 'x' + screenshotPhoneDims.height,
        type: 'image/' + screenshotPhoneDims.type,
      };
      resultObject['images'].push(fullScreenObject);
      resultObject['images'].push(phoneObject);
      //files.push(screenshotFullScreen);
      //files.push(screenshotPhone);
    }
    response.setHeader('Content-Type', 'application/json');
    response.json(resultObject);
  } catch (err) {
    console.log('Error generating screenshots', err);
    response.status(500).send('Error generating screenshots: ' + err);
  } finally {
    if (screenshotFullScreen) {
      await scheduleTemporaryFileDeletion(screenshotFullScreen);
    }

    if (screenshotPhone) {
      await scheduleTemporaryFileDeletion(screenshotPhone);
    }
  }
});

//Add protocol to the URL if not provided
function getValidatedUrls(urlArray: Array<string>) {
  return urlArray.map((url) => {
    return validateUrl(url);
  });
}

function validateUrl(url: string) {
  if (url) {
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
  }
  return url;
}

async function generateScreenshots(
  url: string,
  pathToFullPageScreenshot: string,
  pathToPhoneScreenshot: string
) {
  try {
    const browser = await launchBrowser();
    const page = await browser.newPage();

    try {
      await page.setViewport({ width: 1280, height: 800 });
      await page.setDefaultNavigationTimeout(120000);
      await page.goto(url, { waitUntil: 'networkidle2' });
    } catch (err) {
      console.log('Check URL here', err);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
    }
    if (pathToFullPageScreenshot !== undefined) {
      console.log('Full page not undefined');
      await page.screenshot({ path: pathToFullPageScreenshot, fullPage: false });
    }
    if (pathToPhoneScreenshot !== undefined) {
      console.log('Mobile not undefined');
      await page.emulate(iPhone);
      await page.goto(url, { waitUntil: 'networkidle2' });
      await page.screenshot({ path: pathToPhoneScreenshot, fullPage: false });
    }
    console.log(await page.title());
    await browser.close();
  } catch (e) {
    console.error(e);
  }
}

async function getDominantColors(pathToFullPageScreenshot) {
  try {
    console.log(pathToFullPageScreenshot);
    var palette = await Vibrant.from(pathToFullPageScreenshot).getPalette();

    return palette;
  } catch (e) {
    console.error(e);
  }
}

async function getScreenshotDetails(pathToImage) {
  try {
    console.log(pathToImage);
    let dims = await getImageDims(pathToImage);
    console.log('DIMS', dims);
    let buff = fs.readFileSync(pathToImage);
    let base64data = 'data:image/png;base64, ' + buff.toString('base64');
    return {
      src: base64data,
      sizes: dims.width + 'x' + dims.height,
      type: 'image/' + dims.type,
    };
  } catch (e) {
    console.error(e);
  }
}

async function getImageDims(pathToImage) {
  var dimensions;
  try {
    dimensions = await sizeOf(pathToImage);
    console.log(dimensions);
  } catch (e) {
    console.error(e);
  }
  return dimensions;
}

async function generateZipFile(output, listOfFiles) {
  const archive = archiver('zip', {
    zlib: { level: 9 }, // Sets the compression level.
  });
  archive.pipe(output);
  try {
    for (var i = 0; i < listOfFiles.length; i++) {
      archive.file(listOfFiles[i], {
        name: 'screenshot' + (i + 1) + '.png',
      });
    }
  } catch (err) {}
  archive.finalize();
}
module.exports = router;
