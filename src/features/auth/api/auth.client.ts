import { supabaseBrowser } from "@/server/supabase/browser";

export async function signInWithPassword(email: string, password: string) {
  const supabase = supabaseBrowser();
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithPassword(params: {
  email: string;
  password: string;
  fullName: string;
}) {
  const supabase = supabaseBrowser();
  return supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      data: { full_name: params.fullName },
    },
  });
}

export async function signInWithGoogle(redirectTo: string) {
  const supabase = supabaseBrowser();
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
}
