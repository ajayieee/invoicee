import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 
    | 'default' 
    | 'secondary' 
    | 'outline' 
    | 'success' 
    | 'warning' 
    | 'danger' 
    | 'info' 
    | 'cancelled'
    | 'converted';
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  const variantStyles = {
    default: 'bg-slate-900 text-white border-transparent',
    secondary: 'bg-slate-100 text-slate-800 border-slate-200',
    outline: 'text-slate-800 border-slate-300 bg-transparent',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-1 ring-emerald-600/10',
    warning: 'bg-amber-50 text-amber-700 border-amber-200 ring-1 ring-amber-600/10',
    danger: 'bg-rose-50 text-rose-700 border-rose-200 ring-1 ring-rose-600/10',
    info: 'bg-sky-50 text-sky-700 border-sky-200 ring-1 ring-sky-600/10',
    cancelled: 'bg-slate-100 text-slate-500 line-through border-slate-300',
    converted: 'bg-purple-50 text-purple-700 border-purple-200 ring-1 ring-purple-600/10',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'PAID':
    case 'ACCEPTED':
    case 'APPLIED':
    case 'ACTIVE':
    case 'RECORDED':
      return <Badge variant="success">{status.replace('_', ' ')}</Badge>;

    case 'PARTIALLY_PAID':
    case 'PENDING':
    case 'EXPIRED':
      return <Badge variant="warning">{status.replace('_', ' ')}</Badge>;

    case 'OVERDUE':
    case 'REJECTED':
    case 'REVERSED':
      return <Badge variant="danger">{status.replace('_', ' ')}</Badge>;

    case 'ISSUED':
    case 'SENT':
      return <Badge variant="info">{status.replace('_', ' ')}</Badge>;

    case 'CONVERTED':
      return <Badge variant="converted">CONVERTED</Badge>;

    case 'CANCELLED':
      return <Badge variant="cancelled">CANCELLED</Badge>;

    case 'DRAFT':
    default:
      return <Badge variant="secondary">{status.replace('_', ' ')}</Badge>;
  }
}
