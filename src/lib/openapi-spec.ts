import { z } from "zod";
import { createDocument } from "zod-openapi";
import {
  classifyRequestSchema,
  classifyResponseSchema,
  createProductSchema,
  errorSchema,
  paginatedProductsSchema,
  productSchema,
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
        "API-first cross-border logistics and compliance classification engine.",
      version: "0.1.0",
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
            "Classify a product using Claude vision. Falls back to a mock response when ANTHROPIC_API_KEY is not configured.",
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
    },
  });
}
