"use client";

import React, { useState } from 'react';
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Target, Share2, UserPlus, ChevronRight, Menu } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";

export default function SettingsHubPage() {
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

  const settingsOptions = [
    {
      title: "Metas",
      description: "Defina metas de ROAS, Receita e CPA por etapa.",
      icon: <Target className="text-brand-500" size={24} />,
      href: "/settings/goals"
    },
    {
      title: "Integrações",
      description: "Gerencie conexões com Kommo, Meta Ads e outras ferramentas.",
      icon: <Share2 className="text-blue-500" size={24} />,
      href: "/integrations"
    },
    {
      title: "Compartilhamento",
      description: "Gerencie o acesso e compartilhamento da conta.",
      icon: <UserPlus className="text-purple-500" size={24} />,
      href: "/sharing"
    }
  ];

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
            <button
              className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-bold text-foreground">Configurações</h1>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-background">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground tracking-tight">Central de Configurações</h2>
              <p className="text-muted-foreground">Gerencie todos os aspectos da sua conta e integrações.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {settingsOptions.map((option, index) => (
                <button
                  key={index}
                  onClick={() => router.push(option.href)}
                  className="flex flex-col items-start p-6 bg-card border border-border rounded-2xl hover:border-brand-500/50 hover:shadow-lg hover:shadow-brand-500/10 transition-all group text-left"
                >
                  <div className="p-3 bg-secondary/50 rounded-xl mb-4 group-hover:scale-110 transition-transform">
                    {option.icon}
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-brand-500 transition-colors">
                    {option.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 flex-1">
                    {option.description}
                  </p>
                  <div className="flex items-center text-sm font-medium text-brand-500 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-[-10px] group-hover:translate-x-0">
                    Acessar <ChevronRight size={16} className="ml-1" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
