'use client';

import React, { useState, useEffect } from 'react';
import { DollarSign, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Invoice } from '@/types/database';
import { db } from '@/lib/db/repository';
import { formatCurrency } from '@/lib/utils';

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
  const paymentMethods = db.getPaymentMethods();
  const allInvoices = db
    .getInvoices()
    .filter((i) => i.status !== 'CANCELLED' && i.status !== 'DRAFT' && i.balance_due > 0);

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(
    targetInvoice?.id || allInvoices[0]?.id || ''
  );

  const currentInvoice = db.getInvoiceById(selectedInvoiceId);

  const [amount, setAmount] = useState<number>(targetInvoice?.balance_due || currentInvoice?.balance_due || 0);
  const [paymentMethodId, setPaymentMethodId] = useState<string>(paymentMethods[0]?.id || '');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [showOverpayWarning, setShowOverpayWarning] = useState<boolean>(false);

  useEffect(() => {
    if (targetInvoice) {
      setSelectedInvoiceId(targetInvoice.id);
      setAmount(targetInvoice.balance_due);
    } else if (allInvoices[0]) {
      setSelectedInvoiceId(allInvoices[0].id);
      setAmount(allInvoices[0].balance_due);
    }
  }, [targetInvoice, open]);

  const handleInvoiceChange = (invId: string) => {
    setSelectedInvoiceId(invId);
    const inv = db.getInvoiceById(invId);
    if (inv) {
      setAmount(inv.balance_due);
    }
  };

  const handlePayAmountChange = (val: number) => {
    setAmount(val);
    if (currentInvoice && val > currentInvoice.balance_due) {
      setShowOverpayWarning(true);
    } else {
      setShowOverpayWarning(false);
    }
  };

  const handleSubmit = (overrideOverpay = false) => {
    if (!currentInvoice) {
      setError('Please select an invoice.');
      return;
    }
    const payAmt = Number(amount);
    if (isNaN(payAmt) || payAmt <= 0) {
      setError('Payment amount must be greater than zero.');
      return;
    }

    // Overpayment check
    if (payAmt > currentInvoice.balance_due && !overrideOverpay) {
      setShowOverpayWarning(true);
      setError(
        `Overpayment Warning: Entered amount (${formatCurrency(payAmt)}) exceeds balance due (${formatCurrency(
          currentInvoice.balance_due
        )}). Explicit confirmation required.`
      );
      return;
    }

    try {
      const payment = db.recordPayment({
        invoice_id: currentInvoice.id,
        payment_method_id: paymentMethodId,
        amount: payAmt > currentInvoice.balance_due ? currentInvoice.balance_due : payAmt,
        payment_date: paymentDate,
        reference_number: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      onSuccess(payment.id);
      onOpenChange(false);
    } catch (e: any) {
      setError(e.message || 'Failed to record payment');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Record Received Payment"
      description="Apply bank transfer, company cheque, or credit card receipt against outstanding invoice balance."
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-slate-500">
            Selected Invoice Balance:{' '}
            <strong className="text-rose-600 font-mono text-sm">
              {currentInvoice ? formatCurrency(currentInvoice.balance_due) : 'AED 0.00'}
            </strong>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="emerald" onClick={() => handleSubmit(false)}>
              Record Payment
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {showOverpayWarning && currentInvoice && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-800">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              <span>Overpayment Guard Warning</span>
            </div>
            <p>
              The entered amount of <strong>{formatCurrency(amount)}</strong> is higher than the invoice balance due of{' '}
              <strong>{formatCurrency(currentInvoice.balance_due)}</strong>.
            </p>
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs bg-white border-amber-300 text-amber-900"
                onClick={() => {
                  setAmount(currentInvoice.balance_due);
                  setShowOverpayWarning(false);
                  setError('');
                }}
              >
                Cap to Balance Due ({formatCurrency(currentInvoice.balance_due)})
              </Button>
            </div>
          </div>
        )}

        {/* Invoice Selector */}
        <Select
          label="Target Invoice to Settle *"
          value={selectedInvoiceId}
          onChange={(e) => handleInvoiceChange(e.target.value)}
          options={allInvoices.map((inv) => ({
            label: `${inv.invoice_number} • ${inv.customer_snapshot.company_name || inv.customer_snapshot.contact_person} (Balance: ${formatCurrency(inv.balance_due)})`,
            value: inv.id,
          }))}
        />

        {/* Amount & Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Payment Amount (AED) *"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => handlePayAmountChange(Number(e.target.value))}
          />
          <Input
            label="Receipt Date"
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />
        </div>

        {/* Method & Bank Reference */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Payment Method *"
            value={paymentMethodId}
            onChange={(e) => setPaymentMethodId(e.target.value)}
            options={paymentMethods.map((pm) => ({ label: pm.name, value: pm.id }))}
          />
          <Input
            label="Transaction Reference / Cheque No."
            placeholder="e.g. Wire Ref FT-FAB-9938 or Cheque 00192"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
          />
        </div>

        <Textarea
          label="Deposit Notes"
          placeholder="e.g. Deposited into FAB Corporate Account; clearance acknowledged."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>
    </Dialog>
  );
}
