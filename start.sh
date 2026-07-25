#!/bin/bash

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

echo "============================================="
echo "  Doctor Clinic Management System"
echo "============================================="
echo ""

# Check if .env file exists in backend
if [ ! -f "$BACKEND_DIR/.env" ]; then
    if [ -f "$BACKEND_DIR/.env.example" ]; then
        echo "[WARN] No .env file found. Copying .env.example to .env..."
        cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
    else
        echo "[WARN] No .env file found in backend folder."
        echo "    The app will use default values, but some features may not work."
        echo "    Create a .env file in the backend directory if needed."
    fi
    echo ""
fi

# Check if backend node_modules exist
if [ ! -d "$BACKEND_DIR/node_modules" ]; then
    echo "[INFO] Installing backend dependencies..."
    cd "$BACKEND_DIR" || { echo "[ERROR] Backend directory not found"; exit 1; }
    npm install
    if [ $? -ne 0 ]; then
        echo "[ERROR] Backend dependencies installation failed!"
        exit 1
    fi
    cd "$ROOT_DIR" || exit 1
fi

# Check if frontend node_modules exist
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "[INFO] Installing frontend dependencies..."
    cd "$FRONTEND_DIR" || { echo "[ERROR] Frontend directory not found"; exit 1; }
    npm install
    if [ $? -ne 0 ]; then
        echo "[ERROR] Frontend dependencies installation failed!"
        exit 1
    fi
    cd "$ROOT_DIR" || exit 1
fi

echo "[1/3] Starting Backend Server (port 3000)..."
cd "$BACKEND_DIR" || { echo "[ERROR] Backend directory not found"; exit 1; }
npm run dev &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"

# Small delay to let backend start first
sleep 3

echo "[2/3] Starting Frontend Server (port 5173)..."
cd "$FRONTEND_DIR" || { echo "[ERROR] Frontend directory not found"; exit 1; }
npm run dev &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID"

# Save PIDs to a file for stop.sh to use
echo "$BACKEND_PID" > /tmp/doctor-clinic-backend.pid
echo "$FRONTEND_PID" > /tmp/doctor-clinic-frontend.pid

# Trap Ctrl+C / SIGTERM to clean up background processes
cleanup() {
    echo ""
    echo "Shutting down..."
    kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
    rm -f /tmp/doctor-clinic-backend.pid /tmp/doctor-clinic-frontend.pid
    exit 0
}
trap cleanup SIGINT SIGTERM

echo "[3/3] Starting Reminder Scheduler (included in backend)..."
echo ""
echo "============================================="
echo "  System is starting up!"
echo ""
echo "  Backend API:  http://localhost:3000"
echo "  Frontend App: http://localhost:5173"
echo ""
echo "  To stop: run ./stop.sh or press Ctrl+C"
echo "============================================="
echo ""

# Return to root directory
cd "$ROOT_DIR" || exit 1

# Wait for background processes
wait
