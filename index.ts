require('dotenv').config()

import { ElementHandle, Page } from "puppeteer";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import puppeteer from 'puppeteer-extra';
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
// @ts-ignore
// const anticaptcha = require('@antiadmin/anticaptchaofficial');

const URL = 'https://jobs.lever.co/nextech/65739f6d-20e0-40f6-86ab-c4b424d1de79/apply';

puppeteer.use(StealthPlugin());

export const REGION = "us-west-2";

const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_S3_ACCESS_KEY || '',
    secretAccessKey: process.env.AWS_S3_SECRET_KEY || '',
  }
});

export const uploadFile = async (key: string, file: Buffer) => {
  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: file
    }));
  } catch (e) {
    console.log(e);
  }
};

export const scrollToPageMiddle = async (page: Page, element: ElementHandle<Element>): Promise<void> => {
  await page.evaluate(element => {
    const yOffset = window.innerHeight / 2; // Middle of the viewport
    const y = element.getBoundingClientRect().top + window.pageYOffset - yOffset;
    window.scrollTo({ top: y });
  }, element);

  await new Promise(r => setTimeout(r, 500));
}

const fillTextField = async (page: Page, name: string, value: string) => {
  const input = await page.$(`[name="${name}"]`);
  await input?.click({ clickCount: 3 })
  await input?.type(value);
};

const fillRadioField = async (page: Page, name: string) => {
  const input = await page.$(`input[name="${name}"]`);
  input?.click();
};

const fillResumeField = async (page: Page) => {
  const button = await page.$('#resume-upload-input');
  if (!button) {
    console.log('No file upload');
    return;
  }

  await scrollToPageMiddle(page, button);

  const [fileChooser] = await Promise.all([
    page.waitForFileChooser({ timeout: 5000 }),
    button.click()
  ]);

  await fileChooser.accept(['./lucy_lewis_resume.pdf']);

  let pollingCount = 0;
  while (pollingCount < 10) {
    await new Promise(r => setTimeout(r, 1000));

    const style = await page.evaluate(() => {
      const element = document.querySelector('.resume-upload-success');
      // @ts-ignore
      return element.style['display'];
    });

    if (style === 'inline') break;

    pollingCount++;
  }
}

(async function() {
  const browser = await puppeteer.launch({ headless: false });
  const userAgent = await browser.userAgent();
  console.log(userAgent);
  const page = await browser.newPage();

  try {
    await page.goto(URL, { waitUntil: 'networkidle2' });

    await fillResumeField(page);

    await fillTextField(page, 'name', 'Lucy Lewis');
    await fillTextField(page, 'email', 'lucylewis2121@gmail.com');
    await fillTextField(page, 'phone', '123-456-7890');
    await fillTextField(page, 'location', 'San Francisco, California, United States');
    // await new Promise(r => setTimeout(r, 2000));
    // console.log('solve');
    // @ts-ignore
    // await page.solveRecaptchas();
    // await solveHCaptchaCapSolver(page, userAgent);
    // console.log('completed');
    // await fillTextField(page, 'location', 'San Francisco, California, United States');
    await page.waitForSelector('#location-0');
    await (await page.$('#location-0'))?.click();
    // await fillTextField(page, 'org', 'Dropbox');

    // await fillTextField(page, 'cards[8712fc7d-cb80-44ca-80e5-072e11bb4c8e][field0]', '9');
    // await fillTextField(page, 'cards[bda017a2-95ef-4b67-be83-02cd19713921][field0]', 'I think I would be really good.');
    await fillRadioField(page, 'cards[06ee605b-ebc1-4b42-a3c5-d2f20b0e4c36][field0]');
    await fillRadioField(page, 'cards[06ee605b-ebc1-4b42-a3c5-d2f20b0e4c36][field1]');

    const screenshot = await page.screenshot({ fullPage: true });
    await uploadFile(`test-${+new Date()}.png`, screenshot);
  } catch (e) {
    const screenshot = await page.screenshot({ fullPage: true });
    await uploadFile(`test-error-${+new Date()}.png`, screenshot);
  }

  await browser.close();

  // await (await page.$('#btn-submit'))?.click();
 })();
