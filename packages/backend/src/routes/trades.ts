// ============================================================
// POST /api/trades     — store executed trade
// GET  /api/trades     — list trades (filter by ?symbol=TSLA)
// ============================================================
import { Router, Request, Response } from "express";
import { TradeDao } from "../db/database";
import { ApiResponse, TradeRecord } from "@ai-trader/shared";

const router = Router();

router.post("/", (req: Request, res: Response) => {
  try {
    const body = req.body;
    const id = TradeDao.insert({
      symbol: body.symbol,
      side: body.side,
      qty: Number(body.qty),
      entryPrice: Number(body.entryPrice),
      stopLoss: body.stopLoss ? Number(body.stopLoss) : undefined,
      takeProfit: body.takeProfit ? Number(body.takeProfit) : undefined,
      status: body.status ?? "submitted",
      brokerId: body.brokerId,
      isPaper: body.isPaper !== false,
      decisionId: body.decisionId,
      timestamp: new Date().toISOString(),
    });

    const response: ApiResponse<{ id: number }> = { success: true, data: { id } };
    res.status(201).json(response);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/", (req: Request, res: Response) => {
  try {
    const symbol = req.query.symbol as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    const records = symbol
      ? TradeDao.findBySymbol(symbol, limit)
      : TradeDao.findAll(limit, offset);

    const response: ApiResponse<TradeRecord[]> = { success: true, data: records };
    res.json(response);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
