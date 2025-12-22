"use client";

import { useSession } from "next-auth/react";
import { LayoutDashboard, BarChart3, Target, Users, Settings, TrendingUp, X, Share2, UserCircle, ChevronLeft, ChevronRight, LogOut, UserPlus, HelpCircle } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { usePersistentState } from "@/hooks/usePersistentState";
import { Tooltip } from "@/components/Tooltip";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentAccount: any;
  availableAccounts: any[];
  onAccountChange: (accountId: string) => void;
}

export const Sidebar = ({ isOpen, onClose, currentAccount, availableAccounts, onAccountChange }: SidebarProps) => {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = usePersistentState<boolean>('sidebar_collapsed', false);
  const [isMobile, setIsMobile] = useState(false);

  // Handle window resize to determine mobile state
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Initial check
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!session) return null;

  const accountOptions = availableAccounts.map(acc => ({
    value: acc.id,
    label: acc.name,
    icon: <UserCircle size={16} />
  }));

  const navItems = [
    { href: "/", label: "Dashboard Geral", icon: BarChart3 },
    { href: "/campaigns", label: "Campanhas", icon: Target },
    { href: "/settings", label: "Configurações", icon: Settings },
    { href: "/help", label: "Ajuda", icon: HelpCircle },
  ];

  const isActive = (path: string) => pathname === path;

  // Mobile behavior: always expanded when open
  const collapsed = isMobile ? false : isCollapsed;

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
                fixed md:static inset-y-0 left-0 z-50 bg-card border-r border-border text-card-foreground flex flex-col shadow-xl glass shrink-0 transition-all duration-300 ease-in-out
                ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                ${collapsed ? 'w-20' : 'w-64'}
            `}>

        {/* Header */}
        <div className={`p-4 border-b border-border flex items-center ${collapsed ? 'justify-center' : 'justify-between'} gap-3 h-16`}>
          <div
            className="flex items-center gap-3 cursor-pointer overflow-hidden"
            onClick={() => !isMobile && setIsCollapsed(!isCollapsed)}
            title={collapsed ? "Expandir" : "Recolher"}
          >
            <div className="w-8 h-8 min-w-[32px] bg-brand-500 rounded-lg flex items-center justify-center shadow-lg shadow-brand-500/20">
              <LayoutDashboard className="text-white" size={20} />
            </div>
            {!collapsed && (
              <span className="text-xl font-bold text-white tracking-tight whitespace-nowrap">TrackFlow</span>
            )}
          </div>

          {/* Mobile Close Button */}
          <button onClick={onClose} className="md:hidden text-muted-foreground hover:text-foreground">
            <X size={24} />
          </button>

          {/* Desktop Collapse Toggle (Optional, since logo click works, but good for affordance) */}
          {!isMobile && !collapsed && (
            <button
              onClick={() => setIsCollapsed(true)}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-secondary/50"
            >
              <ChevronLeft size={20} />
            </button>
          )}
        </div>

        {/* Account Selector */}
        <div className={`px-4 pt-4 ${collapsed ? 'flex justify-center' : ''}`}>
          {!collapsed ? (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">
                Conta
              </div>
              <Select
                options={accountOptions}
                value={currentAccount?.id || ""}
                onChange={onAccountChange}
                placeholder="Selecione"
              />
            </>
          ) : (
            <Tooltip content={currentAccount?.name || "Conta"} position="right">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center cursor-pointer hover:bg-secondary/80">
                <UserCircle size={24} className="text-muted-foreground" />
              </div>
            </Tooltip>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-2 overflow-y-auto custom-scrollbar mt-4">
          {!collapsed && (
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">
              Menu
            </div>
          )}

          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative
                  ${active
                    ? 'bg-brand-600/10 text-brand-400 border border-brand-600/20'
                    : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'
                  }
                  ${collapsed ? 'justify-center' : ''}
                `}
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={20} className={`${active ? 'text-brand-400' : 'group-hover:text-foreground'} ${!collapsed && 'group-hover:scale-110'} transition-transform`} />

                {!collapsed && (
                  <span className="font-medium whitespace-nowrap">{item.label}</span>
                )}

                {/* Active Indicator for Collapsed Mode */}
                {collapsed && active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-brand-500 rounded-r-full" />
                )}
              </Link>
            );
          })}

          {session.user.role === "ADMIN" && (
            <>
              {!collapsed && <div className="my-2 border-t border-border/50" />}
              <Link
                href="/admin/users"
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative
                  ${isActive('/admin/users')
                    ? 'bg-brand-600/10 text-brand-400 border border-brand-600/20'
                    : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'
                  }
                  ${collapsed ? 'justify-center' : ''}
                `}
                title={collapsed ? "Gestão de Usuários" : undefined}
              >
                <Users size={20} className={`${isActive('/admin/users') ? 'text-brand-400' : 'group-hover:text-foreground'} ${!collapsed && 'group-hover:scale-110'} transition-transform`} />
                {!collapsed && <span className="font-medium">Gestão de Usuários</span>}
              </Link>
            </>
          )}
        </nav>

        {/* Footer / Meta Card */}
        {!collapsed && (
          <div className="p-4 border-t border-border">
            <div className="bg-card/50 rounded-xl p-4 border border-border">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-brand-500/20 rounded-lg">
                  <TrendingUp size={16} className="text-brand-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Meta Diária</p>
                  <p className="text-sm font-bold text-foreground">85% Atingida</p>
                </div>
              </div>
              <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                <div className="bg-brand-500 h-1.5 rounded-full w-[85%] shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
              </div>
            </div>
          </div>
        )}

        {/* Collapsed Footer (Expand Button) */}
        {collapsed && !isMobile && (
          <div className="p-4 border-t border-border flex justify-center">
            <button
              onClick={() => setIsCollapsed(false)}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </aside>
    </>
  );
};
