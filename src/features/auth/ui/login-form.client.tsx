"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, LoginInput } from "../model/auth.schema";
import { signInWithPassword, signInWithGoogle } from "../api/auth.client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const redirectTo = useMemo(
    () => `${window.location.origin}/auth/callback`,
    [],
  );

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(values: LoginInput) {
    setLoading(true);
    const { error } = await signInWithPassword(values.email, values.password);
    setLoading(false);

    if (!error) router.push("/dashboard");
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <Input placeholder="EMAIL" {...form.register("email")} />
      <Input
        type="password"
        placeholder="SENHA"
        {...form.register("password")}
      />

      <Button type="submit" disabled={loading}>
        AUTENTICAR OPERADOR →
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={() => signInWithGoogle(redirectTo)}
      >
        Entrar com Google
      </Button>
    </form>
  );
}
