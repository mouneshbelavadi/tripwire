@echo off
title Tripwire: Office Pact - BEYOND 9TO5
cd /d "%~dp0"

echo ======================================================================
echo           TRIPWIRE: OFFICE PACT - BEYOND 9TO5 BENGALURU
echo   "Agree on when to reconsider the office trip, check before leaving"
echo ======================================================================
echo.

:: 1. Check Node.js installation
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found in PATH!
    echo Please install Node.js v20+ from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. Check npm installation
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not found in PATH!
    echo.
    pause
    exit /b 1
)

:: 3. Check for .env file; create from .env.example if missing
if not exist ".env" (
    echo [INFO] .env file not found. Creating default from .env.example...
    copy ".env.example" ".env" >nul
    echo [INFO] Default .env created. You can add your live API keys to .env anytime.
    echo.
)

:: 4. Check for node_modules; install if missing
if not exist "node_modules" (
    echo [INFO] node_modules not found. Installing dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] npm install failed!
        pause
        exit /b 1
    )
    echo.
)

:: 5. Default port if not set in environment
if not defined PORT set PORT=3000

:: 6. Ensure client and server bundles are built and up-to-date
echo [INFO] Building production client and server bundles...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build failed! Check TypeScript errors above.
    pause
    exit /b 1
)
echo [OK] Production build complete.
echo.

:: 7. Launch default browser after 2 seconds
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:%PORT%"

:: 8. Start application server
echo ======================================================================
echo [READY] Office Pact server starting on http://localhost:%PORT%
echo         Browser will open automatically in 2 seconds.
echo         Press Ctrl+C to stop the server at any time.
echo ======================================================================
echo.

node dist/server/index.js

pause
