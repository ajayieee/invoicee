'use client';

import React from 'react';
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  Receipt,
  CreditCard,
  RotateCcw,
  BarChart3,
  Settings,
  ShieldCheck,
  Building2,
  ChevronRight,
  UserCheck,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

export type NavTab =
  | 'dashboard'
  | 'customers'
  | 'products'
  | 'quotes'
  | 'invoices'
  | 'payments'
  | 'credit-notes'
  | 'reports'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  orgName?: string;
  trn?: string;
  emirate?: string;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({
  currentTab,
  onSelectTab,
  orgName = 'Al Thuraya Tech',
  trn = '100284759600003',
  emirate = 'Dubai',
  mobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const { user, permissions } = useAuth();

  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'customers' as NavTab, label: 'Customers & Prospects', icon: Users },
    { id: 'products' as NavTab, label: 'Products & Services', icon: Package },
    { id: 'quotes' as NavTab, label: 'Quotations', icon: FileText },
    { id: 'invoices' as NavTab, label: 'Tax Invoices', icon: Receipt },
    { id: 'payments' as NavTab, label: 'Payments', icon: CreditCard },
    { id: 'credit-notes' as NavTab, label: 'Credit Notes', icon: RotateCcw },
    { id: 'reports' as NavTab, label: 'Reports & Analytics', icon: BarChart3 },
    {
      id: 'settings' as NavTab,
      label: 'Company Settings',
      icon: Settings,
      disabled: !permissions.canEditCompanySettings && user.role === 'SALES',
    },
  ];

  const handleTabClick = (tabId: NavTab) => {
    onSelectTab(tabId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const sidebarContent = (
    <>
      {/* Brand Header */}
      <div className="p-4 sm:p-5 border-b border-slate-900/80 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-950 shrink-0">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="overflow-hidden min-w-0">
            <h1 className="font-semibold text-sm text-white truncate leading-tight tracking-tight">
              {orgName}
            </h1>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 shrink-0">
                🇦🇪 {emirate}
              </span>
              <span className="text-[10px] text-slate-500 font-mono truncate">
                TRN: {trn.slice(-5)}
              </span>
            </div>
          </div>
        </div>
        {/* Mobile close button */}
        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition-colors ml-2 cursor-pointer"
            aria-label="Close Navigation"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Core Operations
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          const isDisabled = item.disabled;

          return (
            <button
              key={item.id}
              disabled={isDisabled}
              onClick={() => handleTabClick(item.id)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all group cursor-pointer',
                isDisabled && 'opacity-40 cursor-not-allowed hover:bg-transparent',
                isActive
                  ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/20 font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={cn(
                    'h-4 w-4 transition-colors',
                    isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'
                  )}
                />
                <span>{item.label}</span>
              </div>
              {isActive && <ChevronRight className="h-3.5 w-3.5 text-emerald-400" />}
            </button>
          );
        })}
      </nav>

      {/* Active User Footer Card */}
      <div className="p-3 border-t border-slate-900 bg-slate-950">
        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`h-7 w-7 rounded-full ${user.avatar_color} text-white font-semibold flex items-center justify-center text-[10px] shrink-0`}
            >
              {user.name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </div>
            <div className="truncate">
              <div className="text-xs font-medium text-slate-200 truncate">{user.name}</div>
              <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <span>●</span>
                <span>{user.role}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* UAE VAT Compliance & Footer Badge */}
      <div className="p-3 border-t border-slate-900 bg-slate-950/50">
        <div className="p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/60 flex items-start gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-[10px] leading-relaxed text-slate-400">
            <span className="font-semibold text-slate-300 block">UAE FTA VAT Ready</span>
            Federal Decree-Law No. (8) compliant
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-64 bg-slate-950 text-slate-300 flex-col shrink-0 h-screen sticky top-0 border-r border-slate-900 select-none">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={onCloseMobile}
          />
          {/* Slide-out Drawer */}
          <aside className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-slate-950 text-slate-300 flex flex-col z-50 shadow-2xl animate-in slide-in-from-left duration-200 select-none">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
