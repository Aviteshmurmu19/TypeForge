# TypeForge

## Prerequisites
- Node.js >= 18 (`npm install`)
- Pandoc (system install, in PATH)
- PowerShell (`pwsh` or `powershell`)

## Commands
- `.\md2pdf.ps1` - Convert all `src/md/*.md` to `output/*.pdf`
  - Params: `-MarkdownFolder`, `-OutputFolder`, `-KeepTemp`
  - Paths are anchored to `$PSScriptRoot`, not the caller's CWD
- `npm test` runs `scripts/test-runner.js` (10 tests). It includes regression tests that enforce the `@mathjax/src` import path, display-math block wrapper, `--mathjax` Pandoc flag, Chrome file-access flags, and end-to-end PDF generation.

## Pipeline
`md2pdf.ps1` processes each `.md` file in sequence:
1. **Pandoc** (`md2pdf.ps1:90-99`) → `temp/<file>_step1.html` using `defaults.yaml`
2. **MathJax** (`md2pdf.ps1:102-105`) → `temp/<file>_step2.html` via `scripts/prerender-math.js`
3. **Puppeteer** (`md2pdf.ps1:108-111`) → `output/<file>.pdf` via `scripts/render-pdf.js`

Temp files are auto-deleted on success. Use `-KeepTemp` to preserve them for debugging.

## Repo-Specific Quirks
- `defaults.yaml` uses `embed-resources: true`, inlining base64 Google Fonts. This produces ~3MB HTML files.
- `md2pdf.ps1:94-98` passes `--mathjax` to Pandoc so raw TeX delimiters survive into HTML. Without this, Pandoc 3.x renders math to HTML entities that MathJax cannot re-parse.
- `scripts/prerender-math.js` uses `@mathjax/src` v4 with the same synchronous `mathjax.document(...)` API as v3. Do not switch back to the bundled `mathjax` package; its Node.js bundle has a Webpack scoping bug.
- `scripts/prerender-math.js:43-48` replaces `\tag{N}` with `\text{(N)}` inside math spans only (scoped regex; code blocks are untouched). This works around a MathJax limitation where `\tag{}` is not handled by default HTML configuration.
- `scripts/prerender-math.js:88-92` rewrites `<span class="math display">` to `<div class="math display" style="display:block;text-align:center;margin:1rem auto">` after rendering, because Pandoc nests display math inside inline spans.
- `scripts/render-pdf.js:16` launches Chrome with `--allow-file-access-from-files --disable-web-security` so local HTML can load MathJax fonts from `node_modules` without CORS failures.
- `render-pdf.js` uses system Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`) if present, otherwise Puppeteer's bundled Chromium.
- PDF format is A4 with 25mm margins, controlled in `render-pdf.js:28-37`, not in `defaults.yaml`.
- `src/md/*.md` and `output/*.pdf` are gitignored.
- `render-pdf.js` uses `networkidle0` with a 30s timeout; if HTML has unresolved external resources, PDF generation times out.
- `src/css/mdcss.css` is optional; if missing, Pandoc falls back to default styling and the script continues.

