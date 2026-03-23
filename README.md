# AI Day Trader — Complete Pipeline

> Paper-trading AI agent: market data → technical indicators → LLM reasoning → Alpaca orders → dashboard.
> **Not financial advice. Paper mode only by default.**

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  n8n Workflow (every 15 min)                                       │
│                                                                    │
│  Cron → Watchlist → Fetch Bars → Fetch News                       │
│             ↓               ↓              ↓                      │
│         Compute Indicators (SMA/EMA/RSI/MACD/BB/ATR)             │
│             ↓                                                      │
│         Build LLM Prompt (compact JSON context bundle)           │
│             ↓                                                      │
│         Claude / GPT-4 → BUY | SELL | HOLD + rationale          │
│             ↓                                                      │
│         Risk Validation (confidence, size cap, loss limit)        │
│             ↓                                                      │
│         Alpaca Paper API → bracket orders (SL + TP)              │
│             ↓                                                      │
│         Store decision + trade → SQLite                          │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────┐    ┌─────────────────────┐
│  Express Backend  │    │  Next.js Dashboard   │
│  :3001            │◄──►│  :3000               │
│  /api/decisions   │    │  PnL Card            │
│  /api/trades      │    │  Candle Chart        │
│  /api/positions   │    │  Decisions Table     │
│  /api/pnl         │    │  Positions Table     │
│  /api/candles     │    │  Trade History       │
└──────────────────┘    └─────────────────────┘
```

## Project Structure

```
Stock cheaker/
├── packages/
│   ├── shared/          # TypeScript types, constants (used by all)
│   │   └── src/
│   │       ├── types.ts        # All interfaces: Candle, Decision, Order…
│   │       └── constants.ts    # Default risk config, indicator periods
│   │
│   ├── agent/           # Core trading agent (run standalone or via n8n)
│   │   └── src/
│   │       ├── index.ts        # Entry point + config loading
│   │       ├── agent.ts        # Main orchestrator (full pipeline)
│   │       ├── broker/
│   │       │   └── alpacaClient.ts   # Alpaca REST API wrapper
│   │       ├── data/
│   │       │   ├── marketData.ts     # OHLCV bars from Alpaca Data API
│   │       │   └── newsClient.ts     # News + simple sentiment scoring
│   │       ├── indicators/
│   │       │   └── compute.ts        # SMA, EMA, RSI, MACD, BB, ATR
│   │       ├── llm/
│   │       │   ├── promptBuilder.ts  # System + user prompt templates
│   │       │   └── llmClient.ts      # Anthropic & OpenAI clients
│   │       ├── risk/
│   │       │   └── riskManager.ts    # All guardrails + order builder
│   │       └── utils/logger.ts
│   │
│   ├── backend/         # Express API server + SQLite
│   │   └── src/
│   │       ├── index.ts        # Express app setup
│   │       ├── db/
│   │       │   ├── database.ts       # SQLite layer (better-sqlite3)
│   │       │   └── migrate.ts        # Run migrations
│   │       └── routes/
│   │           ├── decisions.ts      # POST/GET /api/trade-decisions
│   │           ├── trades.ts         # POST/GET /api/trades
│   │           ├── positions.ts      # GET /api/positions, /api/pnl
│   │           └── candles.ts        # GET /api/candles (Alpaca proxy)
│   │
│   └── frontend/        # Next.js 14 dashboard
│       └── src/
│           ├── pages/index.tsx       # Main dashboard page
│           ├── components/
│           │   ├── PnlCard.tsx       # Account summary + PnL stats
│           │   ├── CandleChart.tsx   # lightweight-charts with AI markers
│           │   ├── PositionsTable.tsx
│           │   ├── DecisionsTable.tsx
│           │   └── TradesTable.tsx
│           ├── hooks/usePolling.ts   # SWR polling hook
│           └── lib/api.ts            # API fetcher util
│
├── n8n/
│   └── ai-trader-workflow.json  # Import this into your n8n instance
│
├── scripts/
│   └── setup-db.js      # One-time DB init script
│
├── .env.example         # Copy to .env — fill in your keys
└── README.md
```

---

## Quick Start

### 1. Prerequisites
- Node.js 20+
- An [Alpaca](https://alpaca.markets) account (free paper trading)
- An Anthropic API key **or** OpenAI API key

### 2. Install
```bash
# From project root:
npm install
```

### 3. Configure
```bash
cp .env.example .env
# Edit .env — fill in:
#   ALPACA_API_KEY, ALPACA_API_SECRET
#   ANTHROPIC_API_KEY (or OPENAI_API_KEY)
```

### 4. Initialize database
```bash
node scripts/setup-db.js
```

### 5. Start the backend + dashboard
```bash
npm run dev
# Backend: http://localhost:3001
# Frontend: http://localhost:3000
```

### 6. Run one agent cycle manually
```bash
npm run agent
```

---

## n8n Setup

1. Install [n8n](https://docs.n8n.io/hosting/) (cloud or self-hosted)
2. Import `n8n/ai-trader-workflow.json`
3. Create two **HTTP Header Auth** credentials in n8n:
   - **"Alpaca API Keys"**: Two headers: `APCA-API-KEY-ID` + `APCA-API-SECRET-KEY`
   - **"Anthropic API Key"**: Two headers: `x-api-key` + `anthropic-version: 2023-06-01`
4. Set environment variables in n8n:
   - `BACKEND_URL`, `MIN_CONFIDENCE`, `MAX_POSITION_PCT`, etc.
5. Activate the workflow — it runs every 15 minutes

---

## Risk Guardrails

| Guard | Default | Description |
|-------|---------|-------------|
| `MAX_POSITION_PCT` | 5% | Max equity per ticker per trade |
| `MAX_DAILY_LOSS_PCT` | 2% | Circuit breaker — stops all trading |
| `MIN_CONFIDENCE` | 0.65 | LLM confidence threshold |
| `MAX_OPEN_POSITIONS` | 5 | Max simultaneous positions |
| `MAX_ORDER_VALUE_USD` | $2,000 | Hard cap per order |
| `PAPER_MODE` | true | Logs only — no real orders |
| Market hours check | ✓ | No trading outside 9:30–15:45 ET |
| No overnight positions | ✓ | `time_in_force: "day"` always |
| No leverage | ✓ | Market orders only, no margin |
| Bracket orders | ✓ | Every trade has SL + TP |

---

## LLM Decision Schema

The LLM always returns this JSON (never anything else):

```json
{
  "decisions": [
    {
      "symbol": "TSLA",
      "action": "BUY",
      "position_size_pct": 3.5,
      "stop_loss_pct": 1.5,
      "take_profit_pct": 4.0,
      "confidence": 0.78,
      "reason": "RSI oversold at 28, MACD histogram crossing positive, strong volume surge."
    }
  ]
}
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/trade-decisions` | Store LLM decision |
| `GET` | `/api/trade-decisions?symbol=TSLA` | List decisions |
| `POST` | `/api/trades` | Store executed trade |
| `GET` | `/api/trades?symbol=TSLA` | List trades |
| `GET` | `/api/positions` | Open positions from Alpaca |
| `GET` | `/api/pnl` | Full PnL summary |
| `GET` | `/api/candles?symbol=TSLA&timeframe=5Min` | OHLCV proxy |

---

## Database Schema

```sql
-- LLM decisions (every run, including HOLDs)
CREATE TABLE decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT, action TEXT, confidence REAL,
  position_size_pct REAL, stop_loss_pct REAL, take_profit_pct REAL,
  reason TEXT, raw_context_json TEXT, llm_output_json TEXT,
  risk_check_passed INTEGER, risk_check_reason TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Placed orders
CREATE TABLE trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT, side TEXT, qty REAL, entry_price REAL,
  stop_loss REAL, take_profit REAL, status TEXT,
  broker_id TEXT, is_paper INTEGER, decision_id INTEGER,
  timestamp TEXT, filled_at TEXT, filled_avg_price REAL
);
```

---

## Supported LLM Providers

| Provider | Model | Notes |
|----------|-------|-------|
| Anthropic | `claude-opus-4-6` | Default, best reasoning |
| Anthropic | `claude-sonnet-4-5-20250929` | Faster, cheaper |
| OpenAI | `gpt-4o` | Alternative |
| Local | Any OpenAI-compatible | Set `LLM_BASE_URL` |

---

## Dashboard Features

- **PnL Card** — equity, cash, day P&L %, unrealized P&L
- **Candle Chart** — 5-min OHLCV with AI BUY/SELL markers (lightweight-charts)
- **Positions Table** — live positions with unrealized P&L
- **Decisions Table** — all LLM decisions, confidence bars, risk pass/fail
- **Trade History** — every submitted order with SL/TP levels
- **Auto-refresh** every 30 seconds
- **Per-ticker filtering** via watchlist buttons

---

## Disclaimer

This software is for **educational and paper trading purposes only**. It does not constitute financial advice. Past performance of any algorithm does not guarantee future results. Never trade with money you cannot afford to lose.
