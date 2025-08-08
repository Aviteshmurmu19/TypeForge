const { mathjax } = require("mathjax-full/js/mathjax.js");
const { TeX } = require("mathjax-full/js/input/tex.js");
const { CHTML } = require("mathjax-full/js/output/chtml.js");
const { liteAdaptor } = require("mathjax-full/js/adaptors/liteAdaptor.js");
const { RegisterHTMLHandler } = require("mathjax-full/js/handlers/html.js");
const {
  AssistiveMmlHandler,
} = require("mathjax-full/js/a11y/assistive-mml.js");
const fs = require("fs");

// No changes to command-line argument handling
if (process.argv.length < 4) {
  console.error(
    "Usage: node prerender-math.js <input_html_file> <output_html_file>"
  );
  process.exit(1);
}
const inputFile = process.argv[2];
const outputFile = process.argv[3];
const htmlfile = fs.readFileSync(inputFile, "utf8");

// The default TeX packages to use
const PACKAGES = "base, autoload, require, ams, newcommand";

// Create a new DOM adaptor and register it
const adaptor = liteAdaptor();
AssistiveMmlHandler(RegisterHTMLHandler(adaptor));

// Configure the input and output jax
const tex = new TeX({
  packages: PACKAGES.split(/\s*,\s*/),
  inlineMath: [
    ["$", "$"],
    ["\\(", "\\)"],
  ],
  displayMath: [
    ["$$", "$$"],
    ["\\[", "\\]"],
  ],
});
const chtml = new CHTML({
  fontURL:
    "https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2",
});

// ** THIS IS THE MAIN CORRECTION **
// Create an HTML document object directly, instead of using init()
const html = mathjax.document(htmlfile, {
  InputJax: tex,
  OutputJax: chtml,
});

// Process the document by calling the render() method
html.render();

// If no math was found on the page, remove the stylesheet
if (Array.from(html.math).length === 0) {
  adaptor.remove(html.outputJax.chtmlStyles);
}

// Output the new HTML with math pre-rendered
const renderedHtml =
  adaptor.doctype(html.document) +
  "\n" +
  adaptor.outerHTML(adaptor.root(html.document));
fs.writeFileSync(outputFile, renderedHtml, "utf8");

console.log(`Successfully pre-rendered math to ${outputFile}`);
