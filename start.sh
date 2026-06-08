#!/bin/bash
# ExamVault — Full Stack Launcher
# Starts both backend and frontend servers

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting ExamVault..."
echo ""

# Start backend
echo "[1/2] Starting backend (port 8000)..."
source "$SCRIPT_DIR/venv/bin/activate"
export PYTHONPATH="$SCRIPT_DIR/backend"
cd "$SCRIPT_DIR/backend"
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo "  PID: $BACKEND_PID"

# Start frontend
echo "[2/2] Starting frontend (port 5173)..."
cd "$SCRIPT_DIR/frontend"
npx vite --host 0.0.0.0 &
FRONTEND_PID=$!
echo "  PID: $FRONTEND_PID"

echo ""
echo "ExamVault is running!"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8000"
echo ""
echo "Demo accounts:"
echo "  admin     / admin123    (Admin)"
echo "  teacher1  / teacher123  (Teacher)"
echo "  teacher2  / teacher123  (Teacher)"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
