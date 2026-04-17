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

fs.unlinkSync(testMdPath);
if (fs.existsSync(testPdfPath)) fs.unlinkSync(testPdfPath);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);