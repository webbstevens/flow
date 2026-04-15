import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { createProductSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createProductSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }

    const { variants, ...productData } = parsed.data;

    const product = await prisma.$transaction(
      async (tx) => {
        const created = await tx.product.create({
          data: {
            ...productData,
            variants: {
              create: variants,
            },
          },
          include: { variants: true },
        });
        return created;
      },
      { maxWait: 10_000, timeout: 15_000 }
    );

    return Response.json(product, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return errorResponse(message, 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "50", 10))
    );
    const sellerId = searchParams.get("seller_id");

    const where = {
      deletedAt: null,
      ...(sellerId ? { sellerId } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { variants: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.count({ where }),
    ]);

    return Response.json({
      data,
      pagination: { page, limit, total },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return errorResponse(message, 500);
  }
}
