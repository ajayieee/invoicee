'use client';

import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  AlertTriangle,
  ShieldCheck,
  Upload,
  FileCheck,
  CheckCircle2,
  Calendar,
  X,
  CreditCard,
  Building,
} from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { AlertBanner } from '@/components/ui/FormError';
import { Invoice, PaymentMethod } from '@/types/database';
import { paymentService } from '@/services/payment.service';
import { invoiceService } from '@/services/invoice.service';
import { formatCurrency, formatDate } from '@/lib/utils';

interface RecordPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetInvoice?: Invoice | null;
  onSuccess: (paymentId: string) => void;
}

export function RecordPaymentModal({
  open,
  onOpenChange,
  targetInvoice,
  onSuccess,
}: RecordPaymentModalProps) {
  const paymentMethods = paymentService.getPaymentMethods();

  // Get eligible invoices (active, non-draft, with balance due > 0)
  const eligibleInvoices = invoiceService
    .getInvoices({ pageSize: 200 })
    .items.filter((i) => i.status !== 'CANCELLED' && i.status !== 'DRAFT' && i.balance_due > 0);

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethodId, setPaymentMethodId] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [proofFileName, setProofFileName] = useState<string>('');
  const [proofDataUrl, setProofDataUrl] = useState<string>('');

  // Safeguard & Validation State
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [allowDuplicateOverride, setAllowDuplicateOverride] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync state on open or target invoice change
  useEffect(() => {
    if (open) {
      setError(null);
      setDuplicateWarning(null);
      setAllowDuplicateOverride(false);

      const activeMethod = paymentMethods[0]?.id || '';
      setPaymentMethodId(activeMethod);
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setReferenceNumber('');
      setNotes('');
      setProofFileName('');
      setProofDataUrl('');

      if (targetInvoice) {
        setSelectedInvoiceId(targetInvoice.id);
        setAmount(targetInvoice.balance_due);
      } else if (eligibleInvoices[0]) {
        setSelectedInvoiceId(eligibleInvoices[0].id);
        setAmount(eligibleInvoices[0].balance_due);
      } else {
        setSelectedInvoiceId('');
        setAmount(0);
      }
    }
  }, [open, targetInvoice]);

  const currentInvoice = invoiceService.getInvoiceById(selectedInvoiceId);

  const handleInvoiceChange = (invId: string) => {
    setSelectedInvoiceId(invId);
    setDuplicateWarning(null);
    setAllowDuplicateOverride(false);
    const inv = invoiceService.getInvoiceById(invId);
    if (inv) {
      setAmount(inv.balance_due);
    }
  };

  const handleQuickAmount = (percentage: number) => {
    if (!currentInvoice) return;
    const computed = Number(((currentInvoice.balance_due * percentage) / 100).toFixed(2));
    setAmount(computed);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: 5MB
    if (file.size > 5 * 1024 * 1024) {
      setError('Proof document size exceeds the 5MB limit.');
      return;
    }

    setProofFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setProofDataUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveProof = () => {
    setProofFileName('');
    setProofDataUrl('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentInvoice) {
      setError('Please select an eligible invoice.');
      return;
    }

    const payAmt = Number(amount);
    if (isNaN(payAmt) || payAmt <= 0) {
      setError('Payment amount must be greater than zero.');
      return;
    }

    if (payAmt > currentInvoice.balance_due) {
      setError(
        `Overpayment blocked: Entered payment (${formatCurrency(payAmt)}) exceeds invoice balance due (${formatCurrency(
          currentInvoice.balance_due
        )}).`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await paymentService.recordPayment({
        invoice_id: currentInvoice.id,
        payment_method_id: paymentMethodId,
        amount: payAmt,
        payment_date: paymentDate,
        reference_number: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        payment_proof_name: proofFileName || undefined,
        payment_proof_url: proofDataUrl || undefined,
        allow_duplicate: allowDuplicateOverride,
      });

      if (res.success && res.data) {
        await invoiceService.syncInvoices();
        onSuccess(res.data.id);
        onOpenChange(false);
      } else {
        if (res.error?.includes('duplicate payment')) {
          setDuplicateWarning(res.error);
        } else {
          setError(res.error || 'Failed to record payment');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to post payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculations
  const grandTotal = currentInvoice?.grand_total || 0;
  const existingPaid = currentInvoice?.amount_paid || 0;
  const enteredAmount = Number(amount) || 0;
  const projectedTotalPaid = Math.min(grandTotal, Number((existingPaid + enteredAmount).toFixed(2)));
  const projectedBalanceDue = Math.max(0, Number((grandTotal - projectedTotalPaid).toFixed(2)));

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Record Invoice Settlement Payment"
      description="Record partial or full payment with bank reference, duplicate prevention, and proof upload."
      maxWidth="3xl"
      footer={
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between w-full gap-3">
          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
            <span>Projected Balance Due:</span>
            <strong
              className={`font-mono text-sm ${
                projectedBalanceDue === 0 ? 'text-emerald-700' : 'text-slate-900'
              }`}
            >
              {formatCurrency(projectedBalanceDue)}
            </strong>
            {projectedBalanceDue === 0 && (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                Fully Settled
              </span>
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="emerald"
              onClick={handleSubmit}
              className="font-semibold shadow-xs"
              disabled={!currentInvoice || isSubmitting}
            >
              {isSubmitting ? 'Posting Payment...' : 'Confirm & Post Payment'}
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && <AlertBanner variant="error" message={error} />}

        {/* Duplicate Warning Confirmation Banner */}
        {duplicateWarning && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>Duplicate Payment Safeguard</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">{duplicateWarning}</p>
            <label className="flex items-center gap-2 pt-1 font-semibold text-amber-950 cursor-pointer">
              <input
                type="checkbox"
                checked={allowDuplicateOverride}
                onChange={(e) => setAllowDuplicateOverride(e.target.checked)}
                className="rounded border-amber-400 text-amber-600 focus:ring-amber-500 h-4 w-4"
              />
              <span>I confirm this is an intentional separate payment, not an accidental duplicate.</span>
            </label>
          </div>
        )}

        {/* Invoice Selection */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <label className="block font-bold uppercase tracking-wider text-slate-700">
            Target Tax Invoice *
          </label>
          <select
            value={selectedInvoiceId}
            onChange={(e) => handleInvoiceChange(e.target.value)}
            disabled={!!targetInvoice}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white font-medium focus:outline-none focus:ring-1 focus:ring-emerald-600"
          >
            {eligibleInvoices.length === 0 && !targetInvoice && (
              <option value="">No outstanding invoices with balance due</option>
            )}
            {targetInvoice && (
              <option value={targetInvoice.id}>
                {targetInvoice.invoice_number} —{' '}
                {targetInvoice.customer_snapshot?.company_name ||
                  targetInvoice.customer_snapshot?.contact_person ||
                  (targetInvoice as any).customerSnapshot?.companyName ||
                  'Customer'}{' '}
                (Balance Due: {formatCurrency(targetInvoice.balance_due)})
              </option>
            )}
            {!targetInvoice &&
              eligibleInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoice_number} —{' '}
                  {inv.customer_snapshot?.company_name ||
                    inv.customer_snapshot?.contact_person ||
                    (inv as any).customerSnapshot?.companyName ||
                    'Customer'}{' '}
                  • Date: {formatDate(inv.invoice_date)} • Due: {formatCurrency(inv.balance_due)}
                </option>
              ))}
          </select>

          {/* Current Invoice Quick Snapshot */}
          {currentInvoice && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 text-center font-mono">
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <div className="text-[10px] text-slate-500 font-sans">Total Billed</div>
                <div className="font-bold text-slate-900">{formatCurrency(currentInvoice.grand_total)}</div>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <div className="text-[10px] text-slate-500 font-sans">Already Paid</div>
                <div className="font-bold text-emerald-700">{formatCurrency(currentInvoice.amount_paid)}</div>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <div className="text-[10px] text-slate-500 font-sans">Current Balance</div>
                <div className="font-bold text-rose-600">{formatCurrency(currentInvoice.balance_due)}</div>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <div className="text-[10px] text-slate-500 font-sans">Due Date</div>
                <div className="font-semibold text-slate-800 font-sans">{formatDate(currentInvoice.due_date)}</div>
              </div>
            </div>
          )}
        </div>

        {/* Payment Amount & Method */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Payment Amount Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-800">Payment Amount (AED) *</label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleQuickAmount(100)}
                  className="text-[10px] bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded font-semibold cursor-pointer"
                >
                  Pay 100%
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAmount(50)}
                  className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 px-1.5 py-0.5 rounded cursor-pointer"
                >
                  50%
                </button>
              </div>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
                AED
              </span>
              <input
                type="number"
                step="any"
                min="0.01"
                max={currentInvoice?.balance_due}
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full pl-12 pr-3 py-2 rounded-lg border border-slate-200 font-mono font-bold text-sm focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-800">Payment Channel / Method *</label>
            <select
              value={paymentMethodId}
              onChange={(e) => setPaymentMethodId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 font-medium"
            >
              {paymentMethods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Payment Date & Reference */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Input
              label="Payment Received Date *"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>
          <div>
            <Input
              label="Bank Transaction / Cheque / Ref Number"
              placeholder="e.g. WIRE-98402, CHQ #1042..."
              value={referenceNumber}
              onChange={(e) => {
                setReferenceNumber(e.target.value);
                setDuplicateWarning(null);
              }}
            />
          </div>
        </div>

        {/* Payment Proof Document Upload */}
        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Upload className="h-3.5 w-3.5 text-emerald-600" />
              <span>Attach Payment Proof (Optional)</span>
            </span>
            <span className="text-[10px] text-slate-400">PDF, PNG, JPG (Max 5MB)</span>
          </div>

          {!proofFileName ? (
            <label className="flex items-center justify-center p-3 rounded-lg border border-dashed border-slate-300 bg-white hover:bg-slate-50 cursor-pointer transition-colors text-slate-600">
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={handleFileUpload}
                className="hidden"
              />
              <span className="text-xs font-medium text-emerald-700 hover:underline">
                Upload bank transfer advice or receipt image
              </span>
            </label>
          ) : (
            <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-emerald-200 text-emerald-900">
              <div className="flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-emerald-600" />
                <span className="font-medium text-xs truncate max-w-[280px]">{proofFileName}</span>
              </div>
              <button
                type="button"
                onClick={handleRemoveProof}
                className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                title="Remove attachment"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <Textarea
            label="Internal Settlement Remarks"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Deposited into First Abu Dhabi Bank main treasury account..."
          />
        </div>
      </form>
    </Dialog>
  );
}
