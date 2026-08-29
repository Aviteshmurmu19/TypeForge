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
  await page.goto("http://localhost:9876", { waitUntil: "networkidle0", timeout: 30000 });
  await new Promise(resolve => setTimeout(resolve, 5000));

  const cssInfo = await page.evaluate(() => {
    const containers = document.querySelectorAll('mjx-container');
    const results = [];
    for (let i = 0; i < Math.min(containers.length, 3); i++) {
      const el = containers[i];
      const rules = [];
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.selectorText && rule.selectorText.includes('mjx-container')) {
              rules.push({
                selector: rule.selectorText,
                display: rule.style.display,
                cssText: rule.cssText.substring(0, 200)
              });
            }
          }
        } catch (e) {
          rules.push({ error: e.message });
        }
      }
      results.push({
        index: i,
        tagName: el.tagName,
        attributes: Array.from(el.attributes).map(a => `${a.name}="${a.value}"`).join(', '),
        matchedRules: rules.filter(r => {
          try {
            return el.matches(r.selector);
          } catch (e) {
            return false;
          }
        })
      });
    }
    return results;
  });

  console.log("CSS match info:", JSON.stringify(cssInfo, null, 2));
  await browser.close();
  server.close();
})();
