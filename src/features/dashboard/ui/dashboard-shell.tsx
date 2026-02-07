"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Shield, Upload, Search, Loader2 } from "lucide-react";
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
  status: "idle" | "processing" | "done" | "error";
  createdAt: string;
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

export function DashboardShell() {
  const [phase, setPhase] = useState(100);
  const [ultra, setUltra] = useState(85);
  const [optimizer, setOptimizer] = useState(true);

  const [engine, setEngine] = useState<"standby" | "active">("standby");
  const [queue, setQueue] = useState<SessionItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const [search, setSearch] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [profileOpen, setProfileOpen] = useState(false);
  const [operatorName, setOperatorName] = useState("LEO");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      const name =
        (user?.user_metadata?.full_name as string | undefined) ||
        (user?.email ? user.email.split("@")[0] : "LEO");

      const avatar =
        (user?.user_metadata?.avatar_url as string | undefined) ?? null;

      setOperatorName(String(name).toUpperCase());
      setAvatarUrl(avatar);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return queue;
    return queue.filter((x) => x.filename.toLowerCase().includes(q));
  }, [queue, search]);

  async function addJob(fileName: string, file: File) {
    const now = new Date();
    const tempId = crypto.randomUUID();
    const item: SessionItem = {
      id: tempId,
      filename: fileName,
      status: "processing",
      createdAt: now.toLocaleString("pt-BR"),
    };

    setQueue((prev) => [item, ...prev]);
    setEngine("active");
    setIsProcessing(true);

    try {
      // Enviar arquivo para a API
      const formData = new FormData();
      formData.append("file", file);
      formData.append("phaseInversion", phase.toString());
      formData.append("ultrasonicNoise", ultra.toString());
      formData.append("sessionId", crypto.randomUUID());

      const response = await fetch("/api/process-video", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Erro ao processar vídeo");
      }

      const data = await response.json();
      const cacheId = data.cacheId;

      // Atualizar item com o ID real
      setQueue((prev) =>
        prev.map((x) => (x.id === tempId ? { ...x, id: cacheId } : x)),
      );

      // Fazer polling do status
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/status/${cacheId}`);
          if (!statusResponse.ok) {
            throw new Error("Erro ao verificar status");
          }

          const statusData = await statusResponse.json();

          if (statusData.status === "completed") {
            setQueue((prev) =>
              prev.map((x) =>
                x.id === cacheId ? { ...x, status: "done" } : x,
              ),
            );
            setIsProcessing(false);
            setEngine("standby");
            clearInterval(pollInterval);
          } else if (statusData.status === "failed") {
            setQueue((prev) =>
              prev.map((x) =>
                x.id === cacheId ? { ...x, status: "error" } : x,
              ),
            );
            setIsProcessing(false);
            setEngine("standby");
            clearInterval(pollInterval);
          }
        } catch (error) {
          console.error("Erro ao verificar status:", error);
          clearInterval(pollInterval);
          setQueue((prev) =>
            prev.map((x) => (x.id === cacheId ? { ...x, status: "error" } : x)),
          );
          setIsProcessing(false);
          setEngine("standby");
        }
      }, 2000); // Verificar a cada 2 segundos
    } catch (error) {
      console.error("Erro ao processar vídeo:", error);
      setQueue((prev) =>
        prev.map((x) => (x.id === tempId ? { ...x, status: "error" } : x)),
      );
      setIsProcessing(false);
      setEngine("standby");
    }
  }

  function onPickFile(file: File) {
    setSelectedFile(file);
  }

  function onShield() {
    if (!selectedFile) return;
    addJob(selectedFile.name, selectedFile);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-[1280px] px-5 py-6">
        <TopBar
          name={operatorName}
          avatarUrl={avatarUrl}
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

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <SectionTitle
              left="SIGNAL ENGINE STATUS:"
              right={engine === "active" ? "ACTIVE" : "STANDBY"}
              active={engine === "active"}
            />

            <WaveCard active={engine === "active"} />

            <LabelWithIndex index="01" title="UPLOAD DE ORIGEM" />
            <UploadCard onPick={onPickFile} disabled={isProcessing} />

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
                  className="h-11 w-full rounded-xl bg-yellow-500 text-black hover:bg-yellow-400 disabled:opacity-50 cursor-pointer"
                  disabled={isProcessing || !selectedFile}
                  onClick={onShield}
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

                {!selectedFile ? (
                  <div className="text-[10px] tracking-[0.25em] text-white/25">
                    SELECIONE UMA MÍDIA PARA HABILITAR
                  </div>
                ) : (
                  <div className="text-[10px] tracking-[0.25em] text-white/35">
                    SELECIONADO: {selectedFile.name}
                  </div>
                )}
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
                {filtered.length === 0 ? (
                  <EmptyHistory />
                ) : (
                  <div className="space-y-2">
                    {filtered.map((x) => (
                      <HistoryRow key={x.id} item={x} />
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

        <div className="mt-14 pb-10 text-center text-[10px] tracking-[0.35em] text-white/25">
          © 2026 MG GROUP
        </div>
      </div>
    </div>
  );
}

function TopBar(props: {
  name: string;
  avatarUrl: string | null;
  onOpenProfile: () => void;
}) {
  const fallback = initialsFromName(props.name);

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

function WaveCard(props: { active: boolean }) {
  return (
    <Card className="relative overflow-hidden rounded-2xl border-white/10 bg-white/[0.03]">
      <div className="h-[140px] w-full">
        <div className="absolute inset-0 opacity-[0.08]" style={gridBg} />
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />

        <div className="relative h-full w-full">
          <div className="absolute left-5 top-4 text-[10px] tracking-[0.35em] text-white/35">
            SIGNAL VISUALIZER
          </div>

          <div className="absolute inset-0 grid place-items-center">
            <WaveBars active={props.active} />
          </div>
        </div>
      </div>
    </Card>
  );
}

function WaveBars(props: { active: boolean }) {
  const bars = Array.from({ length: 54 });

  return (
    <div className="flex h-14 items-end gap-[3px]">
      {bars.map((_, i) => {
        const h = props.active ? 10 + ((i * 13) % 42) : 6;
        return (
          <div
            key={i}
            className={cn(
              "w-[3px] rounded-sm",
              props.active ? "bg-yellow-400/90" : "bg-white/10",
            )}
            style={{
              height: `${h}px`,
              opacity: props.active ? 1 : 0.6,
              transition: "height 240ms ease",
              animation: props.active
                ? "pulseWave 1.2s ease-in-out infinite"
                : undefined,
              animationDelay: props.active ? `${(i % 10) * 0.06}s` : undefined,
            }}
          />
        );
      })}

      <style jsx global>{`
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
  onPick: (file: File) => void;
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

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
            disabled={props.disabled}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              props.onPick(f);
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
            onClick={handleButtonClick}
            disabled={props.disabled}
          >
            Selecionar arquivo
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
    props.items.find((x) => x.status === "processing") ?? props.items[0];

  return (
    <Card className="rounded-2xl border-yellow-500/20 bg-yellow-500/5 p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.20em] text-yellow-200">
            {current.filename.toUpperCase()}
          </div>
          <div className="mt-1 text-[10px] tracking-[0.22em] text-white/45">
            {current.status === "processing" ? "SHIELDING..." : "READY"}
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
            "h-full bg-yellow-400/90",
            current.status === "processing" ? "w-[55%]" : "w-full",
          )}
        />
      </div>
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
  const st = props.item.status;

  const handleDownload = () => {
    if (st === "done") {
      window.open(`/api/cache/${props.item.id}/download`, "_blank");
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
          <div
            className={cn(
              "shrink-0 rounded-full px-2 py-[3px] text-[9px] tracking-[0.22em]",
              st === "processing" &&
                "bg-yellow-500/10 text-yellow-300 border border-yellow-500/20",
              st === "done" &&
                "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20",
              st === "error" &&
                "bg-red-500/10 text-red-300 border border-red-500/20",
              st === "idle" &&
                "bg-white/5 text-white/45 border border-white/10",
            )}
          >
            {st.toUpperCase()}
          </div>

          {st === "done" && (
            <button
              onClick={handleDownload}
              className="shrink-0 rounded-lg border border-yellow-500/25 bg-yellow-500/10 px-2 py-1 text-[9px] tracking-[0.22em] text-yellow-300 hover:bg-yellow-500/20 transition cursor-pointer"
              type="button"
            >
              DOWNLOAD
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

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

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setSaving(false);
      return;
    }

    let nextAvatarUrl = props.initialAvatarUrl ?? null;

    if (avatarFile) {
      try {
        const path = `${user.id}/avatar-${Date.now()}`;
        const up = await supabase.storage
          .from("avatars")
          .upload(path, avatarFile, {
            upsert: true,
            contentType: avatarFile.type,
          });

        if (!up.error) {
          const pub = supabase.storage.from("avatars").getPublicUrl(path);
          nextAvatarUrl = pub.data.publicUrl ?? nextAvatarUrl;
        }
      } catch {
        nextAvatarUrl = nextAvatarUrl ?? null;
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
            onClick={onSave}
            type="button"
          >
            {saving ? "SALVANDO..." : "ATUALIZAR CREDENCIAIS"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const gridBg = {
  backgroundImage:
    "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.16) 1px, transparent 0)",
  backgroundSize: "18px 18px",
};
