import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { updateProductSchema } from "@/lib/validation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const body = await request.json();
    const parsed = updateProductSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 400);
    }

    const existing = await prisma.product.findUnique({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return errorResponse("Product not found", 404);
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...parsed.data,
        requiresReview: false,
      },
      include: { variants: true },
    });

    return Response.json(product);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return errorResponse(message, 500);
  }
}
