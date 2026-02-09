"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import {
  Shield,
  Upload,
  Search,
  Loader2,
  Settings,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "@/features/auth/api/auth.client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabaseBrowser } from "@/server/supabase/browser";

type SessionItem = {
  id: string;
  filename: string;
  status: "queued" | "processing" | "done" | "error";
  createdAt: string;
  downloadUrl?: string;
};

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

function pct(n: number) {
  return `${Math.round(n)}%`;
}

function initialsFromName(name: string) {
  return (name || "OP")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

function safeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");
}

function isStorageBucketNotFound(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.toLowerCase().includes("bucket") &&
    msg.toLowerCase().includes("not found")
  );
}

async function getUserIdOrThrow() {
  const supabase = supabaseBrowser();

  const { data: sess, error: sessErr } = await supabase.auth.getSession();
  if (sessErr) throw new Error(sessErr.message);
  if (!sess.session)
    throw new Error("Usuário não autenticado (sem sessão). Faça login.");

  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);

  const user = data.user;
  if (!user) throw new Error("Usuário não autenticado (getUser sem user).");

  return user.id;
}

async function uploadToStorage(params: { userId: string; file: File }) {
  const supabase = supabaseBrowser();

  const original = params.file.name || "input.bin";
  const ext = original.includes(".") ? original.split(".").pop() : "bin";
  const base = safeName(original.replace(/\.[^/.]+$/, ""));
  const key = `${params.userId}/${base}-${Date.now()}.${ext}`;

  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session)
    throw new Error("Sessão não encontrada. Faça login e tente novamente.");

  const up = await supabase.storage.from("uploads").upload(key, params.file, {
    upsert: true,
    contentType: params.file.type || "application/octet-stream",
    cacheControl: "3600",
  });

  if (up.error) {
    throw new Error(`Upload falhou: ${up.error.message}`);
  }

  return { bucket: "uploads", path: key };
}

/** ===== Persistência do histórico ===== */

function historyKey(userId: string) {
  return `audiobuilder_history_v1:${userId}`;
}

function readHistory(userId: string): SessionItem[] {
  try {
    const raw = localStorage.getItem(historyKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SessionItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => x?.status === "done");
  } catch {
    return [];
  }
}

function writeHistory(userId: string, items: SessionItem[]) {
  try {
    localStorage.setItem(
      historyKey(userId),
      JSON.stringify(items.slice(0, 200)),
    );
  } catch {}
}

/** ✅ download direto (sem abrir aba) */
async function downloadDirect(url: string, filename: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao baixar o arquivo");

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename || "download.mp4";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(objectUrl);
}

/** ===== Dashboard ===== */

export function DashboardShell() {
  const [phase, setPhase] = useState(100);
  const [ultra, setUltra] = useState(85);
  const [optimizer, setOptimizer] = useState(true);

  const [engine, setEngine] = useState<"standby" | "active">("standby");
  const [queue, setQueue] = useState<SessionItem[]>([]);
  const [history, setHistory] = useState<SessionItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const [search, setSearch] = useState("");

  const [profileOpen, setProfileOpen] = useState(false);
  const [operatorName, setOperatorName] = useState("LEO");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [uiError, setUiError] = useState<string | null>(null);

  const filesByIdRef = useRef<Record<string, File>>({});
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    let alive = true;

    async function loadUser() {
      const { data: sess } = await supabase.auth.getSession();
      if (!alive) return;
      if (!sess.session) return;

      const { data } = await supabase.auth.getUser();
      if (!alive) return;

      const user = data.user;
      if (!user) return;

      userIdRef.current = user.id;

      const name =
        (user.user_metadata?.full_name as string | undefined) ||
        (user.email ? user.email.split("@")[0] : "LEO");

      const avatar =
        (user.user_metadata?.avatar_url as string | undefined) ?? null;

      setOperatorName(String(name).toUpperCase());
      setAvatarUrl(avatar);

      setHistory(readHistory(user.id));

      // Verificar se é admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      setIsAdmin(roleData?.role === "admin");
    }

    loadUser();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const uid = userIdRef.current;
    if (!uid) return;
    writeHistory(uid, history);
  }, [history]);

  const filteredHistory = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return history;
    return history.filter((x) => x.filename.toLowerCase().includes(q));
  }, [history, search]);

  function onPickFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;

    const createdAt = new Date().toLocaleString("pt-BR");

    const items: SessionItem[] = list.map((file) => {
      const id = crypto.randomUUID();
      filesByIdRef.current[id] = file;
      return { id, filename: file.name, status: "queued", createdAt };
    });

    setQueue((prev) => [...items, ...prev]);
    setUiError(null);
  }

  async function processJob(jobId: string) {
    const file = filesByIdRef.current[jobId];
    const item = queue.find((x) => x.id === jobId);
    if (!file || !item) return;

    setQueue((prev) =>
      prev.map((x) => (x.id === jobId ? { ...x, status: "processing" } : x)),
    );
    setEngine("active");

    try {
      const userId = await getUserIdOrThrow();
      const { bucket, path } = await uploadToStorage({ userId, file });

      const apiRes = await fetch("/api/process-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bucket,
          path,
          sessionId: crypto.randomUUID(),
          options: { phaseInversion: phase, ultrasonicNoise: ultra, optimizer },
        }),
      });

      if (!apiRes.ok) {
        const err = await apiRes.json().catch(() => null);
        throw new Error(err?.error || "Erro ao processar vídeo");
      }

      const data = await apiRes.json();
      const cacheId = String(data.cacheId);

      filesByIdRef.current[cacheId] = filesByIdRef.current[jobId];
      delete filesByIdRef.current[jobId];

      setQueue((prev) =>
        prev.map((x) => (x.id === jobId ? { ...x, id: cacheId } : x)),
      );

      await new Promise<void>((resolve) => {
        const poll = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/status/${cacheId}`, {
              cache: "no-store",
            });
            if (!statusRes.ok) throw new Error("Erro ao verificar status");
            const statusData = await statusRes.json();

            if (statusData.status === "completed") {
              const downloadUrl = statusData.downloadUrl as string | undefined;
              const processedFilename =
                (statusData.processedFilename as string | undefined) ??
                item.filename;

              setQueue((prev) => prev.filter((x) => x.id !== cacheId));

              setHistory((prev) => [
                {
                  id: cacheId,
                  filename: processedFilename,
                  status: "done",
                  createdAt: item.createdAt,
                  downloadUrl,
                },
                ...prev,
              ]);

              clearInterval(poll);
              resolve();
              return;
            }

            if (statusData.status === "failed") {
              setQueue((prev) =>
                prev.map((x) =>
                  x.id === cacheId ? { ...x, status: "error" } : x,
                ),
              );
              clearInterval(poll);
              resolve();
              return;
            }
          } catch {
            setQueue((prev) =>
              prev.map((x) =>
                x.id === cacheId ? { ...x, status: "error" } : x,
              ),
            );
            clearInterval(poll);
            resolve();
          }
        }, 2000);
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);

      setQueue((prev) =>
        prev.map((x) => (x.id === jobId ? { ...x, status: "error" } : x)),
      );

      throw new Error(msg);
    }
  }

  async function onShield() {
    if (isProcessing) return;

    const pending = queue.filter((x) => x.status === "queued");
    if (pending.length === 0) return;

    setIsProcessing(true);
    setUiError(null);

    const errors: string[] = [];

    try {
      for (const job of pending) {
        try {
          await processJob(job.id);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          errors.push(`${job.filename}: ${msg}`);
        }
      }

      if (errors.length > 0) {
        setUiError(`Alguns itens falharam:\n- ${errors.join("\n- ")}`);
      }
    } finally {
      setIsProcessing(false);
      setEngine("standby");
    }
  }

  const canShield = queue.some((x) => x.status === "queued");

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="mx-auto w-full max-w-[1280px] px-5 py-6 flex-1">
        <TopBar
          name={operatorName}
          avatarUrl={avatarUrl}
          isAdmin={isAdmin}
          onOpenProfile={() => setProfileOpen(true)}
        />

        {profileOpen ? (
          <ProfileDialog
            open
            onOpenChange={(v) => setProfileOpen(v)}
            initialName={operatorName}
            initialAvatarUrl={avatarUrl}
            onUpdated={(v) => {
              setOperatorName(v.fullName.toUpperCase());
              setAvatarUrl(v.avatarUrl ?? null);
            }}
          />
        ) : null}

        {uiError ? (
          <Card className="mt-6 rounded-2xl border-red-500/20 bg-red-500/10 p-4">
            <div className="text-[11px] tracking-[0.18em] text-red-200">
              ERRO
            </div>
            <div className="mt-2 whitespace-pre-line text-[12px] leading-relaxed text-white/80">
              {uiError}
            </div>
          </Card>
        ) : null}

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <SectionTitle
              left="SIGNAL ENGINE STATUS:"
              right={engine === "active" ? "ACTIVE" : "STANDBY"}
              active={engine === "active"}
            />

            <WaveCard active={engine === "active"} />

            <LabelWithIndex index="01" title="UPLOAD DE ORIGEM" />
            <UploadCard onPick={onPickFiles} disabled={isProcessing} />

            <LabelWithIndex index="02" title="FILA DE PROCESSAMENTO" />
            <QueueCard items={queue} />
          </div>

          <aside className="space-y-6">
            <OperatorBar operatorName={operatorName} />

            <Card className="rounded-2xl border-white/10 bg-white/[0.04] p-5">
              <div className="text-[12px] tracking-[0.22em] text-white/60">
                ENGINE PARAMETERS
              </div>

              <div className="mt-5 space-y-5">
                <KnobRow
                  label="PHASE INVERSION"
                  value={phase}
                  onChange={setPhase}
                />
                <KnobRow
                  label="ULTRASONIC NOISE"
                  value={ultra}
                  onChange={setUltra}
                />

                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-4 py-3">
                  <div className="text-[11px] tracking-[0.22em] text-white/55">
                    PRESET OPTIMIZER
                  </div>
                  <Toggle value={optimizer} onChange={setOptimizer} />
                </div>

                <Button
                  className={cn(
                    "h-11 w-full rounded-xl font-bold tracking-[0.25em] transition-all duration-300 cursor-pointer",
                    canShield && !isProcessing
                      ? "bg-yellow-500 text-black hover:bg-yellow-400"
                      : "bg-white/5 text-white/20 border border-white/10 cursor-not-allowed",
                  )}
                  disabled={!canShield || isProcessing}
                  onClick={() => onShield().catch(() => {})}
                  type="button"
                >
                  {isProcessing ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      BLINDANDO...
                    </span>
                  ) : (
                    "BLINDAR ÁUDIO"
                  )}
                </Button>

                <div className="text-[10px] tracking-[0.25em] text-white/35">
                  {canShield
                    ? `${queue.filter((x) => x.status === "queued").length} ITEM(NS) NA FILA`
                    : "SELECIONE MÍDIAS PARA ENTRAR NA FILA"}
                </div>
              </div>
            </Card>

            <Card className="rounded-2xl border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[12px] tracking-[0.22em] text-white/60">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-white/5">
                    <Search className="h-3 w-3 text-white/60" />
                  </span>
                  HISTÓRICO DE SESSÃO
                </div>
              </div>

              <div className="mt-4">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="PESQUISAR CRIATIVO..."
                  className="h-10 rounded-xl border-white/10 bg-black/40 text-[12px] tracking-[0.08em] placeholder:text-white/25"
                />
              </div>

              <div className="mt-4">
                {filteredHistory.length === 0 ? (
                  <EmptyHistory />
                ) : (
                  <div className="space-y-2">
                    {filteredHistory.map((x) => (
                      <HistoryRow key={`${x.id}-${x.createdAt}`} item={x} />
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <Card className="rounded-2xl border-yellow-500/20 bg-yellow-500/5 p-5">
              <div className="flex items-start gap-3">
                <div className="mt-[2px] grid h-8 w-8 place-items-center rounded-xl border border-yellow-500/25 bg-yellow-500/10">
                  <Shield className="h-4 w-4 text-yellow-400" />
                </div>
                <div>
                  <div className="text-[12px] font-semibold tracking-[0.18em] text-yellow-200">
                    NEURAL SHIELDING
                  </div>
                  <div className="mt-2 text-[12px] leading-relaxed text-white/55">
                    Operador identificado como {operatorName.toLowerCase()}.
                    Todos os processos são locais e efêmeros.
                  </div>
                </div>
              </div>
            </Card>
          </aside>
        </div>
      </div>

      <footer className="w-full border-t border-white/10 bg-black/50 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-[1280px] px-5 py-6 text-center text-[10px] tracking-[0.35em] text-white/25">
          © 2026 MG GROUP
        </div>
      </footer>
    </div>
  );
}

/* ======================= UI COMPONENTS ======================= */

function TopBar(props: {
  name: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  onOpenProfile: () => void;
}) {
  const fallback = initialsFromName(props.name);
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  return (
    <div className="flex items-center justify-between border-b border-white/10 pb-4">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl border border-yellow-500/25 bg-yellow-500/10">
          <Shield className="h-4 w-4 text-yellow-400" />
        </div>
        <div className="text-[14px] font-extrabold tracking-tight">
          <span className="text-white">AUDIO</span>
          <span className="text-yellow-400">BUILDER</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2 sm:flex">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-[10px] tracking-[0.28em] text-white/55">
            SECURE LINK ACTIVE
          </span>
        </div>

        {props.isAdmin && (
          <Link
            href="/admin"
            className="flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-2 hover:bg-purple-500/20 transition cursor-pointer"
          >
            <Settings className="h-3 w-3 text-purple-400" />
            <span className="text-[10px] tracking-[0.25em] text-purple-300">
              ADMIN
            </span>
          </Link>
        )}

        <button
          type="button"
          onClick={props.onOpenProfile}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 hover:bg-white/[0.06] transition cursor-pointer"
        >
          <div className="text-[10px] tracking-[0.25em] text-white/60">
            {props.name}
          </div>
          <div className="rounded-full bg-yellow-500/10 px-2 py-[2px] text-[9px] tracking-[0.22em] text-yellow-300">
            PRO OPERATOR
          </div>

          <Avatar className="h-7 w-7 border border-white/10 bg-black/40">
            <AvatarImage src={props.avatarUrl ?? undefined} />
            <AvatarFallback className="bg-white/[0.06] text-white/70 text-[10px]">
              {fallback}
            </AvatarFallback>
          </Avatar>
        </button>

        <button
          type="button"
          disabled={loggingOut}
          onClick={async () => {
            setLoggingOut(true);
            try {
              await signOut();
              router.push("/auth");
            } catch (e) {
              console.error(e);
            } finally {
              setLoggingOut(false);
            }
          }}
          className="p-2 rounded-full border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 transition cursor-pointer disabled:opacity-50"
          title="Sair"
        >
          {loggingOut ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

function OperatorBar(props: { operatorName: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-[11px] tracking-[0.22em] text-white/50">
        V3.5 PRO / OPERATOR: {props.operatorName}
      </div>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="text-[10px] tracking-[0.28em] text-white/55">
          ONLINE
        </span>
      </div>
    </div>
  );
}

function SectionTitle(props: {
  left: string;
  right: string;
  active?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-[10px] tracking-[0.35em] text-white/45">
        {props.left}
      </div>
      <div
        className={cn(
          "text-[10px] tracking-[0.35em]",
          props.active ? "text-yellow-300" : "text-white/50",
        )}
      >
        {props.right}
      </div>
    </div>
  );
}

/** ===== Wave neon ===== */

function WaveCard(props: { active: boolean }) {
  return (
    <Card className="relative overflow-hidden rounded-2xl border-white/10 bg-white/[0.03]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -inset-24 opacity-40" style={neonRadial} />
        <div className="absolute inset-0 opacity-[0.10]" style={gridBg} />
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/80 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent" />
        <div
          className={cn(
            "absolute inset-0 ring-1 ring-inset rounded-2xl",
            props.active ? "ring-yellow-500/25" : "ring-white/10",
          )}
        />
        <div
          className={cn(
            "absolute inset-0 rounded-2xl",
            props.active ? "opacity-100" : "opacity-50",
          )}
          style={animatedBorder}
        />
      </div>

      <div className="relative h-[150px] w-full">
        <div className="absolute left-5 top-4 text-[10px] tracking-[0.35em] text-white/35">
          SIGNAL VISUALIZER
        </div>

        <div className="absolute inset-0 grid place-items-center">
          <WaveBars active={props.active} />
        </div>
      </div>

      <style jsx global>{`
        @keyframes neonBorder {
          0% {
            transform: translateX(-30%);
            opacity: 0.45;
          }
          50% {
            transform: translateX(30%);
            opacity: 0.9;
          }
          100% {
            transform: translateX(-30%);
            opacity: 0.45;
          }
        }
        @keyframes pulseWave {
          0% {
            transform: translateY(0);
            opacity: 0.7;
          }
          50% {
            transform: translateY(-2px);
            opacity: 1;
          }
          100% {
            transform: translateY(0);
            opacity: 0.7;
          }
        }
      `}</style>
    </Card>
  );
}

function WaveBars(props: { active: boolean }) {
  const bars = Array.from({ length: 54 });

  return (
    <div className="relative">
      <div
        className={cn(
          "absolute inset-0 blur-2xl opacity-0 transition-opacity duration-300",
          props.active && "opacity-70",
        )}
        style={neonGlowLayer}
      />

      <div className="relative flex h-14 items-end gap-[3px]">
        {bars.map((_, i) => {
          const h = props.active ? 10 + ((i * 13) % 42) : 6;

          return (
            <div
              key={i}
              className={cn(
                "w-[3px] rounded-sm transition-all",
                props.active ? "bg-yellow-400/90" : "bg-white/10",
              )}
              style={{
                height: `${h}px`,
                opacity: props.active ? 1 : 0.6,
                transition: "height 240ms ease",
                filter: props.active
                  ? "drop-shadow(0 0 10px rgba(250,204,21,0.35)) drop-shadow(0 0 20px rgba(250,204,21,0.20))"
                  : undefined,
                animation: props.active
                  ? "pulseWave 1.2s ease-in-out infinite"
                  : undefined,
                animationDelay: props.active
                  ? `${(i % 10) * 0.06}s`
                  : undefined,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function LabelWithIndex(props: { index: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-6 w-6 place-items-center rounded-md border border-yellow-500/25 bg-yellow-500/10 text-[10px] font-semibold text-yellow-300">
        {props.index}
      </div>
      <div className="text-[11px] tracking-[0.22em] text-white/70">
        {props.title}
      </div>
    </div>
  );
}

function UploadCard(props: {
  onPick: (files: FileList | File[]) => void;
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <Card className="rounded-2xl border-white/10 bg-white/[0.03] p-5">
      <div className="grid place-items-center rounded-2xl border border-white/10 bg-black/30 px-6 py-10 text-center">
        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.04]">
          <Upload className="h-5 w-5 text-white/70" />
        </div>

        <div className="mt-4 text-[11px] tracking-[0.22em] text-white/75">
          SELECIONAR MÍDIA
        </div>
        <div className="mt-2 text-[10px] tracking-[0.20em] text-white/35">
          MP3, WAV, MP4, MOV (MAX 100MB)
        </div>

        <div className="mt-5">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            multiple
            disabled={props.disabled}
            onChange={(e) => {
              const fs = e.target.files;
              if (!fs || fs.length === 0) return;
              props.onPick(fs);
              e.target.value = "";
            }}
            accept=".mp3,.wav,.mp4,.mov"
          />
          <Button
            className={cn(
              "h-10 rounded-xl bg-white/[0.06] text-white hover:bg-white/[0.10] border border-white/10 cursor-pointer",
              props.disabled && "opacity-50 cursor-not-allowed",
            )}
            type="button"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={props.disabled}
          >
            Selecionar arquivo(s)
          </Button>
        </div>
      </div>
    </Card>
  );
}

function QueueCard(props: { items: SessionItem[] }) {
  if (props.items.length === 0) {
    return (
      <div className="py-2 text-[11px] tracking-[0.18em] text-white/25">
        AGUARDANDO MÍDIAS PARA PROCESSAMENTO
      </div>
    );
  }

  const current =
    props.items.find((x) => x.status === "processing") ??
    props.items.find((x) => x.status === "queued") ??
    props.items[0];

  const queuedCount = props.items.filter((x) => x.status === "queued").length;

  return (
    <Card className="rounded-2xl border-yellow-500/20 bg-yellow-500/5 p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.20em] text-yellow-200">
            {current.filename.toUpperCase()}
          </div>
          <div className="mt-1 text-[10px] tracking-[0.22em] text-white/45">
            {current.status === "processing"
              ? "SHIELDING..."
              : queuedCount > 0
                ? `QUEUED (${queuedCount})`
                : "QUEUE"}
          </div>
        </div>

        <div className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-black/30">
          <Loader2
            className={cn(
              "h-4 w-4 text-white/60",
              current.status === "processing" && "animate-spin",
            )}
          />
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/40">
        <div
          className={cn(
            "h-full bg-yellow-400/90 transition-all",
            current.status === "processing" ? "w-[55%]" : "w-full",
          )}
        />
      </div>

      {props.items.length > 1 ? (
        <div className="mt-4 space-y-2">
          {props.items.slice(0, 4).map((x) => (
            <div
              key={x.id}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="truncate text-[10px] tracking-[0.18em] text-white/70">
                  {x.filename.toUpperCase()}
                </div>
                <div className="mt-1 text-[9px] tracking-[0.20em] text-white/35">
                  {x.status.toUpperCase()}
                </div>
              </div>
              <div
                className={cn(
                  "rounded-full px-2 py-[3px] text-[9px] tracking-[0.22em] border",
                  x.status === "queued" &&
                    "border-white/10 text-white/45 bg-white/5",
                  x.status === "processing" &&
                    "border-yellow-500/25 text-yellow-300 bg-yellow-500/10",
                  x.status === "error" &&
                    "border-red-500/25 text-red-300 bg-red-500/10",
                  x.status === "done" &&
                    "border-emerald-500/25 text-emerald-300 bg-emerald-500/10",
                )}
              >
                {x.status.toUpperCase()}
              </div>
            </div>
          ))}
          {props.items.length > 4 ? (
            <div className="text-[9px] tracking-[0.22em] text-white/30">
              +{props.items.length - 4} item(ns)
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function KnobRow(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] tracking-[0.22em] text-white/55">
          {props.label}
        </div>
        <div className="text-[11px] font-semibold tracking-[0.18em] text-yellow-300">
          {pct(props.value)}
        </div>
      </div>

      <div className="mt-3">
        <input
          type="range"
          min={0}
          max={100}
          value={props.value}
          onChange={(e) => props.onChange(Number(e.target.value))}
          className="w-full accent-yellow-400 cursor-pointer"
        />
      </div>
    </div>
  );
}

function Toggle(props: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => props.onChange(!props.value)}
      className={cn(
        "relative h-6 w-11 rounded-full border transition cursor-pointer",
        props.value
          ? "border-yellow-500/30 bg-yellow-500/20"
          : "border-white/10 bg-white/5",
      )}
      aria-pressed={props.value}
    >
      <span
        className={cn(
          "absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition",
          props.value ? "left-[22px] bg-yellow-400" : "left-[2px] bg-white/50",
        )}
      />
    </button>
  );
}

function EmptyHistory() {
  return (
    <div className="grid place-items-center py-10">
      <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-black/30">
        <div className="h-4 w-4 rounded bg-white/10" />
      </div>
      <div className="mt-3 text-[10px] tracking-[0.28em] text-white/35">
        NENHUM RESULTADO
      </div>
    </div>
  );
}

function HistoryRow(props: { item: SessionItem }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    const url =
      props.item.downloadUrl || `/api/cache/${props.item.id}/download`;

    try {
      setDownloading(true);
      await downloadDirect(url, props.item.filename);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-semibold tracking-[0.14em] text-white/80">
            {props.item.filename.toUpperCase()}
          </div>
          <div className="mt-1 text-[10px] tracking-[0.18em] text-white/35">
            {props.item.createdAt}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="shrink-0 rounded-full px-2 py-[3px] text-[9px] tracking-[0.22em] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            DONE
          </div>

          <button
            onClick={() => handleDownload().catch(() => {})}
            disabled={downloading}
            className={cn(
              "shrink-0 rounded-lg border px-2 py-1 text-[9px] tracking-[0.22em] transition cursor-pointer",
              downloading
                ? "border-white/10 bg-white/5 text-white/25 cursor-not-allowed"
                : "border-yellow-500/25 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20",
            )}
            type="button"
          >
            {downloading ? "BAIXANDO..." : "DOWNLOAD"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ====== ProfileDialog ====== */

function ProfileDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialName: string;
  initialAvatarUrl?: string | null;
  onUpdated: (v: { fullName: string; avatarUrl?: string | null }) => void;
}) {
  const [fullName, setFullName] = useState(props.initialName);
  const [password, setPassword] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const previewUrl = useMemo(() => {
    if (!avatarFile) return null;
    return URL.createObjectURL(avatarFile);
  }, [avatarFile]);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function onSave() {
    setSaving(true);
    const supabase = supabaseBrowser();

    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) {
      setSaving(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setSaving(false);
      return;
    }

    let nextAvatarUrl = props.initialAvatarUrl ?? null;

    if (avatarFile) {
      try {
        const key = `${user.id}/${safeName(avatarFile.name)}-${avatarFile.size}-${avatarFile.lastModified}`;
        const up = await supabase.storage
          .from("avatars")
          .upload(key, avatarFile, {
            upsert: true,
            contentType: avatarFile.type || "application/octet-stream",
          });

        if (up.error) {
          if (isStorageBucketNotFound(up.error)) {
            throw new Error(
              "Bucket 'avatars' não existe no Supabase Storage. Crie o bucket com esse nome (avatars) no painel do Supabase.",
            );
          }
          throw up.error;
        }

        const pub = supabase.storage.from("avatars").getPublicUrl(key);
        nextAvatarUrl = pub.data.publicUrl ?? nextAvatarUrl;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setSaving(false);
        throw new Error(msg);
      }
    }

    const meta = { full_name: fullName, avatar_url: nextAvatarUrl };

    const newPass = password.trim();
    if (newPass.length >= 6) {
      await supabase.auth.updateUser({ password: newPass, data: meta });
    } else {
      await supabase.auth.updateUser({ data: meta });
    }

    props.onUpdated({ fullName, avatarUrl: nextAvatarUrl });
    setSaving(false);
    props.onOpenChange(false);
  }

  const shownAvatar = previewUrl || props.initialAvatarUrl || undefined;
  const fallback = initialsFromName(fullName || props.initialName);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="border-white/10 bg-black/95 text-white rounded-2xl max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-[12px] tracking-[0.22em]">
            EDITAR PERFIL OPERADOR
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid place-items-center">
            <label className="cursor-pointer">
              <Avatar className="h-20 w-20 border border-white/10 bg-white/[0.03]">
                <AvatarImage src={shownAvatar} />
                <AvatarFallback className="bg-white/[0.06] text-white/80">
                  {fallback}
                </AvatarFallback>
              </Avatar>

              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setAvatarFile(f);
                }}
              />
            </label>

            <div className="mt-2 text-[10px] tracking-[0.25em] text-white/35">
              ALTERAR AVATAR
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] tracking-[0.28em] text-white/45">
              NOME DE OPERADOR
            </div>
            <Input
              className="h-11 rounded-xl border-white/10 bg-black/40"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="text-[10px] tracking-[0.28em] text-white/45">
              NOVA CHAVE DE ACESSO
            </div>
            <Input
              type="password"
              placeholder="DEIXE EM BRANCO PARA MANTER"
              className="h-11 rounded-xl border-white/10 bg-black/40"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <Button
            className="h-12 w-full rounded-xl bg-yellow-500 text-black hover:bg-yellow-400 cursor-pointer"
            disabled={saving || fullName.trim().length < 2}
            onClick={() => onSave().catch(() => {})}
            type="button"
          >
            {saving ? "SALVANDO..." : "ATUALIZAR CREDENCIAIS"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ======================= STYLES ======================= */

const gridBg = {
  backgroundImage:
    "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.16) 1px, transparent 0)",
  backgroundSize: "18px 18px",
};

const neonRadial = {
  background:
    "radial-gradient(800px circle at 50% 40%, rgba(250,204,21,0.18), rgba(0,0,0,0) 55%)",
};

const neonGlowLayer = {
  background:
    "radial-gradient(220px circle at 50% 60%, rgba(250,204,21,0.35), rgba(0,0,0,0) 65%)",
};

const animatedBorder: React.CSSProperties = {
  background:
    "linear-gradient(90deg, rgba(250,204,21,0) 0%, rgba(250,204,21,0.22) 45%, rgba(250,204,21,0) 100%)",
  filter: "blur(10px)",
  animation: "neonBorder 2.6s ease-in-out infinite",
};
