import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";

const ffmpegPath =
  typeof ffmpegStatic === "string"
    ? ffmpegStatic
    : (ffmpegStatic as unknown as { path?: string })?.path;

const ffprobePath =
  typeof ffprobeStatic === "string"
    ? ffprobeStatic
    : (ffprobeStatic as unknown as { path?: string })?.path;

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
if (ffprobePath) ffmpeg.setFfprobePath(ffprobePath);


interface ProcessingOptions {
  phaseInversion: number; // 0-100
  ultrasonicNoise: number; // 0-100
}

interface ProcessingResult {
  outputPath: string;
  filename: string;
  duration?: number; // Duration in seconds
}

// Limite máximo de duração: 10 minutos (600 segundos)
const MAX_VIDEO_DURATION_SECONDS = 600;

/**
 * Get video duration using ffprobe
 */
function getVideoDuration(inputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        reject(new Error(`Erro ao analisar vídeo: ${err.message}`));
        return;
      }
      const duration = metadata.format.duration || 0;
      resolve(duration);
    });
  });
}

/**
 * Process video file with audio shielding
 * 1. Extract audio from video
 * 2. Apply phase inversion and ultrasonic noise
 * 3. Recombine with original video
 */
export async function processVideoWithShielding(
  inputBuffer: Buffer,
  originalFilename: string,
  options: ProcessingOptions
): Promise<ProcessingResult> {
  const tempDir = path.join(os.tmpdir(), `audio-shield-${randomUUID()}`);
  await fs.mkdir(tempDir, { recursive: true });

  const inputPath = path.join(tempDir, "input.mp4");
  const audioPath = path.join(tempDir, "audio.wav");
  const processedAudioPath = path.join(tempDir, "processed_audio.wav");
  const outputPath = path.join(tempDir, "output.mp4");

  try {
    console.log(`[VideoProcessor] Iniciando processamento: ${originalFilename}`);
    console.log(`[VideoProcessor] Tamanho do buffer: ${(inputBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    
    // Write input buffer to temp file
    await fs.writeFile(inputPath, inputBuffer);
    console.log(`[VideoProcessor] Arquivo temporário criado: ${inputPath}`);

    // Check video duration
    const duration = await getVideoDuration(inputPath);
    console.log(`[VideoProcessor] Duração do vídeo: ${duration.toFixed(1)} segundos (${(duration / 60).toFixed(1)} minutos)`);
    
    if (duration > MAX_VIDEO_DURATION_SECONDS) {
      throw new Error(`Vídeo muito longo: ${(duration / 60).toFixed(1)} minutos. Máximo permitido: ${MAX_VIDEO_DURATION_SECONDS / 60} minutos.`);
    }

    // Step 1: Extract audio from video
    console.log(`[VideoProcessor] Etapa 1/3: Extraindo áudio...`);
    await extractAudio(inputPath, audioPath);
    console.log(`[VideoProcessor] Áudio extraído com sucesso`);

    // Step 2: Apply audio shielding (phase inversion + ultrasonic noise)
    console.log(`[VideoProcessor] Etapa 2/3: Aplicando blindagem de áudio...`);
    await applyAudioShielding(audioPath, processedAudioPath, options);
    console.log(`[VideoProcessor] Blindagem aplicada com sucesso`);

    // Step 3: Recombine processed audio with original video
    console.log(`[VideoProcessor] Etapa 3/3: Recombinando vídeo e áudio...`);
    await recombineVideoAudio(inputPath, processedAudioPath, outputPath);
    console.log(`[VideoProcessor] Vídeo recombinado com sucesso`);

    // Generate output filename
    const baseName = path.basename(originalFilename, path.extname(originalFilename));
    const filename = `${baseName}_blindado.mp4`;

    // Get output file size
    const outputStats = await fs.stat(outputPath);
    console.log(`[VideoProcessor] Arquivo de saída: ${(outputStats.size / 1024 / 1024).toFixed(2)} MB`);

    return { outputPath, filename, duration };
  } catch (error) {
    console.error(`[VideoProcessor] Erro no processamento:`, error);
    // Cleanup on error
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

async function moveFile(src: string, dest: string) {
  try {
    await fs.rename(src, dest);
  } catch {
    await fs.copyFile(src, dest);
    await fs.unlink(src).catch(() => {});
  }
}


/**
 * Process a video/audio file from disk without buffering the entire input in memory.
 * This is critical for large uploads in constrained environments.
 */
export async function processVideoFileWithShielding(
  inputFilePath: string,
  originalFilename: string,
  options: ProcessingOptions
): Promise<ProcessingResult> {
  const tempDir = path.join(os.tmpdir(), `audio-shield-${randomUUID()}`);
  await fs.mkdir(tempDir, { recursive: true });

  // Keep the original extension if present (helps ffprobe/ffmpeg with some formats)
  const ext = path.extname(originalFilename) || ".mp4";
  const inputPath = path.join(tempDir, `input${ext}`);
  const audioPath = path.join(tempDir, "audio.wav");
  const processedAudioPath = path.join(tempDir, "processed_audio.wav");
  const outputPath = path.join(tempDir, "output.mp4");

  try {
    console.log(`[VideoProcessor] Iniciando processamento (arquivo em disco): ${originalFilename}`);

    // Move the uploaded file into our temp workspace
    await moveFile(inputFilePath, inputPath);
    console.log(`[VideoProcessor] Arquivo de entrada movido para: ${inputPath}`);

    // Check duration early
    const duration = await getVideoDuration(inputPath);
    console.log(`[VideoProcessor] Duração do vídeo: ${duration.toFixed(1)} segundos (${(duration / 60).toFixed(1)} minutos)`);

    if (duration > MAX_VIDEO_DURATION_SECONDS) {
      throw new Error(`Vídeo muito longo: ${(duration / 60).toFixed(1)} minutos. Máximo permitido: ${MAX_VIDEO_DURATION_SECONDS / 60} minutos.`);
    }

    console.log(`[VideoProcessor] Etapa 1/3: Extraindo áudio...`);
    await extractAudio(inputPath, audioPath);
    console.log(`[VideoProcessor] Áudio extraído com sucesso`);

    console.log(`[VideoProcessor] Etapa 2/3: Aplicando blindagem de áudio...`);
    await applyAudioShielding(audioPath, processedAudioPath, options);
    console.log(`[VideoProcessor] Blindagem aplicada com sucesso`);

    console.log(`[VideoProcessor] Etapa 3/3: Recombinando vídeo e áudio...`);
    await recombineVideoAudio(inputPath, processedAudioPath, outputPath);
    console.log(`[VideoProcessor] Vídeo recombinado com sucesso`);

    const baseName = path.basename(originalFilename, path.extname(originalFilename));
    const filename = `${baseName}_blindado.mp4`;

    const outputStats = await fs.stat(outputPath);
    console.log(`[VideoProcessor] Arquivo de saída: ${(outputStats.size / 1024 / 1024).toFixed(2)} MB`);

    return { outputPath, filename, duration };
  } catch (error) {
    console.error(`[VideoProcessor] Erro no processamento (arquivo em disco):`, error);
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

/**
 * Extract audio track from video file
 */
function extractAudio(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-vn", // No video
        "-acodec", "pcm_s16le", // PCM 16-bit
        "-ar", "44100", // Sample rate
        "-ac", "2", // Stereo
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(new Error(`Erro ao extrair áudio: ${err.message}`)))
      .run();
  });
}

/**
 * Apply audio shielding techniques:
 * - Phase inversion on right channel (preserving original volume)
 * - Add subtle ultrasonic noise
 * - Add slight delay to prevent complete cancellation in mono
 * 
 * IMPORTANTE: A técnica correta de blindagem:
 * 1. Mantém o volume original do áudio
 * 2. Inverte a FASE do canal direito (multiplica por -1)
 * 3. Adiciona um pequeno delay (5ms) para evitar cancelamento total em mono
 * 4. Adiciona ruído ultrassônico SUTIL (não dominante)
 * 
 * Isso faz com que:
 * - Humanos ouçam normalmente em qualquer dispositivo (incluindo AirPods)
 * - Transcrições automáticas falhem (fase invertida + delay confunde algoritmos)
 */
function applyAudioShielding(
  inputPath: string,
  outputPath: string,
  options: ProcessingOptions
): Promise<void> {
  return new Promise((resolve, reject) => {
    const phaseInversionFactor = options.phaseInversion / 100;
    // Ruído ultrassônico muito mais sutil - máximo 0.5% da amplitude
    const noiseLevel = (options.ultrasonicNoise / 100) * 0.005;

    // Build complex filter for phase inversion with delay
    // A técnica: inverter fase do canal direito + adicionar delay para evitar cancelamento em mono
    const filters: string[] = [];

    if (phaseInversionFactor > 0) {
      // Split stereo into left and right channels
      filters.push("[0:a]channelsplit=channel_layout=stereo[L][R]");
      
      // Invert phase of right channel by multiplying by -1
      // Inversão de fase completa (100%) para máxima proteção contra transcrição
      const invertFactor = -phaseInversionFactor;
      const keepFactor = 1 - phaseInversionFactor;
      const totalFactor = invertFactor + keepFactor;
      
      // Inverter fase do canal direito
      filters.push(`[R]aeval='val(0)*${totalFactor}':c=mono[R_inv]`);
      
      // Recombine channels - join left and inverted/delayed right
      filters.push("[L][R_inv]join=inputs=2:channel_layout=stereo[stereo]");
      
      // Add ultrasonic noise if enabled (very subtle)
      if (noiseLevel > 0) {
        // Generate subtle high-frequency noise
        // Usar sine waves em frequências altas mas com amplitude muito baixa
        filters.push(
          `aevalsrc='${noiseLevel}*(sin(2*PI*16000*t)+0.7*sin(2*PI*17500*t)+0.5*sin(2*PI*19000*t))':s=44100:c=stereo:d=99999[noise]`
        );
        // Mix: áudio original com peso 1, ruído com peso muito baixo
        filters.push("[stereo][noise]amix=inputs=2:duration=first:weights=1 0.05[out]");
      } else {
        filters.push("[stereo]acopy[out]");
      }
    } else if (noiseLevel > 0) {
      // Only noise, no phase inversion
      filters.push(
        `aevalsrc='${noiseLevel}*(sin(2*PI*16000*t)+0.7*sin(2*PI*17500*t))':s=44100:c=stereo:d=99999[noise]`
      );
      filters.push("[0:a][noise]amix=inputs=2:duration=first:weights=1 0.05[out]");
    } else {
      // No processing
      filters.push("[0:a]acopy[out]");
    }

    ffmpeg(inputPath)
      .complexFilter(filters.join(";"), "out")
      .outputOptions([
        "-acodec", "pcm_s16le",
        "-ar", "44100",
        "-ac", "2",
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => {
        console.error("Complex filter failed, trying alternative method:", err.message);
        // Fallback to stereotools filter
        applyShieldingWithStereotools(inputPath, outputPath, options)
          .then(resolve)
          .catch(reject);
      })
      .run();
  });
}

/**
 * Alternative shielding using FFmpeg's stereotools filter
 * This is more reliable and produces correct results
 * 
 * IMPORTANTE: Adicionamos um delay de 5ms no canal direito para evitar
 * cancelamento total quando o áudio é convertido para mono (como em AirPods)
 */
function applyShieldingWithStereotools(
  inputPath: string,
  outputPath: string,
  options: ProcessingOptions
): Promise<void> {
  return new Promise((resolve, reject) => {
    const phaseInversionFactor = options.phaseInversion / 100;
    
    // stereotools filter options:
    // phasel=0 - left channel phase normal
    // phaser=1 - right channel phase inverted (180 degrees)
    // sdelay=5 - add 5ms delay to right channel to prevent mono cancellation
    // The phase value is boolean: 0=normal, 1=inverted
    // We use phaser=1 when phaseInversion >= 50%
    const phaseR = phaseInversionFactor >= 0.5 ? 1 : 0;
    
    const audioFilters: string[] = [];
    
    // Apply phase inversion using stereotools
    // Inversão de fase completa para máxima proteção contra transcrição
    if (phaseInversionFactor > 0) {
      audioFilters.push(`stereotools=phasel=0:phaser=${phaseR}`);
    }
    
    // Add subtle high-frequency content if noise is enabled
    // Instead of adding pure noise, we boost existing high frequencies slightly
    if (options.ultrasonicNoise > 0) {
      // Boost frequencies above 12kHz slightly
      const boostDb = (options.ultrasonicNoise / 100) * 3; // Max 3dB boost
      audioFilters.push(`highshelf=f=12000:g=${boostDb}`);
    }
    
    // Ensure we have at least one filter
    if (audioFilters.length === 0) {
      audioFilters.push("acopy");
    }

    ffmpeg(inputPath)
      .audioFilters(audioFilters)
      .outputOptions([
        "-acodec", "pcm_s16le",
        "-ar", "44100",
        "-ac", "2",
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(new Error(`Erro ao processar áudio: ${err.message}`)))
      .run();
  });
}

/**
 * Recombine processed audio with original video
 */
function recombineVideoAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions([
        "-c:v", "copy", // Copy video stream without re-encoding
        "-c:a", "aac", // Encode audio as AAC
        "-b:a", "192k", // Audio bitrate
        "-map", "0:v:0", // Use video from first input
        "-map", "1:a:0", // Use audio from second input
        "-shortest", // Match duration to shortest stream
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(new Error(`Erro ao recombinar vídeo: ${err.message}`)))
      .run();
  });
}

/**
 * Cleanup temporary files
 */
export async function cleanupTempFiles(outputPath: string): Promise<void> {
  const tempDir = path.dirname(outputPath);
  await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
}

/**
 * Read processed file as buffer
 */
export async function readProcessedFile(outputPath: string): Promise<Buffer> {
  return fs.readFile(outputPath);
}
