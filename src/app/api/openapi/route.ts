import { generateOpenApiSpec } from "@/lib/openapi-spec";

// Cache-bust on each request so edits to Zod schemas surface immediately in dev.
// Generation is very fast (< 5ms) so there's no meaningful cost.
export async function GET() {
  return Response.json(generateOpenApiSpec());
}
