import { type NextRequest } from "next/server";
import { errorResponse } from "@/lib/errors";
import { classifyRequestSchema } from "@/lib/validation";
import { classifyWithClaude, isClaudeConfigured } from "@/lib/anthropic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = classifyRequestSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }

    if (!isClaudeConfigured()) {
      // Mock fallback for local dev without ANTHROPIC_API_KEY
      return Response.json({
        success: true,
        data: {
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
        },
      });
    }

    const classification = await classifyWithClaude(parsed.data);

    return Response.json({
      success: true,
      data: classification,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return errorResponse(message, 500);
  }
}
