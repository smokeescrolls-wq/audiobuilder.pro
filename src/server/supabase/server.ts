import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/shared/config/env";

export const supabaseServer = async () => {
  const store = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
};
