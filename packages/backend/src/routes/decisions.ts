// ============================================================
// POST /api/trade-decisions  — store LLM decision
// GET  /api/trade-decisions  — list (filter by ?symbol=TSLA)
// ============================================================
import { Router, Request, Response } from "express";
import { DecisionDao } from "../db/database";
import { ApiResponse, DecisionRecord } from "@ai-trader/shared";

const router = Router();

router.post("/", (req: Request, res: Response) => {
  try {
    const body = req.body;
    const id = DecisionDao.insert({
      symbol: body.symbol,
      action: body.action,
      confidence: Number(body.confidence),
      positionSizePct: Number(body.positionSizePct),
      stopLossPct: Number(body.stopLossPct),
      takeProfitPct: Number(body.takeProfitPct),
      reason: body.reason ?? "",
      rawContextJson: body.rawContextJson ?? "{}",
      llmOutputJson: body.llmOutputJson ?? "{}",
      riskCheckPassed: body.riskCheckPassed !== false,
      riskCheckReason: body.riskCheckReason,
    });

    const response: ApiResponse<{ id: number }> = {
      success: true,
      data: { id },
    };
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
      ? DecisionDao.findBySymbol(symbol, limit)
      : DecisionDao.findAll(limit, offset);

    const total = DecisionDao.count();
    const response: ApiResponse<DecisionRecord[]> = {
      success: true,
      data: records,
      meta: { total, page: Math.floor(offset / limit) + 1, pageSize: limit },
    };
    res.json(response);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
