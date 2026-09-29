'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

interface FormErrorProps {
  message?: string | null;
  className?: string;
}

export function FormError({ message, className = '' }: FormErrorProps) {
  if (!message) return null;

  return (
    <p className={`flex items-center gap-1 text-[11px] text-rose-600 mt-1 font-medium animate-in fade-in duration-150 ${className}`}>
      <AlertCircle className="h-3 w-3 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

interface AlertBannerProps {
  variant?: 'error' | 'success' | 'info';
  title?: string;
  message: string;
  onClose?: () => void;
  className?: string;
}

export function AlertBanner({
  variant = 'error',
  title,
  message,
  onClose,
  className = '',
}: AlertBannerProps) {
  const styles = {
    error: 'bg-rose-50 border-rose-200 text-rose-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    info: 'bg-sky-50 border-sky-200 text-sky-800',
  };

  const icons = {
    error: <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />,
    success: <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />,
    info: <Info className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />,
  };

  return (
    <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${styles[variant]} ${className}`}>
      {icons[variant]}
      <div className="flex-1">
        {title && <div className="font-semibold mb-0.5">{title}</div>}
        <div className="leading-relaxed opacity-90">{message}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
        >
          ✕
        </button>
      )}
    </div>
  );
}
