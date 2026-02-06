import { createClient } from "@supabase/supabase-js";
import { env } from "@/shared/config/env";

export const supabaseBrowser = () =>
  createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
