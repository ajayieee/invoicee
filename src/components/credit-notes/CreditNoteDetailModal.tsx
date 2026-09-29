'use client';

import React, { useState } from 'react';
import {
  FileText,
  RotateCcw,
  ShieldCheck,
  Building2,
  Calendar,
  CheckCircle2,
  Coins,
  Send,
  Eye,
  Printer,
  History,
  QrCode,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { CreditNote } from '@/types/database';
import { creditNoteService } from '@/services/credit-note.service';
import { db } from '@/lib/db/repository';
import { formatCurrency, formatDate } from '@/lib/utils';

interface CreditNoteDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditNoteId: string | null;
  onViewInvoice?: (invoiceId: string) => void;
  onPrintCreditNote?: (creditNoteId: string) => void;
  onRefresh?: () => void;
}

export function CreditNoteDetailModal({
  open,
  onOpenChange,
  creditNoteId,
  onViewInvoice,
  onPrintCreditNote,
  onRefresh,
}: CreditNoteDetailModalProps) {
  const [submittingAsp, setSubmittingAsp] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'BANK'>('BANK');
  const [refundReference, setRefundReference] = useState('');
  const [refundNotes, setRefundNotes] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (!creditNoteId) return null;
  const cn = db.getCreditNoteById(creditNoteId);
  if (!cn) return null;

  const inv = db.getInvoiceById(cn.invoice_id);
  const auditLogs = db.getAuditLogs('CREDIT_NOTE', cn.id);

  const handleProcessRefund = () => {
    const res = creditNoteService.processRefund(
      cn.id,
      refundMethod,
      refundReference.trim() || undefined,
      refundNotes.trim() || undefined
    );
    if (!res.success) {
      setFeedback({ type: 'error', message: res.error || 'Failed to process refund.' });
    } else {
      setFeedback({ type: 'success', message: 'Refund successfully recorded and ledger updated.' });
      setRefundOpen(false);
      onRefresh && onRefresh();
    }
  };

  const handleCancelCreditNote = () => {
    if (!cancelReason.trim()) {
      setFeedback({ type: 'error', message: 'A cancellation reason is required.' });
      return;
    }
    const res = creditNoteService.cancelCreditNote(cn.id, cancelReason.trim());
    if (!res.success) {
      setFeedback({ type: 'error', message: res.error || 'Failed to cancel credit note.' });
    } else {
      setFeedback({ type: 'success', message: 'Credit Note cancelled. Associated invoice balance has been restored.' });
      setCancelOpen(false);
      onRefresh && onRefresh();
    }
  };

  const handleSubmitToAsp = async () => {
    setSubmittingAsp(true);
    const res = await creditNoteService.submitToAsp(cn.id);
    setSubmittingAsp(false);
    if (res.success) {
      setFeedback({ type: 'success', message: 'Electronic credit note successfully cleared with UAE ASP.' });
      onRefresh && onRefresh();
    } else {
      setFeedback({ type: 'error', message: res.error || 'Failed to submit to ASP.' });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Credit Note: ${cn.credit_note_number}`}
      description="UAE Tax Credit Note specifications, line item precision, and audit trail."
      maxWidth="3xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {cn.status !== 'CANCELLED' && onPrintCreditNote && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onPrintCreditNote(cn.id);
                }}
                className="gap-1.5 text-xs text-slate-700"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Official PDF</span>
              </Button>
            )}

            {cn.refund_status === 'CREDIT_ON_ACCOUNT' && cn.status !== 'CANCELLED' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRefundOpen(true)}
                className="gap-1.5 text-xs text-emerald-700 border-emerald-300 bg-emerald-50"
              >
                <Coins className="h-3.5 w-3.5" />
                <span>Record Client Refund</span>
              </Button>
            )}

            {cn.status === 'ISSUED' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancelOpen(true)}
                className="gap-1.5 text-xs text-rose-700 border-rose-300 hover:bg-rose-50"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Cancel Credit Note</span>
              </Button>
            )}
          </div>

          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {feedback && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <span>{feedback.message}</span>
            <button
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-slate-600 font-bold ml-2"
            >
              ×
            </button>
          </div>
        )}

        {/* Top Header Card */}
        <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-amber-400">{cn.credit_note_number}</span>
              <StatusBadge status={cn.status} />
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                {cn.credit_type}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Issued on <strong className="text-white">{formatDate(cn.credit_note_date)}</strong> for{' '}
              <strong className="text-white">{cn.customer_name}</strong>
            </p>
          </div>

          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Total Credit Value</div>
            <div className="text-2xl font-bold font-mono text-amber-400">
              {formatCurrency(cn.grand_total)} <span className="text-xs font-normal">AED</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Net: {formatCurrency(cn.subtotal_net)} • VAT (5%): {formatCurrency(cn.vat_total)}
            </div>
          </div>
        </div>

        {/* Originating Tax Invoice Reference Box */}
        <div className="p-3.5 rounded-xl bg-amber-50/40 border border-amber-200 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-amber-800 font-semibold block text-[11px]">Original Tax Invoice:</span>
            {inv ? (
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onViewInvoice && onViewInvoice(inv.id);
                }}
                className="font-mono font-bold text-emerald-700 hover:underline cursor-pointer flex items-center gap-1 mt-0.5"
              >
                <span>{inv.invoice_number}</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            ) : (
              <span className="font-mono font-bold text-slate-800">{cn.invoice_number}</span>
            )}
          </div>

          <div>
            <span className="text-slate-500 block text-[11px]">Invoice Date:</span>
            <span className="font-medium text-slate-800">{formatDate(cn.invoice_date || inv?.invoice_date || '')}</span>
          </div>

          <div>
            <span className="text-slate-500 block text-[11px]">Original Gross Total:</span>
            <span className="font-mono font-bold text-slate-900">
              {formatCurrency(cn.original_invoice_total || inv?.grand_total || 0)}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block text-[11px]">Refund / Allocation Status:</span>
            <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
              {cn.refund_status.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        {/* Reason for Issuance */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
              Mandatory UAE VAT Reason:
            </span>
            {cn.credit_reason_code && (
              <span className="font-mono text-[10px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded">
                Code: {cn.credit_reason_code}
              </span>
            )}
          </div>
          <p className="text-slate-800 font-medium italic">&ldquo;{cn.reason}&rdquo;</p>
        </div>

        {/* Line Items Breakdown */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
            Credited Items Breakdown
          </h4>
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">#</th>
                  <th className="p-2.5">Description</th>
                  <th className="p-2.5 text-center">Original Qty</th>
                  <th className="p-2.5 text-center">Credited Qty</th>
                  <th className="p-2.5 text-right">Unit Price</th>
                  <th className="p-2.5 text-right">Net Credit</th>
                  <th className="p-2.5 text-right">VAT (5%)</th>
                  <th className="p-2.5 text-right">Total Gross</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {cn.items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-2.5 text-slate-400">{idx + 1}</td>
                    <td className="p-2.5 font-medium text-slate-900">{item.description}</td>
                    <td className="p-2.5 text-center text-slate-500">
                      {item.original_invoiced_quantity !== undefined ? item.original_invoiced_quantity : '-'}
                    </td>
                    <td className="p-2.5 text-center font-bold text-amber-900">{item.quantity}</td>
                    <td className="p-2.5 text-right font-mono text-slate-600">{formatCurrency(item.unit_price)}</td>
                    <td className="p-2.5 text-right font-mono text-slate-800">{formatCurrency(item.subtotal_net)}</td>
                    <td className="p-2.5 text-right font-mono text-slate-800">{formatCurrency(item.vat_amount)}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-amber-900">
                      {formatCurrency(item.total_gross)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* UAE E-Invoicing / ASP Digital Footprint */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-900">UAE Electronic Credit Note Verification</span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              ASP {cn.e_invoice_status}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1">
            <div>
              <span className="text-slate-400 block text-[10px]">Universal Document UUID:</span>
              <span className="font-mono text-slate-800 select-all">{cn.e_invoice_uuid || 'Pending generation'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Cryptographic SHA-256 Digest:</span>
              <span className="font-mono text-slate-800 truncate block select-all" title={cn.e_invoice_hash}>
                {cn.e_invoice_hash || 'Pending generation'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Accredited Service Provider (ASP):</span>
              <span className="text-slate-800">{cn.asp_provider_name || 'Simulated UAE ASP'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">ASP Clearance Submission ID:</span>
              <span className="font-mono text-slate-800">{cn.asp_submission_id || 'N/A'}</span>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              isLoading={submittingAsp}
              onClick={handleSubmitToAsp}
              className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
            >
              <Send className="h-3 w-3 mr-1" />
              <span>Re-Submit to UAE ASP Access Point</span>
            </Button>
          </div>
        </div>

        {/* Audit Trail */}
        {auditLogs.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <History className="h-3.5 w-3.5 text-slate-500" />
              <span>Document Audit Trail</span>
            </h4>
            <div className="space-y-1.5">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-lg border border-slate-200 bg-white text-xs flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-800 mr-2">{log.action}</span>
                    <span className="text-slate-500">by {log.performed_by_name}</span>
                  </div>
                  <span className="text-slate-400 font-mono text-[11px]">{formatDate(log.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Client Refund Modal Sub-Dialog */}
        {refundOpen && (
          <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/80 space-y-3">
            <h4 className="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
              <Coins className="h-4 w-4 text-emerald-700" />
              <span>Record Client Payout / Refund</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Disbursement Method</label>
                <select
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value as any)}
                  className="w-full p-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                >
                  <option value="BANK">Bank Transfer / Wire</option>
                  <option value="CASH">Cash Disbursement</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Reference / Cheque Number</label>
                <input
                  type="text"
                  placeholder="e.g. TXN-9948291"
                  value={refundReference}
                  onChange={(e) => setRefundReference(e.target.value)}
                  className="w-full p-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setRefundOpen(false)}>
                Cancel
              </Button>
              <Button variant="emerald" size="sm" onClick={handleProcessRefund}>
                Confirm Refund
              </Button>
            </div>
          </div>
        )}

        {/* Cancellation Sub-Dialog */}
        {cancelOpen && (
          <div className="p-4 rounded-xl border border-rose-300 bg-rose-50/80 space-y-3">
            <h4 className="font-bold text-xs text-rose-950 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-rose-700" />
              <span>Documented Credit Note Cancellation</span>
            </h4>
            <p className="text-[11px] text-rose-800">
              In accordance with UAE accounting regulations, issued credit notes are never deleted.
              Cancelling this note will mark it CANCELLED, reopen the invoice balance, and write an immutable audit log.
            </p>
            <input
              type="text"
              placeholder="Mandatory cancellation reason..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full p-2 rounded-lg border border-rose-300 bg-white text-xs"
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setCancelOpen(false)}>
                Abort
              </Button>
              <Button variant="danger" size="sm" onClick={handleCancelCreditNote}>
                Confirm Cancellation
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
