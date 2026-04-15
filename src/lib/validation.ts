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
  .refine((v) => Boolean(v.title) || (v.images && v.images.length > 0), {
    message: "Either 'title' or at least one image is required",
    path: ["title"],
  })
  .meta({
    id: "ClassifyRequest",
    description:
      "Either `title` or at least one image in `images` must be provided.",
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
      ai_attributes: z.record(z.string(), z.any()),
    }),
  })
  .meta({ id: "ClassifyResponse" });

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
