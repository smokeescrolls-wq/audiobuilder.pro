"use client";

import { useEffect, useState } from "react";
import {
  Shield,
  Loader2,
  Calendar,
  LayoutDashboard,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "@/features/auth/api/auth.client";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

type User = {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
  created_at: string;
};

type ProcessingHistory = {
  id: string;
  filename: string;
  processed_filename: string | null;
  status: string;
  download_url: string | null;
  created_at: string;
  completed_at: string | null;
};

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

function initialsFromName(name: string) {
  return (name || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

export function AdminPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userHistory, setUserHistory] = useState<ProcessingHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await fetch("/api/admin/users");
        if (!res.ok) throw new Error("Erro ao carregar usuários");
        const data = await res.json();
        setUsers(data.users || []);
      } catch (e) {
        console.error("Erro ao carregar usuários:", e);
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, []);

  async function loadUserHistory(userId: string) {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/history`);
      if (!res.ok) throw new Error("Erro ao carregar histórico");
      const data = await res.json();
      setUserHistory(data.history || []);
    } catch (e) {
      console.error("Erro ao carregar histórico:", e);
      setUserHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  function handleUserClick(user: User) {
    setSelectedUser(user);
    loadUserHistory(user.id);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString("pt-BR");
  }

  function getStatusBadge(status: string) {
    const variants: Record<string, { label: string; className: string }> = {
      queued: {
        label: "Na Fila",
        className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      },
      processing: {
        label: "Processando",
        className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
      },
      done: {
        label: "Concluído",
        className: "bg-green-500/10 text-green-400 border-green-500/20",
      },
      completed: {
        label: "Concluído",
        className: "bg-green-500/10 text-green-400 border-green-500/20",
      },
      error: {
        label: "Erro",
        className: "bg-red-500/10 text-red-400 border-red-500/20",
      },
      failed: {
        label: "Falhou",
        className: "bg-red-500/10 text-red-400 border-red-500/20",
      },
    };

    const variant = variants[status] || {
      label: status,
      className: "bg-white/10 text-white/60 border-white/20",
    };

    return (
      <Badge className={cn("border", variant.className)}>{variant.label}</Badge>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
          <span className="text-[12px] tracking-[0.22em] text-white/60">
            CARREGANDO PAINEL...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl border border-yellow-500/25 bg-yellow-500/10">
                <Shield className="h-4 w-4 text-yellow-400" />
              </div>
              <div className="text-[14px] font-extrabold tracking-tight">
                <span className="text-white">PAINEL </span>
                <span className="text-yellow-400">ADMINISTRATIVO</span>
              </div>
            </div>

            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 hover:bg-white/[0.08] transition cursor-pointer group"
            >
              <LayoutDashboard className="h-3.5 w-3.5 text-white/40 group-hover:text-yellow-400 transition" />
              <span className="text-[10px] tracking-[0.25em] text-white/60 group-hover:text-white transition">
                VOLTAR AO DASHBOARD
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-[10px] tracking-[0.28em] text-white/55">
                ADMIN MODE
              </span>
            </div>

            <button
              type="button"
              disabled={loggingOut}
              onClick={async () => {
                setLoggingOut(true);
                try {
                  await signOut();
                  router.push("/auth");
                } catch (e) {
                  console.error(e);
                } finally {
                  setLoggingOut(false);
                }
              }}
              className="p-2 rounded-full border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 transition cursor-pointer disabled:opacity-50"
              title="Sair"
            >
              {loggingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="mt-8">
          <Card className="rounded-2xl border-white/10 bg-white/[0.04] p-6">
            <div className="mb-6">
              <div className="text-[12px] tracking-[0.22em] text-white/60">
                USUÁRIOS REGISTRADOS
              </div>
              <div className="mt-1 text-[10px] tracking-[0.18em] text-white/35">
                Total: {users.length} usuário(s)
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-white/5">
                    <TableHead className="text-white/60 text-[10px] tracking-[0.22em]">
                      USUÁRIO
                    </TableHead>
                    <TableHead className="text-white/60 text-[10px] tracking-[0.22em]">
                      EMAIL
                    </TableHead>
                    <TableHead className="text-white/60 text-[10px] tracking-[0.22em]">
                      DATA DE REGISTRO
                    </TableHead>
                    <TableHead className="text-white/60 text-[10px] tracking-[0.22em]">
                      AÇÕES
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const fullName =
                      user.user_metadata?.full_name ||
                      user.email?.split("@")[0] ||
                      "Usuário";
                    const avatarUrl = user.user_metadata?.avatar_url;
                    const initials = initialsFromName(fullName);

                    return (
                      <TableRow
                        key={user.id}
                        className="border-white/10 hover:bg-white/5 cursor-pointer transition"
                        onClick={() => handleUserClick(user)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 border border-white/10 bg-black/40">
                              <AvatarImage src={avatarUrl} />
                              <AvatarFallback className="bg-white/[0.06] text-white/70 text-[10px]">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-[12px] text-white/80">
                              {fullName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-[12px] text-white/60">
                          {user.email || "—"}
                        </TableCell>
                        <TableCell className="text-[12px] text-white/60">
                          {formatDate(user.created_at)}
                        </TableCell>
                        <TableCell>
                          <button
                            className="text-[10px] tracking-[0.18em] text-yellow-400 hover:text-yellow-300 transition"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUserClick(user);
                            }}
                          >
                            VER HISTÓRICO
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>

        {/* User History Dialog */}
        <Dialog
          open={!!selectedUser}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedUser(null);
              setUserHistory([]);
            }
          }}
        >
          <DialogContent className="p-0 overflow-hidden border-white/10 bg-black/80 text-white shadow-2xl rounded-3xl max-w-[800px] max-h-[80vh]">
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-transparent" />

            <div className="relative">
              <DialogHeader className="px-7 py-5 border-b border-white/10">
                <DialogTitle className="text-[12px] tracking-[0.22em] text-white/85">
                  HISTÓRICO DE PROCESSAMENTO
                </DialogTitle>
                {selectedUser && (
                  <div className="mt-2 flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-white/10 bg-black/40">
                      <AvatarImage
                        src={selectedUser.user_metadata?.avatar_url}
                      />
                      <AvatarFallback className="bg-white/[0.06] text-white/70 text-[10px]">
                        {initialsFromName(
                          selectedUser.user_metadata?.full_name ||
                            selectedUser.email?.split("@")[0] ||
                            "U",
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-[13px] text-white/90">
                        {selectedUser.user_metadata?.full_name ||
                          selectedUser.email?.split("@")[0] ||
                          "Usuário"}
                      </div>
                      <div className="text-[10px] text-white/50">
                        {selectedUser.email}
                      </div>
                    </div>
                  </div>
                )}
              </DialogHeader>

              <div className="px-7 py-6 overflow-y-auto max-h-[60vh]">
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin text-yellow-400" />
                      <span className="text-[11px] tracking-[0.18em] text-white/60">
                        CARREGANDO...
                      </span>
                    </div>
                  </div>
                ) : userHistory.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 mb-3">
                      <Calendar className="h-5 w-5 text-white/40" />
                    </div>
                    <div className="text-[11px] tracking-[0.18em] text-white/40">
                      NENHUM HISTÓRICO ENCONTRADO
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {userHistory.map((item) => (
                      <Card
                        key={item.id}
                        className="rounded-xl border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.05] transition"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] text-white/90 truncate">
                              {item.processed_filename || item.filename}
                            </div>
                            <div className="mt-1 text-[10px] text-white/50">
                              Original: {item.filename}
                            </div>
                            <div className="mt-2 flex items-center gap-3 text-[10px] text-white/40">
                              <span>Criado: {formatDate(item.created_at)}</span>
                              {item.completed_at && (
                                <span>
                                  Concluído: {formatDate(item.completed_at)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div>{getStatusBadge(item.status)}</div>
                        </div>
                        {item.download_url && (
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <a
                              href={item.download_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] tracking-[0.18em] text-yellow-400 hover:text-yellow-300 transition"
                            >
                              BAIXAR ARQUIVO
                            </a>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
