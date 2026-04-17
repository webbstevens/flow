import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { updateProductSchema } from "@/lib/validation";
import { apiHandler } from "@/lib/api-handler";

export const PATCH = apiHandler(
  { auth: true, meter: "products.update" },
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
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
      data: { ...parsed.data, requiresReview: false },
      include: { variants: true },
    });

    return Response.json(product);
  }
);
