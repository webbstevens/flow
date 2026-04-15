import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const ClassificationSchema = z.object({
  hs_code: z.string().describe("10-digit HTSUS code in dotted format, e.g. 6109.10.0012"),
  mid_code: z.string().describe("Manufacturer ID code if known, otherwise empty string"),
  confidence_score: z.number().int().min(0).max(100).describe("Classification confidence 0-100"),
  requires_review: z.boolean().describe("True if confidence < 70 or there is meaningful ambiguity"),
  ai_attributes: z.record(z.string(), z.string()).describe("Key product attributes extracted from the image and text"),
});

export type Classification = z.infer<typeof ClassificationSchema>;

interface ClassifyInput {
  images?: string[];
  title?: string;
  description?: string;
  category?: string;
  brand?: string;
  originCountry?: string;
  destinationCountry?: string;
}

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function classifyWithClaude(input: ClassifyInput): Promise<Classification> {
  const client = new Anthropic();

  const textParts: string[] = [
    "You are an expert customs classification assistant. Determine the most likely 10-digit HTSUS (Harmonized Tariff Schedule of the United States) code for this product.",
  ];
  if (input.title) textParts.push(`Title: ${input.title}`);
  if (input.brand) textParts.push(`Brand: ${input.brand}`);
  if (input.category) textParts.push(`Category: ${input.category}`);
  if (input.description) textParts.push(`Description: ${input.description}`);
  if (input.originCountry) textParts.push(`Origin country: ${input.originCountry}`);
  if (input.destinationCountry) textParts.push(`Destination country: ${input.destinationCountry}`);
  textParts.push(
    "If you can identify the product from the image, base your classification primarily on what you see. Return the structured classification."
  );

  const content: Anthropic.ContentBlockParam[] = [];

  if (input.images?.length) {
    for (const img of input.images) {
      const { mediaType, data } = parseDataUrl(img);
      content.push({
        type: "image",
        source: { type: "base64", media_type: mediaType, data },
      });
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
  if (result.confidence_score < 70) {
    result.requires_review = true;
  }
  return result;
}

function parseDataUrl(input: string): {
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  data: string;
} {
  const match = input.match(/^data:(image\/(jpeg|png|gif|webp));base64,(.+)$/);
  if (match) {
    return {
      mediaType: match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
      data: match[3],
    };
  }
  return { mediaType: "image/jpeg", data: input };
}
