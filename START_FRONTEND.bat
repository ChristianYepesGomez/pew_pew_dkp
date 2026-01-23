@echo off
echo ========================================
echo Starting DKP Frontend Development Server
echo ========================================
echo.

cd /d "%~dp0"

echo Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo Node.js version:
node --version

echo NPM version:
npm --version

echo.
echo Starting Vite development server...
echo Frontend will be available at: http://localhost:5173
echo.

npm run dev

pause
