@echo off
setlocal enabledelayedexpansion
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

:: 3. Check if server is running on http://localhost:3000
echo [*] Checking server status on http://localhost:3000...
curl.exe -s -f http://localhost:3000/api/health >nul 2>nul

if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Server not running on http://localhost:3000.
    echo [INFO] Launching Office Pact server in background...
    start "Tripwire Server" /MIN cmd /c "node dist/server/index.js"
    echo [INFO] Waiting for server on http://localhost:3000 to be ready...
    
    set ATTEMPTS=0
    :wait_server
    set /a ATTEMPTS+=1
    ping -n 2 127.0.0.1 >nul
    curl.exe -s -f http://localhost:3000/api/health >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo [OK] Server is ready on http://localhost:3000.
        goto run_demo
    )
    if !ATTEMPTS! GEQ 15 (
        echo [ERROR] Server failed to start within 15 seconds.
        pause
        exit /b 1
    )
    goto wait_server
) else (
    echo [OK] Server is already active on http://localhost:3000.
)

:run_demo
:: 4. Run the delayed observable breach demonstration script
:: (The script walks through the full 15-18s paced breach sequence,
::  and opens the browser directly to the live agreement with breach receipt)
echo [INFO] Starting delayed (~15-18s) observable breach demonstration...
echo.
node scripts\demo_fail.cjs

echo.
echo [*] Opening Microsoft Edge to view Breach Alert, Evidence Receipt, and Selectable Fallback Options...
start msedge "http://localhost:3000/pacts/pact_paytm_google_anantha?tab=decision" 2>nul || start microsoft-edge:"http://localhost:3000/pacts/pact_paytm_google_anantha?tab=decision" 2>nul || start "" "http://localhost:3000/pacts/pact_paytm_google_anantha?tab=decision"

echo.
echo ======================================================================
echo Demonstration complete. Press any key to exit this console...
echo ======================================================================
pause >nul
