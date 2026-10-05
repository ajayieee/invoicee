'use client';

import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Mail,
  Lock,
  Briefcase,
  Shield,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { User, UserRole } from '@/types/auth';
import { useAuth } from '@/context/AuthContext';

interface EditMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUser: User | null;
  onUpdateUser: (
    userId: string,
    data: {
      name?: string;
      email?: string;
      role?: UserRole;
      title?: string;
      password?: string;
    }
  ) => Promise<{ success: boolean; error?: string }>;
  onDeleteUser: (userId: string) => Promise<{ success: boolean; error?: string }>;
  onSuccess?: () => void;
}

export function EditMemberModal({
  open,
  onOpenChange,
  targetUser,
  onUpdateUser,
  onDeleteUser,
  onSuccess,
}: EditMemberModalProps) {
  const { user } = useAuth();
  const isSelf = Boolean(user?.id && targetUser?.id && user.id === targetUser.id);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('ACCOUNTANT');
  const [title, setTitle] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (targetUser && open) {
      setName(targetUser.name || '');
      setEmail(targetUser.email || '');
      setRole(targetUser.role || 'ACCOUNTANT');
      setTitle(targetUser.title || '');
      setPassword('');
      setShowPassword(false);
      setConfirmDelete(false);
      setError(null);
      setSuccessMessage(null);
    }
  }, [targetUser, open]);

  if (!targetUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!name.trim()) {
      setError('Member name is required.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setError('A valid email address is required.');
      return;
    }

    if (password.trim() && password.trim().length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    setSaving(true);
    try {
      const res = await onUpdateUser(targetUser.id, {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: isSelf ? targetUser.role : role,
        title: title.trim(),
        password: password.trim() ? password.trim() : undefined,
      });

      if (!res.success) {
        setError(res.error || 'Failed to update team member.');
      } else {
        setSuccessMessage('Team member details successfully updated in MongoDB Atlas!');
        setTimeout(() => {
          onOpenChange(false);
          if (onSuccess) onSuccess();
        }, 1000);
      }
    } catch (err: any) {
      setError(err.message || 'Network error while updating team member.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isSelf) {
      setError('Administrators cannot delete their own account.');
      return;
    }

    setDeleting(true);
    setError(null);
    try {
      const res = await onDeleteUser(targetUser.id);
      if (!res.success) {
        setError(res.error || 'Failed to delete user.');
        setConfirmDelete(false);
      } else {
        setSuccessMessage(`User ${targetUser.name} has been permanently deleted from MongoDB Atlas.`);
        setTimeout(() => {
          onOpenChange(false);
          if (onSuccess) onSuccess();
        }, 1000);
      }
    } catch (err: any) {
      setError(err.message || 'Network error while deleting user.');
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setError(null);
          setSuccessMessage(null);
          setConfirmDelete(false);
        }
        onOpenChange(v);
      }}
      title="Edit Team Member"
      description="Update profile details, assign permissions, reset password, or manage membership."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1" autoComplete="off">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Member Preview Header */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
          <div
            className={`h-10 w-10 rounded-full ${targetUser.avatar_color} text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs`}
          >
            {targetUser.name
              .split(' ')
              .map((n) => n[0])
              .join('')}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-slate-900 text-sm truncate">{targetUser.name}</div>
            <div className="text-slate-500 text-xs font-mono truncate">{targetUser.email}</div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200/80 text-slate-700 font-semibold uppercase">
            Current: {targetUser.role}
          </span>
        </div>

        {/* Full Name & Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Full Name *
            </label>
            <div className="relative">
              <UserIcon className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full Name"
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Work Email Address *
            </label>
            <div className="relative">
              <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>
        </div>

        {/* Assigned Role & Job Title */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Assigned Role *
            </label>
            <div className="relative">
              <Shield className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                value={role}
                disabled={isSelf || saving || deleting}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                <option value="ACCOUNTANT">ACCOUNTANT (Invoices, Payments & VAT)</option>
                <option value="SALES">SALES (Quotations & Customers CRM)</option>
                <option value="VIEWER">VIEWER (Read-Only Auditor Access)</option>
                <option value="OWNER">OWNER (Full Administrative Control)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Job Title / Designation
            </label>
            <div className="relative">
              <Briefcase className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior Accountant"
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>
        </div>

        {/* Role Description Note */}
        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-500">
          {role === 'ACCOUNTANT' && 'Accountant: Can record payments, issue credit notes, approve tax invoices, and export FTA VAT returns.'}
          {role === 'SALES' && 'Sales: Can register customers, prepare commercial quotes, and generate sales invoices.'}
          {role === 'VIEWER' && 'Viewer: Read-only audit visibility. Cannot create documents or modify financial records.'}
          {role === 'OWNER' && 'Owner: Full administrative authority across all financial configurations, VAT setup, and user management.'}
        </div>

        {/* Admin Password Reset Section */}
        <div className="pt-2 border-t border-slate-100">
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
            Reset Password <span className="font-normal text-slate-400">(leave blank to keep current password)</span>
          </label>
          <div className="relative">
            <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type={showPassword ? 'text' : 'password'}
              name="edit_member_new_password"
              id="edit_member_new_password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password (min 8 chars)"
              className="w-full pl-9 pr-9 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            If this team member forgot their password, you can set a new one here. It will be securely encrypted and saved directly to MongoDB Atlas.
          </p>
        </div>

        {/* Modal Footer: Delete on Bottom Left, Cancel & Save on Bottom Right */}
        <div className="pt-3 flex items-center justify-between gap-2 border-t border-slate-100">
          {/* Bottom Left: Red Danger Delete User Button */}
          <div>
            {!isSelf && (
              <>
                {!confirmDelete ? (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    disabled={saving || deleting}
                    onClick={() => setConfirmDelete(true)}
                    className="text-xs flex items-center gap-1.5 shadow-xs"
                    title="Permanently remove this user from the organization"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete User</span>
                  </Button>
                ) : (
                  <div className="flex items-center gap-1.5 animate-in fade-in">
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      disabled={deleting}
                      onClick={handleDelete}
                      className="text-xs bg-rose-700 hover:bg-rose-800 text-white flex items-center gap-1.5 shadow-sm"
                    >
                      {deleting ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Deleting...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Confirm Delete?</span>
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={deleting}
                      onClick={() => setConfirmDelete(false)}
                      className="text-xs px-2 text-slate-600"
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Bottom Right: Cancel & Save Changes */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving || deleting}
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="emerald"
              size="sm"
              disabled={saving || deleting}
              className="text-xs min-w-[110px]"
            >
              {saving ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </span>
              ) : (
                <span>Save Changes</span>
              )}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
