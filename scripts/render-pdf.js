const { launch } = require("puppeteer");
const path = require("path");

(async () => {
  if (process.argv.length < 4) {
    console.error(
      "Usage: node render-pdf.js <input_html_file> <output_pdf_file>"
    );
    process.exit(1);
  }

  const inputFile = "file://" + path.resolve(process.argv[2]);
  const outputFile = process.argv[3];

  console.log("Launching headless browser...");
  const browser = await launch({ headless: "new" });
  const page = await browser.newPage();

  try {
    console.log(`Navigating to local file: ${inputFile}`);

    // CHANGE HERE: Wait until all resources (CSS, fonts) are loaded.
    await page.goto(inputFile, { waitUntil: "networkidle0" });

    // REMOVED: The waitForSelector for 'mjx-container' is no longer needed.
    // The math is already static HTML.

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
  } finally {
    await browser.close();
    console.log("Browser closed.");
  }
})();
