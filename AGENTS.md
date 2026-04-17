# Markdown-to-PDF Converter

## ⚠ Maintaining AGENTS.md - Rules and Guidelines

This file is the **single source of truth** for AI agents working on this project. To prevent conflicting information and chaos, follow these rules:

### Rules for Reading
1. **Always read AGENTS.md first** before making any changes or answering questions about the project
2. Check the entire file for existing information - don't assume it's not there
3. If the file seems outdated, verify by checking the actual source code

### Rules for Creating (New Sections)
1. Only add new sections if the information doesn't fit existing categories
2. Use clear, descriptive headers that match the content
3. Add new sections at the appropriate location (not arbitrarily)
4. If unsure where to place information, add to "Notes" section

### Rules for Updating/Editing
1. **Verify before editing** - read the relevant section and surrounding context
2. **Preserve existing correct information** - don't remove unless it's wrong or outdated
3. **Update only what's necessary** - don't rewrite entire sections for minor changes
4. **Keep formatting consistent** - follow the existing style (tables, code blocks, etc.)
5. **If fixing a bug**, document it in "Known Issues and Fixes" section with:
   - Problem description
   - Root cause
   - Solution with code reference

### Rules for Deleting
1. **Never delete** - only mark as outdated if something is deprecated
2. If a solution is no longer valid, mark it but keep the history for reference

### Anti-Patterns (Don't Do)
- ❌ Adding duplicate information in multiple places
- ❌ Overwriting existing correct solutions with "newer" ideas
- ❌ Making changes without reading the file first
- ❌ Writing long explanations when a simple code reference suffices
- ❌ Removing historical fixes (they may be needed again)

---

## Project Overview
A PowerShell-based tool that converts Markdown files to professional PDFs using a 3-step pipeline: Pandoc to MathJax to Puppeteer.

## Quick Start
```powershell
./md2pdf.ps1
```
- Input: `src/md/*.md` files
- Output: `output/*.pdf` files

## Architecture

### Pipeline (md2pdf.ps1:79-89)
1. **Pandoc** - Converts Markdown to HTML using `defaults.yaml`
2. **MathJax** - Pre-renders LaTeX math equations (`scripts/prerender-math.js`)
3. **Puppeteer** - Generates final PDF (`scripts/render-pdf.js`)

### Key Files
| File | Purpose |
|------|---------|
| `md2pdf.ps1` | Main orchestrator script |
| `defaults.yaml` | Pandoc configuration (standalone HTML, CSS path) |
| `scripts/prerender-math.js` | Converts `$...$` and `$$...$$` to MathML |
| `scripts/render-pdf.js` | Headless Chrome PDF generation |
| `src/css/mdcss.css` | PDF styling (Barlow font, code blocks, tables) |

### Dependencies (package.json)
- `mathjax-full` - LaTeX math rendering
- `puppeteer` - Browser automation
- `pandoc` - Markdown to HTML (must be installed separately)

## Folder Structure
- `src/md/` - Input Markdown files
- `src/css/` - CSS styling
- `src/img/` - Image assets
- `output/` - Generated PDFs
- `scripts/` - Node.js helper scripts
- `src/done/`, `src/md trash/`, `Trash/` - Ignored folders

## Notes
- MathJax supports `$inline$` and `$$display$$` math syntax
- CSS imports Google Fonts (Barlow, JetBrains Mono)
- PDF format: A4 with 25mm margins (controlled by render-pdf.js)
- Images: Use `![caption](src/img/image.jpg)` syntax - not `[link](path)`

## Known Issues and Fixes

### Equation `\tag{}` Not Rendering
**Problem:** Using `\tag{num}` in equations (e.g., `$$\beta = x \tag{10}$$`) shows "Undefined control sequence \tag" in the PDF.

**Root Cause:** Pandoc doesn't process `\tag` (leaves it as raw TeX), and MathJax's default configuration doesn't handle the `\tag` command properly when processing HTML documents.

**Solution (scripts/prerender-math.js):** Pre-process the HTML to replace `\tag{...}` with `\text{(...)}` only inside math spans (scoped regex to avoid corrupting code blocks):
```javascript
// Replace \tag{N} only within <span class="math ..."> blocks
htmlfile = htmlfile.replace(
  /(<span[^>]*class="[^"]*math[^"]*"[^>]*>)([\s\S]*?)(<\/span>)/g,
  (match, open, content, close) => {
    return open + content.replace(/\\tag\{([^}]+)\}/g, "\\text{($1)}") + close;
  }
);
```

This transforms `\tag{10}` into `\text{(10)}` which MathJax can render correctly as the tag number appearing inline with the equation.