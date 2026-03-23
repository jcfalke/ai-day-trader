#!/bin/bash
ROOT="/Users/JCanizales/Carol Day Trayding tool/Stock cheaker"
cd "$ROOT/packages/agent"
echo "================================================="
echo "  Running AI Agent (one cycle)..."
echo "================================================="
npx ts-node -r tsconfig-paths/register src/index.ts
