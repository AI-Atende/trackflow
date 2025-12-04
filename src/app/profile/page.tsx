"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { User, Camera, Save, ArrowLeft, Mail, UserCircle, MapPin, Phone } from "lucide-react";
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

export default function ProfilePage() {
    const { data: session, status, update } = useSession();
    const router = useRouter();
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        fullName: "",
        email: "",
        image: "",
        phone: "",
        birthDate: "",
        street: "",
        number: "",
        neighborhood: "",
        city: "",
        state: "",
        zip: ""
    });

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/login");
        } else if (status === "authenticated") {
            fetchProfile();
        }
    }, [status, router]);

    const fetchProfile = async () => {
        try {
            const res = await fetch("/api/profile");
            if (res.ok) {
                const data = await res.json();
                setFormData({
                    name: data.name || "",
                    fullName: data.fullName || "",
                    email: data.email || "",
                    image: data.image || "",
                    phone: data.phone || "",
                    birthDate: data.birthDate ? new Date(data.birthDate).toISOString().split('T')[0] : "",
                    street: data.address?.street || "",
                    number: data.address?.number || "",
                    neighborhood: data.address?.neighborhood || "",
                    city: data.address?.city || "",
                    state: data.address?.state || "",
                    zip: data.address?.zip || ""
                });
            }
        } catch (error) {
            console.error("Erro ao carregar perfil", error);
            showToast("Erro ao carregar perfil", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            const res = await fetch("/api/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: formData.name,
                    fullName: formData.fullName,
                    image: formData.image,
                    phone: formData.phone,
                    birthDate: formData.birthDate,
                    address: {
                        street: formData.street,
                        number: formData.number,
                        neighborhood: formData.neighborhood,
                        city: formData.city,
                        state: formData.state,
                        zip: formData.zip
                    }
                }),
            });

            if (res.ok) {
                await update({
                    image: formData.image,
                    phone: formData.phone,
                    birthDate: formData.birthDate,
                    address: { ...formData }
                });
                showToast("Perfil atualizado com sucesso!", "success");
                router.refresh();
            } else {
                showToast("Erro ao atualizar perfil", "error");
            }
        } catch (error) {
            console.error("Erro ao salvar", error);
            showToast("Erro ao salvar perfil", "error");
        } finally {
            setIsSaving(false);
        }
    };

    if (status === "loading" || isLoading) {
        return <div className="flex items-center justify-center min-h-screen bg-background text-foreground">Carregando...</div>;
    }

    return (
        <div className="min-h-screen bg-background p-8 font-sans">
            <div className="max-w-4xl mx-auto">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors p-2 hover:bg-secondary rounded-lg w-fit"
                >
                    <ArrowLeft size={20} />
                    Voltar
                </button>

                <div className="bg-card/50 backdrop-blur-md border border-border rounded-xl shadow-xl glass neon-border">
                    <div className="p-8 border-b border-border bg-secondary/30">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-brand-500/20 rounded-xl">
                                <UserCircle size={24} className="text-brand-500" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-foreground tracking-tight">Editar Perfil</h1>
                                <p className="text-muted-foreground text-sm mt-1">Atualize suas informações pessoais e foto de perfil.</p>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 space-y-8">
                        {/* Avatar Section */}
                        <div className="flex flex-col items-center space-y-6">
                            <div className="relative group">
                                <div className="w-32 h-32 rounded-full bg-secondary border-4 border-background shadow-2xl overflow-hidden flex items-center justify-center ring-4 ring-brand-500/20">
                                    {formData.image ? (
                                        <img
                                            src={formData.image}
                                            alt="Profile"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <User size={48} className="text-muted-foreground" />
                                    )}
                                </div>
                                <div className="absolute bottom-0 right-0 bg-brand-600 p-2.5 rounded-full text-white shadow-lg cursor-pointer hover:bg-brand-700 transition-all hover:scale-110 border-2 border-background">
                                    <Camera size={16} />
                                </div>
                            </div>
                            <div className="w-full max-w-md space-y-2">
                                <label className="block text-sm font-medium text-foreground text-center">
                                    URL da Imagem de Perfil
                                </label>
                                <div className="relative">
                                    <input
                                        type="url"
                                        value={formData.image}
                                        onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                                        placeholder="https://exemplo.com/foto.jpg"
                                        className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 outline-none text-sm text-foreground placeholder-muted-foreground transition-all text-center"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border">
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-foreground">Nome da Conta (Público)</label>
                                <div className="relative">
                                    <User size={18} className="absolute left-3 top-3 text-muted-foreground" />
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full pl-10 pr-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-foreground">Nome Completo (Privado)</label>
                                <div className="relative">
                                    <User size={18} className="absolute left-3 top-3 text-muted-foreground" />
                                    <input
                                        type="text"
                                        value={formData.fullName}
                                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                        className="w-full pl-10 pr-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-foreground">Email</label>
                                <div className="relative">
                                    <Mail size={18} className="absolute left-3 top-3 text-muted-foreground" />
                                    <input
                                        type="email"
                                        value={formData.email}
                                        disabled
                                        className="w-full pl-10 pr-4 py-2.5 bg-secondary/50 border border-border rounded-xl text-muted-foreground cursor-not-allowed"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-foreground">Telefone</label>
                                <div className="relative">
                                    <Phone size={18} className="absolute left-3 top-3 text-muted-foreground" />
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: maskPhone(e.target.value) })}
                                        className="w-full pl-10 pr-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-foreground">Data de Nascimento</label>
                                <DatePicker
                                    value={formData.birthDate}
                                    onChange={(val) => setFormData({ ...formData, birthDate: val })}
                                    placeholder="DD/MM/AAAA"
                                    className="w-full"
                                />
                            </div>
                        </div>

                        {/* Address Section */}
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
                                        className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all"
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-sm font-medium text-foreground">Rua</label>
                                    <input
                                        type="text"
                                        value={formData.street}
                                        onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground">Número</label>
                                    <input
                                        type="text"
                                        value={formData.number}
                                        onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all"
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-sm font-medium text-foreground">Bairro</label>
                                    <input
                                        type="text"
                                        value={formData.neighborhood}
                                        onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all"
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-sm font-medium text-foreground">Cidade</label>
                                    <input
                                        type="text"
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all"
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

                        <div className="pt-6 flex justify-end border-t border-border">
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="flex items-center gap-2 px-8 py-2.5 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700 shadow-lg shadow-brand-500/20 hover:shadow-brand-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
                            >
                                {isSaving ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Save size={18} />
                                )}
                                {isSaving ? "Salvando..." : "Salvar Alterações"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
