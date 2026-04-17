import { describe, it, expect } from "vitest";
import { errorResponse } from "@/lib/errors";
import { ErrorCodes } from "@/lib/error-codes";

describe("errorResponse — VISION.md §4.8 standard error contract", () => {
  it("returns a JSON body with { code, message, request_id, docs_url }", async () => {
    const res = errorResponse({
      code: ErrorCodes.VALIDATION_ERROR,
      message: "bad input",
      status: 400,
      requestId: "req_test_123",
    });
    const body = await res.json();
    expect(body).toEqual({
      code: "validation_error",
      message: "bad input",
      request_id: "req_test_123",
      docs_url: "https://docs.flow.dev/errors/validation_error",
    });
  });

  it("sets the HTTP status from the `status` field", () => {
    const res = errorResponse({
      code: ErrorCodes.NOT_FOUND,
      message: "nope",
      status: 404,
      requestId: "req_x",
    });
    expect(res.status).toBe(404);
  });

  it("sets X-Request-Id header to match the body request_id", async () => {
    const res = errorResponse({
      code: ErrorCodes.INTERNAL_ERROR,
      message: "boom",
      status: 500,
      requestId: "req_abc",
    });
    expect(res.headers.get("X-Request-Id")).toBe("req_abc");
    const body = await res.json();
    expect(body.request_id).toBe("req_abc");
  });

  it("generates a request_id when none is passed (body + header in sync)", async () => {
    const res = errorResponse({
      code: ErrorCodes.INTERNAL_ERROR,
      message: "boom",
      status: 500,
    });
    const headerId = res.headers.get("X-Request-Id");
    const body = await res.json();
    expect(headerId).toBeTruthy();
    expect(body.request_id).toBe(headerId);
  });

  it("allows overriding docs_url explicitly", async () => {
    const res = errorResponse({
      code: ErrorCodes.UPSTREAM_ERROR,
      message: "vendor down",
      status: 502,
      requestId: "req_y",
      docsUrl: "https://docs.flow.dev/errors/upstream_error#anthropic",
    });
    const body = await res.json();
    expect(body.docs_url).toBe(
      "https://docs.flow.dev/errors/upstream_error#anthropic",
    );
  });

  it("defaults docs_url to the code-indexed URL", async () => {
    const res = errorResponse({
      code: ErrorCodes.RATE_LIMITED,
      message: "slow down",
      status: 429,
      requestId: "req_z",
    });
    const body = await res.json();
    expect(body.docs_url).toBe("https://docs.flow.dev/errors/rate_limited");
  });

  it("does not include the legacy `error: true` field", async () => {
    const res = errorResponse({
      code: ErrorCodes.VALIDATION_ERROR,
      message: "bad",
      status: 400,
      requestId: "req_q",
    });
    const body = await res.json();
    expect(body).not.toHaveProperty("error");
  });
});
