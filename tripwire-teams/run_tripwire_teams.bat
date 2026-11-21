@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

echo ================================================================
echo                   TRIPWIRE TEAMS - ONE-CLICK RUNNER             
echo   Automated Commute Tripwires & Bilateral Remote Office Pacts   
echo ================================================================
echo.

:: 1. Validate Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in your system PATH!
    echo Please install Node.js 20 or higher from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. Validate Node.js version is >= 20
node -e "process.exit(parseInt(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)"
if %errorlevel% neq 0 (
    echo [ERROR] Node.js version 20 or higher is required!
    echo Current installed version:
    node -v
    echo Please upgrade Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)
echo [OK] Node.js runtime validated:
node -v

:: 3. Check for .env file
if not exist .env (
    echo [WARNING] No .env file found in tripwire-teams.
    if exist .env.example (
        echo [INFO] Creating .env from .env.example template...
        copy .env.example .env >nul
        echo [OK] Created .env file. Please edit it with your Slack and Google credentials.
    ) else (
        echo [ERROR] Neither .env nor .env.example was found!
        pause
        exit /b 1
    )
) else (
    echo [OK] Environment configuration file (.env) detected.
)

:: 4. Verify node_modules
if not exist node_modules (
    echo [INFO] Dependencies not found. Running npm install...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed!
        pause
        exit /b 1
    )
)

:: 5. Generate Prisma Client if needed
if not exist node_modules\.prisma\client (
    echo [INFO] Generating Prisma ORM Client...
    call npx prisma generate
)

:: 6. Start the Tripwire Teams Master Server
echo.
echo ================================================================
echo               STARTING TRIPWIRE TEAMS MASTER SERVER             
echo ================================================================
echo   [Web UI]    http://localhost:3000/
echo   [Health]    http://localhost:3000/health
echo   [Privacy]   http://localhost:3000/privacy
echo   [Security]  http://localhost:3000/security
echo   [OAuth]     http://localhost:3000/oauth/google/callback
echo ================================================================
echo.

call npx tsx src/index.ts

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Tripwire Teams server exited with code %errorlevel%.
    pause
)
