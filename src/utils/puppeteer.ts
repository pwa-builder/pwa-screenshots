import puppeteer from 'puppeteer';

export async function launchBrowser() {
  return await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
}