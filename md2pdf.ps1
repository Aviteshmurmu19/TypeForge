<#
.SYNOPSIS
    Converts all Markdown files from the 'src/md' folder into PDFs in the 'output' folder.

.DESCRIPTION
    This script automates a professional-grade conversion workflow:
    1.  Checks if required software (pandoc, node) is installed.
    2.  Creates 'output' and 'temp' directories if they don't exist.
    3.  Loops through every .md file in 'src/md/'.
    4.  For each file, it runs the pandoc -> MathJax -> Puppeteer pipeline.
    5.  Cleans up all temporary files after completion.

.NOTES
    Requires pandoc and Node.js to be installed and in your system's PATH.
    Run your 'npm install' first. Place this script in the project root.
#>

# Stop the script immediately if any command fails
$ErrorActionPreference = "Stop"

# --- 1. Prerequisite Checks ---
function Test-Prerequisites {
    Write-Host "Checking for required software..." -ForegroundColor Cyan
    $missing = @()
    if (-not (Get-Command pandoc -ErrorAction SilentlyContinue)) { $missing += "pandoc" }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { $missing += "node" }

    if ($missing.Count -gt 0) {
        Write-Host "----------------------------------------------------" -ForegroundColor Red
        Write-Host "ERROR: Required software is missing or not in your PATH." -ForegroundColor Red
        $missing | ForEach-Object { Write-Host " - $_" }
        Write-Host "Please install the missing software and try again." -ForegroundColor Red
        Write-Host "----------------------------------------------------"
        return $false
    }
    Write-Host "All required software found." -ForegroundColor Green
    return $true
}

# --- 2. Define Folder Paths ---
$ScriptsFolder = "scripts"
$MarkdownFolder = "src/md"
$CssFile = "src/css/mdcss.css"
$OutputFolder = "output"
$TempFolder = "temp"

# --- 3. Main Execution Block ---
if (-not (Test-Prerequisites)) {
    Read-Host -Prompt "Press Enter to exit"
    exit 1
}

try {
    # Create necessary directories
    Write-Host "Setting up project directories..."
    New-Item -ItemType Directory -Path $OutputFolder -Force | Out-Null
    New-Item -ItemType Directory -Path $TempFolder -Force | Out-Null

    # Find all Markdown files to process
    $markdownFiles = Get-ChildItem -Path $MarkdownFolder -Filter *.md
    if ($markdownFiles.Count -eq 0) {
        throw "No Markdown files found in '$MarkdownFolder'. Nothing to convert."
    }

    Write-Host "Found $($markdownFiles.Count) Markdown file(s) to convert."

    # Loop through each Markdown file
    foreach ($file in $markdownFiles) {
        $BaseName = $file.BaseName
        $InputFile = $file.FullName
        
        Write-Host "--- Starting conversion for '$($file.Name)' ---" -ForegroundColor Yellow

        # Define file paths for the current loop iteration
        $TempHtml1 = Join-Path $TempFolder "$($BaseName)_step1.html"
        $TempHtml2 = Join-Path $TempFolder "$($BaseName)_step2.html"
        $FinalPdf = Join-Path $OutputFolder "$($BaseName).pdf"

        # Step A: Run Pandoc
        Write-Host "  (1/3) Converting Markdown to HTML with Pandoc..."
        pandoc $InputFile -o $TempHtml1 --defaults defaults.yaml
        
        # Step B: Pre-render MathJax with Node.js
        Write-Host "  (2/3) Pre-rendering LaTeX math with MathJax..."
        node (Join-Path $ScriptsFolder "prerender-math.js") $TempHtml1 $TempHtml2
        
        # Step C: Generate PDF with Puppeteer (Node.js)
        Write-Host "  (3/3) Generating final PDF with Puppeteer..."
        node (Join-Path $ScriptsFolder "render-pdf.js") $TempHtml2 $FinalPdf

        Write-Host "--- Successfully created '$FinalPdf' ---" -ForegroundColor Green
    }
    
    Write-Host "===================================================="
    Write-Host "All conversions complete!" -ForegroundColor Green
    Write-Host "===================================================="

}
catch {
    # If any command fails, this block will run
    Write-Host "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" -ForegroundColor Red
    Write-Host "An error occurred during the conversion process:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" -ForegroundColor Red
}
finally {
    # This block ALWAYS runs, ensuring cleanup happens
    Write-Host "Cleaning up temporary files..."
    if (Test-Path $TempFolder) {
        Remove-Item -Recurse -Path $TempFolder -Force
        Write-Host "Removed temporary directory: '$TempFolder'"
    }
    Write-Host "Cleanup complete."
}

# Pause the script at the very end so the user can see the result
Read-Host -Prompt "Process finished. Press Enter to exit"