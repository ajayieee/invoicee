'use client';

import React from 'react';
import { Dialog } from './Dialog';
import { Button } from './Button';
import { Trash2, AlertTriangle } from 'lucide-react';

export interface ConfirmDeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  itemName?: string;
  itemType?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDeleteModal({
  open,
  onOpenChange,
  title = 'Confirm Delete',
  itemName,
  itemType = 'item',
  description,
  confirmText = 'Confirm Delete',
  cancelText = 'Cancel',
  isLoading = false,
  onConfirm,
}: ConfirmDeleteModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isLoading) {
          onOpenChange(isOpen);
        }
      }}
      title={title}
      maxWidth="md"
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="cursor-pointer"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={onConfirm}
            isLoading={isLoading}
            className="flex items-center gap-1.5 shadow-sm font-semibold cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{confirmText}</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-1">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 border border-rose-200 text-rose-600 shadow-xs">
            <Trash2 className="h-5 w-5" />
          </div>
          <div className="space-y-1.5 flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 leading-snug">
              Are you sure you want to delete this {itemType}?
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              This action is permanent and cannot be reversed. Please confirm if you wish to proceed.
            </p>

            {itemName && (
              <div className="mt-2.5 rounded-lg bg-slate-50 border border-slate-200/80 px-3 py-2 text-xs flex items-center justify-between gap-2">
                <span className="text-slate-500 font-medium shrink-0">Selected:</span>
                <span className="font-semibold text-slate-900 truncate" title={itemName}>
                  {itemName}
                </span>
              </div>
            )}
          </div>
        </div>

        {description && (
          <div className="rounded-lg bg-amber-50/80 border border-amber-200/70 p-3 flex items-start gap-2.5 text-xs text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <span className="leading-relaxed">{description}</span>
          </div>
        )}
      </div>
    </Dialog>
  );
}
