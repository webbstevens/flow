import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { downloadImage } from "@/lib/scraper";

const ClassificationSchema = z.object({
  hs_code: z
    .string()
    .describe("10-digit HTSUS code in dotted format, e.g. 6109.10.0012"),
  mid_code: z
    .string()
    .describe("Manufacturer ID code if known, otherwise empty string"),
  confidence_score: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("Classification confidence 0-100"),
  requires_review: z
    .boolean()
    .describe("True if confidence < 80 or there is meaningful ambiguity"),
  country_of_origin: z
    .string()
    .describe(
      "ISO 3166-1 alpha-2 country code of manufacture if determinable, else empty string",
    ),
  materials: z
    .string()
    .describe(
      "Primary material composition in plain English, e.g. '100% organic cotton'. Empty string if unknown.",
    ),
  restricted_goods_flag: z
    .boolean()
    .describe(
      "True if the product may be subject to CITES, dual-use, sanctions, food/drug, or other cross-border import restrictions that typically require extra documentation.",
    ),
  product_description_for_customs: z
    .string()
    .describe(
      "One-sentence standardized customs declaration description. Plain, specific, and compliant with typical commercial invoice phrasing.",
    ),
  ai_attributes: z
    .record(z.string(), z.string())
    .describe(
      "Additional key product attributes extracted from the image and text (e.g. garment_type, gender, season, color).",
    ),
});

export type Classification = z.infer<typeof ClassificationSchema>;

export interface ClassifyInput {
  images?: string[];
  title?: string;
  description?: string;
  category?: string;
  brand?: string;
  originCountry?: string;
  destinationCountry?: string;
  productUrl?: string;
}

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function classifyWithClaude(
  input: ClassifyInput,
): Promise<Classification> {
  const client = new Anthropic();

  const textParts: string[] = [
    "You are an expert cross-border customs classification assistant. Determine the most likely 10-digit HTSUS (Harmonized Tariff Schedule of the United States) code for this product and extract all customs-relevant attributes.",
    "Prioritize accuracy over specificity: if you are not confident in the final 4 digits, return a broader code and set requires_review to true.",
    "For `product_description_for_customs`, write a single sentence suitable for a commercial invoice (plain material + form + use).",
    "Flag `restricted_goods_flag` true only if the product plausibly implicates CITES, dual-use export controls, sanctions, food/drug regulation, or hazardous materials rules.",
  ];
  if (input.productUrl) textParts.push(`Source URL: ${input.productUrl}`);
  if (input.title) textParts.push(`Title: ${input.title}`);
  if (input.brand) textParts.push(`Brand: ${input.brand}`);
  if (input.category) textParts.push(`Category: ${input.category}`);
  if (input.description) textParts.push(`Description: ${input.description}`);
  if (input.originCountry)
    textParts.push(`Origin country: ${input.originCountry}`);
  if (input.destinationCountry)
    textParts.push(`Destination country: ${input.destinationCountry}`);
  textParts.push(
    "If an image is provided, use it as the primary signal for material, form, and intended use. Return the structured classification.",
  );

  const content: Anthropic.ContentBlockParam[] = [];

  if (input.images?.length) {
    const blocks = await Promise.all(input.images.map(toImageBlock));
    for (const block of blocks) {
      if (block) content.push(block);
    }
  }

  content.push({ type: "text", text: textParts.join("\n") });

  const response = await client.messages.parse({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content }],
    output_config: { format: zodOutputFormat(ClassificationSchema) },
  });

  if (!response.parsed_output) {
    throw new Error("Claude did not return a parseable classification");
  }

  const result = response.parsed_output;
  // Business rule: any score below 80 requires human review before the
  // classification can be used to auto-generate customs documents.
  if (result.confidence_score < 80) {
    result.requires_review = true;
  }
  return result;
}

const SUPPORTED_IMAGE_MEDIA = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;
type SupportedImageMedia = (typeof SUPPORTED_IMAGE_MEDIA)[number];

/**
 * Build a Claude image block from a data URL or a remote image.
 *
 * Anthropic's `url` image source ONLY accepts HTTPS — handing it any other
 * scheme fails the entire request with "Only HTTPS URLs are supported." So:
 *   - data: URL  → inline as base64
 *   - https://   → pass straight through as a url source
 *   - anything else (http://, protocol-relative, …) → fetch server-side and
 *     inline as base64
 * Returns null for an image we can't fetch or whose type Claude doesn't accept,
 * so one bad image never sinks the whole classification.
 */
export async function toImageBlock(
  img: string,
): Promise<Anthropic.ImageBlockParam | null> {
  if (img.startsWith("data:")) {
    const { mediaType, data } = parseDataUrl(img);
    return {
      type: "image",
      source: { type: "base64", media_type: mediaType, data },
    };
  }

  if (img.startsWith("https://")) {
    return { type: "image", source: { type: "url", url: img } };
  }

  try {
    const { buffer, contentType } = await downloadImage(img);
    const mediaType = contentType.split(";")[0].trim().toLowerCase();
    if (!(SUPPORTED_IMAGE_MEDIA as readonly string[]).includes(mediaType)) {
      return null;
    }
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType as SupportedImageMedia,
        data: buffer.toString("base64"),
      },
    };
  } catch {
    return null;
  }
}

function parseDataUrl(input: string): {
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  data: string;
} {
  const match = input.match(/^data:(image\/(jpeg|png|gif|webp));base64,(.+)$/);
  if (match) {
    return {
      mediaType: match[1] as
        | "image/jpeg"
        | "image/png"
        | "image/gif"
        | "image/webp",
      data: match[3],
    };
  }
  return { mediaType: "image/jpeg", data: input };
}
