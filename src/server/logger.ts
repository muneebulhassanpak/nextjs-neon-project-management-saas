import "server-only";
import pino from "pino";

import { env } from "@/env";

/** Structured JSON logs. Never log secrets or personal data. */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "stackboard" },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ["password", "*.password", "token", "*.token", "authorization", "*.authorization"],
    censor: "[redacted]",
  },
});
