import { z } from "zod";

const iso2Country = z
  .string()
  .length(2)
  .toUpperCase()
  .meta({
    description: "ISO 3166-1 alpha-2 country code",
    example: "US",
  })
  .optional();

export const variantInputSchema = z
  .object({
    sku: z.string().min(1).meta({ example: "TST-001" }),
    price: z.number().positive().meta({ example: 29.99 }),
    weightKg: z.number().nonnegative().meta({ example: 0.25 }).optional(),
    lengthCm: z.number().nonnegative().optional(),
    widthCm: z.number().nonnegative().optional(),
    heightCm: z.number().nonnegative().optional(),
    attributes: z
      .record(z.string(), z.any())
      .meta({ example: { color: "black", size: "L" } })
      .optional(),
  })
  .meta({ id: "VariantInput" });

export const createProductSchema = z
  .object({
    sellerId: z.string().uuid().meta({ example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" }),
    title: z.string().min(1).meta({ example: "Organic cotton t-shirt" }),
    description: z.string().optional(),
    brand: z.string().optional(),
    category: z.string().optional(),
    countryOfOrigin: iso2Country,
    hsCode: z.string().optional(),
    midCode: z.string().optional(),
    aiAttributes: z.record(z.string(), z.any()).optional(),
    aiConfidenceScore: z.number().int().min(0).max(100).optional(),
    requiresReview: z.boolean().optional(),
    variants: z.array(variantInputSchema).min(1),
  })
  .meta({ id: "CreateProductRequest" });

export const updateProductSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    brand: z.string().optional(),
    category: z.string().optional(),
    countryOfOrigin: iso2Country,
    hsCode: z.string().optional(),
    midCode: z.string().optional(),
    aiAttributes: z.record(z.string(), z.any()).optional(),
    aiConfidenceScore: z.number().int().min(0).max(100).optional(),
  })
  .meta({ id: "UpdateProductRequest" });

export const classifyRequestSchema = z
  .object({
    productId: z.string().uuid().optional(),
    productUrl: z
      .string()
      .transform((v) => {
        // Normalize bare domains: gymshark.com/... → https://gymshark.com/...
        if (v && !/^https?:\/\//i.test(v)) {
          return `https://${v}`;
        }
        return v;
      })
      .pipe(z.string().url())
      .meta({
        description:
          "URL of a product page (protocol optional — bare domains like gymshark.com/... are accepted). The server will fetch it, extract title/description/brand/image from meta tags + JSON-LD, and classify.",
        example: "https://www.example.com/products/organic-cotton-tee",
      })
      .optional(),
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    brand: z.string().optional(),
    originCountry: iso2Country,
    destinationCountry: iso2Country,
    images: z
      .array(z.string().min(1))
      .meta({
        description: "Base64 data URLs or HTTPS image URLs",
        example: ["data:image/jpeg;base64,/9j/..."],
      })
      .optional(),
  })
  .refine(
    (v) =>
      Boolean(v.title) ||
      Boolean(v.productUrl) ||
      (v.images && v.images.length > 0),
    {
      message: "One of 'title', 'productUrl', or 'images' is required",
      path: ["productUrl"],
    },
  )
  .meta({
    id: "ClassifyRequest",
    description:
      "One of `title`, `productUrl`, or at least one image in `images` must be provided.",
  });

// Response schemas (used for docs only — routes currently return Prisma types directly)

export const variantSchema = z
  .object({
    id: z.string().uuid(),
    productId: z.string().uuid(),
    sku: z.string(),
    price: z.string().meta({ description: "Decimal as string for precision" }),
    weightKg: z.string().nullable(),
    lengthCm: z.string().nullable(),
    widthCm: z.string().nullable(),
    heightCm: z.string().nullable(),
    attributes: z.record(z.string(), z.any()).nullable(),
  })
  .meta({ id: "Variant" });

export const productSchema = z
  .object({
    id: z.string().uuid(),
    sellerId: z.string().uuid(),
    title: z.string(),
    description: z.string().nullable(),
    brand: z.string().nullable(),
    category: z.string().nullable(),
    countryOfOrigin: z.string().nullable(),
    hsCode: z.string().nullable(),
    midCode: z.string().nullable(),
    aiAttributes: z.record(z.string(), z.any()).nullable(),
    aiConfidenceScore: z.number().int().nullable(),
    requiresReview: z.boolean(),
    deletedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    variants: z.array(variantSchema),
  })
  .meta({ id: "Product" });

export const paginatedProductsSchema = z
  .object({
    data: z.array(productSchema),
    pagination: z.object({
      page: z.number().int(),
      limit: z.number().int(),
      total: z.number().int(),
    }),
  })
  .meta({ id: "PaginatedProducts" });

const complianceWarningSchema = z
  .object({
    code: z.enum(["LOW_CONFIDENCE", "RESTRICTED_GOODS"]),
    message: z.string(),
  })
  .meta({ id: "ComplianceWarning" });

const requirementWarningSchema = z
  .object({
    code: z.string(),
    message: z.string(),
  })
  .meta({ id: "RequirementWarning" });

const requirementEnvelopeSchema = z
  .object({
    status: z
      .enum(["flow_validating", "verified", "manual_override"])
      .meta({
        description:
          "`flow_validating` = AI-inferred, pending verification against an authoritative source. `verified` = reconciled against UK Trade Tariff / TARIC / ACE. `manual_override` = operator-edited.",
      }),
    source: z.enum(["llm", "uk_trade_tariff", "taric", "ace", "manual"]),
    confidence: z.number().int().min(0).max(100).nullable(),
    destination_country: z.string(),
    origin_country: z.string(),
    warnings: z.array(requirementWarningSchema),
    updated_at: z.string().datetime(),
    verified_at: z.string().datetime().nullable(),
  })
  .meta({ id: "RequirementEnvelope" });

export const classificationEnvelopeSchema = z
  .object({
    classification_id: z.string().uuid(),
    compliance_status: z.enum(["compliant", "partially_compliant"]).meta({
      description:
        "`compliant` requires a 6-10 digit hs_code, a 2-letter ISO country_of_origin, and requires_review=false.",
    }),
    classification: z.object({
      hs_code: z.string().meta({ example: "6109.10.0012" }),
      coo: z
        .string()
        .nullable()
        .meta({
          description: "ISO 3166-1 alpha-2 country code, or null if unknown",
          example: "PT",
        }),
      mid_code: z.string().nullable(),
      customs_description: z
        .string()
        .nullable()
        .meta({
          description: "Standardized 1-sentence customs declaration description.",
          example: "Men's knitted t-shirt, 100% cotton, short sleeve.",
        }),
      materials: z
        .string()
        .nullable()
        .meta({
          description: "Primary material composition",
          example: "100% organic cotton",
        }),
    }),
    ai_metadata: z.object({
      confidence_score: z.number().int().min(0).max(100),
      requires_review: z.boolean(),
      attributes: z.record(z.string(), z.any()),
    }),
    actionable_flags: z.object({
      missing_required_fields: z.array(z.string()).meta({
        description:
          "Names of required cross-border fields that are missing or invalid. Must be filled in (e.g. via PATCH /products/:id) before the record can be used to auto-generate customs documents.",
        example: ["country_of_origin"],
      }),
      warnings: z.array(complianceWarningSchema),
      restricted_goods_flag: z.boolean().meta({
        description:
          "True if the product may be subject to CITES, dual-use, sanctions, or other cross-border restrictions.",
      }),
    }),
    source: z.object({
      product_url: z.string().url().nullable(),
      title: z.string().nullable(),
    }),
    image_url: z
      .string()
      .url()
      .nullable()
      .meta({
        description:
          "Public URL to the evaluated image in Supabase Storage, or null if persistence was disabled.",
      }),
    created_at: z.string().datetime(),
    documentation: requirementEnvelopeSchema.nullable().meta({
      description:
        "Required customs documents / Y-codes / PGA flags for this (HS6, origin, destination) triple. `null` if no destination was supplied or the destination is outside the v1 scope (US/UK/EU).",
    }),
  })
  .meta({ id: "ClassificationEnvelope" });

export const classifyResponseSchema = z
  .object({
    status: z.literal("success"),
    data: classificationEnvelopeSchema,
  })
  .meta({ id: "ClassifyResponse" });

export const historyResponseSchema = z
  .object({
    status: z.literal("success"),
    data: z.array(classificationEnvelopeSchema),
    pagination: z.object({
      page: z.number().int(),
      limit: z.number().int(),
      total: z.number().int(),
    }),
  })
  .meta({ id: "HistoryResponse" });

export const errorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    request_id: z.string(),
    docs_url: z.string().url(),
  })
  .meta({ id: "ErrorResponse" });

// ---------------------------------------------------------------------------
// Rationale (GRI analysis + note review)
// ---------------------------------------------------------------------------

const griStepSchema = z
  .object({
    rule: z.enum([
      "GRI 1",
      "GRI 2(a)",
      "GRI 2(b)",
      "GRI 3(a)",
      "GRI 3(b)",
      "GRI 3(c)",
      "GRI 4",
      "GRI 5(a)",
      "GRI 5(b)",
      "GRI 6",
    ]),
    reasoning: z.string(),
    outcome: z.enum([
      "provisional_classification",
      "subheading_selected",
      "heading_eliminated",
      "disambiguated",
    ]),
  })
  .meta({ id: "GriStep" });

const noteReviewSchema = z
  .object({
    scope: z.string().meta({ example: "chapter_61_note_9" }),
    text_excerpt: z.string(),
    relevance: z.enum([
      "confirms_inclusion",
      "confirms_exclusion",
      "clarifies_definition",
    ]),
  })
  .meta({ id: "NoteReview" });

export const rationaleEnvelopeSchema = z
  .object({
    classification_id: z.string().uuid(),
    hs_code: z.string().meta({ example: "6109.10.0012" }),
    status: z
      .enum(["flow_validating", "verified", "manual_override"])
      .meta({
        description:
          "`flow_validating` = LLM-generated, pending verification against WCO explanatory notes. `verified` = reconciled. `manual_override` = operator-edited.",
      }),
    source: z.enum(["llm", "wco_explanatory_notes", "manual"]),
    confidence: z.number().int().min(0).max(100).nullable(),
    gri_steps: z.array(griStepSchema),
    notes_reviewed: z.array(noteReviewSchema),
    generated_at: z.string().datetime(),
    verified_at: z.string().datetime().nullable(),
  })
  .meta({ id: "RationaleEnvelope" });

export const rationaleResponseSchema = z
  .object({
    status: z.literal("success"),
    data: rationaleEnvelopeSchema,
  })
  .meta({ id: "RationaleResponse" });

// ---------------------------------------------------------------------------
// Precedents (CROSS rulings — v1 stub)
// ---------------------------------------------------------------------------

const crossRulingSchema = z
  .object({
    ruling_number: z.string().meta({ example: "NY N123456" }),
    date: z.string().meta({ example: "2023-06-15" }),
    hs_code: z.string(),
    product: z.string(),
    url: z.string().url(),
    relevance: z.number().int().min(0).max(100),
  })
  .meta({ id: "CrossRuling" });

export const precedentsEnvelopeSchema = z
  .object({
    classification_id: z.string().uuid(),
    hs_code: z.string(),
    hs6: z.string().meta({ example: "610910" }),
    status: z.enum(["flow_validating", "verified", "manual_override"]),
    source: z.enum(["cross_stub", "cross_scrape", "cross_api"]).meta({
      description:
        "`cross_stub` = placeholder during closed beta (empty rulings array, see `notice`). `cross_scrape`/`cross_api` = live sources once the fetcher ships.",
    }),
    rulings: z.array(crossRulingSchema),
    notice: z.string().nullable(),
    updated_at: z.string().datetime(),
    expires_at: z.string().datetime().nullable(),
  })
  .meta({ id: "PrecedentsEnvelope" });

export const precedentsResponseSchema = z
  .object({
    status: z.literal("success"),
    data: precedentsEnvelopeSchema,
  })
  .meta({ id: "PrecedentsResponse" });

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ClassifyRequest = z.infer<typeof classifyRequestSchema>;
