'use client';

import React, { useState } from 'react';
import { Mail, Lock, KeyRound, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2, ArrowLeft, Send, Check } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';

interface ResetPasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEmail?: string;
  onPasswordResetSuccess?: (email: string) => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export function ResetPasswordModal({
  open,
  onOpenChange,
  defaultEmail = '',
  onPasswordResetSuccess,
}: ResetPasswordModalProps) {
  const [step, setStep] = useState<'EMAIL' | 'VERIFY' | 'SUCCESS'>('EMAIL');
  const [email, setEmail] = useState(defaultEmail);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [deliveredVia, setDeliveredVia] = useState<'brevo' | 'console_fallback' | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setStep('EMAIL');
    setEmail(defaultEmail);
    setCode('');
    setDevCode(null);
    setDeliveredVia(null);
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setError(null);
  };

  // Step 1: Request 6-digit verification code via Brevo
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid work email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to send verification code.');
      } else {
        setDeliveredVia(data.deliveredVia || null);
        if (data.devCode) {
          setDevCode(data.devCode);
        } else {
          setDevCode(null);
        }
        setStep('VERIFY');
      }
    } catch (err: any) {
      setError(err.message || 'Network error while contacting authentication server.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Submit 6-digit code and new password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanCode = code.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match. Please verify and try again.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: cleanCode,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to reset password. Please check your verification code.');
      } else {
        setStep('SUCCESS');
        if (onPasswordResetSuccess) {
          onPasswordResetSuccess(email.trim().toLowerCase());
        }
      }
    } catch (err: any) {
      setError(err.message || 'Network error while contacting authentication server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
      title={step === 'SUCCESS' ? 'Password Reset Complete' : 'Reset Account Password'}
      description={
        step === 'EMAIL'
          ? 'Enter your registered work email to receive a 6-digit code via Brevo.'
          : step === 'VERIFY'
          ? 'Enter the 6-digit verification code and your new password.'
          : 'Your account credentials have been securely updated.'
      }
      maxWidth="md"
    >
      {step === 'SUCCESS' ? (
        <div className="py-6 text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-xs">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-slate-900">Password Changed Successfully!</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Your password has been securely updated in MongoDB Atlas. You can now sign in using your new credentials.
            </p>
          </div>
          <div className="pt-2">
            <Button
              type="button"
              variant="emerald"
              onClick={() => {
                onOpenChange(false);
                resetForm();
              }}
              className="w-full text-xs font-semibold py-2"
            >
              Back to Sign In
            </Button>
          </div>
        </div>
      ) : step === 'EMAIL' ? (
        <form onSubmit={handleRequestCode} className="space-y-4 pt-1" autoComplete="off">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Registered Work Email Address *
            </label>
            <div className="relative">
              <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. ajay@pixelflames.com"
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1.5">
              <span>📧</span>
              <span>A 15-minute verification code will be sent to your email inbox via Brevo.</span>
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="emerald"
              size="sm"
              disabled={loading}
              className="text-xs min-w-[150px] flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Sending Code...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Send Verification Code</span>
                </>
              )}
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="space-y-4 pt-1" autoComplete="off">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Delivery Status Banner */}
          {deliveredVia === 'brevo' ? (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5">
              <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-emerald-950">Email Dispatched via Brevo</div>
                <div className="text-[11px] text-emerald-700 mt-0.5">
                  Please check your inbox (and spam/junk folder) at <strong>{email}</strong> for the 6-digit code.
                </div>
              </div>
            </div>
          ) : devCode ? (
            <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-900 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-emerald-950">
                  Verification Code Generated
                </span>
                <button
                  type="button"
                  onClick={() => setCode(devCode)}
                  className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded font-mono font-bold cursor-pointer transition-colors"
                >
                  Auto-Fill {devCode}
                </button>
              </div>
              <p className="text-[11px] text-emerald-700">
                Code logged to server terminal: <strong className="font-mono">{devCode}</strong>. (Set <code>BREVO_API_KEY</code> in <code>server/.env</code> for live inbox delivery).
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs">
              A 6-digit code was sent to <strong>{email}</strong>.
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-semibold text-slate-700">
                6-Digit Verification Code *
              </label>
              <button
                type="button"
                onClick={() => setStep('EMAIL')}
                className="text-[10px] text-emerald-600 hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <ArrowLeft className="h-2.5 w-2.5" /> Change Email ({email})
              </button>
            </div>
            <div className="relative">
              <KeyRound className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm font-mono tracking-widest bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 text-slate-900"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Valid for 15 minutes. Check your email or spam folder.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              New Password (min 8 characters) *
            </label>
            <div className="relative">
              <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-9 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                tabIndex={-1}
              >
                {showNewPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Confirm New Password *
            </label>
            <div className="relative">
              <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-9 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => setStep('EMAIL')}
              className="text-xs"
            >
              Back
            </Button>
            <Button
              type="submit"
              variant="emerald"
              size="sm"
              disabled={loading}
              className="text-xs min-w-[130px]"
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Resetting...</span>
                </span>
              ) : (
                <span>Reset Password</span>
              )}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
