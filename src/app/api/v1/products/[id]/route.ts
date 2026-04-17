import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { ErrorCodes } from "@/lib/error-codes";
import { updateProductSchema } from "@/lib/validation";
import { apiHandler } from "@/lib/api-handler";

export const PATCH = apiHandler(
  { auth: true, meter: "products.update" },
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
    { requestId },
  ) => {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateProductSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse({
        code: ErrorCodes.VALIDATION_ERROR,
        message: parsed.error.issues[0].message,
        status: 400,
        requestId,
      });
    }

    const existing = await prisma.product.findUnique({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return errorResponse({
        code: ErrorCodes.NOT_FOUND,
        message: "Product not found",
        status: 404,
        requestId,
      });
    }

    const product = await prisma.product.update({
      where: { id },
      data: { ...parsed.data, requiresReview: false },
      include: { variants: true },
    });

    return Response.json(product);
  }
);
