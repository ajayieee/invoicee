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
  Menu,
  LogOut,
  Users,
  Shield,
  Edit2,
  Lock,
  Key,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { User } from '@/types/auth';
import { InviteMemberModal } from '@/components/auth/InviteMemberModal';
import { EditMemberModal } from '@/components/auth/EditMemberModal';
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal';

interface TopBarProps {
  onQuickAction: (action: 'NEW_QUOTE' | 'NEW_INVOICE' | 'RECORD_PAYMENT' | 'NEW_CUSTOMER') => void;
  onSearchChange: (query: string) => void;
  searchQuery: string;
  onResetData: () => void;
  onToggleMobileMenu?: () => void;
}

export function TopBar({
  onQuickAction,
  onSearchChange,
  searchQuery,
  onResetData,
  onToggleMobileMenu,
}: TopBarProps) {
  const {
    user,
    availableUsers,
    permissions,
    organization,
    logout,
    inviteMember,
    updateUserDetails,
    deleteUser,
    changePassword,
    refreshUsers,
  } = useAuth();
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);

  if (!user) return null;

  return (
    <header className="h-16 border-b border-slate-200/80 bg-white/95 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Left section: Hamburger button + Search Input */}
      <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
            aria-label="Open Navigation Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div className="relative w-full max-w-[200px] sm:max-w-xs md:w-80">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Global search..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-all"
          />
        </div>
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
            className="flex items-center gap-1 sm:gap-1.5 shadow-xs font-semibold text-xs px-2 sm:px-3"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Create</span>
            <ChevronDown className="h-3 w-3 opacity-80" />
          </Button>

          {quickActionOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setQuickActionOpen(false)} />
              <div className="absolute right-0 mt-2 w-52 max-w-[calc(100vw-2rem)] rounded-xl bg-white shadow-xl border border-slate-200 py-1.5 z-50 text-xs animate-in fade-in zoom-in-95">
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

          {/* User & Role Dropdown */}
          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-2rem)] rounded-2xl bg-white shadow-xl border border-slate-200 p-2.5 z-50 text-xs animate-in fade-in zoom-in-95">
                {/* Active Session Card */}
                <div className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Active Session
                  </div>
                  <div className="font-semibold text-slate-900 mt-0.5 text-sm">{user.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono">{user.email}</div>
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
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

                  {/* Admin Change Password Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      setChangePasswordModalOpen(true);
                    }}
                    className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-100/80 text-slate-700 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                  >
                    <Key className="h-3.5 w-3.5 text-slate-500" />
                    <span>Change Password</span>
                  </button>
                </div>

                {/* Company Team & Roles List (Available to OWNER / ADMIN) */}
                {(user.role === 'OWNER' || user.role === 'ADMIN') && (
                  <div className="mt-2.5">
                    <div className="px-2 pt-1 pb-1 flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        <span>Company Team Members ({availableUsers.length})</span>
                      </span>
                      <span className="text-[9px] text-slate-400 font-medium">Manage Team</span>
                    </div>

                    <div className="max-h-52 overflow-y-auto px-1 space-y-1.5 mt-1">
                      {availableUsers.map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-white hover:bg-slate-50 transition-colors border border-slate-200/70"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <div
                              className={`h-7 w-7 rounded-full ${u.avatar_color} text-white font-bold flex items-center justify-center text-[10px] shrink-0`}
                            >
                              {u.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-900 truncate flex items-center gap-1.5">
                                <span className="truncate">{u.name}</span>
                                {u.id === user.id && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-normal">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono truncate">{u.email}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border uppercase ${
                                u.role === 'OWNER'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : u.role === 'ACCOUNTANT'
                                  ? 'bg-sky-50 text-sky-700 border-sky-200'
                                  : u.role === 'SALES'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {u.role}
                            </span>
                            {u.id !== user.id ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedUserForEdit(u);
                                  setEditModalOpen(true);
                                  setUserMenuOpen(false);
                                }}
                                className="text-[10px] text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 font-medium px-2 py-1 rounded-lg border border-slate-200 hover:border-emerald-200 transition-colors flex items-center gap-1 cursor-pointer"
                                title={`Edit details, role, and password for ${u.name}`}
                              >
                                <Edit2 className="h-3 w-3 text-slate-400 hover:text-emerald-600" />
                                <span>Edit</span>
                              </button>
                            ) : (
                              <span
                                className="text-[10px] text-slate-400 font-medium px-2 py-1 rounded-lg bg-slate-100/80 border border-slate-200 flex items-center gap-1 cursor-default select-none"
                                title="Your administrator account is permanently protected"
                              >
                                <Lock className="h-3 w-3 text-slate-400" />
                                <span>Locked</span>
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {availableUsers.length === 0 && (
                        <div className="p-3 text-center text-slate-400 text-xs">
                          No team members registered yet.
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-100 my-2" />

                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        setInviteModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                    >
                      <UserPlus className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Invite New Team Member</span>
                    </button>

                    <div className="border-t border-slate-100 my-1" />
                  </div>
                )}

                <div className="py-1">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <LogOut className="h-4 w-4 text-rose-500 shrink-0" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <InviteMemberModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        onInvite={inviteMember}
        onSuccess={refreshUsers}
      />

      <EditMemberModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        targetUser={selectedUserForEdit}
        onUpdateUser={updateUserDetails}
        onDeleteUser={deleteUser}
        onSuccess={refreshUsers}
      />

      <ChangePasswordModal
        open={changePasswordModalOpen}
        onOpenChange={setChangePasswordModalOpen}
        onChangePassword={changePassword}
      />
    </header>
  );
}
