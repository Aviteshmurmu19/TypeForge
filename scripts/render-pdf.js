const { launch } = require("puppeteer");
const path = require("path");

(async () => {
  if (process.argv.length < 4) {
    console.error("Usage: node render-pdf.js <input_html_file> <output_pdf_file>");
    process.exit(1);
  }

  const inputFile = require("url").pathToFileURL(path.resolve(process.argv[2])).href;
  const outputFile = process.argv[3];

  console.log("Launching headless browser...");
  const browser = await launch({ headless: true });

  try {
    const page = await browser.newPage();
    console.log(`Navigating to local file: ${inputFile}`);

    await page.goto(inputFile, { waitUntil: "networkidle0", timeout: 30000 });

    console.log("Generating PDF...");
    await page.pdf({
      path: outputFile,
      format: "A4",
      printBackground: true,
      margin: {
        top: "25mm",
        right: "25mm",
        bottom: "25mm",
        left: "25mm",
      },
    });

    console.log(`Success! PDF saved to ${outputFile}`);
  } catch (error) {
    console.error("An error occurred during PDF generation:", error);
    await browser.close();
    process.exit(1);
  }

  await browser.close();
  console.log("Browser closed.");
})();