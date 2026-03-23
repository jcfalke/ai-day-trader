// ============================================================
// Winston Logger
// ============================================================
import { createLogger, format, transports } from "winston";
import path from "path";

const logDir = process.env.LOG_DIR ?? path.join(process.cwd(), "logs");

export const logger = createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: "ai-trader-agent" },
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ timestamp, level, message, ...meta }) => {
          const extras = Object.keys(meta).length
            ? " " + JSON.stringify(meta)
            : "";
          return `[${timestamp}] ${level}: ${message}${extras}`;
        })
      ),
    }),
    new transports.File({
      filename: path.join(logDir, "agent-error.log"),
      level: "error",
    }),
    new transports.File({
      filename: path.join(logDir, "agent-combined.log"),
    }),
  ],
});
