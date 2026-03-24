// ============================================================
// Backend Express Server
// ============================================================
import dotenv from "dotenv";
// Local dev: load from monorepo root. Production (Railway): env vars injected directly.
dotenv.config({ path: "../../.env", override: true });
dotenv.config({ override: true });

import express from "express";
import cors from "cors";
import { migrate } from "./db/database";
import decisionsRouter from "./routes/decisions";
import tradesRouter from "./routes/trades";
import positionsRouter from "./routes/positions";
import candlesRouter from "./routes/candles";

const app = express();
// Railway injects PORT; fall back to BACKEND_PORT for local dev
const PORT = process.env.PORT ?? process.env.BACKEND_PORT ?? 3001;

const allowedOrigins = (process.env.FRONTEND_URL ?? "http://localhost:3000").split(",").map(s => s.trim());
app.use(cors({ origin: (origin, cb) => cb(null, true) })); // Vercel preview URLs vary; restrict via FRONTEND_URL in prod if needed
app.use(express.json({ limit: "5mb" }));

// Routes
app.use("/api/trade-decisions", decisionsRouter);
app.use("/api/trades", tradesRouter);
app.use("/api", positionsRouter);
app.use("/api", candlesRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Run migrations then start server (migrate() is now async with sql.js)
migrate()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[Backend] Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("[Backend] DB init failed:", err);
    process.exit(1);
  });

export default app;
