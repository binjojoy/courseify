#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_LOG="$ROOT_DIR/backend-dev.log"
FRONTEND_LOG="$ROOT_DIR/frontend-dev.log"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required. Install Node.js 18+ and run this script again."
  exit 1
fi

echo "Installing backend dependencies..."
(cd "$BACKEND_DIR" && npm install)

echo "Installing frontend dependencies..."
(cd "$FRONTEND_DIR" && npm install)

cleanup() {
  trap - EXIT INT TERM
  [[ -n "${BACKEND_PID:-}" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  [[ -n "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting backend on http://localhost:5000..."
(cd "$BACKEND_DIR" && npm run dev) >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

echo "Starting frontend on http://localhost:5173..."
(cd "$FRONTEND_DIR" && npm run dev -- --host localhost) >"$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!

sleep 2

echo "Opening Courseify in your browser..."
if command -v powershell.exe >/dev/null 2>&1; then
  powershell.exe -NoProfile -Command "Start-Process 'http://localhost:5173/'"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:5173/" >/dev/null 2>&1 || true
elif command -v open >/dev/null 2>&1; then
  open "http://localhost:5173/" >/dev/null 2>&1 || true
else
  echo "Open http://localhost:5173/ in your browser."
fi

echo "Courseify is running. Press Ctrl+C to stop both services."
echo "Backend log: $BACKEND_LOG"
echo "Frontend log: $FRONTEND_LOG"

wait "$FRONTEND_PID"