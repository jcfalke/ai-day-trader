#!/usr/bin/env node
// Quick setup script — run with: node scripts/setup-db.js
// Uses sql.js (pure WebAssembly — no native compilation needed)
const path = require("path");
const fs = require("fs");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const DB_PATH =
  process.env.DB_PATH ?? path.join(__dirname, "../data/trader.db");

// Ensure data dir
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log("[Setup] Created data directory:", dataDir);
}

async function setup() {
  const initSqlJs = require("sql.js");
  const SQL = await initSqlJs();

  let db;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log("[Setup] Opened existing database:", DB_PATH);
  } else {
    db = new SQL.Database();
    console.log("[Setup] Creating new database:", DB_PATH);
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      action TEXT NOT NULL,
      confidence REAL NOT NULL,
      position_size_pct REAL NOT NULL,
      stop_loss_pct REAL NOT NULL,
      take_profit_pct REAL NOT NULL,
      reason TEXT NOT NULL,
      raw_context_json TEXT NOT NULL,
      llm_output_json TEXT NOT NULL,
      risk_check_passed INTEGER NOT NULL DEFAULT 1,
      risk_check_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_decisions_symbol ON decisions(symbol);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_decisions_created_at ON decisions(created_at);`);

  db.run(`
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL,
      qty REAL NOT NULL,
      entry_price REAL NOT NULL,
      stop_loss REAL,
      take_profit REAL,
      status TEXT NOT NULL DEFAULT 'pending',
      broker_id TEXT,
      is_paper INTEGER NOT NULL DEFAULT 1,
      decision_id INTEGER REFERENCES decisions(id),
      timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      filled_at TEXT,
      filled_avg_price REAL
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);`);

  // Persist to disk
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  db.close();

  console.log("[Setup] ✓ Tables: decisions, trades");
  console.log("[Setup] ✓ Database saved to:", DB_PATH);
  console.log("\n[Setup] ✓ Complete! Next steps:");
  console.log("  1. cp .env.example .env");
  console.log("  2. Fill in your API keys in .env");
  console.log("  3. npm run dev    (starts backend :3001 + frontend :3000)");
  console.log("  4. npm run agent  (run one agent cycle manually)");
}

setup().catch((err) => {
  console.error("[Setup] Failed:", err.message);
  process.exit(1);
});
