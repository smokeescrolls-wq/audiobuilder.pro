import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { envPublic } from "@/shared/config/env.public";

export const supabaseServer = async () => {
  const store = await cookies();

  return createServerClient(
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
};
