#!/bin/bash
ROOT="/Users/JCanizales/Carol Day Trayding tool/Stock cheaker"
cd "$ROOT"
mkdir -p logs

echo "Stopping any previous instances..."
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null
sleep 1

echo "▶ Starting backend (port 3001)..."
cd "$ROOT/packages/backend"
npm run dev > "$ROOT/logs/backend.log" 2>&1 &

echo "▶ Waiting for backend..."
for i in {1..10}; do
  sleep 1
  if /usr/bin/curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "  ✅ Backend ready"
    break
  fi
done

echo "▶ Starting frontend (port 3000)..."
cd "$ROOT/packages/frontend"
npm run dev > "$ROOT/logs/frontend.log" 2>&1 &
sleep 4

echo ""
echo "========================================"
echo "  ✅ AI Day Trader is running!"
echo ""
echo "  Open:  http://localhost:3000"
echo "  API:   http://localhost:3001/api/health"
echo ""
echo "  To stop: bash '$ROOT/stop.sh'"
echo "========================================"
open http://localhost:3000
