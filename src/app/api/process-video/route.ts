import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { randomUUID } from "crypto";
import path from "path";
import os from "os";
import {
  processVideoFileWithShielding,
  cleanupTempFiles,
} from "@/shared/lib/video-processor";
import {
  generateCacheId,
  setCacheEntry,
} from "@/shared/lib/processing-cache";

// Configurações do Route Segment para o App Router
export const maxDuration = 300; // 5 minutos (Vercel Pro)
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const phaseInversion = parseInt(
      (formData.get("phaseInversion") as string) || "100"
    );
    const ultrasonicNoise = parseInt(
      (formData.get("ultrasonicNoise") as string) || "50"
    );
    const sessionId = (formData.get("sessionId") as string) || randomUUID();

    if (!file) {
      return NextResponse.json(
        { error: "Nenhum arquivo enviado" },
        { status: 400 }
      );
    }

    console.log(`[API] Processing: ${file.name}`);
    console.log(`[API] File size: ${file.size} bytes`);
    console.log(`[API] Session: ${sessionId}`);
    console.log(
      `[API] Options: phaseInversion=${phaseInversion}, ultrasonicNoise=${ultrasonicNoise}`
    );

    // Validar tamanho do arquivo (500MB)
    const MAX_FILE_SIZE = 500 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Arquivo muito grande. Máximo: 500MB" },
        { status: 400 }
      );
    }

    // Validar tipo de arquivo
    const allowedTypes = [
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
      "video/webm",
      "audio/mpeg",
      "audio/wav",
      "audio/aac",
      "audio/ogg",
    ];

    const allowedExtensions = [".mp4", ".mov", ".avi", ".webm", ".mp3", ".wav", ".aac", ".ogg"];
    const fileExtension = path.extname(file.name).toLowerCase();

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      return NextResponse.json(
        { error: "Formato de arquivo não suportado" },
        { status: 400 }
      );
    }

    // Criar diretório temporário para uploads
    const uploadDir = path.join(os.tmpdir(), "audio-shield-uploads");
    await mkdir(uploadDir, { recursive: true });

    // Salvar arquivo no disco (não carregar na memória)
    const safeFilename = file.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_");

    const uploadPath = path.join(uploadDir, `${randomUUID()}_${safeFilename}`);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(uploadPath, buffer);

    console.log(`[API] File saved to: ${uploadPath}`);

    // Criar entrada no cache
    const cacheId = generateCacheId();
    const baseName = file.name
      .replace(/\.[^/.]+$/, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_");
    const processedFilename = `${baseName}_blindado.mp4`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    setCacheEntry(cacheId, {
      sessionId,
      originalFilename: file.name,
      processedFilename,
      status: "processing",
      expiresAt,
    });

    console.log(`[API] Created cache entry: ${cacheId}`);

    // Retornar imediatamente com o ID do cache
    const response = NextResponse.json({
      success: true,
      status: "processing",
      cacheId: cacheId,
      sessionId: sessionId,
      message:
        "Processamento iniciado. Use o endpoint /api/status/:id para verificar o progresso.",
    });

    // Processar de forma assíncrona (não bloquear a resposta)
    (async () => {
      try {
        console.log(`[API] Starting async processing for ${cacheId}`);

        const result = await processVideoFileWithShielding(
          uploadPath,
          file.name,
          { phaseInversion, ultrasonicNoise }
        );

        console.log(`[API] Processing completed for ${cacheId}`);

        // Atualizar cache com resultado
        setCacheEntry(cacheId, {
          sessionId,
          originalFilename: file.name,
          processedFilename: result.filename,
          status: "completed",
          expiresAt,
          outputPath: result.outputPath,
          localOnly: true,
          duration: result.duration,
        });

        // Agendar limpeza após 24h
        setTimeout(() => {
          if (result.outputPath) {
            cleanupTempFiles(result.outputPath).catch(() => {});
          }
        }, 24 * 60 * 60 * 1000);
      } catch (error) {
        console.error(`[API] Processing failed for ${cacheId}:`, error);

        setCacheEntry(cacheId, {
          sessionId,
          originalFilename: file.name,
          processedFilename,
          status: "failed",
          expiresAt,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();

    return response;
  } catch (error) {
    console.error("[API] Error in process-video:", error);
    return NextResponse.json(
      {
        error: "Erro ao processar vídeo",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
