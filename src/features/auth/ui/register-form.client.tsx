"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, KeyRound, User } from "lucide-react";
import { toast } from "sonner";
import { registerSchema, RegisterInput } from "../model/auth.schema";
import { signUpWithPassword } from "../api/auth.client";
import { Button } from "@/components/ui/button";
import { AuthInput } from "./auth-input";

export function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(values: RegisterInput) {
    setLoading(true);
    const { error } = await signUpWithPassword(values);
    setLoading(false);

    if (error) {
      // EFEITO NEON VERMELHO PARA ERRO
      const isAlreadyRegistered =
        error.message.includes("User already registered") ||
        error.status === 422;

      return toast.error(
        isAlreadyRegistered ? "ACESSO NEGADO" : "FALHA NO PROVISIONAMENTO",
        {
          description: isAlreadyRegistered
            ? "ESTE ENDEREÇO DE EMAIL JÁ ESTÁ SENDO UTILIZADO NO SISTEMA."
            : error.message.toUpperCase(),
          className:
            "group !bg-black/80 !backdrop-blur-md !border-red-500/40 !text-white shadow-[0_0_20px_rgba(239,68,68,0.15)] rounded-2xl border",
          descriptionClassName: "!text-red-200/60 tracking-[0.15em] text-[9px]",
          duration: 5000,
        },
      );
    }

    // EFEITO NEON VERDE PARA SUCESSO
    toast.success("SISTEMA PROVISIONADO", {
      description:
        "CONTA CRIADA COM SUCESSO. REDIRECIONANDO PARA O DASHBOARD...",
      className:
        "group !bg-black/80 !backdrop-blur-md !border-emerald-500/40 !text-white shadow-[0_0_20px_rgba(16,185,129,0.15)] rounded-2xl border",
      descriptionClassName: "!text-emerald-200/60 tracking-[0.15em] text-[9px]",
      duration: 3000,
    });

    router.push("/dashboard");
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <AuthInput
        icon={<User className="size-4" />}
        placeholder="NOME COMPLETO"
        {...form.register("fullName")}
      />
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
        className="h-12 w-full rounded-xl bg-yellow-400 text-black hover:bg-yellow-300 font-semibold tracking-[0.18em] transition-all duration-300 active:scale-[0.98]"
      >
        {loading ? "PROCESSANDO..." : "PROVISIONAR SISTEMA →"}
      </Button>

      <div className="pt-2 text-center text-[10px] tracking-[0.25em] text-white/35">
        JÁ POSSUI AUTORIZAÇÃO?{" "}
        <a
          href="/auth/login"
          className="text-white/65 hover:text-white underline underline-offset-4 transition-colors"
        >
          ENTRAR AQUI
        </a>
      </div>
    </form>
  );
}
