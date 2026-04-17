import { type NextRequest } from "next/server";
import { errorResponse } from "@/lib/errors";
import { classifyRequestSchema } from "@/lib/validation";
import {
  classifyWithClaude,
  isClaudeConfigured,
  type ClassifyInput,
  type Classification,
} from "@/lib/anthropic";
import { generateRequestId, logRequest } from "@/lib/request-logger";
import { incrementUsage } from "@/lib/usage";
import { getWorkspaceId } from "@/lib/session";
import {
  downloadImage,
  parseDataUrl,
  scrapeProductUrl,
  type ScrapedProduct,
} from "@/lib/scraper";
import { uploadClassifyImage } from "@/lib/image-storage";
import { prisma } from "@/lib/prisma";
import { buildClassificationEnvelope } from "@/lib/compliance";

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const start = Date.now();
  let statusCode = 500;
  let errorMsg: string | undefined;

  try {
    const body = await request.json();
    const parsed = classifyRequestSchema.safeParse(body);

    if (!parsed.success) {
      statusCode = 400;
      const res = errorResponse(parsed.error.issues[0].message, 400);
      res.headers.set("X-Request-Id", requestId);
      return res;
    }

    const workspaceId = await getWorkspaceId();

    // 1. If a product URL was provided, scrape it server-side.
    let scraped: ScrapedProduct | null = null;
    if (parsed.data.productUrl) {
      try {
        scraped = await scrapeProductUrl(parsed.data.productUrl);
      } catch (err) {
        statusCode = 400;
        const msg =
          err instanceof Error ? err.message : "Failed to scrape URL";
        const res = errorResponse(`Unable to read product URL: ${msg}`, 400);
        res.headers.set("X-Request-Id", requestId);
        return res;
      }
    }

    // 2. Build the Claude input by merging scraped + explicit values.
    const classifyInput: ClassifyInput = {
      productUrl: parsed.data.productUrl,
      title: parsed.data.title ?? scraped?.title,
      description: parsed.data.description ?? scraped?.description,
      brand: parsed.data.brand ?? scraped?.brand,
      category: parsed.data.category,
      originCountry: parsed.data.originCountry,
      destinationCountry: parsed.data.destinationCountry,
      images: [
        ...(parsed.data.images ?? []),
        ...(scraped?.imageUrl ? [scraped.imageUrl] : []),
      ],
    };
    if (classifyInput.images && classifyInput.images.length === 0) {
      classifyInput.images = undefined;
    }

    // 3. Persist the primary image to Supabase Storage (best-effort).
    const imageStoragePath = await persistEvaluatedImage(
      classifyInput.images?.[0],
      workspaceId,
    );

    // 4. Run classification (or mock).
    const result: Classification = isClaudeConfigured()
      ? await classifyWithClaude(classifyInput)
      : mockClassification();

    // 5. Record the evaluation for history.
    const record = await prisma.classificationRecord.create({
      data: {
        workspaceId,
        productUrl: parsed.data.productUrl ?? null,
        sourceTitle: classifyInput.title ?? null,
        imageStoragePath: imageStoragePath?.path ?? null,
        hsCode: result.hs_code,
        midCode: result.mid_code || null,
        confidenceScore: result.confidence_score,
        requiresReview: result.requires_review,
        countryOfOrigin: result.country_of_origin || null,
        materials: result.materials || null,
        restrictedGoodsFlag: result.restricted_goods_flag,
        customsDescription: result.product_description_for_customs || null,
        aiAttributes: result.ai_attributes,
      },
    });

    statusCode = 200;

    // Meter usage for authenticated workspaces
    if (workspaceId) {
      try {
        incrementUsage(workspaceId, "classify");
      } catch {
        /* ignore metering failures */
      }
    }

    const envelope = buildClassificationEnvelope({
      id: record.id,
      hsCode: record.hsCode,
      midCode: record.midCode,
      countryOfOrigin: record.countryOfOrigin,
      materials: record.materials,
      customsDescription: record.customsDescription,
      confidenceScore: record.confidenceScore,
      requiresReview: record.requiresReview,
      restrictedGoodsFlag: record.restrictedGoodsFlag,
      aiAttributes: (record.aiAttributes as Record<string, unknown> | null) ?? null,
      productUrl: record.productUrl,
      sourceTitle: record.sourceTitle,
      createdAt: record.createdAt,
      imageUrl: imageStoragePath?.publicUrl ?? null,
    });

    const res = Response.json({ status: "success", data: envelope });
    res.headers.set("X-Request-Id", requestId);
    return res;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    errorMsg = message;
    const res = errorResponse(message, 500);
    res.headers.set("X-Request-Id", requestId);
    return res;
  } finally {
    logRequest({
      requestId,
      method: "POST",
      path: "/api/v1/compliance/classify",
      statusCode,
      responseMs: Date.now() - start,
      errorMsg,
    });
  }
}

async function persistEvaluatedImage(
  firstImage: string | undefined,
  workspaceId: string | null,
): Promise<{ path: string; publicUrl: string } | null> {
  if (!firstImage) return null;
  try {
    const source = firstImage.startsWith("data:")
      ? parseDataUrl(firstImage)
      : await downloadImage(firstImage);
    if (!source) return null;
    return await uploadClassifyImage(
      source.buffer,
      source.contentType,
      workspaceId,
    );
  } catch (err) {
    console.error("[classify] image persistence failed", err);
    return null;
  }
}

function mockClassification(): Classification {
  return {
    hs_code: "6109.10.0012",
    mid_code: "MIDCN12345",
    confidence_score: 87,
    requires_review: false,
    country_of_origin: "CN",
    materials: "100% cotton",
    restricted_goods_flag: false,
    product_description_for_customs:
      "Men's knitted t-shirt, 100% cotton, short sleeve.",
    ai_attributes: {
      material: "100% Cotton",
      garment_type: "T-Shirt",
      gender: "Unisex",
      season: "All-Season",
      note: "Mock response - set ANTHROPIC_API_KEY for real classification",
    },
  };
}
