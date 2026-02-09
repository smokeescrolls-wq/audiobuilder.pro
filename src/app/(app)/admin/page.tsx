import { redirect } from "next/navigation";
import { supabaseServer } from "@/server/supabase/server";
import { AdminPanel } from "@/features/admin/ui/admin-painel.client";

export default async function AdminPage() {
  const supabase = await supabaseServer();

  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    redirect("/auth");
  }

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (roleRow?.role !== "admin") {
    redirect("/dashboard");
  }

  return <AdminPanel />;
}
