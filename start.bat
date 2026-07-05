@echo off
setlocal enabledelayedexpansion

set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%backend"
set "FRONTEND_DIR=%ROOT_DIR%frontend"

echo =============================================
echo   Doctor Clinic Management System
echo =============================================
echo.

:: Check if .env file exists in backend
if not exist "%BACKEND_DIR%\.env" (
    if exist "%BACKEND_DIR%\.env.example" (
        echo [WARN] No .env file found. Copying .env.example to .env...
        copy "%BACKEND_DIR%\.env.example" "%BACKEND_DIR%\.env" >nul
    ) else (
        echo [WARN] No .env file found in backend folder.
        echo     The app will use default values, but some features may not work.
        echo     Create a .env file in the backend directory if needed.
    )
    echo.
)

:: Check if backend node_modules exist
if not exist "%BACKEND_DIR%\node_modules" (
    echo [INFO] Installing backend dependencies...
    cd /d "%BACKEND_DIR%"
    call npm install
    if errorlevel 1 (
        echo [ERROR] Backend dependencies installation failed!
        pause
        exit /b 1
    )
    cd /d "%ROOT_DIR%"
)

:: Check if frontend node_modules exist
if not exist "%FRONTEND_DIR%\node_modules" (
    echo [INFO] Installing frontend dependencies...
    cd /d "%FRONTEND_DIR%"
    call npm install
    if errorlevel 1 (
        echo [ERROR] Frontend dependencies installation failed!
        pause
        exit /b 1
    )
    cd /d "%ROOT_DIR%"
)

echo [1/3] Starting Backend Server (port 3000)...
start "Doctor Clinic - Backend" cmd /c "cd /d "%BACKEND_DIR%" && echo Backend starting on http://localhost:3000 && npm run dev"

:: Small delay to let backend start first
timeout /t 3 /nobreak >nul

echo [2/3] Starting Frontend Server (port 5173)...
start "Doctor Clinic - Frontend" cmd /c "cd /d "%FRONTEND_DIR%" && echo Frontend starting on http://localhost:5173 && npm run dev"

echo [3/3] Starting Reminder Scheduler (included in backend)...
echo.
echo =============================================
echo   System is starting up!
echo.
echo   Backend API:  http://localhost:3000
echo   Frontend App: http://localhost:5173
echo.
echo   To stop: run stop.bat or close the server windows.
echo =============================================
echo.
pause
