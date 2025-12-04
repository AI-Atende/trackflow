
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Trash2, Edit, Plus, Check, X, Users, Shield, ShieldAlert, Activity } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";

type MetaAdAccount = {
    adAccountId: string;
    name: string;
    accessToken: string;
};

type User = {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "MEMBER";
    isActive: boolean;
    createdAt: string;
    metaAdAccount?: MetaAdAccount | null;
};

export default function AdminUsersPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { showToast } = useToast();
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);

    // Form states
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        role: "MEMBER",
        isActive: true,
        adAccountId: "",
        adAccountName: "",
        accessToken: "",
    });

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/login");
        } else if (status === "authenticated") {
            if (session.user.role !== "ADMIN") {
                router.push("/");
            } else {
                fetchUsers();
            }
        }
    }, [status, session, router]);

    const fetchUsers = async () => {
        try {
            const res = await fetch("/api/admin/users");
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (error) {
            console.error("Erro ao buscar usuários", error);
            showToast("Erro ao buscar usuários", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const url = "/api/admin/users";
        const method = editingUser ? "PUT" : "POST";
        const body = editingUser ? { ...formData, id: editingUser.id } : formData;

        try {
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                fetchUsers();
                closeModal();
                showToast(editingUser ? "Usuário atualizado com sucesso" : "Usuário criado com sucesso", "success");
            } else {
                const data = await res.json();
                showToast(data.error || "Erro ao salvar usuário", "error");
            }
        } catch (error) {
            console.error("Erro ao salvar", error);
            showToast("Erro ao salvar usuário", "error");
        }
    };

    const confirmDelete = (user: User) => {
        setUserToDelete(user);
        setIsDeleteModalOpen(true);
    };

    const handleDeleteUser = async () => {
        if (!userToDelete) return;

        try {
            const res = await fetch(`/api/admin/users?id=${userToDelete.id}`, {
                method: "DELETE",
            });

            if (res.ok) {
                fetchUsers();
                setIsDeleteModalOpen(false);
                setUserToDelete(null);
                showToast("Usuário excluído com sucesso", "success");
            } else {
                const data = await res.json();
                showToast(data.error || "Erro ao excluir usuário", "error");
            }
        } catch (error) {
            console.error("Erro ao excluir", error);
            showToast("Erro ao excluir usuário", "error");
        }
    };

    const openModal = (user?: User) => {
        if (user) {
            setEditingUser(user);
            setFormData({
                name: user.name,
                email: user.email,
                password: "", // Senha vazia na edição
                role: user.role,
                isActive: user.isActive,
                adAccountId: user.metaAdAccount?.adAccountId || "",
                adAccountName: user.metaAdAccount?.name || "",
                accessToken: "", // Não mostramos o token salvo por segurança, apenas permitimos atualizar
            });
        } else {
            setEditingUser(null);
            setFormData({
                name: "",
                email: "",
                password: "",
                role: "MEMBER",
                isActive: true,
                adAccountId: "",
                adAccountName: "",
                accessToken: "",
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingUser(null);
    };

    if (status === "loading" || isLoading) {
        return <div className="flex items-center justify-center min-h-screen bg-background text-foreground">Carregando...</div>;
    }

    return (
        <div className="min-h-screen bg-background p-8 font-sans">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-brand-500/20 rounded-xl">
                            <Users size={24} className="text-brand-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-foreground tracking-tight">Gestão de Usuários</h1>
                            <p className="text-sm text-muted-foreground">Gerencie o acesso e permissões da plataforma.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => openModal()}
                        className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 shadow-lg shadow-brand-500/20 hover:shadow-brand-500/40 transition-all transform hover:-translate-y-0.5"
                    >
                        <Plus size={20} />
                        Novo Usuário
                    </button>
                </div>

                <div className="bg-card/50 backdrop-blur-md border border-border rounded-xl shadow-xl overflow-hidden glass neon-border">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-secondary/30 border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                                <th className="p-5 font-semibold">Nome</th>
                                <th className="p-5 font-semibold">Email</th>
                                <th className="p-5 font-semibold">Função</th>
                                <th className="p-5 font-semibold">Meta Ads</th>
                                <th className="p-5 font-semibold">Status</th>
                                <th className="p-5 font-semibold text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {users.map((user: User) => (
                                <tr key={user.id} className="hover:bg-secondary/20 transition-colors group">
                                    <td className="p-5 font-medium text-foreground">{user.name}</td>
                                    <td className="p-5 text-muted-foreground">{user.email}</td>
                                    <td className="p-5">
                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 w-fit ${user.role === "ADMIN"
                                                ? "bg-purple-500/10 text-purple-500 border-purple-500/20"
                                                : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                                } `}
                                        >
                                            {user.role === "ADMIN" ? <ShieldAlert size={12} /> : <Shield size={12} />}
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="p-5">
                                        {user.metaAdAccount ? (
                                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-500 border border-green-500/20 flex items-center gap-1 w-fit">
                                                <Check size={12} />
                                                Conectado
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-secondary text-muted-foreground border border-border flex items-center gap-1 w-fit">
                                                <X size={12} />
                                                Sem conta
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-5">
                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 w-fit ${user.isActive
                                                ? "bg-green-500/10 text-green-500 border-green-500/20"
                                                : "bg-red-500/10 text-red-500 border-red-500/20"
                                                } `}
                                        >
                                            <Activity size={12} />
                                            {user.isActive ? "Ativo" : "Inativo"}
                                        </span>
                                    </td>
                                    <td className="p-5 text-right">
                                        <button
                                            onClick={() => openModal(user)}
                                            className="p-2 text-muted-foreground hover:text-brand-500 hover:bg-brand-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 mr-2"
                                            title="Editar"
                                        >
                                            <Edit size={18} />
                                        </button>
                                        <button
                                            onClick={() => confirmDelete(user)}
                                            className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                            title="Excluir"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 overflow-y-auto py-10 animate-in fade-in duration-200">
                    <div className="bg-card border border-border rounded-2xl p-8 w-full max-w-2xl shadow-2xl my-auto glass neon-border animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-8 border-b border-border pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-brand-500/20 rounded-lg">
                                    <Users size={20} className="text-brand-500" />
                                </div>
                                <h2 className="text-xl font-bold text-foreground">
                                    {editingUser ? "Editar Usuário" : "Novo Usuário"}
                                </h2>
                            </div>
                            <button onClick={closeModal} className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-secondary rounded-lg">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-foreground">Nome</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 outline-none text-foreground placeholder-muted-foreground transition-all"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-foreground">Email</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 outline-none text-foreground placeholder-muted-foreground transition-all"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-foreground">
                                    Senha {editingUser && <span className="text-muted-foreground font-normal text-xs ml-2">(deixe em branco para manter)</span>}
                                </label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 outline-none text-foreground placeholder-muted-foreground transition-all"
                                    required={!editingUser}
                                />
                            </div>

                            <div className="flex gap-6">
                                <div className="flex-1 space-y-2">
                                    <label className="block text-sm font-medium text-foreground">Função</label>
                                    <select
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                                        className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 outline-none text-foreground transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="MEMBER">Membro</option>
                                        <option value="ADMIN">Admin</option>
                                    </select>
                                </div>
                                <div className="flex-1 space-y-2">
                                    <label className="block text-sm font-medium text-foreground">Status</label>
                                    <select
                                        value={formData.isActive ? "true" : "false"}
                                        onChange={(e) =>
                                            setFormData({ ...formData, isActive: e.target.value === "true" })
                                        }
                                        className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 outline-none text-foreground transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="true">Ativo</option>
                                        <option value="false">Inativo</option>
                                    </select>
                                </div>
                            </div>

                            <div className="border-t border-border pt-6">
                                <h3 className="text-md font-semibold text-foreground mb-4 flex items-center gap-2">
                                    <Shield size={18} className="text-brand-500" />
                                    Configuração Meta Ads
                                </h3>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-foreground">ID da Conta (act_...)</label>
                                            <input
                                                type="text"
                                                value={formData.adAccountId}
                                                onChange={(e) => setFormData({ ...formData, adAccountId: e.target.value })}
                                                placeholder="Ex: 123456789"
                                                className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 outline-none text-foreground placeholder-muted-foreground transition-all"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-foreground">Nome da Conta (Opcional)</label>
                                            <input
                                                type="text"
                                                value={formData.adAccountName}
                                                onChange={(e) => setFormData({ ...formData, adAccountName: e.target.value })}
                                                placeholder="Ex: Conta Principal"
                                                className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 outline-none text-foreground placeholder-muted-foreground transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-foreground">Token de Acesso (Access Token)</label>
                                        <input
                                            type="text"
                                            value={formData.accessToken}
                                            onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                                            placeholder={editingUser ? "Deixe em branco para manter o atual" : "Token do Graph API"}
                                            className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 outline-none text-foreground placeholder-muted-foreground transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-border">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2.5 text-muted-foreground hover:bg-secondary rounded-xl transition-colors font-medium"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 shadow-lg shadow-brand-500/20 hover:shadow-brand-500/40 transition-all font-medium"
                                >
                                    Salvar Alterações
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
                    <div className="bg-card border border-border rounded-2xl p-8 w-full max-w-md shadow-2xl glass neon-border animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-red-500/20 rounded-full">
                                <ShieldAlert size={24} className="text-red-500" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-foreground">Excluir Usuário</h2>
                                <p className="text-sm text-muted-foreground">Esta ação é irreversível.</p>
                            </div>
                        </div>

                        <p className="text-foreground mb-8">
                            Tem certeza que deseja excluir o usuário <span className="font-bold">{userToDelete?.name}</span>?
                            Todos os dados associados serão perdidos.
                        </p>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="px-4 py-2.5 text-muted-foreground hover:bg-secondary rounded-xl transition-colors font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeleteUser}
                                className="px-6 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 shadow-lg shadow-red-500/20 hover:shadow-red-500/40 transition-all font-medium"
                            >
                                Sim, Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
