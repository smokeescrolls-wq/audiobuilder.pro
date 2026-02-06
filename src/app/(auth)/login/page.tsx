import { AuthCard } from "@/features/auth/ui/auth-card";
import { LoginForm } from "@/features/auth/ui/login-form.client";

export default function LoginPage() {
  return (
    <AuthCard subtitle="TERMINAL DE ACESSO SEGURO">
      <LoginForm />
    </AuthCard>
  );
}
