"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { UserPlus, Mail, Trash2, Check, X, Clock, Shield, ArrowLeft, User, Menu } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { Sidebar } from "@/components/Sidebar";

interface Invite {
  id: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  createdAt: string;
  guest?: {
    name: string;
    email: string;
    image: string | null;
  };
  owner?: {
    name: string;
    email: string;
    image: string | null;
  };
}

export default function SharingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [sentInvites, setSentInvites] = useState<Invite[]>([]);
  const [receivedInvites, setReceivedInvites] = useState<Invite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (status === "authenticated") {
      fetchInvites();
    }
  }, [status, router]);

  const fetchInvites = async () => {
    try {
      const res = await fetch("/api/sharing");
      if (res.ok) {
        const data = await res.json();
        setSentInvites(data.sent);
        setReceivedInvites(data.received);
      }
    } catch (error) {
      console.error("Erro ao buscar convites", error);
      showToast("Erro ao carregar convites", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setIsInviting(true);
    try {
      const res = await fetch("/api/sharing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      });

      if (res.ok) {
        showToast("Convite enviado com sucesso!", "success");
        setInviteEmail("");
        fetchInvites();
      } else {
        const data = await res.json();
        showToast(data.error || "Erro ao enviar convite", "error");
      }
    } catch (error) {
      console.error("Erro ao enviar convite", error);
      showToast("Erro ao enviar convite", "error");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRespondInvite = async (inviteId: string, status: "ACCEPTED" | "DECLINED") => {
    try {
      const res = await fetch("/api/sharing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId, status }),
      });

      if (res.ok) {
        showToast(status === "ACCEPTED" ? "Convite aceito!" : "Convite recusado.", "success");
        fetchInvites();
      } else {
        showToast("Erro ao responder convite", "error");
      }
    } catch (error) {
      console.error("Erro ao responder convite", error);
      showToast("Erro ao responder convite", "error");
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    if (!confirm("Tem certeza que deseja remover este acesso/convite?")) return;

    try {
      const res = await fetch(`/api/sharing?id=${inviteId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        showToast("Removido com sucesso!", "success");
        fetchInvites();
      } else {
        showToast("Erro ao remover", "error");
      }
    } catch (error) {
      console.error("Erro ao remover", error);
      showToast("Erro ao remover", "error");
    }
  };

  if (status === "loading" || isLoading) {
    return <div className="flex items-center justify-center min-h-screen bg-background text-foreground">Carregando...</div>;
  }

  return (
    <div className="flex h-screen bg-background text-foreground font-sans">
      <Sidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        currentAccount={{ id: session?.user?.clientId || '', name: session?.user?.name || '', image: session?.user?.image }}
        availableAccounts={[]} // Placeholder
        onAccountChange={() => { }}
      />

      <main className="flex-1 flex flex-col h-screen relative overflow-hidden">
        <header className="h-16 bg-card/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 md:px-8 shadow-sm z-30">
          <div className="flex items-center gap-4">
            <button
              className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-bold text-foreground">Compartilhamento</h1>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-background">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Share Access Section */}
              <div className="space-y-6">
                <div className="bg-card/50 backdrop-blur-md border border-border rounded-xl shadow-xl overflow-hidden glass neon-border">
                  <div className="p-6 border-b border-border bg-secondary/30">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-brand-500/20 rounded-lg">
                        <UserPlus size={20} className="text-brand-500" />
                      </div>
                      <h2 className="text-lg font-bold text-foreground">Compartilhar Acesso</h2>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 ml-11">
                      Convide outros usuários para acessar sua conta.
                    </p>
                  </div>

                  <div className="p-6 space-y-6">
                    <form onSubmit={handleSendInvite} className="flex gap-2">
                      <div className="relative flex-1">
                        <Mail size={18} className="absolute left-3 top-3 text-muted-foreground" />
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="Email do usuário"
                          className="w-full pl-10 pr-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isInviting}
                        className="px-4 py-2 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-500/20"
                      >
                        {isInviting ? "Enviando..." : "Convidar"}
                      </button>
                    </form>

                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Convites Enviados / Acessos</h3>
                      {sentInvites.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">Nenhum convite enviado.</p>
                      ) : (
                        sentInvites.map((invite) => (
                          <div key={invite.id} className="flex items-center justify-between p-3 bg-secondary/20 border border-border rounded-xl">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                                {invite.guest?.image ? (
                                  <img src={invite.guest.image} alt={invite.guest.name} className="w-full h-full object-cover" />
                                ) : (
                                  <User size={14} className="text-muted-foreground" />
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">{invite.guest?.name}</p>
                                <p className="text-xs text-muted-foreground">{invite.guest?.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${invite.status === 'ACCEPTED' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                invite.status === 'DECLINED' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                  'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                                }`}>
                                {invite.status === 'ACCEPTED' ? 'Ativo' :
                                  invite.status === 'DECLINED' ? 'Recusado' : 'Pendente'}
                              </span>
                              <button
                                onClick={() => handleDeleteInvite(invite.id)}
                                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                title="Remover acesso"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Received Invites Section */}
              <div className="space-y-6">
                <div className="bg-card/50 backdrop-blur-md border border-border rounded-xl shadow-xl overflow-hidden glass neon-border">
                  <div className="p-6 border-b border-border bg-secondary/30">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-brand-500/20 rounded-lg">
                        <Shield size={20} className="text-brand-500" />
                      </div>
                      <h2 className="text-lg font-bold text-foreground">Convites Recebidos</h2>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 ml-11">
                      Gerencie os acessos que compartilharam com você.
                    </p>
                  </div>

                  <div className="p-6 space-y-4">
                    {receivedInvites.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic text-center py-8">Você não tem convites pendentes ou ativos.</p>
                    ) : (
                      receivedInvites.map((invite) => (
                        <div key={invite.id} className="flex items-center justify-between p-4 bg-secondary/20 border border-border rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden border border-border">
                              {invite.owner?.image ? (
                                <img src={invite.owner.image} alt={invite.owner.name} className="w-full h-full object-cover" />
                              ) : (
                                <User size={18} className="text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">Convite de <span className="font-bold">{invite.owner?.name}</span></p>
                              <p className="text-xs text-muted-foreground">{invite.owner?.email}</p>
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Clock size={10} /> {new Date(invite.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {invite.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => handleRespondInvite(invite.id, 'ACCEPTED')}
                                  className="p-2 bg-green-500/10 text-green-500 hover:bg-green-500/20 border border-green-500/20 rounded-lg transition-colors"
                                  title="Aceitar"
                                >
                                  <Check size={18} />
                                </button>
                                <button
                                  onClick={() => handleRespondInvite(invite.id, 'DECLINED')}
                                  className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors"
                                  title="Recusar"
                                >
                                  <X size={18} />
                                </button>
                              </>
                            )}
                            {invite.status === 'ACCEPTED' && (
                              <span className="px-3 py-1 bg-green-500/10 text-green-500 border border-green-500/20 rounded-full text-xs font-medium flex items-center gap-1">
                                <Check size={12} /> Aceito
                              </span>
                            )}
                            {invite.status === 'DECLINED' && (
                              <div className="flex items-center gap-2">
                                <span className="px-3 py-1 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full text-xs font-medium">
                                  Recusado
                                </span>
                                <button
                                  onClick={() => handleDeleteInvite(invite.id)}
                                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                  title="Limpar"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
