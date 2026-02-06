import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { envPublic } from "@/shared/config/env.public";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) return NextResponse.redirect(new URL("/auth/login", url.origin));

  const store = await cookies();

  const supabase = createServerClient(
    envPublic.NEXT_PUBLIC_SUPABASE_URL,
    envPublic.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll(items) {
          items.forEach(({ name, value, options }) => {
            store.set(name, value, options);
          });
        },
      },
    }
  );

  await supabase.auth.exchangeCodeForSession(code);

  const next = url.searchParams.get("next");
  return NextResponse.redirect(new URL(next || "/dashboard", url.origin));
}
