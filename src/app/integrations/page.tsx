'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Link, Facebook, Menu, BarChart3, Waypoints } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { IntegrationCard } from '@/components/IntegrationCard';
import { KommoConfigModal } from '@/components/KommoConfigModal';
import { MetaConfigModal } from '@/components/MetaConfigModal';
import { GoogleConfigModal } from '@/components/GoogleConfigModal';
import { JourneyConfigModal } from '@/components/JourneyConfigModal';
import { Sidebar } from '@/components/Sidebar';
import { useSession } from 'next-auth/react';

export default function IntegrationsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isKommoModalOpen, setIsKommoModalOpen] = useState(false);
  const [kommoStatus, setKommoStatus] = useState(false);
  const [isMetaModalOpen, setIsMetaModalOpen] = useState(false);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [isJourneyModalOpen, setIsJourneyModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const fetchKommoStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/kommo');
      if (res.ok) {
        const data = await res.json();
        setKommoStatus(data.isActive);
      }
    } catch (error) {
      console.error('Erro ao verificar status Kommo:', error);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await fetchKommoStatus();
    })();
  }, [fetchKommoStatus]);

  return (
    <div className="flex h-screen bg-background text-foreground font-sans">
      <Sidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        currentAccount={{
          id: session?.user?.clientId || '',
          name: session?.user?.name || '',
          image: session?.user?.image,
        }}
        availableAccounts={[]} // Placeholder
        onAccountChange={() => {}}
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
            <button
              onClick={() => router.back()}
              className="hidden md:block p-2 -ml-2 hover:bg-secondary rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-muted-foreground" />
            </button>
            <h1 className="text-xl font-bold text-foreground">Integrações</h1>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-background">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground tracking-tight">
                Gerenciar Conexões
              </h2>
              <p className="text-muted-foreground">
                Conecte suas ferramentas para sincronizar dados automaticamente.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Kommo CRM */}
              <IntegrationCard
                name="Kommo CRM"
                description="Sincronize leads e etapas do funil de vendas automaticamente."
                icon={<Link size={24} className="text-blue-500" />}
                isActive={kommoStatus}
                onConfigure={() => setIsKommoModalOpen(true)}
              />

              {/* Meta Ads */}
              <IntegrationCard
                name="Meta Ads"
                description="Conecte sua conta de anúncios para importar campanhas e custos."
                icon={<Facebook size={24} className="text-blue-600" />}
                isActive={true}
                onConfigure={() => setIsMetaModalOpen(true)}
              />

              {/* Google Ads */}
              <IntegrationCard
                name="Google Ads"
                description="Importe campanhas, grupos de anúncios e palavras-chave."
                icon={<BarChart3 size={24} className="text-yellow-500" />}
                isActive={true} // Logic to check status can be added here or inside modal
                onConfigure={() => setIsGoogleModalOpen(true)}
              />

              {/* Jornada do Lead — cross-platform (Meta + Google), não é uma config do Kommo. O
                  Kommo é só a fonte de etapas usada hoje; por isso o card fica separado dos
                  outros 3, que são conexões de plataforma. */}
              <IntegrationCard
                name="Jornada do Lead"
                description="Etapas do funil que disparam eventos de conversão pra Meta e Google."
                icon={<Waypoints size={24} className="text-brand-500" />}
                isActive={true}
                onConfigure={() => setIsJourneyModalOpen(true)}
              />
            </div>

            {/* Modals */}
            <KommoConfigModal
              isOpen={isKommoModalOpen}
              onClose={() => setIsKommoModalOpen(false)}
              onSuccess={fetchKommoStatus}
            />
            <MetaConfigModal
              isOpen={isMetaModalOpen}
              onClose={() => setIsMetaModalOpen(false)}
              onSuccess={() => {}}
            />
            <GoogleConfigModal
              isOpen={isGoogleModalOpen}
              onClose={() => setIsGoogleModalOpen(false)}
              onSuccess={() => {}}
            />
            <JourneyConfigModal
              isOpen={isJourneyModalOpen}
              onClose={() => setIsJourneyModalOpen(false)}
              onSuccess={() => {}}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
