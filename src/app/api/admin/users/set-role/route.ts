import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/server/supabase/server";
import { supabaseAdmin } from "@/server/supabase/admin";

const schema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["user", "admin"]),
});

export async function POST(req: Request) {
  const supabase = supabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (roleRow?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const input = schema.parse(body);

  const admin = supabaseAdmin();
  const { error } = await admin
    .from("user_roles")
    .upsert({ user_id: input.userId, role: input.role }, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
