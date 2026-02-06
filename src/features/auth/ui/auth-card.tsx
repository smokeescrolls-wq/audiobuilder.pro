"use client";

import { ReactNode } from "react";
import { Shield } from "lucide-react";
import { Card } from "@/components/ui/card";

export function AuthCard(props: { subtitle: string; children: ReactNode }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-black text-white">
      <div className="w-full max-w-md px-4">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 grid place-items-center size-12 rounded-2xl border border-yellow-500/40 bg-yellow-500/10">
            <Shield className="size-5 text-yellow-400" />
          </div>

          <div className="text-3xl font-black tracking-tight">
            <span className="text-white">AUDIO</span>
            <span className="text-yellow-400">BUILDER</span>
          </div>

          <div className="mt-2 text-[10px] tracking-[0.35em] text-white/50">
            {props.subtitle}
          </div>
        </div>

        <Card className="border-white/10 bg-white/5 backdrop-blur rounded-2xl p-5">
          {props.children}
        </Card>

        <div className="mt-4 text-center text-[10px] tracking-[0.25em] text-white/30">
          NEURAL-LOCK ENCRYPTION v2.4 ACTIVE
        </div>
      </div>
    </div>
  );
}
