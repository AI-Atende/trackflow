"use client";

import React, { useState } from 'react';
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, Menu } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";

export default function SharingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (status === "loading") {
    return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  }

  if (status === "unauthenticated") {
    router.push("/auth/login");
    return null;
  }

  return (
    <div className="flex h-screen bg-background text-foreground font-sans">
      <Sidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        currentAccount={{ id: session?.user?.clientId || '', name: session?.user?.name || '', image: session?.user?.image }}
        availableAccounts={[]}
        onAccountChange={() => { }}
      />

      <main className="flex-1 flex flex-col h-screen relative overflow-hidden">
        <header className="h-16 bg-card/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 md:px-8 shadow-sm z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-secondary rounded-lg transition-colors">
              <ArrowLeft size={20} className="text-muted-foreground" />
            </button>
            <h1 className="text-xl font-bold text-foreground">Compartilhamento</h1>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-background">
          <div className="max-w-4xl mx-auto text-center py-20">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-500/10 rounded-full mb-6">
              <UserPlus size={40} className="text-purple-500" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Compartilhamento em Breve</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Em breve você poderá convidar membros para sua equipe e gerenciar permissões de acesso.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
