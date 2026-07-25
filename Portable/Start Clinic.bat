@echo off
title Doctor Clinic Portable
setlocal enabledelayedexpansion

set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%backend"

echo =============================================
echo   Doctor Clinic Portable
echo =============================================
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo   Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Install dependencies if needed
if not exist "%BACKEND_DIR%\node_modules" (
    echo [INFO] Installing backend dependencies...
    cd /d "%BACKEND_DIR%"
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies!
        pause
        exit /b 1
    )
    :: Re-patch @prisma/client/default.js (Node v24 dotfile workaround)
    > "%BACKEND_DIR%\node_modules\@prisma\client\default.js" echo const path=require('path');
    >>"%BACKEND_DIR%\node_modules\@prisma\client\default.js" echo module.exports={...require(path.join(__dirname,'.prisma/client/default'))}
    cd /d "%ROOT_DIR%"
)

:: Check if database exists
set "DB_FILE=%BACKEND_DIR%\prisma\dev.db"
if not exist "!DB_FILE!" (
    echo [INFO] Setting up database...
    cd /d "%BACKEND_DIR%"
    echo   Generating Prisma Client...
    call node scripts\generate.js
    echo   Creating database schema...
    call npx prisma db push --skip-generate
    echo   Creating essential users (superadmin + admin)...
    call node prisma\seed.minimal.js
    cd /d "%ROOT_DIR%"
)

:: Regenerate Prisma Client to ensure correct output path
echo [INFO] Building Prisma Client...
cd /d "%BACKEND_DIR%"
call npx prisma generate
if errorlevel 1 (
    echo [ERROR] Failed to generate Prisma Client!
    echo   Try running: cd backend ^&^& npx prisma generate
    pause
    exit /b 1
)
cd /d "%ROOT_DIR%"

echo [1/1] Starting server on http://localhost:3000
echo.
echo   Open your browser to http://localhost:3000
echo   To stop: double-click stop.vbs or close this window
echo.

cd /d "%BACKEND_DIR%"
call node server.js

pause
