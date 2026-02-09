"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Loader2, LogOut, Save, User as UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "@/features/auth/api/auth.client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabaseBrowser } from "@/server/supabase/browser";
import { cn } from "@/shared/lib/utils";

const schema = z.object({
  fullName: z.string().min(2, "Informe um nome válido"),
  password: z.string().optional(),
  avatar: z.instanceof(File).optional(),
});

type FormValues = z.infer<typeof schema>;

export function ProfileDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialName: string;
  initialAvatarUrl?: string | null;
  onUpdated: (v: { fullName: string; avatarUrl?: string | null }) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: props.initialName, password: "" },
    mode: "onSubmit",
  });

  const avatarFile = useWatch({ control: form.control, name: "avatar" });
  const fullName = useWatch({ control: form.control, name: "fullName" });

  useEffect(() => {
    if (!props.open) return;
    form.reset({
      fullName: props.initialName,
      password: "",
      avatar: undefined,
    });
  }, [props.open, props.initialName, form]);

  const previewUrl = useMemo(() => {
    if (!avatarFile) return null;
    return URL.createObjectURL(avatarFile);
  }, [avatarFile]);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const showAvatar = previewUrl || props.initialAvatarUrl || undefined;

  const fallback = (fullName || props.initialName || "OP")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  async function onSubmit(values: FormValues) {
    setSaving(true);

    try {
      const supabase = supabaseBrowser();
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) return;

      let avatar_url: string | null | undefined =
        props.initialAvatarUrl ?? null;

      if (values.avatar) {
        try {
          const safeName = values.avatar.name.replace(/[^\w.-]+/g, "_");
          const timestamp = Date.now();
          const path = `${user.id}/avatar-${timestamp}-${safeName}`;

          const up = await supabase.storage
            .from("avatars")
            .upload(path, values.avatar, {
              upsert: true,
              contentType: values.avatar.type,
            });

          if (up.error) {
            if (up.error.message.toLowerCase().includes("bucket")) {
              console.warn("Bucket avatars nao encontrado");
              avatar_url = props.initialAvatarUrl ?? null;
            } else {
              throw new Error(`Erro ao fazer upload: ${up.error.message}`);
            }
          } else {
            const pub = supabase.storage.from("avatars").getPublicUrl(path);
            avatar_url = pub.data.publicUrl ?? null;
          }
        } catch (e) {
          console.warn("Erro ao fazer upload do avatar:", e);
          avatar_url = props.initialAvatarUrl ?? null;
        }
      }

      const payload: { password?: string; data?: Record<string, unknown> } = {
        data: { full_name: values.fullName, avatar_url },
      };

      const newPass = values.password?.trim();
      if (newPass && newPass.length >= 6) payload.password = newPass;

      await supabase.auth.updateUser(payload);

      props.onUpdated({ fullName: values.fullName, avatarUrl: avatar_url });
      props.onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="p-0 overflow-hidden border-white/10 bg-black/80 text-white shadow-2xl rounded-3xl max-w-[520px]">
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-transparent" />

        <div className="relative">
          <DialogHeader className="px-7 py-5 border-b border-white/10">
            <DialogTitle className="text-[12px] tracking-[0.22em] text-white/85">
              EDITAR PERFIL OPERADOR
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="px-7 py-6 space-y-5"
          >
            <div className="grid place-items-center">
              <label className="group cursor-pointer select-none">
                <div
                  className={cn(
                    "relative grid place-items-center size-[92px] rounded-full",
                    "border border-dashed border-white/20 bg-white/3",
                    "transition-colors duration-150",
                    "group-hover:border-yellow-500/60",
                  )}
                >
                  <Avatar className="size-[74px] border border-white/10 bg-black/30">
                    <AvatarImage src={showAvatar} />
                    <AvatarFallback className="bg-white/6 text-white/80">
                      {fallback ? (
                        fallback
                      ) : (
                        <UserIcon className="h-5 w-5 text-white/60" />
                      )}
                    </AvatarFallback>
                  </Avatar>

                  <div
                    className={cn(
                      "pointer-events-none absolute inset-0 grid place-items-center rounded-full",
                      "opacity-0 transition-opacity duration-150",
                      "group-hover:opacity-100",
                    )}
                  >
                    <div className="absolute inset-0 rounded-full bg-black/55" />
                    <div className="relative grid place-items-center size-[58px] rounded-full border border-dashed border-yellow-500/70">
                      <Camera className="h-5 w-5 text-yellow-300" />
                    </div>
                  </div>
                </div>

                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    form.setValue("avatar", f, { shouldDirty: true });
                  }}
                />
              </label>

              <div className="mt-3 text-[10px] tracking-[0.35em] text-white/35">
                ALTERAR AVATAR
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] tracking-[0.35em] text-white/45">
                NOME DE OPERADOR
              </div>
              <Input
                className={cn(
                  "h-11 rounded-2xl border-white/10 bg-black/40",
                  "text-white placeholder:text-white/25",
                  "focus-visible:ring-1 focus-visible:ring-yellow-500/40",
                )}
                {...form.register("fullName")}
              />
            </div>

            <div className="space-y-2">
              <div className="text-[10px] tracking-[0.35em] text-white/45">
                NOVA CHAVE DE ACESSO
              </div>
              <Input
                type="password"
                placeholder="DEIXE EM BRANCO PARA MANTER"
                className={cn(
                  "h-11 rounded-2xl border-white/10 bg-black/40",
                  "text-white placeholder:text-white/25",
                  "focus-visible:ring-1 focus-visible:ring-yellow-500/40",
                )}
                {...form.register("password")}
              />
            </div>

            <Button
              className="h-12 w-full rounded-2xl bg-yellow-500 text-black hover:bg-yellow-400 cursor-pointer"
              disabled={saving}
              type="submit"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  SALVANDO...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Save className="h-4 w-4" />
                  ATUALIZAR CREDENCIAIS
                </span>
              )}
            </Button>

            <Button
              className="h-12 w-full rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 cursor-pointer"
              disabled={loggingOut || saving}
              type="button"
              onClick={async () => {
                setLoggingOut(true);
                try {
                  await signOut();
                  router.push("/auth");
                } catch (e) {
                  console.error("Erro ao fazer logout:", e);
                } finally {
                  setLoggingOut(false);
                }
              }}
            >
              {loggingOut ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  SAINDO...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <LogOut className="h-4 w-4" />
                  SAIR DA CONTA
                </span>
              )}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
