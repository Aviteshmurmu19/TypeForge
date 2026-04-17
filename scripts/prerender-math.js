const { mathjax } = require("mathjax-full/js/mathjax.js");
const { TeX } = require("mathjax-full/js/input/tex.js");
const { CHTML } = require("mathjax-full/js/output/chtml.js");
const { liteAdaptor } = require("mathjax-full/js/adaptors/liteAdaptor.js");
const { RegisterHTMLHandler } = require("mathjax-full/js/handlers/html.js");
const {
  AssistiveMmlHandler,
} = require("mathjax-full/js/a11y/assistive-mml.js");
const fs = require("fs");

if (process.argv.length < 4) {
  console.error(
    "Usage: node prerender-math.js <input_html_file> <output_html_file>"
  );
  process.exit(1);
}
const inputFile = process.argv[2];
const outputFile = process.argv[3];
let htmlfile = fs.readFileSync(inputFile, "utf8");

htmlfile = htmlfile.replace(/\\tag\{([^}]+)\}/g, "\\text{($1)}");

const PACKAGES = "base, autoload, require, ams, newcommand";

const adaptor = liteAdaptor();
AssistiveMmlHandler(RegisterHTMLHandler(adaptor));

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
  tags: "all",
  tagSide: "right",
  tagIndent: "0.8em",
});
const chtml = new CHTML({
  fontURL:
    "https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2",
});

const html = mathjax.document(htmlfile, {
  InputJax: tex,
  OutputJax: chtml,
});

html.render();

if (Array.from(html.math).length === 0) {
  adaptor.remove(html.outputJax.chtmlStyles);
}

let renderedHtml =
  adaptor.doctype(html.document) +
  "\n" +
  adaptor.outerHTML(adaptor.root(html.document));

fs.writeFileSync(outputFile, renderedHtml, "utf8");

console.log(`Successfully pre-rendered math to ${outputFile}`);