import { NextResponse } from "next/server";
import { supabaseServer } from "@/server/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const supabase = await supabaseServer();

  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (roleRow?.role !== "admin")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const { userId } = await params;

    // Buscar histórico de processamento usando Supabase
    const { data: history, error } = await supabase
      .from("processing_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.warn("Erro ao buscar histórico:", error);
      // Retornar histórico vazio se a tabela não existir
      return NextResponse.json({ history: [] });
    }

    return NextResponse.json({ history: history || [] });
  } catch (error) {
    console.error("Erro ao buscar histórico:", error);
    return NextResponse.json({ history: [] });
  }
}
