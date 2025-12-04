"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { User, MapPin, Check, FileText, ShieldCheck } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { maskPhone, maskCEP } from "@/lib/masks";

const BRAZIL_STATES = [
  { value: "AC", label: "Acre" }, { value: "AL", label: "Alagoas" }, { value: "AP", label: "Amapá" },
  { value: "AM", label: "Amazonas" }, { value: "BA", label: "Bahia" }, { value: "CE", label: "Ceará" },
  { value: "DF", label: "Distrito Federal" }, { value: "ES", label: "Espírito Santo" }, { value: "GO", label: "Goiás" },
  { value: "MA", label: "Maranhão" }, { value: "MT", label: "Mato Grosso" }, { value: "MS", label: "Mato Grosso do Sul" },
  { value: "MG", label: "Minas Gerais" }, { value: "PA", label: "Pará" }, { value: "PB", label: "Paraíba" },
  { value: "PR", label: "Paraná" }, { value: "PE", label: "Pernambuco" }, { value: "PI", label: "Piauí" },
  { value: "RJ", label: "Rio de Janeiro" }, { value: "RN", label: "Rio Grande do Norte" }, { value: "RS", label: "Rio Grande do Sul" },
  { value: "RO", label: "Rondônia" }, { value: "RR", label: "Roraima" }, { value: "SC", label: "Santa Catarina" },
  { value: "SP", label: "São Paulo" }, { value: "SE", label: "Sergipe" }, { value: "TO", label: "Tocantins" }
];

export default function CompleteProfilePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    fullName: "",
    phone: "",
    birthDate: "",
    street: "",
    number: "",
    neighborhood: "",
    city: "",
    state: "",
    zip: "",
    termsAccepted: false,
    lgpdConsent: false
  });

  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    console.log("[COMPLETE-PROFILE] Status:", status, "Session:", session);
    if (status === "unauthenticated") {
      console.log("[COMPLETE-PROFILE] Unauthenticated, showing login link...");
      router.push("/auth/login");
    } else if (status === "authenticated") {
      if (session?.user?.isProfileComplete) {
        console.log("[COMPLETE-PROFILE] Profile already complete.");
        setIsComplete(true);
        // We do NOT redirect automatically to avoid loops.
        router.push("/");
      } else {
        setFormData(prev => ({ ...prev, name: session.user.name || "" }));
      }
    }
  }, [status, session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.termsAccepted || !formData.lgpdConsent) {
      showToast("Você deve aceitar os Termos e a Política de Privacidade.", "error");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          fullName: formData.fullName,
          phone: formData.phone,
          birthDate: formData.birthDate,
          address: {
            street: formData.street,
            number: formData.number,
            neighborhood: formData.neighborhood,
            city: formData.city,
            state: formData.state,
            zip: formData.zip
          },
          termsAccepted: formData.termsAccepted,
          lgpdConsent: formData.lgpdConsent
        }),
      });

      if (res.ok) {
        await update({
          phone: formData.phone,
          birthDate: formData.birthDate,
          address: { ...formData }, // Simplified for session update trigger
          isProfileComplete: true
        });
        showToast("Cadastro concluído com sucesso!", "success");
        router.push("/");
      } else {
        const data = await res.json();
        showToast(data.error || "Erro ao salvar perfil", "error");
      }
    } catch (error) {
      console.error("Erro ao salvar", error);
      showToast("Erro ao salvar perfil", "error");
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "loading") {
    return <div className="flex items-center justify-center min-h-screen bg-background text-foreground">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl glass neon-border">
        <div className="p-8 border-b border-border bg-secondary/30 text-center">
          <h1 className="text-2xl font-bold text-foreground">Complete seu Cadastro</h1>
          <p className="text-muted-foreground mt-2">Precisamos de algumas informações adicionais para continuar.</p>
        </div>

        {isComplete ? (
          <div className="p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto">
              <Check size={32} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Perfil Completo!</h2>
              <p className="text-muted-foreground mt-2">Seu cadastro já está finalizado.</p>
            </div>
            <button
              onClick={() => window.location.href = "/"}
              className="px-6 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-all w-full"
            >
              Ir para o Dashboard
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {/* Personal Info */}
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <User size={16} /> Dados Pessoais
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Nome da Conta (Público)</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-secondary/30 border border-border rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Nome Completo (Privado)</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-4 py-2 bg-secondary/30 border border-border rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Telefone / WhatsApp</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: maskPhone(e.target.value) })}
                    placeholder="(00) 00000-0000"
                    className="w-full px-4 py-2 bg-secondary/30 border border-border rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Data de Nascimento</label>
                  <DatePicker
                    value={formData.birthDate}
                    onChange={(val: string) => setFormData({ ...formData, birthDate: val })}
                    placeholder="DD/MM/AAAA"
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <MapPin size={16} /> Endereço
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1 space-y-2">
                  <label className="text-sm font-medium text-foreground">CEP</label>
                  <input
                    type="text"
                    value={formData.zip}
                    onChange={(e) => setFormData({ ...formData, zip: maskCEP(e.target.value) })}
                    placeholder="00000-000"
                    className="w-full px-4 py-2 bg-secondary/30 border border-border rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all"
                    required
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-medium text-foreground">Rua</label>
                  <input
                    type="text"
                    value={formData.street}
                    onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                    className="w-full px-4 py-2 bg-secondary/30 border border-border rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Número</label>
                  <input
                    type="text"
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    className="w-full px-4 py-2 bg-secondary/30 border border-border rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all"
                    required
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-medium text-foreground">Bairro</label>
                  <input
                    type="text"
                    value={formData.neighborhood}
                    onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                    className="w-full px-4 py-2 bg-secondary/30 border border-border rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all"
                    required
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-medium text-foreground">Cidade</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-4 py-2 bg-secondary/30 border border-border rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Estado</label>
                  <Select
                    options={BRAZIL_STATES}
                    value={formData.state}
                    onChange={(val) => setFormData({ ...formData, state: val })}
                    placeholder="UF"
                  />
                </div>
              </div>
            </div>

            {/* Consents */}
            <div className="space-y-4 pt-4 border-t border-border bg-secondary/10 p-4 rounded-xl">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0 ${formData.termsAccepted ? 'bg-brand-500 border-brand-500' : 'border-muted-foreground group-hover:border-brand-500'}`}>
                  {formData.termsAccepted && <Check size={14} className="text-white" />}
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={formData.termsAccepted}
                  onChange={(e) => setFormData({ ...formData, termsAccepted: e.target.checked })}
                />
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  Li e aceito os <a href="/legal/terms" target="_blank" className="text-brand-500 hover:underline">Termos de Uso</a> e <a href="/legal/privacy" target="_blank" className="text-brand-500 hover:underline">Políticas da Plataforma</a>.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0 ${formData.lgpdConsent ? 'bg-brand-500 border-brand-500' : 'border-muted-foreground group-hover:border-brand-500'}`}>
                  {formData.lgpdConsent && <Check size={14} className="text-white" />}
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={formData.lgpdConsent}
                  onChange={(e) => setFormData({ ...formData, lgpdConsent: e.target.checked })}
                />
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  Concordo com o processamento dos meus dados pessoais conforme a <a href="/legal/lgpd" target="_blank" className="text-brand-500 hover:underline">Lei Geral de Proteção de Dados (LGPD)</a>.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow-lg shadow-brand-500/20 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? "Salvando..." : "Concluir Cadastro"}
              {!isLoading && <ShieldCheck size={20} />}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
