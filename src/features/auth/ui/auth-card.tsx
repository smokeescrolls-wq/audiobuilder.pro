"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/shared/lib/utils";

export function AuthCard(props: { subtitle: string; children: ReactNode }) {
  const pathname = usePathname();

  const isLogin = pathname?.includes("/auth/login");
  const isRegister = pathname?.includes("/auth/register");

  return (
    <div className="min-h-screen w-full bg-black text-white relative overflow-hidden">
      {/* background grain + vignette */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0.55)_60%,rgba(0,0,0,0.9)_100%)]" />

      <div className="relative min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-[520px]">
          {/* logo */}
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-4 grid place-items-center size-12 rounded-2xl border border-yellow-500/35 bg-yellow-500/10 shadow-[0_0_40px_rgba(234,179,8,0.15)]">
              <Shield className="size-5 text-yellow-400" />
            </div>

            <div className="text-[34px] leading-none font-extrabold tracking-tight">
              <span className="text-white">AUDIO</span>
              <span className="text-yellow-400">BUILDER</span>
            </div>

            <div className="mt-2 text-[10px] tracking-[0.35em] text-white/45 font-medium">
              {props.subtitle}
            </div>
          </div>

          {/* tabs bar */}
          <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-1 backdrop-blur">
            <div className="grid grid-cols-2 gap-1">
              <Link
                href="/auth/login"
                className={cn(
                  "h-9 rounded-lg grid place-items-center text-[11px] tracking-[0.25em] font-semibold transition",
                  isLogin
                    ? "bg-yellow-400 text-black"
                    : "text-white/55 hover:text-white",
                )}
              >
                ACESSAR
              </Link>
              <Link
                href="/auth/register"
                className={cn(
                  "h-9 rounded-lg grid place-items-center text-[11px] tracking-[0.25em] font-semibold transition",
                  isRegister
                    ? "bg-yellow-400 text-black"
                    : "text-white/55 hover:text-white",
                )}
              >
                REGISTRAR
              </Link>
            </div>
          </div>

          {/* card */}
          <Card className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
            {props.children}
          </Card>

          {/* footer */}
          <div className="mt-4 text-center text-[10px] tracking-[0.25em] text-white/25">
            NEURAL-LOCK ENCRYPTION v2.4 ACTIVE
          </div>
        </div>
      </div>
    </div>
  );
}
