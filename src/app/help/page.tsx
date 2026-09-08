'use client';

import React, { useState } from 'react';
import {
  BookOpen,
  LayoutDashboard,
  Target,
  Settings,
  Link as LinkIcon,
  Shield,
  FileText,
  Lock,
} from 'lucide-react';
import Link from 'next/link';

const TOPICS = [
  {
    id: 'intro',
    title: 'Introdução',
    icon: BookOpen,
    content: (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Bem-vindo ao TrackFlow</h2>
        <p className="text-muted-foreground">
          O TrackFlow é sua plataforma central para rastreamento e otimização de anúncios. Aqui você
          pode conectar suas contas de anúncio, visualizar métricas unificadas e acompanhar a
          jornada do seu cliente.
        </p>
        <div className="bg-secondary/20 p-4 rounded-xl border border-border">
          <h3 className="font-semibold text-foreground mb-2">Primeiros Passos</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li>
              Conecte suas contas em <strong>Configurações &gt; Integrações</strong>.
            </li>
            <li>Defina suas metas de campanha.</li>
            <li>Acompanhe os resultados no Dashboard Geral.</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: 'dashboard',
    title: 'Dashboard Geral',
    icon: LayoutDashboard,
    content: (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Dashboard Geral</h2>
        <p className="text-muted-foreground">
          O Dashboard oferece uma visão macro do desempenho das suas campanhas.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-card p-4 rounded-xl border border-border">
            <h3 className="font-semibold text-foreground mb-2">Métricas Principais</h3>
            <p className="text-sm text-muted-foreground">
              Visualize Investimento Total, Receita, ROAS e Leads em tempo real.
            </p>
          </div>
          <div className="bg-card p-4 rounded-xl border border-border">
            <h3 className="font-semibold text-foreground mb-2">Filtros</h3>
            <p className="text-sm text-muted-foreground">
              Use o seletor de data no topo para filtrar os dados por período (últimos 7, 14, 30
              dias ou personalizado).
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'campaigns',
    title: 'Campanhas',
    icon: Target,
    content: (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Gerenciamento de Campanhas</h2>
        <p className="text-muted-foreground">
          A tela de Campanhas permite uma análise detalhada e hierárquica (Campanha &gt; Conjunto
          &gt; Anúncio).
        </p>
        <div className="space-y-4">
          <div className="bg-secondary/10 p-4 rounded-xl border border-border">
            <h3 className="font-semibold text-foreground mb-2">Avaliação Automática</h3>
            <p className="text-sm text-muted-foreground">
              O sistema avalia automaticamente suas campanhas com base nas metas configuradas:
            </p>
            <div className="flex gap-2 mt-2">
              <span className="px-2 py-1 bg-green-500/10 text-green-500 rounded text-xs">
                🤩 Bom
              </span>
              <span className="px-2 py-1 bg-yellow-500/10 text-yellow-500 rounded text-xs">
                😐 Aceitável
              </span>
              <span className="px-2 py-1 bg-red-500/10 text-red-500 rounded text-xs">
                😟 Crítico
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'integrations',
    title: 'Integrações',
    icon: LinkIcon,
    content: (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Integrações</h2>
        <p className="text-muted-foreground">
          Conecte suas fontes de dados para centralizar suas métricas.
        </p>
        <ul className="space-y-2">
          <li className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-2 h-2 bg-blue-500 rounded-full" />
            <strong>Meta Ads:</strong> Importa campanhas, conjuntos e anúncios do
            Facebook/Instagram.
          </li>
          <li className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-2 h-2 bg-orange-500 rounded-full" />
            <strong>Kommo CRM:</strong> Sincroniza leads e vendas para cálculo de ROAS real.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: 'settings',
    title: 'Configurações',
    icon: Settings,
    content: (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Configurações</h2>
        <p className="text-muted-foreground">Personalize sua experiência no TrackFlow.</p>
        <div className="grid gap-4">
          <div className="bg-card p-4 rounded-xl border border-border">
            <h3 className="font-semibold text-foreground mb-2">Metas</h3>
            <p className="text-sm text-muted-foreground">
              Defina metas de ROAS, CPA e Receita para que o sistema avalie suas campanhas
              automaticamente.
            </p>
          </div>
        </div>
      </div>
    ),
  },
];

export default function HelpPage() {
  const [selectedTopicId, setSelectedTopicId] = useState(TOPICS[0].id);

  const selectedTopic = TOPICS.find((t) => t.id === selectedTopicId) || TOPICS[0];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar Topics */}
      <div className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="text-brand-500" />
            Central de Ajuda
          </h1>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {TOPICS.map((topic) => (
            <button
              key={topic.id}
              onClick={() => setSelectedTopicId(topic.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${
                selectedTopicId === topic.id
                  ? 'bg-brand-500/10 text-brand-500 border border-brand-500/20'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              <topic.icon size={18} />
              {topic.title}
            </button>
          ))}
        </nav>

        {/* Legal Links Footer */}
        <div className="p-4 border-t border-border bg-secondary/10">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
            Legal & Privacidade
          </h3>
          <div className="space-y-1">
            <Link
              href="/legal/terms"
              target="_blank"
              className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-brand-500 transition-colors rounded-lg hover:bg-brand-500/5"
            >
              <FileText size={14} /> Termos de Uso
            </Link>
            <Link
              href="/legal/privacy"
              target="_blank"
              className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-brand-500 transition-colors rounded-lg hover:bg-brand-500/5"
            >
              <Lock size={14} /> Política de Privacidade
            </Link>
            <Link
              href="/legal/lgpd"
              target="_blank"
              className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-brand-500 transition-colors rounded-lg hover:bg-brand-500/5"
            >
              <Shield size={14} /> LGPD
            </Link>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto bg-background p-8 md:p-12">
        <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-8 flex items-center gap-4">
            <div className="p-3 bg-brand-500/10 rounded-2xl text-brand-500">
              <selectedTopic.icon size={32} />
            </div>
            <div>
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Tópico
              </h2>
              <h1 className="text-3xl font-bold text-foreground">{selectedTopic.title}</h1>
            </div>
          </div>

          <div className="prose prose-invert max-w-none">{selectedTopic.content}</div>
        </div>
      </div>
    </div>
  );
}
