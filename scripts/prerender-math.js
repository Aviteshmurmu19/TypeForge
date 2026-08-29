const { mathjax } = require("@mathjax/src/cjs/mathjax.js");
const { TeX } = require("@mathjax/src/cjs/input/tex.js");
const { CHTML } = require("@mathjax/src/cjs/output/chtml.js");
const { liteAdaptor } = require("@mathjax/src/cjs/adaptors/liteAdaptor.js");
const { RegisterHTMLHandler } = require("@mathjax/src/cjs/handlers/html.js");
const { AssistiveMmlHandler } = require("@mathjax/src/cjs/a11y/assistive-mml.js");
const fs = require("fs");

try {
  if (process.argv.length < 4) {
    console.error("Usage: node prerender-math.js <input_html_file> <output_html_file>");
    process.exit(1);
  }

  const inputFile = process.argv[2];
  const outputFile = process.argv[3];

  if (!fs.existsSync(inputFile)) {
    console.error(`Input file not found: ${inputFile}`);
    process.exit(1);
  }

  let htmlfile = fs.readFileSync(inputFile, "utf8");

  // Handle image width attributes from markdown: ![caption](img.jpg){width=80%}
  // Converts to <img width="80%" ...>
  htmlfile = htmlfile.replace(
    /<img([^>]*)width="([^"]*)"([^>]*)>/g,
    '<img$1$3 width="$2">'
  );
  htmlfile = htmlfile.replace(
    /<img([^>]*)data-width="([^"]*)"([^>]*)>/g,
    '<img$1$3 width="$2">'
  );
  htmlfile = htmlfile.replace(
    /<img([^>]*)\s+width=("|')?([^}"']+)("|')?([^>]*)>/gi,
    '<img$1 width="$3"$5>'
  );

  // SCOPED tag replacement: only inside math spans, not global HTML
  // This replaces \tag{N} only within <span class="math ..."> blocks
  htmlfile = htmlfile.replace(
    /(<span[^>]*class="[^"]*math[^"]*"[^>]*>)([\s\S]*?)(<\/span>)/g,
    (match, open, content, close) => {
      return open + content.replace(/\\tag\{([^}]+)\}/g, "\\text{($1)}") + close;
    }
  );

  const PACKAGES = ["base", "autoload", "require", "ams", "newcommand"];

  const adaptor = liteAdaptor();
  AssistiveMmlHandler(RegisterHTMLHandler(adaptor));

  const tex = new TeX({
    packages: PACKAGES,
    inlineMath: [["$", "$"], ["\\(", "\\)"]],
    displayMath: [["$$", "$$"], ["\\[", "\\]"]],
    tags: "none",
    tagSide: "right",
    tagIndent: "0.8em",
  });

  const chtml = new CHTML({
    fontURL: "https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2",
  });

  const html = mathjax.document(htmlfile, {
    InputJax: tex,
    OutputJax: chtml,
  });

  html.render();

  if (Array.from(html.math).length === 0) {
    if (html.outputJax.chtmlStyles) {
      adaptor.remove(html.outputJax.chtmlStyles);
    }
  }

  let renderedHtml =
    adaptor.doctype(html.document) +
    "\n" +
    adaptor.outerHTML(adaptor.root(html.document));

  // Replace inline span wrappers with block divs for display math
  renderedHtml = renderedHtml.replace(
    /<span class="math display">([\s\S]*?)<\/span>/g,
    '<div class="math display" style="display:block;text-align:center;margin:1rem auto">$1</div>'
  );

  fs.writeFileSync(outputFile, renderedHtml, "utf8");
  console.log(`Successfully pre-rendered math to ${outputFile}`);

} catch (err) {
  console.error("prerender-math.js failed:", err);
  process.exit(1);
}
