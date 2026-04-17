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
      .url()
      .meta({
        description:
          "HTTPS URL of a product page. The server will fetch it, extract title/description/brand/image from meta tags + JSON-LD, and classify.",
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

export const classifyResponseSchema = z
  .object({
    success: z.boolean(),
    data: z.object({
      hs_code: z.string().meta({ example: "6109.10.0012" }),
      mid_code: z.string(),
      confidence_score: z.number().int().min(0).max(100),
      requires_review: z.boolean(),
      country_of_origin: z
        .string()
        .meta({ description: "ISO 3166-1 alpha-2 country code, or empty string if unknown", example: "PT" }),
      materials: z
        .string()
        .meta({ description: "Primary material composition", example: "100% organic cotton" }),
      restricted_goods_flag: z
        .boolean()
        .meta({
          description:
            "True if the product may be subject to CITES, dual-use, sanctions, or other cross-border restrictions.",
        }),
      product_description_for_customs: z
        .string()
        .meta({
          description: "Standardized 1-sentence customs declaration description.",
          example: "Men's knitted t-shirt, 100% cotton, short sleeve.",
        }),
      ai_attributes: z.record(z.string(), z.any()),
      record_id: z
        .string()
        .uuid()
        .meta({ description: "ClassificationRecord id for this evaluation." }),
      image_url: z
        .string()
        .url()
        .nullable()
        .meta({
          description:
            "Public URL to the evaluated image in Supabase Storage, or null if persistence was disabled.",
        }),
    }),
  })
  .meta({ id: "ClassifyResponse" });

export const classificationRecordSchema = z
  .object({
    id: z.string().uuid(),
    product_url: z.string().url().nullable(),
    source_title: z.string().nullable(),
    image_url: z.string().url().nullable(),
    hs_code: z.string(),
    mid_code: z.string().nullable(),
    confidence_score: z.number().int().min(0).max(100),
    requires_review: z.boolean(),
    country_of_origin: z.string().nullable(),
    materials: z.string().nullable(),
    restricted_goods_flag: z.boolean(),
    product_description_for_customs: z.string().nullable(),
    ai_attributes: z.record(z.string(), z.any()).nullable(),
    created_at: z.string().datetime(),
  })
  .meta({ id: "ClassificationRecord" });

export const historyResponseSchema = z
  .object({
    data: z.array(classificationRecordSchema),
    pagination: z.object({
      page: z.number().int(),
      limit: z.number().int(),
      total: z.number().int(),
    }),
  })
  .meta({ id: "HistoryResponse" });

export const errorSchema = z
  .object({
    error: z.literal(true),
    message: z.string(),
    code: z.number().int(),
  })
  .meta({ id: "ErrorResponse" });

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ClassifyRequest = z.infer<typeof classifyRequestSchema>;
