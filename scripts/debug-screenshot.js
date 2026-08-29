const { launch } = require("puppeteer");
const path = require("path");

(async () => {
  const inputFile = require("url").pathToFileURL(path.resolve("temp/Markdown-Cheatsheet_step2.html")).href;
  const winChromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const fs = require("fs");
  const launchOptions = { headless: true };
  if (fs.existsSync(winChromePath)) {launchOptions.executablePath = winChromePath;}

  const browser = await launch(launchOptions);
  const page = await browser.newPage();
  await page.goto(inputFile, { waitUntil: "networkidle0", timeout: 30000 });
  await new Promise(resolve => setTimeout(resolve, 5000));

  const bodyInfo = await page.evaluate(() => {
    return {
      bodyHeight: document.body.scrollHeight,
      bodyInnerHTML: document.body.innerHTML.substring(0, 2000),
      mjxCount: document.querySelectorAll('mjx-container').length,
      mjxDisplay: document.querySelectorAll('mjx-container[display="true"]').length,
      mathDisplayDivs: document.querySelectorAll('div.math.display').length,
      mathDisplaySpans: document.querySelectorAll('span.math.display').length
    };
  });

  console.log("Body height:", bodyInfo.bodyHeight);
  console.log("mjx-container count:", bodyInfo.mjxCount);
  console.log("mjx-container display=true count:", bodyInfo.mjxDisplay);
  console.log("div.math.display count:", bodyInfo.mathDisplayDivs);
  console.log("span.math.display count:", bodyInfo.mathDisplaySpans);
  console.log("Body HTML (first 2000 chars):", bodyInfo.bodyInnerHTML);

  await page.screenshot({ path: "temp/Markdown-Cheatsheet_screenshot.png", fullPage: true });
  console.log("Screenshot saved");
  await browser.close();
})();
