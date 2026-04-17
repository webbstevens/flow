import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/request-logger", () => ({
  generateRequestId: () => "req_test_fixed",
  logRequest: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ allowed: true, remaining: 10, resetMs: 60_000 }),
}));

vi.mock("@/lib/usage", () => ({ incrementUsage: vi.fn() }));

// prisma is pulled in transitively by api-auth. We don't need it for the
// no-auth or missing-header paths, but importing it at module init would
// blow up without DATABASE_URL. Stub the module.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { apiHandler } from "@/lib/api-handler";

function makeRequest(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/v1/test", { headers });
}

describe("apiHandler — error contract end-to-end", () => {
  it("wraps an unexpected handler throw as { code: internal_error, status: 500 }", async () => {
    const route = apiHandler({ auth: false }, async () => {
      throw new Error("kaboom");
    });
    const res = await route(makeRequest(), {});
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({
      code: "internal_error",
      message: "kaboom",
      request_id: "req_test_fixed",
      docs_url: "https://docs.flow.dev/errors/internal_error",
    });
    expect(res.headers.get("X-Request-Id")).toBe("req_test_fixed");
  });

  it("maps a missing Authorization header to { code: unauthorized, status: 401 }", async () => {
    const route = apiHandler({ auth: true }, async () => Response.json({}));
    const res = await route(makeRequest(), {});
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("unauthorized");
    expect(body.request_id).toBe("req_test_fixed");
    expect(body.docs_url).toBe("https://docs.flow.dev/errors/unauthorized");
    expect(res.headers.get("X-Request-Id")).toBe("req_test_fixed");
  });

  it("propagates a handler-returned errorResponse unchanged", async () => {
    const route = apiHandler({ auth: false }, async (_req, _ctx, { requestId }) => {
      const { errorResponse } = await import("@/lib/errors");
      const { ErrorCodes } = await import("@/lib/error-codes");
      return errorResponse({
        code: ErrorCodes.VALIDATION_ERROR,
        message: "nope",
        status: 400,
        requestId,
      });
    });
    const res = await route(makeRequest(), {});
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("validation_error");
    expect(body.request_id).toBe("req_test_fixed");
  });

  it("passes through a 2xx response without wrapping", async () => {
    const route = apiHandler({ auth: false }, async () =>
      Response.json({ ok: true }),
    );
    const res = await route(makeRequest(), {});
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Request-Id")).toBe("req_test_fixed");
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});
