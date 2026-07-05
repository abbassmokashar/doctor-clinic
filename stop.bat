@echo off
setlocal enabledelayedexpansion

echo =============================================
echo   Stopping Doctor Clinic System
echo =============================================
echo.

:: Kill backend process on port 3000
echo [1/2] Stopping Backend Server (port 3000)...
set "BACKEND_KILLED=0"
for /f "tokens=*" %%a in ('netstat -ano ^| findstr :3000 ^| findstr /C:"LISTEN"') do (
    for %%b in (%%a) do set "PID=%%b"
    if defined PID (
        taskkill /PID !PID! /F >nul 2>&1
        if !errorlevel! equ 0 set "BACKEND_KILLED=1"
    )
)
if !BACKEND_KILLED! equ 1 ( echo     Backend server stopped successfully. ) else ( echo     Backend server was not running. )

:: Kill frontend process on port 5173
echo [2/2] Stopping Frontend Server (port 5173)...
set "FRONTEND_KILLED=0"
for /f "tokens=*" %%a in ('netstat -ano ^| findstr :5173 ^| findstr /C:"LISTEN"') do (
    for %%b in (%%a) do set "PID=%%b"
    if defined PID (
        taskkill /PID !PID! /F >nul 2>&1
        if !errorlevel! equ 0 set "FRONTEND_KILLED=1"
    )
)
if !FRONTEND_KILLED! equ 1 ( echo     Frontend server stopped successfully. ) else ( echo     Frontend server was not running. )

:: Kill any cmd.exe windows that were started by start.bat
echo [*] Closing server terminal windows...
for /f "tokens=2 delims=," %%a in ('tasklist /FI "WINDOWTITLE eq Doctor Clinic -*" /FO CSV /NH 2^>nul') do (
    set "PID=%%~a"
    if defined PID (
        taskkill /PID !PID! /F >nul 2>&1
    )
)

echo.
echo =============================================
echo   System stopped successfully!
echo =============================================
echo.
pause
