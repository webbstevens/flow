import { describe, it, expect, beforeEach, vi } from "vitest";

type IdempotencyRow = {
  workspaceId: string;
  method: string;
  path: string;
  key: string;
  requestHash: string;
  statusCode: number | null;
  responseBody: unknown;
  responseHeaders: Record<string, string> | null;
  lockedAt: Date;
  completedAt: Date | null;
  expiresAt: Date;
};

const store = new Map<string, IdempotencyRow>();
function rowKey(r: { workspaceId: string; method: string; path: string; key: string }) {
  return `${r.workspaceId}|${r.method}|${r.path}|${r.key}`;
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    idempotencyKey: {
      create: vi.fn(async ({ data }: { data: Partial<IdempotencyRow> & Pick<IdempotencyRow, "workspaceId" | "method" | "path" | "key" | "requestHash" | "lockedAt" | "expiresAt"> }) => {
        const k = rowKey(data);
        if (store.has(k)) {
          const err = new Error("unique constraint") as Error & { code: string };
          err.code = "P2002";
          throw err;
        }
        const row: IdempotencyRow = {
          statusCode: data.statusCode ?? null,
          responseBody: data.responseBody ?? null,
          responseHeaders: data.responseHeaders ?? null,
          completedAt: data.completedAt ?? null,
          workspaceId: data.workspaceId,
          method: data.method,
          path: data.path,
          key: data.key,
          requestHash: data.requestHash,
          lockedAt: data.lockedAt,
          expiresAt: data.expiresAt,
        };
        store.set(k, row);
        return row;
      }),
      findUnique: vi.fn(async ({ where }: { where: { workspaceId_method_path_key: IdempotencyRow } }) => {
        const w = where.workspaceId_method_path_key;
        return store.get(rowKey(w)) ?? null;
      }),
      update: vi.fn(async ({ where, data }: { where: { workspaceId_method_path_key: IdempotencyRow }; data: Partial<IdempotencyRow> }) => {
        const k = rowKey(where.workspaceId_method_path_key);
        const row = store.get(k);
        if (!row) throw new Error("not found");
        Object.assign(row, data);
        return row;
      }),
      delete: vi.fn(async ({ where }: { where: { workspaceId_method_path_key: IdempotencyRow } }) => {
        const k = rowKey(where.workspaceId_method_path_key);
        const row = store.get(k);
        if (!row) throw new Error("not found");
        store.delete(k);
        return row;
      }),
    },
  },
}));

import {
  acquireIdempotencyLock,
  finalizeIdempotencyLock,
} from "@/lib/idempotency";

const WS = "11111111-1111-1111-1111-111111111111";

function makeCtx(overrides: Partial<Parameters<typeof acquireIdempotencyLock>[0]> = {}) {
  return {
    workspaceId: WS,
    method: "POST",
    path: "/api/v1/products",
    key: "idem_abc",
    requestBody: JSON.stringify({ name: "widget" }),
    requestId: "req_test_1",
    ...overrides,
  };
}

describe("idempotency — lock acquisition", () => {
  beforeEach(() => {
    store.clear();
  });

  it("returns fresh on first use; row is written", async () => {
    const res = await acquireIdempotencyLock(makeCtx());
    expect(res.kind).toBe("fresh");
    expect(store.size).toBe(1);
  });

  it("replays a completed response on duplicate key with matching hash", async () => {
    const ctx = makeCtx();
    await acquireIdempotencyLock(ctx);
    const response = Response.json({ id: "p_1" }, { status: 201 });
    await finalizeIdempotencyLock(ctx, response);

    const replay = await acquireIdempotencyLock(ctx);
    expect(replay.kind).toBe("replay");
    if (replay.kind !== "replay") return;
    expect(replay.response.status).toBe(201);
    expect(replay.response.headers.get("Idempotent-Replayed")).toBe("true");
    const body = await replay.response.json();
    expect(body).toEqual({ id: "p_1" });
  });

  it("returns 422 idempotency_conflict on same key + different body", async () => {
    const ctx = makeCtx();
    await acquireIdempotencyLock(ctx);
    const response = Response.json({ id: "p_1" }, { status: 201 });
    await finalizeIdempotencyLock(ctx, response);

    const bad = await acquireIdempotencyLock(
      makeCtx({ requestBody: JSON.stringify({ name: "different" }) }),
    );
    expect(bad.kind).toBe("error");
    if (bad.kind !== "error") return;
    expect(bad.response.status).toBe(422);
    const body = await bad.response.json();
    expect(body.code).toBe("idempotency_conflict");
  });

  it("returns 409 idempotency_in_progress when row is locked but not completed", async () => {
    const ctx = makeCtx();
    await acquireIdempotencyLock(ctx);
    // don't call finalize — the row stays locked

    const second = await acquireIdempotencyLock(ctx);
    expect(second.kind).toBe("error");
    if (second.kind !== "error") return;
    expect(second.response.status).toBe(409);
    const body = await second.response.json();
    expect(body.code).toBe("idempotency_in_progress");
  });

  it("rejects empty keys with 400 validation_error", async () => {
    const res = await acquireIdempotencyLock(makeCtx({ key: "" }));
    expect(res.kind).toBe("error");
    if (res.kind !== "error") return;
    expect(res.response.status).toBe(400);
  });

  it("rejects keys longer than 255 chars with 400 validation_error", async () => {
    const res = await acquireIdempotencyLock(makeCtx({ key: "x".repeat(256) }));
    expect(res.kind).toBe("error");
    if (res.kind !== "error") return;
    expect(res.response.status).toBe(400);
  });

  it("scopes keys per (workspace, method, path) — same key on different path is independent", async () => {
    await acquireIdempotencyLock(makeCtx());
    const other = await acquireIdempotencyLock(
      makeCtx({ path: "/api/v1/products/abc" }),
    );
    expect(other.kind).toBe("fresh");
    expect(store.size).toBe(2);
  });
});

describe("idempotency — finalize", () => {
  beforeEach(() => {
    store.clear();
  });

  it("stores a 2xx response for later replay", async () => {
    const ctx = makeCtx();
    await acquireIdempotencyLock(ctx);
    await finalizeIdempotencyLock(ctx, Response.json({ ok: true }, { status: 200 }));
    const row = store.get(rowKey(ctx));
    expect(row?.statusCode).toBe(200);
    expect(row?.completedAt).toBeInstanceOf(Date);
  });

  it("stores a 4xx response for later replay", async () => {
    const ctx = makeCtx();
    await acquireIdempotencyLock(ctx);
    await finalizeIdempotencyLock(
      ctx,
      Response.json({ code: "validation_error" }, { status: 400 }),
    );
    const row = store.get(rowKey(ctx));
    expect(row?.statusCode).toBe(400);
  });

  it("deletes the lock on 5xx so the client can retry", async () => {
    const ctx = makeCtx();
    await acquireIdempotencyLock(ctx);
    await finalizeIdempotencyLock(
      ctx,
      Response.json({ code: "internal_error" }, { status: 500 }),
    );
    expect(store.size).toBe(0);
  });

  it("returns a response with the original body readable after finalize", async () => {
    const ctx = makeCtx();
    await acquireIdempotencyLock(ctx);
    const original = Response.json({ id: "p_1" }, { status: 201 });
    const finalized = await finalizeIdempotencyLock(ctx, original);
    const body = await finalized.json();
    expect(body).toEqual({ id: "p_1" });
  });
});
