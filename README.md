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

## Including Images

Use Markdown image syntax to embed images in PDFs:

```markdown
![Image Caption](src/img/image.jpg)
```

Do not use link syntax `[text](path)` - images will not render.

## PDF Format

- A4, 25mm margins on all sides
- Font: Barlow (body), JetBrains Mono (code)

## Known Limitations

- Fonts are loaded from Google Fonts - offline builds may fall back to system fonts
- MathJax font glyphs are loaded from jsDelivr CDN
- PowerShell is required for the main entry point (works on Windows, macOS, Linux via `pwsh`)