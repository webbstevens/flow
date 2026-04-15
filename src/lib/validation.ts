import { z } from "zod";

const iso2Country = z
  .string()
  .length(2)
  .toUpperCase()
  .optional();

const variantSchema = z.object({
  sku: z.string().min(1),
  price: z.number().positive(),
  weightKg: z.number().nonnegative().optional(),
  lengthCm: z.number().nonnegative().optional(),
  widthCm: z.number().nonnegative().optional(),
  heightCm: z.number().nonnegative().optional(),
  attributes: z.record(z.string(), z.any()).optional(),
});

export const createProductSchema = z.object({
  sellerId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  countryOfOrigin: iso2Country,
  hsCode: z.string().optional(),
  midCode: z.string().optional(),
  aiAttributes: z.record(z.string(), z.any()).optional(),
  aiConfidenceScore: z.number().int().min(0).max(100).optional(),
  requiresReview: z.boolean().optional(),
  variants: z.array(variantSchema).min(1),
});

export const updateProductSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  countryOfOrigin: iso2Country,
  hsCode: z.string().optional(),
  midCode: z.string().optional(),
  aiAttributes: z.record(z.string(), z.any()).optional(),
  aiConfidenceScore: z.number().int().min(0).max(100).optional(),
});

export const classifyRequestSchema = z
  .object({
    productId: z.string().uuid().optional(),
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    brand: z.string().optional(),
    originCountry: iso2Country,
    destinationCountry: iso2Country,
    images: z.array(z.string().min(1)).optional(),
  })
  .refine((v) => Boolean(v.title) || (v.images && v.images.length > 0), {
    message: "Either 'title' or at least one image is required",
    path: ["title"],
  });

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ClassifyRequest = z.infer<typeof classifyRequestSchema>;
