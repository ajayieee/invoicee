'use client';

import React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 ${className}`}
    >
      <div className="h-12 w-12 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-slate-400 mb-4">
        <Icon className="h-6 w-6 text-slate-500" />
      </div>

      <h3 className="text-sm font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">{description}</p>

      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {action && (
            <Button variant="emerald" size="sm" onClick={action.onClick} className="flex items-center gap-1.5 shadow-xs">
              {action.icon && React.createElement(action.icon, { className: 'h-3.5 w-3.5' })}
              <span>{action.label}</span>
            </Button>
          )}

          {secondaryAction && (
            <Button variant="outline" size="sm" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
