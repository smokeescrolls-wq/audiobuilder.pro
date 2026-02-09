import { NextRequest, NextResponse } from "next/server";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";

import { supabaseAdmin } from "@/server/supabase/admin";
import {
  processVideoFileWithShielding,
  cleanupTempFiles,
} from "@/shared/lib/video-processor";
import { generateCacheId, setCacheEntry } from "@/shared/lib/processing-cache";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

type JsonBody = {
  bucket: string;
  path: string;
  sessionId?: string;
  options?: {
    phaseInversion?: number;
    ultrasonicNoise?: number;
  };
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeFilename(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");
}

async function readBody(request: NextRequest): Promise<JsonBody> {
  const ct = request.headers.get("content-type") ?? "";

  if (ct.includes("application/json")) {
    return (await request.json()) as JsonBody;
  }

  if (ct.includes("multipart/form-data")) {
    const fd = await request.formData();

    if (fd.get("file")) {
      throw new Error(
        "Envio de arquivo direto para /api/process-video não é suportado em produção. Faça upload no Supabase Storage e envie { bucket, path } em JSON.",
      );
    }

    const bucket = String(fd.get("bucket") || "");
    const objectPath = String(fd.get("path") || "");
    const sessionId = String(fd.get("sessionId") || "") || undefined;

    const phaseInversionRaw = fd.get("phaseInversion");
    const ultrasonicNoiseRaw = fd.get("ultrasonicNoise");

    const phaseInversion = phaseInversionRaw ? Number(phaseInversionRaw) : undefined;
    const ultrasonicNoise = ultrasonicNoiseRaw ? Number(ultrasonicNoiseRaw) : undefined;

    return {
      bucket,
      path: objectPath,
      sessionId,
      options: { phaseInversion, ultrasonicNoise },
    };
  }

  const text = await request.text().catch(() => "");
  throw new Error(
    `Unsupported Content-Type: ${ct}. Body preview: ${text.slice(0, 120)}`,
  );
}

async function downloadFromStorageToTmp(params: {
  bucket: string;
  objectPath: string;
  originalName?: string;
}) {
  const admin = supabaseAdmin();

  const { data: signed, error: signErr } = await admin.storage
    .from(params.bucket)
    .createSignedUrl(params.objectPath, 60 * 15);

  if (signErr || !signed?.signedUrl) {
    throw new Error(signErr?.message || "Falha ao gerar signed URL");
  }

  const res = await fetch(signed.signedUrl);
  if (!res.ok) {
    throw new Error(`Falha ao baixar arquivo do storage (${res.status})`);
  }

  // ⚠️ Usa memória: coloque limite (ajuste conforme sua infra)
  const MAX_BYTES = 200 * 1024 * 1024; // 200MB
  const contentLength = res.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BYTES) {
    throw new Error(
      `Arquivo muito grande para processamento no server atual (${Number(contentLength)} bytes). Limite: ${MAX_BYTES} bytes.`,
    );
  }

  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_BYTES) {
    throw new Error(
      `Arquivo muito grande para processamento no server atual (${arrayBuffer.byteLength} bytes). Limite: ${MAX_BYTES} bytes.`,
    );
  }

  const tmpDir = path.join(os.tmpdir(), "audio-shield-uploads");
  await mkdir(tmpDir, { recursive: true });

  const originalName =
    params.originalName || path.basename(params.objectPath) || "input.mp4";

  const safeName = safeFilename(originalName);
  const ext = path.extname(safeName) || ".mp4";
  const base = safeName.replace(ext, "");

  const tmpPath = path.join(tmpDir, `${randomUUID()}_${base}${ext}`);

  await writeFile(tmpPath, Buffer.from(arrayBuffer));

  return { tmpPath, filename: safeName, size: arrayBuffer.byteLength };
}

async function uploadProcessedToStorage(params: {
  outputLocalPath: string;
  outputFilename: string;
  sessionId: string;
}) {
  const admin = supabaseAdmin();

  const outBucket = "processed";
  const safeOut = safeFilename(params.outputFilename);
  const outPath = `${params.sessionId}/${randomUUID()}_${safeOut}`;

  const fileBuffer = await readFile(params.outputLocalPath);

  const up = await admin.storage.from(outBucket).upload(outPath, fileBuffer, {
    upsert: true,
    contentType: "video/mp4",
  });

  if (up.error) {
    throw new Error(up.error.message);
  }

  const { data: signed, error } = await admin.storage
    .from(outBucket)
    .createSignedUrl(outPath, 60 * 60);

  if (error || !signed?.signedUrl) {
    throw new Error(error?.message || "Falha ao gerar signed url do output");
  }

  return { outBucket, outPath, downloadUrl: signed.signedUrl };
}

export async function POST(request: NextRequest) {
  const cacheId = generateCacheId();
  const createdAt = new Date();

  let sessionId: string = randomUUID();
  let originalFilename = "unknown";

  try {
    const body = await readBody(request);

    const bucket = body.bucket;
    const objectPath = body.path;

    sessionId = body.sessionId || sessionId;
    originalFilename = path.basename(objectPath || "") || "input.mp4";

    const phaseInversion = clamp(body.options?.phaseInversion ?? 100, 0, 100);
    const ultrasonicNoise = clamp(body.options?.ultrasonicNoise ?? 50, 0, 100);

    if (!bucket || !objectPath) {
      return NextResponse.json(
        { error: "Campos obrigatórios: bucket, path" },
        { status: 400 },
      );
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    setCacheEntry(cacheId, {
      sessionId,
      originalFilename,
      processedFilename: "output.mp4",
      status: "processing",
      createdAt,
      expiresAt,
    });

    const downloaded = await downloadFromStorageToTmp({
      bucket,
      objectPath,
      originalName: originalFilename,
    });

    const result = await processVideoFileWithShielding(
      downloaded.tmpPath,
      downloaded.filename,
      { phaseInversion, ultrasonicNoise },
    );

    const uploaded = await uploadProcessedToStorage({
      outputLocalPath: result.outputPath,
      outputFilename: result.filename,
      sessionId,
    });

    setCacheEntry(cacheId, {
      sessionId,
      originalFilename: downloaded.filename,
      processedFilename: result.filename,
      status: "completed",
      createdAt,
      expiresAt,
      localOnly: false,
      s3Key: `${uploaded.outBucket}/${uploaded.outPath}`,
      s3Url: uploaded.downloadUrl,
      duration: result.duration,
    });

    cleanupTempFiles(result.outputPath).catch(() => {});

    return NextResponse.json({
      success: true,
      status: "completed",
      cacheId,
      sessionId,
      output: {
        bucket: uploaded.outBucket,
        path: uploaded.outPath,
        downloadUrl: uploaded.downloadUrl,
        filename: result.filename,
        duration: result.duration,
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : JSON.stringify(error);

    setCacheEntry(cacheId, {
      sessionId,
      originalFilename,
      processedFilename: "unknown",
      status: "failed",
      createdAt,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      error: message,
    });

    return NextResponse.json(
      { error: "Erro ao processar vídeo", details: message },
      { status: 500 },
    );
  }
}

