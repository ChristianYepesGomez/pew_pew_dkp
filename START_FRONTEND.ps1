Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting DKP Frontend Development Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $PSScriptRoot

Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Green

    $npmVersion = npm --version
    Write-Host "NPM version: $npmVersion" -ForegroundColor Green
}
catch {
    Write-Host "ERROR: Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Node.js from: https://nodejs.org/" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Starting Vite development server..." -ForegroundColor Yellow
Write-Host "Frontend will be available at: http://localhost:5173" -ForegroundColor Green
Write-Host ""

npm run dev

Read-Host "Press Enter to exit"
