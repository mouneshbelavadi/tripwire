@echo off
title Tripwire: Office Pact - Breach Fail Scenario Demo
cd /d "%~dp0"

echo ======================================================================
echo       TRIPWIRE: OFFICE PACT - BREACH FAIL SCENARIO (DELAYED DEMO)
echo   "Agree on when to reconsider the office trip, check before leaving"
echo ======================================================================
echo.

:: 1. Check Node.js installation
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found in PATH!
    echo Please install Node.js v20+ from https://nodejs.org/
    pause
    exit /b 1
)

:: 2. Ensure dist server and client are built
if not exist "dist\server\index.js" (
    echo [INFO] Build artifacts missing. Running npm run build...
    call npm run build
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] npm run build failed!
        pause
        exit /b 1
    )
    echo.
)

:: 3. Run the delayed observable breach demonstration script
:: (The script automatically verifies if http://localhost:3000 is running,
::  launches the server in the background if needed, walks through the full 15-18s
::  paced breach sequence, and opens the browser to the live agreement)
echo [INFO] Starting delayed (~15-18s) observable breach demonstration...
echo.
node scripts\demo_fail.cjs

echo.
echo ======================================================================
echo Demonstration complete. Press any key to exit this console...
echo ======================================================================
pause >nul
