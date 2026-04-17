import { randomUUID } from "crypto";
import { prisma } from "./prisma";

export function generateRequestId(): string {
  return `req_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

/**
 * Log a completed API request. Fire-and-forget (non-blocking).
 */
export function logRequest(data: {
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  responseMs: number;
  keyPrefix?: string | null;
  workspaceId?: string | null;
  errorMsg?: string | null;
}) {
  prisma.requestLog
    .create({
      data: {
        requestId: data.requestId,
        method: data.method,
        path: data.path,
        statusCode: data.statusCode,
        responseMs: data.responseMs,
        keyPrefix: data.keyPrefix ?? null,
        workspaceId: data.workspaceId ?? null,
        errorMsg: data.errorMsg ?? null,
      },
    })
    .catch((err) => {
      console.error("[request-logger] Failed to log:", err.message);
    });
}
