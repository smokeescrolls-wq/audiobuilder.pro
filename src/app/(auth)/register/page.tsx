import { AuthCard } from "@/features/auth/ui/auth-card";
import { RegisterForm } from "@/features/auth/ui/register-form.client";

export default function RegisterPage() {
  return (
    <AuthCard subtitle="TERMINAL DE ACESSO SEGURO">
      <RegisterForm />
    </AuthCard>
  );
}
