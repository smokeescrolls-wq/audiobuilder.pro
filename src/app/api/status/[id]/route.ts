import { NextRequest, NextResponse } from "next/server";
import { getCacheEntry } from "@/shared/lib/processing-cache";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "ID não fornecido" }, { status: 400 });
    }

    const cacheEntry = getCacheEntry(id);

    if (!cacheEntry) {
      return NextResponse.json(
        { error: "Processamento não encontrado" },
        { status: 404 },
      );
    }

    const downloadUrl =
      cacheEntry.status === "completed"
        ? cacheEntry.s3Url && !cacheEntry.localOnly
          ? cacheEntry.s3Url
          : `/api/cache/${id}/download`
        : undefined;

    return NextResponse.json({
      status: cacheEntry.status,
      originalFilename: cacheEntry.originalFilename,
      processedFilename: cacheEntry.processedFilename,
      downloadUrl,
      error: cacheEntry.error,
      duration: cacheEntry.duration,
      expiresAt: cacheEntry.expiresAt,
      createdAt: cacheEntry.createdAt,
    });
  } catch (error) {
    console.error("[API] Error in status:", error);
    return NextResponse.json(
      {
        error: "Erro ao verificar status",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
