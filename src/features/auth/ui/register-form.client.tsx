"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, RegisterInput } from "../model/auth.schema";
import { signUpWithPassword } from "../api/auth.client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      <Input placeholder="NOME COMPLETO" {...form.register("fullName")} />
      <Input placeholder="EMAIL" {...form.register("email")} />
      <Input
        type="password"
        placeholder="SENHA"
        {...form.register("password")}
      />

      <Button type="submit" disabled={loading}>
        PROVISIONAR SISTEMA →
      </Button>
    </form>
  );
}
