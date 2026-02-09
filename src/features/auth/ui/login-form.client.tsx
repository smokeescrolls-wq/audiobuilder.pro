"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { loginSchema, LoginInput } from "../model/auth.schema";
import { signInWithPassword, signInWithGoogle } from "../api/auth.client";
import { Button } from "@/components/ui/button";
import { AuthInput } from "./auth-input";

function normalizeAuthErrorMessage(err: unknown) {
  const raw =
    typeof err === "string"
      ? err
      : err && typeof err === "object" && "message" in err
        ? String((err as { message?: unknown }).message ?? "")
        : "";

  const msg = raw.toLowerCase();

  if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
    return {
      title: "ACESSO BLOQUEADO",
      description:
        "Seu email ainda não foi confirmado. Verifique sua caixa de entrada e spam.",
    };
  }

  if (msg.includes("too many requests") || msg.includes("rate limit")) {
    return {
      title: "MUITAS TENTATIVAS",
      description: "Aguarde um pouco e tente novamente.",
    };
  }

  // Supabase normalmente usa "Invalid login credentials" pra email/senha errados.
  // Aqui você pediu: não revelar qual dos dois está errado.
  if (
    msg.includes("invalid login credentials") ||
    msg.includes("user not found")
  ) {
    return {
      title: "CREDENCIAIS INVÁLIDAS",
      description: "Email ou senha incorretos. Verifique e tente novamente.",
    };
  }

  return {
    title: "ERRO AO AUTENTICAR",
    description: "Não foi possível entrar agora. Tente novamente em instantes.",
  };
}

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(values: LoginInput) {
    if (loading) return;

    setLoading(true);
    const toastId = toast.loading("AUTENTICANDO OPERADOR...", {
      description: "Validando credenciais no canal seguro.",
    });

    try {
      const { error } = await signInWithPassword(values.email, values.password);

      if (error) {
        const info = normalizeAuthErrorMessage(error);
        toast.error(info.title, { id: toastId, description: info.description });
        return;
      }

      toast.success("ACESSO LIBERADO", {
        id: toastId,
        description: "Redirecionando para o painel.",
      });

      router.push("/dashboard");
    } catch (e) {
      const info = normalizeAuthErrorMessage(e);
      toast.error(info.title, { id: toastId, description: info.description });
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    if (loading) return;

    const toastId = toast.loading("INICIANDO LOGIN GOOGLE...", {
      description: "Abrindo provedor de autenticação.",
    });

    try {
      const origin = window.location.origin;
      const redirectTo = `${origin}/auth/callback`;
      const { error } = await signInWithGoogle(redirectTo);

      if (error) {
        toast.error("FALHA NO GOOGLE", {
          id: toastId,
          description:
            "Não foi possível autenticar com Google. Tente novamente.",
        });
        return;
      }

      toast.success("REDIRECIONANDO...", {
        id: toastId,
        description: "Conclua o login no Google para continuar.",
      });
    } catch {
      toast.error("FALHA NO GOOGLE", {
        id: toastId,
        description: "Ocorreu um erro inesperado. Tente novamente.",
      });
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <AuthInput
        icon={<Mail className="size-4" />}
        placeholder="ENDEREÇO DE EMAIL"
        {...form.register("email")}
      />
      <AuthInput
        icon={<KeyRound className="size-4" />}
        type="password"
        placeholder="CHAVE DE ACESSO"
        {...form.register("password")}
      />

      <Button
        type="submit"
        disabled={loading}
        className="h-12 w-full rounded-xl bg-yellow-400 text-black hover:bg-yellow-300 font-semibold tracking-[0.18em]"
      >
        {loading ? "AUTENTICANDO..." : "AUTENTICAR OPERADOR →"}
      </Button>

      <Button
        type="button"
        onClick={() => onGoogle().catch(() => {})}
        disabled={loading}
        className="h-12 w-full rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10 font-semibold"
      >
        Entrar com Google
      </Button>

      <div className="pt-2 text-center text-[10px] tracking-[0.25em] text-white/35">
        NÃO POSSUI CREDENCIAIS?{" "}
        <a
          href="/auth/register"
          className="text-white/65 hover:text-white underline underline-offset-4"
        >
          CRIAR AGORA
        </a>
      </div>
    </form>
  );
}
