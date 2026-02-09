import { NextRequest, NextResponse } from "next/server";
import { getCacheEntry } from "@/shared/lib/processing-cache";
import { createReadStream, existsSync } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "ID não fornecido" }, { status: 400 });
    }

    const cacheEntry = getCacheEntry(id);

    if (!cacheEntry) {
      return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
    }

    if (cacheEntry.status !== "completed") {
      return NextResponse.json(
        { error: "Processamento ainda não concluído" },
        { status: 400 }
      );
    }

    if (cacheEntry.s3Url && !cacheEntry.localOnly) {
      return NextResponse.redirect(cacheEntry.s3Url);
    }

    if (!cacheEntry.outputPath) {
      return NextResponse.json({ error: "Arquivo não disponível" }, { status: 404 });
    }

    if (!existsSync(cacheEntry.outputPath)) {
      return NextResponse.json(
        { error: "Arquivo não encontrado no disco" },
        { status: 404 }
      );
    }

    const fileStats = await stat(cacheEntry.outputPath);
    const fileSize = fileStats.size;

    const fileStream = createReadStream(cacheEntry.outputPath);
    const webStream = Readable.toWeb(fileStream) as ReadableStream<Uint8Array>;

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": fileSize.toString(),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(
          cacheEntry.processedFilename
        )}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[API] Error in download:", error);
    return NextResponse.json(
      {
        error: "Erro ao fazer download",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
