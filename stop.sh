#!/bin/bash
ROOT="/Users/JCanizales/Carol Day Trayding tool/Stock cheaker"
echo "Stopping AI Day Trader..."
lsof -ti:3001 | xargs kill -9 2>/dev/null && echo "  ✅ Backend stopped"
lsof -ti:3000 | xargs kill -9 2>/dev/null && echo "  ✅ Frontend stopped"
rm -f "$ROOT/.pids/"*.pid
echo "Done."
