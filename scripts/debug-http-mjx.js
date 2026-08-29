const { launch } = require("puppeteer");
const http = require("http");
const fs = require("fs");
const path = require("path");

(async () => {
  const server = http.createServer((req, res) => {
    const file = path.join("temp", "Markdown-Cheatsheet_step2.html");
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
      } else {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(data);
      }
    });
  });

  await new Promise(resolve => server.listen(9876, resolve));
  console.log("Server running on http://localhost:9876");

  const winChromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
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
  
  await page.goto("http://localhost:9876", { waitUntil: "networkidle0", timeout: 30000 });
  await new Promise(resolve => setTimeout(resolve, 5000));

  const mjxInfo = await page.evaluate(() => {
    const containers = document.querySelectorAll('mjx-container');
    return {
      containers: Array.from(containers).map((el, i) => {
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
      })
    };
  });

  console.log("Console logs:", JSON.stringify(mjxInfo.consoleLogs, null, 2));
  console.log("mjx-container info:", JSON.stringify(mjxInfo.containers, null, 2));
  
  await page.screenshot({ path: "temp/Markdown-Cheatsheet_screenshot_http.png", fullPage: true });
  console.log("Screenshot saved to temp/Markdown-Cheatsheet_screenshot_http.png");
  await browser.close();
  server.close();
})();
