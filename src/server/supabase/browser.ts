import { createClient } from "@supabase/supabase-js";
import { envPublic } from "@/shared/config/env.public";

export const supabaseBrowser = () =>
  createClient(
    envPublic.NEXT_PUBLIC_SUPABASE_URL,
    envPublic.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
