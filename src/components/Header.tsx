import React, { useState } from 'react';
import { Menu, Search, Bell, User, LogOut } from "lucide-react";
import { DateRangePicker, DateRange } from "@/components/DateRangePicker";
import { SyncButton } from "@/components/SyncButton";
import { useRouter, usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

interface HeaderProps {
  session: any;
  dateRange: DateRange;
  setDateRange: (date: DateRange) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onSyncSuccess?: () => void;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
}

export const Header = ({
  session,
  dateRange,
  setDateRange,
  searchTerm,
  setSearchTerm,
  onSyncSuccess,
  setIsMobileMenuOpen
}: HeaderProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  return (
    <header className="h-16 bg-card/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 md:px-8 shadow-sm z-30 sticky top-0 gap-4">
      {/* Left: Mobile Menu & Date Picker */}
      <div className="flex items-center gap-4">
        <button
          className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg"
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <Menu />
        </button>
        <DateRangePicker date={dateRange} setDate={setDateRange} />
      </div>

      {/* Center: Search Bar - Only visible on /campaigns */}
      {pathname === '/campaigns' && (
        <div className="flex-1 max-w-md hidden md:flex items-center relative transition-all duration-300 animate-in fade-in slide-in-from-top-1">
          <Search className="absolute left-3 text-muted-foreground w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar campanhas..."
            className="w-full pl-9 pr-4 py-2 bg-secondary/50 border border-border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      )}

      {/* Right: Actions & Profile */}
      <div className="flex items-center gap-3">
        <SyncButton
          session={session}
          dateRange={dateRange}
          onSyncSuccess={onSyncSuccess}
        />

        <button className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-all relative">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>

        <div className="h-8 w-px bg-border mx-2 hidden md:block" />

        <div
          className="relative"
          onMouseEnter={() => setIsProfileMenuOpen(true)}
          onMouseLeave={() => setIsProfileMenuOpen(false)}
        >
          <div className="flex items-center gap-3 cursor-pointer py-2">
            <div className="text-right hidden md:block">
              <p className="text-sm font-semibold text-foreground">{session.user.name}</p>
              <p className="text-xs text-muted-foreground">{session.user.role === 'ADMIN' ? 'Administrador' : 'Membro'}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-secondary border-2 border-border shadow-sm overflow-hidden">
              {session.user.image ? (
                <img src={session.user.image} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-brand-500/10 text-brand-500 font-bold">
                  {session.user.name?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
            </div>
          </div>

          {/* Hover Dropdown */}
          {isProfileMenuOpen && (
            <div className="absolute right-0 top-full w-64 bg-popover text-popover-foreground rounded-xl shadow-xl border border-border overflow-hidden transition-all transform origin-top-right z-50">
              <div className="p-4 border-b border-border bg-accent/50">
                <p className="font-semibold">{session.user.name}</p>
                <p className="text-xs text-muted-foreground break-all">{session.user.email}</p>
              </div>
              <div className="p-2">
                <button
                  onClick={() => router.push('/profile')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors"
                >
                  <User size={16} />
                  Editar Perfil
                </button>
                <button
                  onClick={() => signOut({ callbackUrl: '/auth/login' })}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                >
                  <LogOut size={16} />
                  Sair
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
