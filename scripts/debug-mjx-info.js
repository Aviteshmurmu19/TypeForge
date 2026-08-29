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

  const mjxInfo = await page.evaluate(() => {
    const containers = document.querySelectorAll('mjx-container');
    return Array.from(containers).map((el, i) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        index: i,
        tagName: el.tagName,
        display: style.display,
        color: style.color,
        backgroundColor: style.backgroundColor,
        fontSize: style.fontSize,
        width: rect.width,
        height: rect.height,
        visible: rect.width > 0 && rect.height > 0,
        innerHTML: el.innerHTML.substring(0, 200)
      };
    });
  });

  console.log("mjx-container info:", JSON.stringify(mjxInfo, null, 2));
  await browser.close();
})();
