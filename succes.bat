@echo off
setlocal enabledelayedexpansion
title Tripwire: Office Pact - Rapid Success Scenario
cd /d "%~dp0"

echo ======================================================================
echo           TRIPWIRE: OFFICE PACT - ALL-CLEAR DEMO SCENARIO
echo   Rapid (~10s) Invariant Verification for Kabir ^& Ananya (Paytm)
echo ======================================================================
echo.

:: 1. Check if server is running on http://localhost:3000
echo [*] Checking server status on http://localhost:3000...
curl.exe -s -f http://localhost:3000/api/health >nul 2>nul

if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Server not running on http://localhost:3000.
    if not exist "dist\server\index.js" (
        echo [INFO] Building server bundle...
        call npm run build:server
    )
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
echo.
node scripts/demo_success.cjs

echo.
echo [*] Opening Microsoft Edge to http://localhost:3000?arrived=true...
start msedge "http://localhost:3000?arrived=true" 2>nul || start microsoft-edge:"http://localhost:3000?arrived=true" 2>nul || start "" "http://localhost:3000?arrived=true"

echo.
echo ======================================================================
echo   Demo sequence completed.
echo ======================================================================
if "%1"=="" pause
