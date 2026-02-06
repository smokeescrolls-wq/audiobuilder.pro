import "server-only";
import { createClient } from "@supabase/supabase-js";
import { envPublic } from "@/shared/config/env.public";
import { envServer } from "@/shared/config/env.server";

export const supabaseAdmin = () =>
  createClient(
    envPublic.NEXT_PUBLIC_SUPABASE_URL,
    envServer.SUPABASE_SERVICE_ROLE_KEY
  );
