// ============================================================
// SQLite Database Layer — sql.js (pure WebAssembly, no native build)
// Persists to disk after every write via fs.writeFileSync.
// ============================================================
import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import fs from "fs";
import path from "path";
import { DecisionRecord, TradeRecord } from "@ai-trader/shared";

const DB_PATH =
  process.env.DB_PATH ?? path.join(process.cwd(), "data", "trader.db");

// Ensure data directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

// Singleton db instance (initialized async, held sync after that)
let _db: SqlJsDatabase | null = null;

/** Load or create the database (call once at startup). */
export async function initDb(): Promise<SqlJsDatabase> {
  if (_db) return _db;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(fileBuffer);
  } else {
    _db = new SQL.Database();
  }
  _db.run("PRAGMA foreign_keys = ON;");
  return _db;
}

/** Return the singleton — throws if initDb() hasn't been awaited yet. */
export function getDb(): SqlJsDatabase {
  if (!_db) throw new Error("Database not initialized — call initDb() first");
  return _db;
}

/** Flush in-memory state to disk. Call after every write. */
function persist(): void {
  if (!_db) return;
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ------------------------------------------------------------
// Schema Migration
// ------------------------------------------------------------
export async function migrate(): Promise<void> {
  const db = await initDb();
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

  persist();
  console.log("[DB] Migration complete →", DB_PATH);
}

// ------------------------------------------------------------
// Low-level helpers (sql.js uses a different query API than better-sqlite3)
// ------------------------------------------------------------

/** Run a SELECT and return rows as plain objects */
function queryAll<T>(sql: string, params: (string | number | null)[] = []): T[] {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return rows;
}

/** Run an INSERT/UPDATE/DELETE and return lastInsertRowid */
function run(sql: string, params: (string | number | null)[] = []): number {
  const db = getDb();
  db.run(sql, params);
  const idResult = db.exec("SELECT last_insert_rowid() AS id");
  persist();
  return (idResult[0]?.values[0]?.[0] as number) ?? 0;
}

// ------------------------------------------------------------
// Decision DAO
// ------------------------------------------------------------
export const DecisionDao = {
  insert(record: Omit<DecisionRecord, "id" | "createdAt">): number {
    return run(
      `INSERT INTO decisions (symbol, action, confidence, position_size_pct,
        stop_loss_pct, take_profit_pct, reason, raw_context_json, llm_output_json,
        risk_check_passed, risk_check_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.symbol,
        record.action,
        record.confidence,
        record.positionSizePct,
        record.stopLossPct,
        record.takeProfitPct,
        record.reason,
        record.rawContextJson,
        record.llmOutputJson,
        record.riskCheckPassed ? 1 : 0,
        record.riskCheckReason ?? null,
      ]
    );
  },

  findBySymbol(symbol: string, limit = 50): DecisionRecord[] {
    const rows = queryAll<any>(
      `SELECT * FROM decisions WHERE symbol = ? ORDER BY created_at DESC LIMIT ?`,
      [symbol, limit]
    );
    return rows.map(mapDecisionRow);
  },

  findAll(limit = 100, offset = 0): DecisionRecord[] {
    const rows = queryAll<any>(
      `SELECT * FROM decisions ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    return rows.map(mapDecisionRow);
  },

  count(): number {
    const rows = queryAll<any>(`SELECT COUNT(*) AS "count" FROM decisions`);
    return (rows[0]?.count as number) ?? 0;
  },
};

function mapDecisionRow(r: any): DecisionRecord {
  return {
    id: r.id,
    symbol: r.symbol,
    action: r.action,
    confidence: r.confidence,
    positionSizePct: r.position_size_pct,
    stopLossPct: r.stop_loss_pct,
    takeProfitPct: r.take_profit_pct,
    reason: r.reason,
    rawContextJson: r.raw_context_json,
    llmOutputJson: r.llm_output_json,
    riskCheckPassed: Boolean(r.risk_check_passed),
    riskCheckReason: r.risk_check_reason,
    createdAt: r.created_at,
  };
}

// ------------------------------------------------------------
// Trade DAO
// ------------------------------------------------------------
export const TradeDao = {
  insert(record: Omit<TradeRecord, "id">): number {
    return run(
      `INSERT INTO trades (symbol, side, qty, entry_price, stop_loss, take_profit,
        status, broker_id, is_paper, decision_id, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.symbol,
        record.side,
        record.qty,
        record.entryPrice,
        record.stopLoss ?? null,
        record.takeProfit ?? null,
        record.status,
        record.brokerId ?? null,
        record.isPaper ? 1 : 0,
        record.decisionId ?? null,
        record.timestamp,
      ]
    );
  },

  findBySymbol(symbol: string, limit = 50): TradeRecord[] {
    const rows = queryAll<any>(
      `SELECT * FROM trades WHERE symbol = ? ORDER BY timestamp DESC LIMIT ?`,
      [symbol, limit]
    );
    return rows.map(mapTradeRow);
  },

  findAll(limit = 100, offset = 0): TradeRecord[] {
    const rows = queryAll<any>(
      `SELECT * FROM trades ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    return rows.map(mapTradeRow);
  },

  updateStatus(
    id: number,
    status: string,
    filledAt?: string,
    filledAvgPrice?: number
  ): void {
    const db = getDb();
    db.run(
      `UPDATE trades SET status = ?, filled_at = ?, filled_avg_price = ? WHERE id = ?`,
      [status, filledAt ?? null, filledAvgPrice ?? null, id]
    );
    persist();
  },
};

function mapTradeRow(r: any): TradeRecord {
  return {
    id: r.id,
    symbol: r.symbol,
    side: r.side,
    qty: r.qty,
    entryPrice: r.entry_price,
    stopLoss: r.stop_loss,
    takeProfit: r.take_profit,
    status: r.status,
    brokerId: r.broker_id,
    isPaper: Boolean(r.is_paper),
    decisionId: r.decision_id,
    timestamp: r.timestamp,
    filledAt: r.filled_at,
    filledAvgPrice: r.filled_avg_price,
  };
}
