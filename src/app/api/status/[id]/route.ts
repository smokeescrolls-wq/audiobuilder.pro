import { NextRequest, NextResponse } from "next/server";
import { getCacheEntry } from "@/shared/lib/processing-cache";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "ID não fornecido" },
        { status: 400 }
      );
    }

    const cacheEntry = getCacheEntry(id);

    if (!cacheEntry) {
      return NextResponse.json(
        { error: "Processamento não encontrado" },
        { status: 404 }
      );
    }

    // Retornar status do processamento
    return NextResponse.json({
      status: cacheEntry.status,
      originalFilename: cacheEntry.originalFilename,
      processedFilename: cacheEntry.processedFilename,
      downloadUrl:
        cacheEntry.status === "completed"
          ? `/api/cache/${id}/download`
          : undefined,
      error: cacheEntry.error,
      duration: cacheEntry.duration,
      expiresAt: cacheEntry.expiresAt,
    });
  } catch (error) {
    console.error("[API] Error in status:", error);
    return NextResponse.json(
      {
        error: "Erro ao verificar status",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
