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
  
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });
  
  page.on('pageerror', error => {
    consoleLogs.push({ type: 'pageerror', text: error.message });
  });
  
  await page.goto(inputFile, { waitUntil: "networkidle0", timeout: 30000 });
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log("Console logs:", JSON.stringify(consoleLogs, null, 2));
  await browser.close();
})();
