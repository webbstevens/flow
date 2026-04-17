import { type NextRequest } from "next/server";
import { errorResponse } from "@/lib/errors";
import { classifyRequestSchema } from "@/lib/validation";
import { classifyWithClaude, isClaudeConfigured } from "@/lib/anthropic";
import { generateRequestId, logRequest } from "@/lib/request-logger";
import { incrementUsage } from "@/lib/usage";
import { getWorkspaceId } from "@/lib/session";

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const start = Date.now();
  let statusCode = 500;
  let errorMsg: string | undefined;

  try {
    const body = await request.json();
    const parsed = classifyRequestSchema.safeParse(body);

    if (!parsed.success) {
      statusCode = 400;
      const res = errorResponse(parsed.error.issues[0].message, 400);
      res.headers.set("X-Request-Id", requestId);
      return res;
    }

    let result;
    if (!isClaudeConfigured()) {
      result = {
        hs_code: "6109.10.0012",
        mid_code: "MIDCN12345",
        confidence_score: 87,
        requires_review: false,
        ai_attributes: {
          material: "100% Cotton",
          garment_type: "T-Shirt",
          gender: "Unisex",
          season: "All-Season",
          note: "Mock response - set ANTHROPIC_API_KEY for real classification",
        },
      };
    } else {
      result = await classifyWithClaude(parsed.data);
    }

    statusCode = 200;

    // Meter if we can identify a workspace (via cookie or bearer)
    try {
      const wsId = await getWorkspaceId();
      if (wsId) incrementUsage(wsId, "classify");
    } catch {
      /* anonymous — skip metering */
    }

    const res = Response.json({ success: true, data: result });
    res.headers.set("X-Request-Id", requestId);
    return res;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    errorMsg = message;
    const res = errorResponse(message, 500);
    res.headers.set("X-Request-Id", requestId);
    return res;
  } finally {
    logRequest({
      requestId,
      method: "POST",
      path: "/api/v1/compliance/classify",
      statusCode,
      responseMs: Date.now() - start,
      errorMsg,
    });
  }
}
