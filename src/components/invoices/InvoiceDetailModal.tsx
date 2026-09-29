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
} from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { Invoice } from '@/types/database';
import { db } from '@/lib/db/repository';
import { formatCurrency, formatDate } from '@/lib/utils';

interface InvoiceDetailModalProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecordPayment: (invoice: Invoice) => void;
  onCreateCreditNote: (invoice: Invoice) => void;
  onPrint: (invoiceId: string) => void;
  onRefresh: () => void;
}

export function InvoiceDetailModal({
  invoice,
  open,
  onOpenChange,
  onRecordPayment,
  onCreateCreditNote,
  onPrint,
  onRefresh,
}: InvoiceDetailModalProps) {
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');

  if (!invoice) return null;

  const payments = db.getPayments().filter((p) => p.invoice_id === invoice.id);
  const creditNotes = db.getCreditNotes().filter((cn) => cn.invoice_id === invoice.id);

  const handleCancelInvoice = () => {
    if (!cancelReason.trim()) {
      setCancelError('A detailed reason is mandatory to cancel an issued tax invoice.');
      return;
    }
    try {
      db.cancelInvoice(invoice.id, cancelReason.trim());
      setCancelModalOpen(false);
      setCancelReason('');
      onRefresh();
    } catch (e: any) {
      setCancelError(e.message || 'Failed to cancel invoice');
    }
  };

  const isCancelled = invoice.status === 'CANCELLED';
  const isDraft = invoice.status === 'DRAFT';
  const isPaid = invoice.status === 'PAID';

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
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPrint(invoice.id)}
                className="text-slate-700"
              >
                <Printer className="h-3.5 w-3.5 mr-1" /> Print / PDF Tax Invoice
              </Button>
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
            </div>

            <div className="flex items-center gap-2">
              {!isCancelled && !isDraft && !isPaid && (
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
              <div className="text-[10px] text-slate-500">Issue Date</div>
              <div className="font-semibold text-slate-800">{formatDate(invoice.invoice_date)}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Date of Supply</div>
              <div className="font-semibold text-slate-800">{formatDate(invoice.supply_date)}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Payment Due</div>
              <div className="font-semibold text-slate-800">{formatDate(invoice.due_date)}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Orig. Quotation</div>
              <div className="font-semibold font-mono text-slate-800">
                {invoice.originating_quote_number || 'Direct Billing'}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Status</div>
              <div className="mt-0.5"><StatusBadge status={invoice.status} /></div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="p-2.5">#</th>
                  <th className="p-2.5">Description of Goods or Services</th>
                  <th className="p-2.5 text-center">Qty / Unit</th>
                  <th className="p-2.5 text-right">Unit Price</th>
                  <th className="p-2.5 text-right">Discount</th>
                  <th className="p-2.5 text-right">Net Subtotal</th>
                  <th className="p-2.5 text-right">VAT Rate</th>
                  <th className="p-2.5 text-right">VAT (AED)</th>
                  <th className="p-2.5 text-right">Total Gross</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {invoice.items.map((it, idx) => (
                  <tr key={it.id || idx} className="hover:bg-slate-50/50">
                    <td className="p-2.5 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="p-2.5 font-medium text-slate-900">{it.description}</td>
                    <td className="p-2.5 text-center text-slate-600">
                      {it.quantity} {it.unit}
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-600">
                      {it.unit_price.toFixed(2)}
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-500">
                      {it.discount_amount > 0 ? it.discount_amount.toFixed(2) : '-'}
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-700 font-semibold">
                      {it.subtotal_net.toFixed(2)}
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-600">
                      {it.vat_rate_percentage}%
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-700">
                      {it.vat_amount.toFixed(2)}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                      {it.total_gross.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Breakdown & Bank Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Bank Snapshot Details */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-slate-600" />
                <span>Bank Payment Coordinates</span>
              </div>
              <div className="text-slate-600 text-[11px] space-y-0.5 pt-1">
                <div>Bank: <strong>{invoice.bank_details_snapshot?.bank_name || 'FAB'}</strong></div>
                <div>Account Name: <strong>{invoice.bank_details_snapshot?.account_name}</strong></div>
                <div>IBAN: <strong className="font-mono text-slate-900">{invoice.bank_details_snapshot?.iban}</strong></div>
                <div>SWIFT / BIC: <strong className="font-mono">{invoice.bank_details_snapshot?.swift_bic}</strong></div>
              </div>
            </div>

            {/* Totals Summary */}
            <div className="p-4 rounded-xl bg-slate-900 text-white space-y-2">
              <div className="flex justify-between text-slate-300">
                <span>Subtotal (Net of Discounts):</span>
                <span className="font-mono">{formatCurrency(invoice.subtotal_net)}</span>
              </div>
              {invoice.discount_amount > 0 && (
                <div className="flex justify-between text-amber-300">
                  <span>Document Discount:</span>
                  <span className="font-mono">-{formatCurrency(invoice.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-300">
                <span>Output UAE VAT (5%):</span>
                <span className="font-mono">{formatCurrency(invoice.vat_total)}</span>
              </div>
              <div className="border-t border-slate-800 pt-1.5 flex justify-between font-bold text-base">
                <span>Grand Total (AED):</span>
                <span className="font-mono text-emerald-400">{formatCurrency(invoice.grand_total)}</span>
              </div>
              <div className="flex justify-between text-xs text-sky-300 pt-1">
                <span>Amount Paid:</span>
                <span className="font-mono">{formatCurrency(invoice.amount_paid)}</span>
              </div>
              <div className="border-t border-slate-800 pt-1 flex justify-between font-bold text-rose-400">
                <span>Balance Due:</span>
                <span className="font-mono">{formatCurrency(invoice.balance_due)}</span>
              </div>
            </div>
          </div>

          {/* Payments Ledger for this Invoice */}
          {payments.length > 0 && (
            <div className="space-y-1.5">
              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                <History className="h-4 w-4 text-emerald-600" />
                <span>Recorded Payment Transactions</span>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="p-2">Receipt #</th>
                      <th className="p-2">Date</th>
                      <th className="p-2">Method</th>
                      <th className="p-2">Reference</th>
                      <th className="p-2 text-right">Amount (AED)</th>
                      <th className="p-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td className="p-2 font-mono font-semibold">{p.payment_number}</td>
                        <td className="p-2 text-slate-500">{formatDate(p.payment_date)}</td>
                        <td className="p-2 text-slate-700">{p.payment_method_name}</td>
                        <td className="p-2 text-slate-500 font-mono">{p.reference_number || '-'}</td>
                        <td className="p-2 text-right font-mono font-bold text-emerald-700">
                          {formatCurrency(p.amount)}
                        </td>
                        <td className="p-2 text-right">
                          <StatusBadge status={p.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Credit Notes for this Invoice */}
          {creditNotes.length > 0 && (
            <div className="space-y-1.5">
              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                <RotateCcw className="h-4 w-4 text-amber-600" />
                <span>Associated Credit Notes</span>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="p-2">Credit Note #</th>
                      <th className="p-2">Date</th>
                      <th className="p-2">Reason</th>
                      <th className="p-2 text-right">Credit Total</th>
                      <th className="p-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {creditNotes.map((cn) => (
                      <tr key={cn.id}>
                        <td className="p-2 font-mono font-semibold text-amber-800">{cn.credit_note_number}</td>
                        <td className="p-2 text-slate-500">{formatDate(cn.credit_note_date)}</td>
                        <td className="p-2 text-slate-700">{cn.reason}</td>
                        <td className="p-2 text-right font-mono font-bold text-amber-800">
                          {formatCurrency(cn.grand_total)}
                        </td>
                        <td className="p-2 text-right">
                          <StatusBadge status={cn.status} />
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

      {/* Cancellation Reason Modal */}
      <Dialog
        open={cancelModalOpen}
        onOpenChange={setCancelModalOpen}
        title="Cancel Issued Tax Invoice"
        description="Accounting Rule: Cancelled invoices remain permanently in the database for audit integrity. Sequence numbers are never deleted or reused."
        maxWidth="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelModalOpen(false)}>
              Keep Active
            </Button>
            <Button variant="danger" onClick={handleCancelInvoice}>
              Confirm Cancellation
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Invoice <strong>{invoice.invoice_number}</strong> will be marked as CANCELLED. The document number will be permanently preserved.
            </span>
          </div>

          {cancelError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {cancelError}
            </div>
          )}

          <Textarea
            label="Mandatory Reason for Cancellation *"
            placeholder="e.g. Agreement terms revised before customer dispatch; replaced by INV-2026-xxxx..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={3}
          />
        </div>
      </Dialog>
    </>
  );
}
