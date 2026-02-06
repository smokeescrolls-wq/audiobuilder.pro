"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, KeyRound } from "lucide-react";
import { loginSchema, LoginInput } from "../model/auth.schema";
import { signInWithPassword, signInWithGoogle } from "../api/auth.client";
import { Button } from "@/components/ui/button";
import { AuthInput } from "./auth-input";

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(values: LoginInput) {
    setLoading(true);
    const { error } = await signInWithPassword(values.email, values.password);
    setLoading(false);

    if (!error) router.push("/dashboard");
  }

  async function onGoogle() {
    const origin = window.location.origin;
    const redirectTo = `${origin}/auth/callback`;
    await signInWithGoogle(redirectTo);
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
        AUTENTICAR OPERADOR →
      </Button>

      <Button
        type="button"
        onClick={onGoogle}
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
