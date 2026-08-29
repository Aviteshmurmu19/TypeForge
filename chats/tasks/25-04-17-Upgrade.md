we will be upgrading this repo. your task is to read the task that are your are given in the markdown and finish the upgradation of the project. You are required to create a new branch locally and do the tasks. your task are here C:\Command_Line_Apps\Markdown-to-PDF\TASKS\25-04-17-Upgrade.md. Please proceed with it.

```markdown
# Agent Execution Plan: markdown-to-pdf

This is a sequenced task list for an autonomous agent. Each task specifies the exact file, the exact change, and a self-test to verify correctness before moving on. Complete tasks in order. Do not skip.

---

## TASK 1 - Fix silent failure in `scripts/render-pdf.js`

**File:** `scripts/render-pdf.js`

**Problem:** The catch block logs the error but exits with code 0. PowerShell cannot distinguish success from failure.

**Change:** Replace the catch block:

```javascript
// BEFORE
} catch (error) {
  console.error("An error occurred during PDF generation:", error);
} finally {
  await browser.close();
  console.log("Browser closed.");
}

// AFTER
} catch (error) {
  console.error("An error occurred during PDF generation:", error);
  await browser.close();
  console.log("Browser closed.");
  process.exit(1);
} finally {
  // finally only runs on success now
  await browser.close();
  console.log("Browser closed.");
}
```

Wait - that double-closes. Use a flag instead:

```javascript
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
```

Note `pathToFileURL` replaces the old string concatenation - this fixes space-in-path crashes on Windows.

**Self-test:** Run `node scripts/render-pdf.js nonexistent_file.html out.pdf`. Confirm the process exits with code 1. In PowerShell: `$LASTEXITCODE` should equal `1`. Confirm no `out.pdf` is created.

---

## TASK 2 - Fix silent failure in `scripts/prerender-math.js`

**File:** `scripts/prerender-math.js`

**Problem:** No error handling. An unhandled exception produces a Node stack trace but the PowerShell orchestrator may or may not catch it depending on environment.

**Change:** Wrap the entire body in a try/catch and add explicit exit on error. Also remove the dangerous global regex (see Task 6 for the proper fix - for now, disable it safely):

```javascript
const { mathjax } = require("mathjax-full/js/mathjax.js");
const { TeX } = require("mathjax-full/js/input/tex.js");
const { CHTML } = require("mathjax-full/js/output/chtml.js");
const { liteAdaptor } = require("mathjax-full/js/adaptors/liteAdaptor.js");
const { RegisterHTMLHandler } = require("mathjax-full/js/handlers/html.js");
const { AssistiveMmlHandler } = require("mathjax-full/js/a11y/assistive-mml.js");
const fs = require("fs");

(async () => {
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
      adaptor.remove(html.outputJax.chtmlStyles);
    }

    const renderedHtml =
      adaptor.doctype(html.document) +
      "\n" +
      adaptor.outerHTML(adaptor.root(html.document));

    fs.writeFileSync(outputFile, renderedHtml, "utf8");
    console.log(`Successfully pre-rendered math to ${outputFile}`);

  } catch (err) {
    console.error("prerender-math.js failed:", err);
    process.exit(1);
  }
})();
```

Note: `tags: "all"` changed to `tags: "none"`. Auto-numbering every equation without user intent is wrong default behavior.

**Self-test:** Run `node scripts/prerender-math.js nonexistent.html out.html`. Confirm exit code 1 via `$LASTEXITCODE`. Run it on a valid HTML file containing `$x^2$`. Confirm `out.html` is created and contains `mjx-container` elements.

---

## TASK 3 - Fix `md2pdf.ps1` error handling

**File:** `md2pdf.ps1`

**Problems:**
1. `$ErrorActionPreference = "Stop"` does not catch non-zero exit codes from external executables.
2. The try/catch wraps the entire loop - one failure aborts all remaining files.
3. `Read-Host` blocks automation.
4. Temp files are always deleted, even when you need them to debug a failure.
5. Paths are relative to current working directory, not script location.

**Replace the entire file with:**

```powershell
<#
.SYNOPSIS
    Converts all Markdown files from the 'src/md' folder into PDFs in the 'output' folder.

.PARAMETER MarkdownFolder
    Path to folder containing .md files. Defaults to 'src/md' relative to script.

.PARAMETER OutputFolder
    Path to folder for output PDFs. Defaults to 'output' relative to script.

.PARAMETER KeepTemp
    If set, preserves temp files on failure for debugging.

.NOTES
    Requires pandoc and Node.js (>=18) to be installed and in your system PATH.
    Run 'npm install' first.
#>

param(
    [string]$MarkdownFolder = "",
    [string]$OutputFolder = "",
    [switch]$KeepTemp
)

$ErrorActionPreference = "Stop"

# Anchor all paths to the script's own directory, not the caller's working directory
$Root = $PSScriptRoot
if ([string]::IsNullOrEmpty($MarkdownFolder)) { $MarkdownFolder = Join-Path $Root "src/md" }
if ([string]::IsNullOrEmpty($OutputFolder))   { $OutputFolder   = Join-Path $Root "output" }
$ScriptsFolder = Join-Path $Root "scripts"
$TempFolder    = Join-Path $Root "temp"

function Test-Prerequisites {
    Write-Host "Checking for required software..." -ForegroundColor Cyan
    $missing = @()
    if (-not (Get-Command pandoc -ErrorAction SilentlyContinue)) { $missing += "pandoc" }
    if (-not (Get-Command node   -ErrorAction SilentlyContinue)) { $missing += "node" }
    if ($missing.Count -gt 0) {
        Write-Host "ERROR: Missing required tools: $($missing -join ', ')" -ForegroundColor Red
        return $false
    }
    Write-Host "All required software found." -ForegroundColor Green
    return $true
}

function Assert-LastExitCode {
    param([string]$StepName)
    if ($LASTEXITCODE -ne 0) {
        throw "$StepName failed with exit code $LASTEXITCODE"
    }
}

function Assert-FileExists {
    param([string]$FilePath, [string]$StepName)
    if (-not (Test-Path $FilePath) -or (Get-Item $FilePath).Length -eq 0) {
        throw "$StepName did not produce output file: $FilePath"
    }
}

if (-not (Test-Prerequisites)) { exit 1 }

New-Item -ItemType Directory -Path $OutputFolder -Force | Out-Null
New-Item -ItemType Directory -Path $TempFolder   -Force | Out-Null

$markdownFiles = Get-ChildItem -Path $MarkdownFolder -Filter *.md
if ($markdownFiles.Count -eq 0) {
    Write-Host "No Markdown files found in '$MarkdownFolder'." -ForegroundColor Yellow
    exit 0
}

Write-Host "Found $($markdownFiles.Count) Markdown file(s) to convert."

$successCount = 0
$failCount    = 0
$failedFiles  = @()

foreach ($file in $markdownFiles) {
    $BaseName   = $file.BaseName
    $InputFile  = $file.FullName
    $TempHtml1  = Join-Path $TempFolder "$($BaseName)_step1.html"
    $TempHtml2  = Join-Path $TempFolder "$($BaseName)_step2.html"
    $FinalPdf   = Join-Path $OutputFolder "$($BaseName).pdf"

    Write-Host "--- Converting '$($file.Name)' ---" -ForegroundColor Yellow

    $fileSuccess = $false

    try {
        # Step 1: Pandoc
        Write-Host "  (1/3) Pandoc: Markdown -> HTML"
        pandoc "$InputFile" -o "$TempHtml1" --defaults "$Root/defaults.yaml"
        Assert-LastExitCode "Pandoc"
        Assert-FileExists $TempHtml1 "Pandoc"

        # Step 2: MathJax
        Write-Host "  (2/3) MathJax: Pre-rendering math"
        node (Join-Path $ScriptsFolder "prerender-math.js") "$TempHtml1" "$TempHtml2"
        Assert-LastExitCode "MathJax prerender"
        Assert-FileExists $TempHtml2 "MathJax prerender"

        # Step 3: Puppeteer
        Write-Host "  (3/3) Puppeteer: Generating PDF"
        node (Join-Path $ScriptsFolder "render-pdf.js") "$TempHtml2" "$FinalPdf"
        Assert-LastExitCode "Puppeteer PDF"
        Assert-FileExists $FinalPdf "Puppeteer PDF"

        Write-Host "  Done: '$FinalPdf'" -ForegroundColor Green
        $fileSuccess = $true
        $successCount++

    } catch {
        Write-Host "  FAILED: $($_.Exception.Message)" -ForegroundColor Red
        $failCount++
        $failedFiles += $file.Name

        if ($KeepTemp) {
            Write-Host "  Temp files preserved in: $TempFolder" -ForegroundColor Yellow
        }
    } finally {
        # Clean temp for THIS file only if it succeeded (or KeepTemp not set on failure)
        if ($fileSuccess -or -not $KeepTemp) {
            Remove-Item -Path $TempHtml1 -Force -ErrorAction SilentlyContinue
            Remove-Item -Path $TempHtml2 -Force -ErrorAction SilentlyContinue
        }
    }
}

# Summary
Write-Host "===================================================="
Write-Host "Completed: $successCount succeeded, $failCount failed." -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Yellow" })
if ($failedFiles.Count -gt 0) {
    Write-Host "Failed files:" -ForegroundColor Red
    $failedFiles | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
}
Write-Host "===================================================="

# Exit with non-zero if any file failed - CI can detect this
if ($failCount -gt 0) { exit 1 }
```

**Self-test:**
1. Run `.\md2pdf.ps1` with a valid `.md` file present. Confirm PDF is created and exit code is 0 (`echo $LASTEXITCODE`).
2. Create a file `src/md/bad.md` containing only `$$\invalid{{{`. Run the script. Confirm: bad.md reports failure, other files still convert, exit code is 1, temp files are cleaned unless `-KeepTemp` is passed.
3. Run `.\md2pdf.ps1 -KeepTemp` with a file that fails. Confirm temp HTML files remain in the `temp/` folder after the run.

---

## TASK 4 - Remove unused dependencies

**File:** `package.json`

Run these commands in the project root:
```bash
npm uninstall pandoc serve-handler
```

Then manually edit `package.json` to fix the metadata:

```json
{
  "name": "markdown-to-pdf",
  "version": "1.0.0",
  "description": "Converts Markdown files to PDFs via Pandoc, MathJax, and Puppeteer.",
  "author": "",
  "license": "ISC",
  "engines": {
    "node": ">=18"
  },
  "scripts": {
    "test": "node scripts/test-runner.js"
  },
  "dependencies": {
    "mathjax-full": "^3.2.2",
    "puppeteer": "^24.15.0"
  }
}
```

Note: `"main"` is removed entirely since there is no `index.js`. The `pandoc` npm package and `serve-handler` are gone.

**Self-test:** Run `npm install`. Confirm `node_modules` no longer contains `serve-handler` or the old `pandoc` wrapper. Run `node -e "require('puppeteer')"` - should succeed without error.

---

## TASK 5 - Fix conflicting margins

**Problem:** `mdcss.css` sets `@page { margin: 20mm }`. `render-pdf.js` sets `25mm` via Puppeteer. Both apply. The CSS value overrides Puppeteer's injected margin in some Chromium versions, producing wrong output.

**Fix:** Remove the `@page` rule from CSS. Puppeteer is the single source of truth for margins.

**File:** `src/css/mdcss.css`

Find and delete this entire block:
```css
@page {
  margin: 20mm 20mm 20mm; /* You can use mm, cm, in, or pt */
}
```

Also update `AGENTS.md` under the Notes section to reflect the correct margin value: `25mm (controlled by render-pdf.js)`.

**Self-test:** Convert a Markdown file with a long line of text. Open the PDF. Measure (or visually confirm) that all four margins appear equal and approximately 25mm. There should be no double-margin visual artifact where content is pushed far from the edge.

---

## TASK 6 - Add a `.gitignore`

**Create file:** `.gitignore` at project root:

```
node_modules/
output/
temp/
.DS_Store
Thumbs.db
*.pdf
```

**Self-test:** Run `git status` (if repo is initialized). Confirm `node_modules/`, `output/`, and `temp/` do not appear as untracked files.

---

## TASK 7 - Fix stale comment in `defaults.yaml`

**File:** `defaults.yaml`

Replace the header comment block:
```yaml
# -------------------------------------------------------------------
# Pandoc Default Settings for the Video-to-Text Project
# -------------------------------------------------------------------
# This file centralizes all our Pandoc conversion options.
```

With:
```yaml
# -------------------------------------------------------------------
# Pandoc Default Settings for markdown-to-pdf
# -------------------------------------------------------------------
# This file centralizes Pandoc conversion options for the pipeline.
# Do not add margins here - margins are controlled by render-pdf.js.
```

**Self-test:** Read the file. Confirm no reference to "Video-to-Text" remains.

---

## TASK 8 - Add timeout to Puppeteer navigation

This was already added in Task 1 (`timeout: 30000`). Confirm it is present in `render-pdf.js`:

```javascript
await page.goto(inputFile, { waitUntil: "networkidle0", timeout: 30000 });
```

If the file was correctly rewritten in Task 1, this is already done. Verify and move on.

---

## TASK 9 - Create a basic test runner

**Create file:** `scripts/test-runner.js`

This gives the agent (and CI) a way to self-test the pipeline end-to-end.

```javascript
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const testMdPath = path.join(root, "src", "md", "_test_sample.md");
const testPdfPath = path.join(root, "output", "_test_sample.pdf");

// Write a minimal test markdown file
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

// Setup
fs.mkdirSync(path.join(root, "src", "md"), { recursive: true });
fs.mkdirSync(path.join(root, "output"), { recursive: true });
fs.writeFileSync(testMdPath, testContent, "utf8");

console.log("\n=== Running markdown-to-pdf test suite ===\n");

// Test 1: prerender-math produces output
test("prerender-math.js produces output HTML", () => {
  const tempIn  = path.join(root, "temp", "_test_in.html");
  const tempOut = path.join(root, "temp", "_test_out.html");
  fs.mkdirSync(path.join(root, "temp"), { recursive: true });

  // Create a minimal HTML with math
  const html = `<!DOCTYPE html><html><body><p><span class="math inline">$x^2$</span></p></body></html>`;
  fs.writeFileSync(tempIn, html, "utf8");

  execSync(`node "${path.join(root, "scripts", "prerender-math.js")}" "${tempIn}" "${tempOut}"`, { stdio: "pipe" });

  if (!fs.existsSync(tempOut)) throw new Error("Output file not created");
  const content = fs.readFileSync(tempOut, "utf8");
  if (!content.includes("mjx-container")) throw new Error("MathJax output not found in rendered HTML");

  fs.unlinkSync(tempIn);
  fs.unlinkSync(tempOut);
});

// Test 2: prerender-math exits 1 on missing input
test("prerender-math.js exits with code 1 on missing input", () => {
  try {
    execSync(`node "${path.join(root, "scripts", "prerender-math.js")}" "nonexistent_xyz.html" "out.html"`, { stdio: "pipe" });
    throw new Error("Should have thrown");
  } catch (e) {
    if (e.status !== 1) throw new Error(`Expected exit code 1, got ${e.status}`);
  }
});

// Test 3: render-pdf exits 1 on missing input
test("render-pdf.js exits with code 1 on missing input", () => {
  try {
    execSync(`node "${path.join(root, "scripts", "render-pdf.js")}" "nonexistent_xyz.html" "out.pdf"`, { stdio: "pipe" });
    throw new Error("Should have thrown");
  } catch (e) {
    if (e.status !== 1) throw new Error(`Expected exit code 1, got ${e.status}`);
  }
});

// Test 4: tag replacement does not corrupt code blocks
test("\\tag{} replacement does not touch code block content", () => {
  const tempIn  = path.join(root, "temp", "_test_tag_in.html");
  const tempOut = path.join(root, "temp", "_test_tag_out.html");
  fs.mkdirSync(path.join(root, "temp"), { recursive: true });

  // Code block containing \tag - must not be modified
  const html = `<!DOCTYPE html><html><body><pre><code>use \\tag{1} here</code></pre></body></html>`;
  fs.writeFileSync(tempIn, html, "utf8");

  execSync(`node "${path.join(root, "scripts", "prerender-math.js")}" "${tempIn}" "${tempOut}"`, { stdio: "pipe" });

  const content = fs.readFileSync(tempOut, "utf8");
  if (!content.includes("\\tag{1}")) throw new Error("Code block content was corrupted by tag replacement");

  fs.unlinkSync(tempIn);
  fs.unlinkSync(tempOut);
});

// Cleanup test md
fs.unlinkSync(testMdPath);
if (fs.existsSync(testPdfPath)) fs.unlinkSync(testPdfPath);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
```

**Self-test:** Run `npm test`. All 4 tests should pass. If Test 4 fails, the `\tag{}` scoping in Task 2 is not working correctly - revisit the regex in `prerender-math.js`.

---

## TASK 10 - Create `README.md`

**Create file:** `README.md` at project root:

```markdown
# markdown-to-pdf

Converts Markdown files (including LaTeX math) to professional PDFs using a three-step pipeline:

1. **Pandoc** - Converts `.md` to standalone HTML
2. **MathJax** - Pre-renders LaTeX math to static CHTML
3. **Puppeteer** - Renders the HTML to PDF via headless Chromium

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Pandoc](https://pandoc.org/installing.html) (system install, must be in PATH)

## Setup

```bash
npm install
```

## Usage

Place `.md` files in `src/md/`. Then run:

```powershell
.\md2pdf.ps1
```

Output PDFs are written to `output/`.

### Options

```powershell
.\md2pdf.ps1 -MarkdownFolder "my/docs" -OutputFolder "my/pdfs"
.\md2pdf.ps1 -KeepTemp   # Preserves temp HTML files on failure for debugging
```

## Running Tests

```bash
npm test
```

## Supported Math Syntax

- Inline: `$x^2$` or `\(x^2\)`
- Display: `$$x^2$$` or `\[x^2\]`

## PDF Format

- A4, 25mm margins on all sides
- Font: Barlow (body), JetBrains Mono (code)

## Known Limitations

- Fonts are loaded from Google Fonts - offline builds may fall back to system fonts
- MathJax font glyphs are loaded from jsDelivr CDN
- PowerShell is required for the main entry point (works on Windows, macOS, Linux via `pwsh`)
```

---

## Final Verification Checklist

After completing all tasks, run through this list in order:

1. `npm test` - all tests pass, exit code 0.
2. Run `.\md2pdf.ps1` with one valid `.md` file - PDF created, exit code 0.
3. Run `.\md2pdf.ps1` with a corrupted `.md` file (e.g., binary garbage) alongside a valid one - the valid file converts successfully, the bad one logs failure, exit code is 1.
4. Run `.\md2pdf.ps1 -KeepTemp` with a file that fails - confirm temp HTML files remain in `temp/`.
5. Open a generated PDF containing a fenced code block that mentions `\tag{1}` in prose. Confirm the text reads `\tag{1}` and has not been mutated to `\text{(1)}`.
6. Open a generated PDF. Confirm margins are visually consistent on all four sides (approximately 25mm). No extreme top/bottom vs side margin difference.
7. Run `git status` - confirm `node_modules/`, `output/`, `temp/` are not listed as untracked.
8. `node -e "require('serve-handler')"` - should throw `MODULE_NOT_FOUND`. Confirms removal succeeded.
```