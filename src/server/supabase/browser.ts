import { createBrowserClient } from "@supabase/ssr";
import { envPublic } from "@/shared/config/env.public";

export function supabaseBrowser() {
  return createBrowserClient(
    envPublic.NEXT_PUBLIC_SUPABASE_URL,
    envPublic.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
