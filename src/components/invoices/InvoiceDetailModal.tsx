'use client';

import React, { useState } from 'react';
import {
  Receipt,
  DollarSign,
  RotateCcw,
  Ban,
  Printer,
  ShieldCheck,
  Building,
  CreditCard,
  AlertTriangle,
  History,
  QrCode,
  Copy,
  Edit,
  Send,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { Invoice } from '@/types/database';
import { invoiceService } from '@/services/invoice.service';
import { db } from '@/lib/db/repository';
import { formatCurrency, formatDate } from '@/lib/utils';
import { AlertBanner } from '@/components/ui/FormError';

interface InvoiceDetailModalProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecordPayment: (invoice: Invoice) => void;
  onCreateCreditNote: (invoice: Invoice) => void;
  onEditDraft?: (invoice: Invoice) => void;
  onPrint: (invoiceId: string) => void;
  onRefresh: () => void;
}

export function InvoiceDetailModal({
  invoice,
  open,
  onOpenChange,
  onRecordPayment,
  onCreateCreditNote,
  onEditDraft,
  onPrint,
  onRefresh,
}: InvoiceDetailModalProps) {
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  if (!invoice) return null;

  const payments = db.getPayments().filter((p) => p.invoice_id === invoice.id);
  const creditNotes = db.getCreditNotes().filter((cn) => cn.invoice_id === invoice.id);

  const handleIssueInvoice = () => {
    const res = invoiceService.issueInvoice(invoice.id);
    if (res.success) {
      setActionSuccess('Tax invoice has been officially issued with legal sequential numbering.');
      onRefresh();
      setTimeout(() => setActionSuccess(null), 3000);
    } else {
      setCancelError(res.error || 'Failed to issue invoice.');
    }
  };

  const handleDuplicateInvoice = () => {
    const res = invoiceService.duplicateInvoice(invoice.id);
    if (res.success && res.data) {
      setActionSuccess(`Cloned invoice into draft proposal: ${res.data.invoice_number}`);
      onRefresh();
      setTimeout(() => setActionSuccess(null), 3000);
    } else {
      setCancelError(res.error || 'Failed to duplicate invoice.');
    }
  };

  const handleCancelInvoice = () => {
    if (!cancelReason.trim()) {
      setCancelError('A detailed reason is mandatory to cancel an issued tax invoice.');
      return;
    }
    const res = invoiceService.cancelInvoice(invoice.id, cancelReason.trim());
    if (res.success) {
      setCancelModalOpen(false);
      setCancelReason('');
      setCancelError('');
      setActionSuccess('Invoice successfully cancelled and retained in registers.');
      onRefresh();
      setTimeout(() => setActionSuccess(null), 3000);
    } else {
      setCancelError(res.error || 'Failed to cancel invoice.');
    }
  };

  const isCancelled = invoice.status === 'CANCELLED';
  const isDraft = invoice.status === 'DRAFT';
  const isPaid = invoice.status === 'PAID';
  const isOverdue =
    invoice.balance_due > 0 &&
    new Date(invoice.due_date) < new Date() &&
    !isCancelled &&
    !isDraft;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title={`Tax Invoice: ${invoice.invoice_number}`}
        description={`UAE FTA Tax Invoice • Supply Date: ${formatDate(invoice.supply_date)}`}
        maxWidth="4xl"
        footer={
          <div className="flex items-center justify-between w-full flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPrint(invoice.id)}
                className="text-slate-700"
              >
                <Printer className="h-3.5 w-3.5 mr-1" /> Print / PDF Tax Invoice
              </Button>

              {isDraft && onEditDraft && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditDraft(invoice)}
                  className="text-slate-700"
                >
                  <Edit className="h-3.5 w-3.5 mr-1" /> Edit Draft
                </Button>
              )}

              {isDraft && (
                <Button
                  variant="emerald"
                  size="sm"
                  onClick={handleIssueInvoice}
                  className="font-semibold shadow-xs"
                >
                  <Send className="h-3.5 w-3.5 mr-1" /> Issue Official Invoice
                </Button>
              )}

              {!isCancelled && !isDraft && invoice.balance_due > 0 && (
                <Button
                  variant="emerald"
                  size="sm"
                  onClick={() => onRecordPayment(invoice)}
                  className="font-semibold"
                >
                  <DollarSign className="h-3.5 w-3.5 mr-1" /> Record Payment
                </Button>
              )}

              {!isCancelled && !isDraft && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCreateCreditNote(invoice)}
                  className="text-amber-700 border-amber-300 hover:bg-amber-50"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1 text-amber-600" /> Create Credit Note
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleDuplicateInvoice}
                className="text-slate-700"
              >
                <Copy className="h-3.5 w-3.5 mr-1" /> Duplicate
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {!isCancelled && !isPaid && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setCancelReason('');
                    setCancelError('');
                    setCancelModalOpen(true);
                  }}
                >
                  <Ban className="h-3.5 w-3.5 mr-1" /> Cancel Invoice
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          {actionSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">
              {actionSuccess}
            </div>
          )}

          {/* Cancellation Banner */}
          {isCancelled && (
            <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-300 text-slate-800 space-y-1">
              <div className="flex items-center gap-2 font-bold text-rose-700">
                <Ban className="h-4 w-4" />
                <span>INVOICE CANCELLED & VOIDED (Audit Retained)</span>
              </div>
              <p className="text-slate-600">
                Reason: <strong>{invoice.cancellation_reason || 'Administrative cancellation'}</strong>
              </p>
              <p className="text-[11px] text-slate-500">
                Cancelled on: {formatDate(invoice.cancelled_at)} • Invoice number remains permanently recorded in registers per accounting guidelines.
              </p>
            </div>
          )}

          {/* Originating Quote Banner */}
          {invoice.originating_quote_number && (
            <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium">
                <FileText className="h-4 w-4 text-indigo-600" />
                <span>Converted from Originating Proposal: <strong>{invoice.originating_quote_number}</strong></span>
              </div>
              <Badge variant="outline" className="bg-white text-indigo-700 border-indigo-300 font-mono">
                Quote Reference Verified
              </Badge>
            </div>
          )}

          {/* Supplier & Customer Header Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Supplier Profile */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="text-[10px] font-bold uppercase text-slate-500">Supplier Details (Issuer)</div>
              <div className="font-bold text-sm text-slate-900">
                {invoice.company_snapshot.legal_company_name}
              </div>
              <div className="text-slate-600">
                {invoice.company_snapshot.address_line_1}, {invoice.company_snapshot.city}, {invoice.company_snapshot.emirate}
              </div>
              <div className="flex items-center gap-1.5 pt-1 text-slate-800 font-medium">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Supplier TRN: <strong>{invoice.company_snapshot.trn}</strong></span>
              </div>
            </div>

            {/* Recipient Profile */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="text-[10px] font-bold uppercase text-slate-500">Customer Details (Billed To)</div>
              <div className="font-bold text-sm text-slate-900">
                {invoice.customer_snapshot.company_name || invoice.customer_snapshot.contact_person}
              </div>
              <div className="text-slate-600">
                {invoice.customer_snapshot.billing_address_line_1 || 'Address on file'}
                {invoice.customer_snapshot.billing_city && `, ${invoice.customer_snapshot.billing_city}`}
                {invoice.customer_snapshot.billing_emirate && `, ${invoice.customer_snapshot.billing_emirate}`}
              </div>
              <div className="flex items-center gap-1.5 pt-1 text-slate-800">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>
                  Customer TRN:{' '}
                  {invoice.customer_snapshot.trn ? (
                    <strong>{invoice.customer_snapshot.trn}</strong>
                  ) : (
                    <span className="italic text-slate-400">Not VAT Registered</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Dates & Reference Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 rounded-xl bg-white border border-slate-200 text-center">
            <div>
              <div className="text-[10px] text-slate-500">Invoice Date</div>
              <div className="font-semibold text-slate-800">{formatDate(invoice.invoice_date)}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Date of Supply</div>
              <div className="font-semibold text-slate-800">{formatDate(invoice.supply_date)}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Due Date</div>
              <div className={`font-semibold ${isOverdue ? 'text-rose-600' : 'text-slate-800'}`}>
                {formatDate(invoice.due_date)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Ref / PO Number</div>
              <div className="font-mono text-slate-800">{invoice.reference_number || invoice.po_number || '-'}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Invoice Status</div>
              <div className="pt-0.5">
                <StatusBadge status={invoice.status} />
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white shadow-xs">
            <table className="w-full text-xs text-left min-w-[700px]">
              <thead className="bg-slate-900 text-white font-medium">
                <tr>
                  <th className="px-3 py-2 w-10">#</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-center w-16">Qty</th>
                  <th className="px-3 py-2 text-right w-24">Unit Price</th>
                  <th className="px-3 py-2 text-right w-20">Discount</th>
                  <th className="px-3 py-2 text-right w-24">Taxable Net</th>
                  <th className="px-3 py-2 text-right w-20">VAT %</th>
                  <th className="px-3 py-2 text-right w-24">VAT (AED)</th>
                  <th className="px-3 py-2 text-right w-24">Total (AED)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {invoice.items.map((it, idx) => (
                  <tr key={it.id || idx} className="hover:bg-slate-50/70">
                    <td className="px-3 py-2 text-slate-400 text-center">{idx + 1}</td>
                    <td className="px-3 py-2 font-sans font-medium text-slate-900">
                      {it.description}
                    </td>
                    <td className="px-3 py-2 text-center text-slate-600">
                      {it.quantity} {it.unit}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {formatCurrency(it.unit_price)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-500">
                      {it.discount_amount > 0 ? formatCurrency(it.discount_amount) : '-'}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-800 font-semibold">
                      {formatCurrency(it.subtotal_net)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {it.vat_rate_percentage}%
                    </td>
                    <td className="px-3 py-2 text-right text-slate-800">
                      {formatCurrency(it.vat_amount)}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-slate-950">
                      {formatCurrency(it.total_gross)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Breakdown & Balances */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Notes & Commercial Terms */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="text-[10px] font-bold uppercase text-slate-500">Commercial Notes & Settlement Terms</div>
              <p className="text-slate-700 italic">{invoice.notes || 'No customer notes specified.'}</p>
              {invoice.terms && (
                <div className="pt-2 border-t border-slate-200">
                  <div className="text-[10px] font-bold text-slate-500">Terms & Conditions:</div>
                  <p className="text-slate-600 text-[11px] mt-0.5">{invoice.terms}</p>
                </div>
              )}
            </div>

            {/* Calculations Summary Box */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 font-mono">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal (Net):</span>
                <span>{formatCurrency(invoice.subtotal_net)}</span>
              </div>
              {invoice.discount_amount > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>Document Discount:</span>
                  <span>- {formatCurrency(invoice.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-slate-800">
                <span>Taxable Amount (Article 25):</span>
                <span>
                  {formatCurrency(Math.max(0, invoice.subtotal_net - invoice.discount_amount))}
                </span>
              </div>
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>VAT Total (5%):</span>
                <span>+ {formatCurrency(invoice.vat_total)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-300 font-bold text-slate-950 text-sm">
                <span>Grand Total (AED):</span>
                <span>{formatCurrency(invoice.grand_total)}</span>
              </div>
              <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-200">
                <span>Amount Paid:</span>
                <span className="text-emerald-700 font-bold">{formatCurrency(invoice.amount_paid)}</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-1">
                <span>Balance Due:</span>
                <span className={invoice.balance_due > 0 ? 'text-rose-600' : 'text-slate-400'}>
                  {formatCurrency(invoice.balance_due)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment History */}
          {payments.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-emerald-600" />
                <span>Recorded Payments ({payments.length})</span>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white">
                <table className="w-full text-xs text-left min-w-[550px]">
                  <thead className="bg-slate-100 text-slate-600 font-medium">
                    <tr>
                      <th className="px-3 py-2">Receipt #</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Method</th>
                      <th className="px-3 py-2">Reference</th>
                      <th className="px-3 py-2 text-right">Amount (AED)</th>
                      <th className="px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td className="px-3 py-2 font-bold text-slate-900">{p.payment_number}</td>
                        <td className="px-3 py-2 text-slate-600 font-sans">{formatDate(p.payment_date)}</td>
                        <td className="px-3 py-2 font-sans">{p.payment_method_name || 'Bank Transfer'}</td>
                        <td className="px-3 py-2 text-slate-500">{p.reference_number || '-'}</td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-700">
                          {formatCurrency(p.amount)}
                        </td>
                        <td className="px-3 py-2 text-center font-sans">
                          <Badge variant={p.status === 'RECORDED' ? 'success' : 'secondary'}>
                            {p.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Credit Notes History */}
          {creditNotes.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <RotateCcw className="h-4 w-4 text-amber-600" />
                <span>Credit Notes Issued ({creditNotes.length})</span>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white">
                <table className="w-full text-xs text-left min-w-[550px]">
                  <thead className="bg-amber-50 text-amber-900 font-medium">
                    <tr>
                      <th className="px-3 py-2">Credit Note #</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Reason</th>
                      <th className="px-3 py-2 text-right">Credited Amount</th>
                      <th className="px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {creditNotes.map((cn) => (
                      <tr key={cn.id}>
                        <td className="px-3 py-2 font-bold text-amber-900">{cn.credit_note_number}</td>
                        <td className="px-3 py-2 text-slate-600 font-sans">{formatDate(cn.credit_note_date)}</td>
                        <td className="px-3 py-2 text-slate-700 font-sans">{cn.reason}</td>
                        <td className="px-3 py-2 text-right font-bold text-rose-600">
                          - {formatCurrency(cn.grand_total)}
                        </td>
                        <td className="px-3 py-2 text-center font-sans">
                          <Badge variant="outline" className="text-amber-800 border-amber-300">
                            {cn.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Dialog>

      {/* Cancellation Confirmation Dialog */}
      <Dialog
        open={cancelModalOpen}
        onOpenChange={setCancelModalOpen}
        title="Cancel Tax Invoice"
        description="Cancelling an official tax invoice is an audited accounting operation. The invoice number remains permanently registered."
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setCancelModalOpen(false)}>
              Back
            </Button>
            <Button variant="danger" onClick={handleCancelInvoice}>
              Confirm Cancellation
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          {cancelError && <AlertBanner variant="error" message={cancelError} />}
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span>UAE FTA Tax Register Notice</span>
            </div>
            <p className="text-[11px] text-amber-800">
              In accordance with UAE VAT auditing guidelines, cancelled invoices are NEVER deleted.
              Invoice number <strong>{invoice.invoice_number}</strong> will remain permanently recorded
              as cancelled and will not be reused.
            </p>
          </div>
          <Textarea
            label="Mandatory Reason for Cancellation *"
            rows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="e.g. Order cancelled prior to supply, billing error corrected via new document, etc."
          />
        </div>
      </Dialog>
    </>
  );
}
