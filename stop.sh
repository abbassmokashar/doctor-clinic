#!/bin/bash

echo "============================================="
echo "  Stopping Doctor Clinic System"
echo "============================================="
echo ""

# Try to kill from saved PIDs first
BACKEND_PID_FILE="/tmp/doctor-clinic-backend.pid"
FRONTEND_PID_FILE="/tmp/doctor-clinic-frontend.pid"

BACKEND_KILLED=0
FRONTEND_KILLED=0

# Kill backend from PID file
if [ -f "$BACKEND_PID_FILE" ]; then
    PID=$(cat "$BACKEND_PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "[1/2] Stopping Backend Server (PID: $PID)..."
        kill "$PID" 2>/dev/null
        BACKEND_KILLED=1
    fi
    rm -f "$BACKEND_PID_FILE"
fi

# Kill frontend from PID file
if [ -f "$FRONTEND_PID_FILE" ]; then
    PID=$(cat "$FRONTEND_PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "[2/2] Stopping Frontend Server (PID: $PID)..."
        kill "$PID" 2>/dev/null
        FRONTEND_KILLED=1
    fi
    rm -f "$FRONTEND_PID_FILE"
fi

# Fallback: kill by port (using lsof on macOS, ss on Linux)
if [ "$BACKEND_KILLED" -eq 0 ]; then
    echo "[1/2] Searching for Backend Server (port 3000)..."
    # macOS
    PID=$(lsof -ti:3000 2>/dev/null)
    # Linux fallback
    if [ -z "$PID" ]; then
        PID=$(ss -tlnp 2>/dev/null | grep ':3000' | grep -oP 'pid=\K[0-9]+')
    fi
    if [ -n "$PID" ]; then
        kill "$PID" 2>/dev/null
        echo "    Backend server stopped (PID: $PID)."
        BACKEND_KILLED=1
    else
        echo "    Backend server was not running."
    fi
else
    echo "    Backend server stopped successfully."
fi

if [ "$FRONTEND_KILLED" -eq 0 ]; then
    echo "[2/2] Searching for Frontend Server (port 5173)..."
    # macOS
    PID=$(lsof -ti:5173 2>/dev/null)
    # Linux fallback
    if [ -z "$PID" ]; then
        PID=$(ss -tlnp 2>/dev/null | grep ':5173' | grep -oP 'pid=\K[0-9]+')
    fi
    if [ -n "$PID" ]; then
        kill "$PID" 2>/dev/null
        echo "    Frontend server stopped (PID: $PID)."
        FRONTEND_KILLED=1
    else
        echo "    Frontend server was not running."
    fi
else
    echo "    Frontend server stopped successfully."
fi

echo ""
echo "============================================="
echo "  System stopped successfully!"
echo "============================================="
echo ""
