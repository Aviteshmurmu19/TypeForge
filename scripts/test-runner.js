const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const testMdPath = path.join(root, "src", "md", "_test_sample.md");
const testPdfPath = path.join(root, "output", "_test_sample.pdf");

const testContent = `# Test Document

This is a test paragraph.

Inline math: $x^2 + y^2 = z^2$

Display math:

$$E = mc^2$$

A code block that mentions latex syntax:

\`\`\`
The \tag{1} command in LaTeX is used for equation numbering.
\`\`\`

| Column A | Column B |
|----------|----------|
| Value 1  | Value 2  |
`;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (e) {
    console.error(`  FAIL: ${name}`);
    console.error(`        ${e.message}`);
    failed++;
  }
}

fs.mkdirSync(path.join(root, "src", "md"), { recursive: true });
fs.mkdirSync(path.join(root, "output"), { recursive: true });
fs.writeFileSync(testMdPath, testContent, "utf8");

console.log("\n=== Running markdown-to-pdf test suite ===\n");

test("prerender-math.js produces output HTML", () => {
  const tempIn  = path.join(root, "temp", "_test_in.html");
  const tempOut = path.join(root, "temp", "_test_out.html");
  fs.mkdirSync(path.join(root, "temp"), { recursive: true });

  const html = `<!DOCTYPE html><html><body><p><span class="math inline">$x^2$</span></p></body></html>`;
  fs.writeFileSync(tempIn, html, "utf8");

  execSync(`node "${path.join(root, "scripts", "prerender-math.js")}" "${tempIn}" "${tempOut}"`, { stdio: "pipe" });

  if (!fs.existsSync(tempOut)) throw new Error("Output file not created");
  const content = fs.readFileSync(tempOut, "utf8");
  if (!content.includes("mjx-container")) throw new Error("MathJax output not found in rendered HTML");

  fs.unlinkSync(tempIn);
  fs.unlinkSync(tempOut);
});

test("prerender-math.js exits with code 1 on missing input", () => {
  try {
    execSync(`node "${path.join(root, "scripts", "prerender-math.js")}" "nonexistent_xyz.html" "out.html"`, { stdio: "pipe" });
    throw new Error("Should have thrown");
  } catch (e) {
    if (e.status !== 1) throw new Error(`Expected exit code 1, got ${e.status}`);
  }
});

test("render-pdf exits 1 on missing input", () => {
  try {
    execSync(`node "${path.join(root, "scripts", "render-pdf.js")}" "nonexistent_xyz.html" "out.pdf"`, { stdio: "pipe" });
    throw new Error("Should have thrown");
  } catch (e) {
    if (e.status !== 1) throw new Error(`Expected exit code 1, got ${e.status}`);
  }
});

test("\\tag{} replacement does not touch code block content", () => {
  const tempIn  = path.join(root, "temp", "_test_tag_in.html");
  const tempOut = path.join(root, "temp", "_test_tag_out.html");
  fs.mkdirSync(path.join(root, "temp"), { recursive: true });

  const html = `<!DOCTYPE html><html><body><pre><code>use \\tag{1} here</code></pre></body></html>`;
  fs.writeFileSync(tempIn, html, "utf8");

  execSync(`node "${path.join(root, "scripts", "prerender-math.js")}" "${tempIn}" "${tempOut}"`, { stdio: "pipe" });

  const content = fs.readFileSync(tempOut, "utf8");
  if (!content.includes("\\tag{1}")) throw new Error("Code block content was corrupted by tag replacement");

  fs.unlinkSync(tempIn);
  fs.unlinkSync(tempOut);
});

test("prerender-math.js uses @mathjax/src, not bundled mathjax", () => {
  const scriptPath = path.join(root, "scripts", "prerender-math.js");
  const content = fs.readFileSync(scriptPath, "utf8");
  if (!content.includes('require("@mathjax/src/cjs/mathjax.js")')) throw new Error("Missing @mathjax/src/cjs/mathjax.js import");
  if (!content.includes('require("@mathjax/src/cjs/input/tex.js")')) throw new Error("Missing @mathjax/src/cjs/input/tex.js import");
  if (!content.includes('require("@mathjax/src/cjs/output/chtml.js")')) throw new Error("Missing @mathjax/src/cjs/output/chtml.js import");
  if (content.includes('require("mathjax-full")')) throw new Error("Still using deprecated mathjax-full package");
  if (content.includes('require("mathjax")')) throw new Error("Should not use bundled mathjax package in prerender-math.js");
});

test("display math is wrapped in block div after prerender", () => {
  const tempIn  = path.join(root, "temp", "_test_display_in.html");
  const tempOut = path.join(root, "temp", "_test_display_out.html");
  fs.mkdirSync(path.join(root, "temp"), { recursive: true });

  const html = `<!DOCTYPE html><html><body><p><span class="math display">$$d = \\alpha * x + \\beta * y$$</span></p></body></html>`;
  fs.writeFileSync(tempIn, html, "utf8");

  execSync(`node "${path.join(root, "scripts", "prerender-math.js")}" "${tempIn}" "${tempOut}"`, { stdio: "pipe" });

  const content = fs.readFileSync(tempOut, "utf8");
  if (!content.includes('<div class="math display"')) throw new Error("Display math not wrapped in block div");
  if (!content.includes("style=\"display:block;text-align:center;margin:1rem auto\"")) throw new Error("Display math missing expected inline style");

  fs.unlinkSync(tempIn);
  fs.unlinkSync(tempOut);
});

test("md2pdf.ps1 passes --mathjax flag to Pandoc", () => {
  const scriptPath = path.join(root, "md2pdf.ps1");
  const content = fs.readFileSync(scriptPath, "utf8");
  if (!content.includes("--mathjax")) throw new Error("md2pdf.ps1 missing --mathjax flag");
});

test("render-pdf.js launches Chrome with file-access flags", () => {
  const scriptPath = path.join(root, "scripts", "render-pdf.js");
  const content = fs.readFileSync(scriptPath, "utf8");
  if (!content.includes("--allow-file-access-from-files")) throw new Error("Missing --allow-file-access-from-files");
  if (!content.includes("--disable-web-security")) throw new Error("Missing --disable-web-security");
});

test("package.json uses @mathjax/src and @mathjax/mathjax-newcm-font", () => {
  const pkgPath = path.join(root, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  if (!pkg.dependencies["@mathjax/src"]) throw new Error("Missing @mathjax/src dependency");
  if (!pkg.dependencies["@mathjax/mathjax-newcm-font"]) throw new Error("Missing @mathjax/mathjax-newcm-font dependency");
  if (pkg.dependencies["mathjax-full"]) throw new Error("Remove deprecated mathjax-full dependency");
  if (pkg.dependencies["mathjax"]) throw new Error("Remove bundled mathjax dependency; use @mathjax/src instead");
});

test("full pipeline produces PDF with visible equation markers", () => {
  const testMdPath = path.join(root, "src", "md", "_test_pipeline.md");
  const testPdfPath = path.join(root, "output", "_test_pipeline.pdf");
  fs.mkdirSync(path.join(root, "src", "md"), { recursive: true });
  fs.mkdirSync(path.join(root, "output"), { recursive: true });
  fs.writeFileSync(testMdPath, testContent, "utf8");

  try {
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${path.join(root, "md2pdf.ps1")}" -KeepTemp`, { stdio: "pipe" });

    if (!fs.existsSync(testPdfPath)) throw new Error("PDF not generated");
    const stats = fs.statSync(testPdfPath);
    if (stats.size < 1000) throw new Error(`PDF too small: ${stats.size} bytes`);

    const step2Path = path.join(root, "temp", "_test_pipeline_step2.html");
    if (!fs.existsSync(step2Path)) throw new Error("Step2 HTML not preserved");
    const step2 = fs.readFileSync(step2Path, "utf8");
    if (!step2.includes("mjx-container")) throw new Error("Step2 HTML missing mjx-container");
    if (!step2.includes('<div class="math display"')) throw new Error("Step2 HTML missing display math div wrapper");
  } finally {
    if (fs.existsSync(testMdPath)) fs.unlinkSync(testMdPath);
    if (fs.existsSync(testPdfPath)) fs.unlinkSync(testPdfPath);
    const step2Path = path.join(root, "temp", "_test_pipeline_step2.html");
    if (fs.existsSync(step2Path)) fs.unlinkSync(step2Path);
  }
});

fs.unlinkSync(testMdPath);
if (fs.existsSync(testPdfPath)) fs.unlinkSync(testPdfPath);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);