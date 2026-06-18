@echo off
echo Starting Doctor Clinic Management System...
echo.

echo [1/2] Starting Backend Server...
start "Doctor Clinic - Backend" cmd /c "cd /d "%~dp0backend" && npm run dev"

echo [2/2] Starting Frontend Server...
start "Doctor Clinic - Frontend" cmd /c "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Both servers are starting up!
echo Backend:  http://localhost:3000
echo Frontend: http://localhost:5173
echo.
echo Close these windows to stop the servers.
pause
