#!/bin/bash
# Doctor Clinic Portable — Start Script (Linux/Mac)

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

echo "============================================="
echo "  Doctor Clinic Portable"
echo "============================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed!"
    echo "  Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "$BACKEND_DIR/node_modules" ]; then
    echo "[INFO] Installing backend dependencies..."
    cd "$BACKEND_DIR" || exit 1
    npm install
    cd "$ROOT_DIR" || exit 1
fi

# Check if database exists
if [ ! -f "$BACKEND_DIR/prisma/dev.db" ]; then
    echo "[INFO] Setting up database..."
    cd "$BACKEND_DIR" || exit 1
    echo "  Generating Prisma Client..."
    node scripts/generate.js
    echo "  Creating database schema..."
    npx prisma db push --skip-generate
    echo "  Creating essential users (superadmin + admin)..."
    node prisma/seed.minimal.js
    cd "$ROOT_DIR" || exit 1
fi

echo "[1/1] Starting server on http://localhost:3000"
echo ""
echo "  Open your browser to http://localhost:3000"
echo "  To stop: press Ctrl+C in this terminal"
echo ""

cd "$BACKEND_DIR" || exit 1
node server.js
