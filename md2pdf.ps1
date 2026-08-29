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
        $DefaultsPath = Join-Path $Root "defaults.yaml"
        $CssPath      = Join-Path $Root "src/css/mdcss.css"
        pandoc "$InputFile" -o "$TempHtml1" `
          --defaults="$DefaultsPath" `
          --resource-path="$ResourcePath" `
          --css="$CssPath" `
          --mathjax
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
        # Clean temp for THIS file only if it succeeded (and KeepTemp not set)
        if ($fileSuccess -and -not $KeepTemp) {
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