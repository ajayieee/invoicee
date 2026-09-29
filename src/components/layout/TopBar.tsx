'use client';

import React, { useState } from 'react';
import {
  Search,
  Plus,
  RotateCcw,
  ChevronDown,
  FileText,
  Receipt,
  CreditCard,
  UserPlus,
  Shield,
  Check,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types/auth';

interface TopBarProps {
  onQuickAction: (action: 'NEW_QUOTE' | 'NEW_INVOICE' | 'RECORD_PAYMENT' | 'NEW_CUSTOMER') => void;
  onSearchChange: (query: string) => void;
  searchQuery: string;
  onResetData: () => void;
}

export function TopBar({ onQuickAction, onSearchChange, searchQuery, onResetData }: TopBarProps) {
  const { user, availableUsers, switchUser, permissions, organization } = useAuth();
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case 'OWNER':
        return 'emerald';
      case 'ACCOUNTANT':
        return 'info';
      case 'SALES':
        return 'purple';
      default:
        return 'secondary';
    }
  };

  return (
    <header className="h-16 border-b border-slate-200/80 bg-white/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Search Input */}
      <div className="relative w-72 sm:w-80 max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Global search (invoices, clients, quotes)..."
          className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-all"
        />
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {/* Organization / Currency Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
          <span>🇦🇪</span>
          <span>{organization.currency}</span>
          <span className="text-[10px] text-emerald-600 font-mono pl-1 border-l border-emerald-200">
            TRN: {organization.trn.slice(-4)}
          </span>
        </div>

        {/* Reset Demo Data Button */}
        <button
          onClick={() => {
            if (confirm('Reset application data to initial UAE FTA compliant seed state?')) {
              onResetData();
            }
          }}
          title="Reset database to initial UAE demo state"
          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          <RotateCcw className="h-4 w-4" />
        </button>

        {/* Quick Action Dropdown */}
        <div className="relative">
          <Button
            variant="emerald"
            size="sm"
            onClick={() => setQuickActionOpen(!quickActionOpen)}
            className="flex items-center gap-1.5 shadow-xs font-semibold text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create</span>
            <ChevronDown className="h-3 w-3 opacity-80" />
          </Button>

          {quickActionOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setQuickActionOpen(false)} />
              <div className="absolute right-0 mt-2 w-52 rounded-xl bg-white shadow-xl border border-slate-200 py-1.5 z-50 text-xs animate-in fade-in zoom-in-95">
                {permissions.canCreateInvoice && (
                  <button
                    onClick={() => {
                      setQuickActionOpen(false);
                      onQuickAction('NEW_INVOICE');
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 cursor-pointer"
                  >
                    <Receipt className="h-4 w-4 text-emerald-600" />
                    <div>
                      <div className="font-semibold text-slate-900">Tax Invoice</div>
                      <div className="text-[10px] text-slate-400">FTA standard 5% tax invoice</div>
                    </div>
                  </button>
                )}

                {permissions.canApproveQuote && (
                  <button
                    onClick={() => {
                      setQuickActionOpen(false);
                      onQuickAction('NEW_QUOTE');
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 cursor-pointer"
                  >
                    <FileText className="h-4 w-4 text-sky-600" />
                    <div>
                      <div className="font-semibold text-slate-900">Commercial Quotation</div>
                      <div className="text-[10px] text-slate-400">Proposal with line discounts</div>
                    </div>
                  </button>
                )}

                {permissions.canRecordPayment && (
                  <button
                    onClick={() => {
                      setQuickActionOpen(false);
                      onQuickAction('RECORD_PAYMENT');
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 cursor-pointer"
                  >
                    <CreditCard className="h-4 w-4 text-amber-600" />
                    <div>
                      <div className="font-semibold text-slate-900">Record Payment</div>
                      <div className="text-[10px] text-slate-400">Bank wire or PDC check</div>
                    </div>
                  </button>
                )}

                <div className="my-1 border-t border-slate-100" />

                {permissions.canManageCustomers && (
                  <button
                    onClick={() => {
                      setQuickActionOpen(false);
                      onQuickAction('NEW_CUSTOMER');
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 cursor-pointer"
                  >
                    <UserPlus className="h-4 w-4 text-slate-600" />
                    <div>
                      <div className="font-semibold text-slate-900">Customer / Prospect</div>
                      <div className="text-[10px] text-slate-400">Add UAE corporate client</div>
                    </div>
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* User Profile & Role Switcher */}
        <div className="relative pl-2 border-l border-slate-200">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-50 transition-colors text-left cursor-pointer"
          >
            <div
              className={`h-8 w-8 rounded-full ${user.avatar_color} text-white font-semibold flex items-center justify-center text-xs shadow-xs`}
            >
              {user.name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-semibold text-slate-900 leading-tight flex items-center gap-1.5">
                <span>{user.name}</span>
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {user.role}
                </span>
              </div>
              <div className="text-[10px] text-slate-500 truncate max-w-[130px]">{user.title}</div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {/* User & Role Switcher Dropdown */}
          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white shadow-xl border border-slate-200 p-2 z-50 text-xs animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 border-b border-slate-100">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Active Session & Role
                  </div>
                  <div className="font-semibold text-slate-900 mt-1">{user.name}</div>
                  <div className="text-[11px] text-slate-500">{user.email}</div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      {user.role}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {user.role === 'OWNER' && 'Full Administrative Control'}
                      {user.role === 'ACCOUNTANT' && 'Invoicing, Payments & Tax Reporting'}
                      {user.role === 'SALES' && 'Quotes, Invoices & Customer CRM'}
                      {user.role === 'VIEWER' && 'Read-only Audit Access'}
                    </span>
                  </div>
                </div>

                <div className="py-1">
                  <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Switch User / Test Role Matrix
                  </div>
                  {availableUsers.map((u) => {
                    const isSelected = u.id === user.id;
                    return (
                      <button
                        key={u.id}
                        onClick={() => {
                          switchUser(u.id);
                          setUserMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all text-left cursor-pointer ${
                          isSelected ? 'bg-slate-100 font-semibold text-slate-900' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`h-7 w-7 rounded-full ${u.avatar_color} text-white font-semibold flex items-center justify-center text-[10px] shrink-0`}
                          >
                            {u.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')}
                          </div>
                          <div>
                            <div className="text-xs text-slate-900 flex items-center gap-1.5">
                              <span>{u.name}</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-200/60 font-mono text-slate-700">
                                {u.role}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400">{u.title}</div>
                          </div>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-emerald-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
