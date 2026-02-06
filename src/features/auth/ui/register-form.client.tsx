"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, KeyRound, User } from "lucide-react";
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

    if (!error) router.push("/dashboard");
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
        className="h-12 w-full rounded-xl bg-yellow-400 text-black hover:bg-yellow-300 font-semibold tracking-[0.18em]"
      >
        PROVISIONAR SISTEMA →
      </Button>

      <div className="pt-2 text-center text-[10px] tracking-[0.25em] text-white/35">
        JÁ POSSUI AUTORIZAÇÃO?{" "}
        <a
          href="/auth/login"
          className="text-white/65 hover:text-white underline underline-offset-4"
        >
          ENTRAR AQUI
        </a>
      </div>
    </form>
  );
}
