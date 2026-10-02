'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Briefcase, AlertCircle, CheckCircle2, Loader2, User as UserIcon, Lock } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { User, UserRole } from '@/types/auth';
import { useAuth } from '@/context/AuthContext';

interface ChangeRoleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUser: User | null;
  onUpdateRole: (userId: string, role: UserRole, title?: string) => Promise<{ success: boolean; error?: string }>;
  onSuccess?: () => void;
}

export function ChangeRoleModal({
  open,
  onOpenChange,
  targetUser,
  onUpdateRole,
  onSuccess,
}: ChangeRoleModalProps) {
  const { user } = useAuth();
  const isSelf = Boolean(user?.id && targetUser?.id && user.id === targetUser.id);
  const [role, setRole] = useState<UserRole>('ACCOUNTANT');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (targetUser) {
      setRole(targetUser.role);
      setTitle(targetUser.title || '');
      setError(null);
      setSuccess(false);
    }
  }, [targetUser, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;
    if (isSelf) {
      setError('Administrators cannot modify their own role. Your administrator account is protected.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await onUpdateRole(targetUser.id, role, title.trim());
      if (!res.success) {
        setError(res.error || 'Failed to update user role.');
      } else {
        setSuccess(true);
        setTimeout(() => {
          onOpenChange(false);
          if (onSuccess) onSuccess();
        }, 1100);
      }
    } catch (err: any) {
      setError(err.message || 'Network error while updating role.');
    } finally {
      setLoading(false);
    }
  };

  if (!targetUser) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setError(null);
          setSuccess(false);
        }
        onOpenChange(v);
      }}
      title="Change User Role & Permissions"
      description="Modify access permissions and assigned job title for this company member."
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>Role successfully updated in MongoDB Atlas!</span>
          </div>
        )}

        {isSelf && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2 select-none">
            <Lock className="h-4 w-4 shrink-0 text-amber-600" />
            <span>Your administrator role is protected and cannot be modified.</span>
          </div>
        )}

        {/* User Card Summary */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
          <div className={`h-10 w-10 rounded-full ${targetUser.avatar_color} text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs`}>
            {targetUser.name.split(' ').map((n) => n[0]).join('')}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-slate-900 text-sm truncate">{targetUser.name}</div>
            <div className="text-slate-500 text-xs font-mono truncate">{targetUser.email}</div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold uppercase">
            Current: {targetUser.role}
          </span>
        </div>

        {/* Role Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-slate-400" />
            <span>New Assigned Role *</span>
          </label>
          <select
            value={role}
            disabled={isSelf || loading}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:opacity-60 disabled:bg-slate-50 cursor-pointer disabled:cursor-not-allowed"
          >
            <option value="ACCOUNTANT">ACCOUNTANT — Invoicing, Payments, Credit Notes & Tax Reporting</option>
            <option value="SALES">SALES — Quotations, Customer CRM & Tax Invoicing</option>
            <option value="VIEWER">VIEWER — Read-Only Audit & Compliance Reporting</option>
            <option value="OWNER">OWNER — Full Administrative Control & Company Parameters</option>
          </select>
          <div className="mt-1.5 p-2 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-500">
            {role === 'ACCOUNTANT' && 'Can record payments, issue credit notes, approve tax invoices, and export FTA VAT returns.'}
            {role === 'SALES' && 'Can register customers, prepare commercial quotes, and generate sales invoices.'}
            {role === 'VIEWER' && 'Read-only audit visibility. Cannot create documents or modify financial records.'}
            {role === 'OWNER' && 'Unrestricted access to all company settings, VAT configurations, and team management.'}
          </div>
        </div>

        {/* Job Title */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5 text-slate-400" />
            <span>Job Title / Designation</span>
          </label>
          <input
            type="text"
            value={title}
            disabled={isSelf || loading}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Senior Accountant, Sales Representative"
            className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:opacity-60 disabled:bg-slate-50"
          />
        </div>

        <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="text-xs"
          >
            {isSelf ? 'Close' : 'Cancel'}
          </Button>
          {!isSelf && (
            <Button
              type="submit"
              variant="emerald"
              size="sm"
              disabled={loading}
              className="text-xs min-w-[110px]"
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </span>
              ) : (
                'Save Changes'
              )}
            </Button>
          )}
        </div>
      </form>
    </Dialog>
  );
}
