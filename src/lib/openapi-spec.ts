import { z } from "zod";
import { createDocument } from "zod-openapi";
import {
  classifyRequestSchema,
  classifyResponseSchema,
  createProductSchema,
  errorSchema,
  historyResponseSchema,
  paginatedProductsSchema,
  precedentsResponseSchema,
  productSchema,
  rationaleResponseSchema,
  updateProductSchema,
} from "./validation";

const errorResponse = (description: string) => ({
  description,
  content: {
    "application/json": { schema: errorSchema },
  },
});

export function generateOpenApiSpec() {
  return createDocument({
    openapi: "3.1.0",
    info: {
      title: "Flow Marketplace Engine API",
      description:
        "API-first cross-border logistics and compliance classification engine.\n\n" +
        "### Audit-grade output\n\n" +
        "`POST /compliance/classify` is the lean, low-latency primary call — it returns the HS code, compliance envelope, and documentation requirements in a single response. For customers who need a full audit trail (brokers, enterprise compliance), two lazy GET endpoints produce the justification material on demand:\n\n" +
        "- `GET /compliance/classify/{id}/rationale` — General Rules of Interpretation (GRI 1–6) step analysis plus section/chapter notes reviewed.\n" +
        "- `GET /compliance/classify/{id}/precedents` — CBP CROSS ruling precedents for the classification (closed beta in v1).\n\n" +
        "Both follow the same lifecycle as documentation requirements: `flow_validating` (LLM-generated) → `verified` (reconciled against an authoritative source) → `manual_override` (operator-edited).",
      version: "0.2.0",
      contact: { name: "Flow Team" },
    },
    servers: [
      { url: "/", description: "This deployment" },
      { url: "http://localhost:3000", description: "Local development" },
    ],
    security: [],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "sk_flow_...",
          description:
            "Flow API key issued from the /account page. Pass as `Authorization: Bearer sk_flow_...`",
        },
      },
    },
    paths: {
      "/api/v1/products": {
        post: {
          operationId: "createProduct",
          summary: "Create a product with variants",
          description:
            "Transactionally creates a parent product and its child variants.",
          tags: ["Products"],
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: createProductSchema },
            },
          },
          responses: {
            "201": {
              description: "Product created",
              content: {
                "application/json": { schema: productSchema },
              },
            },
            "400": errorResponse("Validation error"),
            "401": errorResponse("Missing or invalid API key"),
            "500": errorResponse("Internal server error"),
          },
        },
        get: {
          operationId: "listProducts",
          summary: "List products",
          description:
            "Paginated list of products with nested variants. Excludes soft-deleted.",
          tags: ["Products"],
          security: [{ BearerAuth: [] }],
          requestParams: {
            query: z.object({
              page: z.coerce.number().int().min(1).default(1).optional(),
              limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
              seller_id: z.string().uuid().optional(),
            }),
          },
          responses: {
            "200": {
              description: "Paginated product list",
              content: {
                "application/json": { schema: paginatedProductsSchema },
              },
            },
            "400": errorResponse("Invalid query parameters"),
            "500": errorResponse("Internal server error"),
          },
        },
      },
      "/api/v1/products/{id}": {
        patch: {
          operationId: "updateProduct",
          summary: "Update product (human override)",
          description:
            "Partial update. Automatically sets requires_review to false.",
          tags: ["Products"],
          security: [{ BearerAuth: [] }],
          requestParams: {
            path: z.object({
              id: z.string().uuid(),
            }),
          },
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: updateProductSchema },
            },
          },
          responses: {
            "200": {
              description: "Product updated",
              content: {
                "application/json": { schema: productSchema },
              },
            },
            "400": errorResponse("Validation error"),
            "404": errorResponse("Product not found"),
            "500": errorResponse("Internal server error"),
          },
        },
      },
      "/api/v1/compliance/classify": {
        post: {
          operationId: "classifyProduct",
          summary: "AI compliance classification",
          description:
            "Classify a product using Claude vision. Accepts a product page URL (scraped server-side), a title/description payload, or base64 images. The evaluated image is persisted to Supabase Storage and the result is saved to `classification_records`. Falls back to a mock response when ANTHROPIC_API_KEY is not configured.",
          tags: ["Compliance"],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: classifyRequestSchema },
            },
          },
          responses: {
            "200": {
              description: "Classification result",
              content: {
                "application/json": { schema: classifyResponseSchema },
              },
            },
            "400": errorResponse("Validation error"),
            "500": errorResponse("Internal server error"),
          },
        },
      },
      "/api/v1/compliance/classify/{id}/rationale": {
        get: {
          operationId: "getClassificationRationale",
          summary: "Audit-grade classification rationale (GRI analysis)",
          description:
            "Returns the legal reasoning behind the classification: the General Rules of Interpretation (GRIs 1–6) that were applied, the outcome of each step, and any section/chapter notes that were reviewed. Lazy — first call generates via Claude and persists a cached row keyed on `(hs_code, attributes_hash)`; subsequent calls (including any record with the same product attributes) hit the cache. Lifecycle: `flow_validating` → `verified` → `manual_override`. Accepts either a Bearer API key or a session cookie; the record must belong to the caller's workspace.",
          tags: ["Compliance", "Audit"],
          security: [{ BearerAuth: [] }],
          requestParams: {
            path: z.object({
              id: z.string().uuid().meta({
                description: "Classification record id (from POST /classify).",
              }),
            }),
          },
          responses: {
            "200": {
              description: "Rationale envelope",
              content: {
                "application/json": { schema: rationaleResponseSchema },
              },
            },
            "401": errorResponse("Authentication required"),
            "404": errorResponse(
              "Record not found or not owned by this workspace",
            ),
            "429": errorResponse("Rate limit exceeded"),
            "502": errorResponse("Rationale generation failed"),
          },
        },
      },
      "/api/v1/compliance/classify/{id}/precedents": {
        get: {
          operationId: "getClassificationPrecedents",
          summary: "CROSS ruling precedents (closed beta)",
          description:
            "Returns CBP CROSS (Customs Rulings Online) precedent matches for the record's HS code + product attributes. **v1 is a stub** — the response shape is stable but the `rulings` array is empty and a `notice` field explains the closed-beta state. When the real fetcher ships, existing integrations pick up populated rulings automatically. Cached per `(HS6, query_hash)` so sibling subheadings share results. Accepts either a Bearer API key or a session cookie.",
          tags: ["Compliance", "Audit"],
          security: [{ BearerAuth: [] }],
          requestParams: {
            path: z.object({
              id: z.string().uuid().meta({
                description: "Classification record id.",
              }),
            }),
          },
          responses: {
            "200": {
              description: "Precedents envelope",
              content: {
                "application/json": { schema: precedentsResponseSchema },
              },
            },
            "401": errorResponse("Authentication required"),
            "404": errorResponse(
              "Record not found or not owned by this workspace",
            ),
            "429": errorResponse("Rate limit exceeded"),
            "502": errorResponse("Precedents lookup failed"),
          },
        },
      },
      "/api/v1/compliance/history": {
        get: {
          operationId: "listClassificationHistory",
          summary: "Recent classifications for the current workspace",
          description:
            "Returns the workspace's recent `ClassificationRecord` entries, newest first. Each entry includes a public URL to the evaluated image (if persistence was enabled at classification time).",
          tags: ["Compliance"],
          requestParams: {
            query: z.object({
              page: z.coerce.number().int().min(1).default(1).optional(),
              limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
            }),
          },
          responses: {
            "200": {
              description: "Paginated history list",
              content: {
                "application/json": { schema: historyResponseSchema },
              },
            },
            "500": errorResponse("Internal server error"),
          },
        },
      },
    },
  });
}
